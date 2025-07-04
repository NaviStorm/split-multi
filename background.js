// Fichier : background.js

let splitViews = {};
let viewTabs = {};
let existingTitles = new Set();

// ===== GESTION DE L'HISTORIQUE PERSONNALISÉ =====
const HISTORY_KEY = 'svd_history';
const MAX_HISTORY_ENTRIES = 500; // Limite pour ne pas saturer le stockage

async function getHistory() {
    const result = await browser.storage.local.get({ [HISTORY_KEY]: [] });
    return result[HISTORY_KEY];
}

async function addToHistory(entry) {
    // Ne pas enregistrer les entrées invalides ou les pages internes
    if (!entry || !entry.url || entry.url.startsWith('about:') || entry.url.startsWith('moz-extension:')) {
        return;
    }
    let history = await getHistory();
    // Retirer l'entrée existante si elle existe pour la remonter en haut de la liste
    const existingIndex = history.findIndex(item => item.url === entry.url);
    if (existingIndex > -1) {
        history.splice(existingIndex, 1);
    }
    // Ajoute la nouvelle entrée au début (plus récente)
    history.unshift({
        url: entry.url,
        title: entry.title || new URL(entry.url).hostname,
        timestamp: Date.now()
    });
    // Limite la taille de l'historique
    if (history.length > MAX_HISTORY_ENTRIES) {
        history = history.slice(0, MAX_HISTORY_ENTRIES);
    }
    await browser.storage.local.set({ [HISTORY_KEY]: history });
}
// =================================================

async function getFinalUrl(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        const xFrameOptions = response.headers.get('x-frame-options');
        const csp = response.headers.get('content-security-policy');
        const hasFrameAncestors = csp && csp.toLowerCase().includes('frame-ancestors');
        if (xFrameOptions || hasFrameAncestors) {
            const finalUrl = new URL(url);
            finalUrl.searchParams.set('svd_forced', 'true');
            finalUrl.searchParams.set('svd_domain', finalUrl.hostname);
            return finalUrl.href;
        }
    } catch (e) {
        console.warn(`HEAD request for ${url} failed, fallback to webRequest listener.`, e);
    }
    return url;
}

function createContextMenu() {
    browser.contextMenus.create({ id: "add-to-split-view", title: browser.i18n.getMessage("contextMenuTitle"), contexts: ["tab"] });
}

browser.runtime.onInstalled.addListener((details) => {
    createContextMenu();

    if (details.reason === "install") {
        browser.storage.local.set({
            operatingMode: 'tab',
            showFramingWarning: true,
            // ===== CORRECTION : Domaines par défaut =====
            forceWindowDomains: [
                'accounts.google.com',
                'facebook.com',
                'twitter.com',
                'linkedin.com',
                'github.com',
                'addons.mozilla.org',
                'www.paypal.com',
                'paypal.com'
            ]
        });

        browser.tabs.create({ url: 'welcome.html' });
    }
});

async function addTabToView(tabUrl, viewId, authorizedDomains) {
    if (splitViews[viewId] && splitViews[viewId].length >= 4) {
        browser.notifications.create({ type: 'basic', iconUrl: browser.runtime.getURL('icons/icon-48.png'), title: 'Super Split View', message: browser.i18n.getMessage('maxTabsAlert') });
        return;
    }
    if (splitViews[viewId]) {
        splitViews[viewId].push(tabUrl);
        const viewTabId = Object.keys(viewTabs).find(id => viewTabs[id] === viewId);
        if (viewTabId) {
            let newUrl = browser.runtime.getURL('split-view.html') + `?id=${viewId}`;
            if (authorizedDomains && authorizedDomains.length > 0) {
                newUrl += `&authorized=${encodeURIComponent(JSON.stringify(authorizedDomains))}`;
            }
            await browser.tabs.update(parseInt(viewTabId), { url: newUrl });
        }
    }
}

browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith("add-to-split-view-")) {
        const viewId = info.menuItemId.replace("add-to-split-view-", "");
        const viewTabId = Object.keys(viewTabs).find(id => viewTabs[id] === viewId);
        if (viewTabId) {
            browser.tabs.sendMessage(parseInt(viewTabId), { action: "getAuthorizedDomains" })
                .then(response => {
                    const domains = response ? response.authorizedDomains : [];
                    addTabToView(tab.url, viewId, domains);
                })
                .catch(e => {
                    console.warn("Could not get authorized domains from view, continuing without them.", e);
                    addTabToView(tab.url, viewId, []);
                });
        }
    }
});

