// background.js (Version finale et stable)

const VIEW_STATE_KEY = 'activeSplitViews';

/**
 * Récupère les vues actives depuis le stockage de session.
 * @returns {Promise<Object>} Un objet contenant les vues actives.
 */
async function getActiveViews() {
    const result = await browser.storage.session.get(VIEW_STATE_KEY);
    return result[VIEW_STATE_KEY] || {};
}

/**
 * Sauvegarde les vues actives dans le stockage de session.
 * @param {Object} views - L'objet des vues actives à sauvegarder.
 */
async function setActiveViews(views) {
    await browser.storage.session.set({ [VIEW_STATE_KEY]: views });
}

/**
 * Met à jour le menu contextuel pour refléter les vues actives.
 */
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

/**
 * Récupère les options de l'utilisateur depuis le stockage local.
 * @returns {Promise<Object>} Les options de l'utilisateur.
 */
async function getOptions() {
    const defaults = {
        mode: 'window',
        showFramingWarning: true,
        forceWindowDomains: ''
    };
    return browser.storage.local.get(defaults);
}

/**
 * Détermine le mode à utiliser et crée la vue partagée.
 * @param {Array<browser.tabs.Tab>} tabs - Les onglets à afficher.
 * @param {browser.windows.Window} sourceWindow - La fenêtre d'origine de l'action.
 */
async function createSplitView(tabs, sourceWindow) {
    const options = await getOptions();
    if (options.mode === 'window') {
        createWindowView(tabs, sourceWindow);
    } else {
        createTabView(tabs);
    }
}

/**
 * Crée une vue partagée dans un nouvel onglet avec des iframes.
 * @param {Array<browser.tabs.Tab>} tabs - Les onglets à afficher.
 */
function createTabView(tabs) {
    const urls = tabs.map(tab => encodeURIComponent(tab.url)).join(',');
    const viewId = `split-${Date.now()}`;
    browser.tabs.create({
        url: `split-view.html?urls=${urls}&viewId=${viewId}`
    });
}

/**
 * Crée une vue partagée en créant et en agençant de nouvelles fenêtres.
 * @param {Array<browser.tabs.Tab>} tabs - Les onglets à afficher.
 * @param {browser.windows.Window} sourceWindow - La fenêtre de référence pour le positionnement.
 */
async function createWindowView(tabs, sourceWindow) {
    const winLeft = sourceWindow.left ?? 0;
    const winTop = sourceWindow.top ?? 0;
    const winWidth = Math.floor(sourceWindow.width / tabs.length);

    for (let i = 0; i < tabs.length; i++) {
        await browser.windows.create({
            url: tabs[i].url,
            type: 'normal',
            width: winWidth,
            height: sourceWindow.height,
            left: winLeft + (i * winWidth),
            top: winTop
        });
    }
}


// --- GESTIONNAIRES D'ÉVÉNEMENTS WEB REQUEST (Logique de forçage) ---

const requestHeadersToRemove = new Set(['sec-fetch-dest']);

// 1. Modifier les en-têtes de la REQUÊTE sortante pour masquer notre intention
browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (details.type !== 'sub_frame') return;
        const initiator = details.originUrl || details.initiator;
        if (!initiator || !initiator.startsWith(browser.runtime.getURL(''))) return;

        const requestHeaders = details.requestHeaders.filter(header => {
            return !requestHeadersToRemove.has(header.name.toLowerCase());
        });

        return { requestHeaders };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);


// --- GESTIONNAIRES D'ÉVÉNEMENTS WEB REQUEST (Logique de forçage) ---
browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.type !== 'sub_frame') return;
        try {
            const initiator = new URL(details.originUrl || details.initiator);
            if (!initiator.protocol.startsWith('moz-extension')) return;
        } catch(e) { return; }

        let headersModified = false;
        const responseHeaders = details.responseHeaders.filter(header => {
            const headerName = header.name.toLowerCase();
            if (headerName === 'x-frame-options' || headerName === 'content-security-policy') {
                headersModified = true;
                return false;
            }
            return true;
        });

        if (headersModified) {
            browser.tabs.sendMessage(details.tabId, {
                type: 'FRAME_FORCED',
                url: details.url
            }).catch(e => console.log(`Could not send FRAME_FORCED message: ${e.message}`));
            return { responseHeaders };
        }
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders"]
);


// --- AUTRES GESTIONNAIRES D'ÉVÉNEMENTS ---
browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        const defaultDomains = [
            'accounts.google.com',
            'facebook.com',
            'twitter.com',
            'linkedin.com',
            'github.com',
            'addons.mozilla.org',
            'www.paypal.com',
            'paypal.com'
        ].join('\n');
        await browser.storage.local.set({ forceWindowDomains: defaultDomains });
        browser.tabs.create({ url: 'welcome.html' });
    }
    await setActiveViews({});
    updateContextMenu();
});

browser.action.onClicked.addListener(async (tab) => {
    const tabs = await browser.tabs.query({ highlighted: true, windowId: tab.windowId });
    const sourceWindow = await browser.windows.get(tab.windowId, { populate: false });
    
    const webPageTabs = tabs.filter(t => t.url && t.url.startsWith('http'));

    if (webPageTabs.length < 2) {
        browser.notifications.create({
            type: 'basic', iconUrl: browser.runtime.getURL('icons/icon-48.png'),
            title: browser.i18n.getMessage('extensionName'), message: browser.i18n.getMessage('alertSelectTabs')
        });
        return;
    }
    createSplitView(webPageTabs, sourceWindow);
});


browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith('add-to-')) {
        browser.runtime.sendMessage({
            type: 'ADD_TAB_TO_VIEW', viewId: info.menuItemId.replace('add-to-', ''),
            tab: { url: tab.url, title: tab.title }
        });
    }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
    switch (message.type) {
        // NOUVEAU : Le seul point de contact avec la sécurité des iframes
        case 'CHECK_FRAME_PROTECTION':
            try {
                // D'abord, vérifier la liste de l'utilisateur
                const options = await getOptions();
                const forceWindowDomains = options.forceWindowDomains.split('\n').map(d => d.trim()).filter(Boolean);
                const url = new URL(message.url);
                if (forceWindowDomains.some(domain => url.hostname.endsWith(domain))) {
                    return { protected: true, reason: 'user_list' };
                }

                // Ensuite, vérifier les en-têtes en direct
                const response = await fetch(message.url, { method: 'HEAD', cache: 'no-cache' });
                const csp = response.headers.get('content-security-policy') || '';
                const xfo = (response.headers.get('x-frame-options') || '').toLowerCase();
                
                if (csp.includes("frame-ancestors") || xfo === 'deny' || xfo === 'sameorigin') {
                    return { protected: true, reason: 'headers' };
                }
                return { protected: false };
            } catch (e) {
                return { protected: false }; // En cas d'erreur, on suppose que c'est ok
            }

        // NOUVEAU : Pour ouvrir un onglet bloqué dans une nouvelle fenêtre
        case 'OPEN_IN_NEW_WINDOW':
            if (message.url) {
                browser.windows.create({ url: message.url });
            }
            break;

        // ... (autres handlers: REGISTER_VIEW, etc. inchangés) ...
    }
    // Rendre la réponse asynchrone possible
    return true;
});

browser.tabs.onRemoved.addListener(async (tabId) => {
    const views = await getActiveViews();
    const viewIdToRemove = Object.keys(views).find(id => views[id].tabId === tabId);
    if (viewIdToRemove) {
        delete views[viewIdToRemove];
        await setActiveViews(views);
        updateContextMenu();
    }
});

updateContextMenu();