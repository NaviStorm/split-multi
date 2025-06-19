// Fichier : background.js (Version finale complète et corrigée)

// --- Initialisation ---
browser.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install') {
        browser.tabs.create({ url: 'welcome.html' });
    }
    createContextMenu();
});

let activeSplitViews = {};

// --- Fonctions utilitaires ---
function shouldForceWindowMode(tabUrls, forceDomainsSetting) {
    if (!forceDomainsSetting) return false;
    const forceDomains = forceDomainsSetting.split('\n').map(d => d.trim().toLowerCase()).filter(d => d);
    if (forceDomains.length === 0) return false;
    return tabUrls.some(url => {
        try {
            const hostname = new URL(url).hostname.replace(/^www\./, '');
            return forceDomains.some(forcedDomain => hostname === forcedDomain || hostname.endsWith('.' + forcedDomain));
        } catch (e) { return false; }
    });
}

// --- Fonctions de création de vue ---
function createTabView(urls) {
    const hostnames = urls.map(url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'invalid-url'; } });
    const viewTitle = hostnames.join(' / ');
    const viewUrl = browser.runtime.getURL('split-view.html') + '?urls=' + encodeURIComponent(JSON.stringify(urls)) + '&title=' + encodeURIComponent(viewTitle);
    browser.tabs.create({ url: viewUrl }).then(tab => {
        const initialName = `Split - ${tab.id}`;
        activeSplitViews[tab.id] = { name: initialName, urls: urls };
        updateContextMenu();
    });
}

async function createWindowsView(tabs) {
    const originalWindow = await browser.windows.getCurrent();
    const startLeft = originalWindow.left ?? 0;
    const startTop = originalWindow.top ?? 0;
    const availableWidth = originalWindow.width;
    const availableHeight = originalWindow.height;
    const windowWidth = Math.floor(availableWidth / tabs.length);
    const originalTabIds = tabs.map(t => t.id);

    for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        const newLeft = startLeft + (i * windowWidth);
        const newWindow = await browser.windows.create({ url: tab.url });
        await browser.windows.update(newWindow.id, {
            left: newLeft,
            top: startTop,
            width: windowWidth,
            height: availableHeight,
            state: "normal"
        });
    }
    try {
        await browser.tabs.remove(originalTabIds);
    } catch (e) {
        console.warn("Could not remove original tabs.", e);
    }
}

// --- Écouteurs principaux ---
browser.browserAction.onClicked.addListener(async () => {
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    const validTabs = selectedTabs.filter(tab => tab.url && !tab.url.startsWith('about:'));
    if (validTabs.length < 2) {
        browser.notifications.create({ type: 'basic', iconUrl: browser.runtime.getURL('icons/icon-48.png'), title: browser.i18n.getMessage('extensionName'), message: browser.i18n.getMessage('alertSelectTabs') });
        return;
    }
    const urls = validTabs.map(tab => tab.url);
    const settings = await browser.storage.local.get({ mode: 'window', forceWindowDomains: '' });
    const forceWindow = shouldForceWindowMode(urls, settings.forceWindowDomains);
    if (settings.mode === 'tab' && !forceWindow) { createTabView(urls); } else { createWindowsView(validTabs); }
});

browser.webRequest.onHeadersReceived.addListener(
    details => ({ responseHeaders: details.responseHeaders.filter(h => !['x-frame-options', 'content-security-policy'].includes(h.name.toLowerCase())) }),
    { urls: ["<all_urls>"], types: ["sub_frame"] },
    ["blocking", "responseHeaders"]
);

// --- Menu Contextuel et gestion des messages ---
function createContextMenu() { browser.contextMenus.create({ id: "add-to-split-view-parent", title: browser.i18n.getMessage("contextMenuTitle"), contexts: ["tab"], enabled: false }); }
function updateContextMenu() {
    browser.contextMenus.removeAll().then(() => {
        createContextMenu();
        const viewEntries = Object.entries(activeSplitViews);
        if (viewEntries.length > 0) {
            browser.contextMenus.update("add-to-split-view-parent", { enabled: true });
            viewEntries.forEach(([tabId, view]) => { browser.contextMenus.create({ id: `add-to-${tabId}`, parentId: "add-to-split-view-parent", title: view.name, contexts: ["tab"] }); });
        }
    });
}
browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith('add-to-')) {
        const targetTabId = parseInt(info.menuItemId.replace('add-to-', ''), 10);
        if (activeSplitViews[targetTabId]) { browser.tabs.sendMessage(targetTabId, { action: 'addTab', url: tab.url }).catch(err => console.error("Could not send message to split view tab:", err)); }
    }
});
browser.tabs.onRemoved.addListener(tabId => { if (activeSplitViews[tabId]) { delete activeSplitViews[tabId]; updateContextMenu(); } });
browser.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'updateViewInfo') {
        const tabId = sender.tab.id;
        if (activeSplitViews[tabId]) {
            if (message.name) activeSplitViews[tabId].name = message.name;
            if (message.urls) activeSplitViews[tabId].urls = message.urls;
            updateContextMenu();
        }
    }
});