browser.contextMenus.onShown.addListener(() => {
    browser.contextMenus.removeAll();
    createContextMenu();
    const activeViews = Object.keys(splitViews);
    if (activeViews.length > 0) {
        browser.contextMenus.update("add-to-split-view", { enabled: true });
        activeViews.forEach(viewId => {
            browser.storage.local.get(`viewName_${viewId}`).then(result => {
                const viewName = result[`viewName_${viewId}`] || `Split - ${viewId}`;
                browser.contextMenus.create({ id: `add-to-split-view-${viewId}`, parentId: "add-to-split-view", title: viewName, contexts: ["tab"] });
            });
        });
    } else {
        browser.contextMenus.update("add-to-split-view", { enabled: false });
    }
});

browser.browserAction.onClicked.addListener(async () => {
    const settings = await browser.storage.local.get({ operatingMode: 'tab' });
    const tabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    const selectedTabs = tabs.filter(t => t.url && !t.url.startsWith("about:") && !t.url.startsWith("moz-extension:"));
    if (selectedTabs.length < 2) {
        browser.tabs.executeScript({ code: `alert("${browser.i18n.getMessage('alertSelectTabs')}");` });
        return;
    }
    const urls = selectedTabs.map(t => t.url);
    if (settings.operatingMode === 'window') {
        console.log("Window Tiling Mode not implemented in this version.");
    } else {
        createSplitViewInTab(urls);
    }
});

async function createSplitViewInTab(urls) {
    const viewId = Date.now().toString();
    splitViews[viewId] = urls;

    let defaultTitle = urls.map(u => new URL(u).hostname.replace('www.', '')).join(' / ');
    let finalTitle = defaultTitle;
    let counter = 2;
    while (existingTitles.has(finalTitle)) {
        finalTitle = `${defaultTitle} (${counter})`;
        counter++;
    }
    existingTitles.add(finalTitle);

    await browser.storage.local.set({ [`viewName_${viewId}`]: finalTitle });

    const viewUrl = browser.runtime.getURL('split-view.html') + `?id=${viewId}`;
    const newTab = await browser.tabs.create({ url: viewUrl, active: true });
    viewTabs[newTab.id] = viewId;
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "getUrlsForView":
            const originalUrls = splitViews[request.viewId] || [];
            Promise.all(originalUrls.map(url => getFinalUrl(url))).then(sendResponse);
            return true;
        case "getFinalUrl":
            getFinalUrl(request.url).then(sendResponse);
            return true;
        case "closeSplitView":
            const tabIdToClose = Object.keys(viewTabs).find(id => viewTabs[id] === request.viewId);
            if (tabIdToClose) {
                browser.storage.local.get(`viewName_${request.viewId}`).then(result => {
                    if (result[`viewName_${request.viewId}`]) existingTitles.delete(result[`viewName_${request.viewId}`]);
                });
                delete splitViews[request.viewId];
                delete viewTabs[tabIdToClose];
                browser.storage.local.remove(`viewName_${request.viewId}`);
            }
            break;
        case "removePanelFromView":
            const { viewId, urlToRemove } = request;
            if (splitViews[viewId]) {
                const urlToRemoveBase = urlToRemove.split('?')[0];
                splitViews[viewId] = splitViews[viewId].filter(url => !url.startsWith(urlToRemoveBase));
            }
            sendResponse(splitViews[viewId]);
            break;
        case "updateUrlsForView":
             if(splitViews[request.viewId]) {
                splitViews[request.viewId] = request.urls;
             }
             sendResponse({});
             break;
        case "addToHistory":
            addToHistory(request.entry);
            break;
        case "getHistory":
            getHistory().then(sendResponse);
            return true;
    }
    return true;
});

browser.tabs.onRemoved.addListener((tabId) => {
    if (viewTabs[tabId]) {
        const viewId = viewTabs[tabId];
        browser.storage.local.get(`viewName_${viewId}`).then(result => {
            if (result[`viewName_${viewId}`]) existingTitles.delete(result[`viewName_${viewId}`]);
        });
        delete splitViews[viewId];
        delete viewTabs[tabId];
        browser.storage.local.remove(`viewName_${viewId}`);
    }
});

browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.type !== "sub_frame") return;
        const responseHeaders = details.responseHeaders.filter(h => h.name.toLowerCase() !== "x-frame-options" && h.name.toLowerCase() !== "content-security-policy");
        return { responseHeaders };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders"]
);