// background.js (MV3 Compliant)

// --- State Management ---
// MV3 background scripts are non-persistent. We use browser.storage.session
// to store the state of active split views. This storage is cleared when the browser closes.
const VIEW_STATE_KEY = 'activeSplitViews';

async function getActiveViews() {
    const result = await browser.storage.session.get(VIEW_STATE_KEY);
    return result[VIEW_STATE_KEY] || {};
}

async function setActiveViews(views) {
    await browser.storage.session.set({ [VIEW_STATE_KEY]: views });
}

// --- Context Menu ---
async function updateContextMenu() {
    await browser.contextMenus.removeAll();
    const views = await getActiveViews();
    const viewIds = Object.keys(views);

    if (viewIds.length > 0) {
        browser.contextMenus.create({
            id: 'add-to-split-view-parent',
            title: browser.i18n.getMessage('contextMenuTitle'),
            contexts: ['tab']
        });

        for (const viewId of viewIds) {
            const view = views[viewId];
            browser.contextMenus.create({
                id: `add-to-${viewId}`,
                parentId: 'add-to-split-view-parent',
                title: view.name,
                contexts: ['tab']
            });
        }
    }
}

// --- Core Logic ---
async function getOptions() {
    const defaults = {
        mode: 'window',
        showFramingWarning: true,
        forceWindowDomains: ''
    };
    return browser.storage.local.get(defaults);
}

// Checks if a URL is likely to block iframe embedding.
async function canBeIframed(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        const csp = response.headers.get('content-security-policy');
        if (csp) {
            const frameAncestors = csp.split(';').find(policy => policy.trim().startsWith('frame-ancestors'));
            if (frameAncestors && frameAncestors.includes("'none'")) {
                return false; // Explicitly forbidden
            }
        }
        const xfo = response.headers.get('x-frame-options');
        if (xfo && (xfo.toLowerCase() === 'deny' || xfo.toLowerCase() === 'sameorigin')) {
            return false;
        }
        return true;
    } catch (e) {
        console.warn(`Could not check headers for ${url}:`, e);
        return true; // Assume it can be iframed if the check fails
    }
}

async function createSplitView(tabs) {
    const options = await getOptions();
    let effectiveMode = options.mode;

    const forceWindowDomains = options.forceWindowDomains.split('\n').map(d => d.trim()).filter(Boolean);
    let forceWindow = false;
    let securityFallback = false;

    for (const tab of tabs) {
        const tabDomain = new URL(tab.url).hostname;
        if (forceWindowDomains.some(domain => tabDomain.endsWith(domain))) {
            forceWindow = true;
            break;
        }
        if (options.mode === 'tab') {
            if (!await canBeIframed(tab.url)) {
                securityFallback = true;
                forceWindow = true;
                break;
            }
        }
    }

    if (forceWindow) {
        effectiveMode = 'window';
    }

    if (effectiveMode === 'window') {
        createWindowView(tabs);
        if (securityFallback && options.showFramingWarning) {
             browser.tabs.create({ url: 'dialog.html' });
        }
    } else {
        createTabView(tabs);
    }
}

function createTabView(tabs) {
    const urls = tabs.map(tab => encodeURIComponent(tab.url)).join(',');
    const viewId = `split-${Date.now()}`;
    browser.tabs.create({
        url: `split-view.html?urls=${urls}&viewId=${viewId}`
    });
}

async function createWindowView(tabs) {
    const totalWidth = screen.width;
    const totalHeight = screen.height;
    const winWidth = Math.floor(totalWidth / tabs.length);

    for (let i = 0; i < tabs.length; i++) {
        await browser.windows.create({
            url: tabs[i].url,
            type: 'normal',
            width: winWidth,
            height: totalHeight,
            left: i * winWidth,
            top: 0
        });
    }
}


// --- Event Listeners ---

// On Install/Update
browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        browser.tabs.create({ url: 'welcome.html' });
    }
    await setActiveViews({}); // Clean slate on install/update
    updateContextMenu();
});

// Browser Action Click
browser.action.onClicked.addListener(async () => {
    const tabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    const webPageTabs = tabs.filter(tab => tab.url && tab.url.startsWith('http'));

    if (webPageTabs.length < 2) {
        browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('icons/icon-48.png'),
            title: browser.i18n.getMessage('extensionName'),
            message: browser.i18n.getMessage('alertSelectTabs')
        });
        return;
    }
    createSplitView(webPageTabs);
});

// Context Menu Click
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId.startsWith('add-to-')) {
        const viewId = info.menuItemId.replace('add-to-', '');
        browser.runtime.sendMessage({
            type: 'ADD_TAB_TO_VIEW',
            viewId: viewId,
            tab: { url: tab.url, title: tab.title }
        });
    }
});


// Message Listener from UI scripts
browser.runtime.onMessage.addListener(async (message, sender) => {
    switch (message.type) {
        case 'REGISTER_VIEW': {
            const views = await getActiveViews();
            views[message.viewId] = {
                name: message.name,
                tabId: sender.tab.id,
                urls: message.urls
            };
            await setActiveViews(views);
            updateContextMenu();
            break;
        }
        case 'UNREGISTER_VIEW': {
            const views = await getActiveViews();
            delete views[message.viewId];
            await setActiveViews(views);
            updateContextMenu();
            break;
        }
        case 'UPDATE_VIEW_NAME': {
            const views = await getActiveViews();
            if (views[message.viewId]) {
                views[message.viewId].name = message.newName;
                await setActiveViews(views);
                updateContextMenu();
            }
            break;
        }
        case 'OPEN_WELCOME_PAGE':
             browser.tabs.create({ url: browser.runtime.getURL("welcome.html") });
             break;
        case 'OPEN_OPTIONS_PAGE':
             browser.runtime.openOptionsPage();
             break;
    }
});

// Clean up storage when a split view tab is closed
browser.tabs.onRemoved.addListener(async (tabId) => {
    const views = await getActiveViews();
    const viewIdToRemove = Object.keys(views).find(id => views[id].tabId === tabId);
    if (viewIdToRemove) {
        delete views[viewIdToRemove];
        await setActiveViews(views);
        updateContextMenu();
    }
});

// Initial setup
updateContextMenu();