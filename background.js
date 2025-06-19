// Fichier : background.js

let splitViews = {};
let viewTabs = {};
let existingTitles = new Set(); // Garde en mémoire les titres pour éviter les doublons

// Fonction pour vérifier une URL et la modifier si elle bloque le framing
async function getFinalUrl(url) {
    try {
        // La requête HEAD est rapide et ne télécharge pas le corps de la page
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
        // La requête HEAD peut échouer (ex: CORS), mais ce n'est pas grave.
        // Le webRequest onHeadersReceived servira de filet de sécurité.
    }
    return url; // Retourne l'URL originale si pas de blocage détecté
}

function createContextMenu() {
    browser.contextMenus.create({ id: "add-to-split-view", title: browser.i18n.getMessage("contextMenuTitle"), contexts: ["tab"] });
}

browser.runtime.onInstalled.addListener(() => {
    createContextMenu();
    browser.storage.local.get('hasSeenWelcome').then(r => { if (!r.hasSeenWelcome) { browser.tabs.create({ url: 'welcome.html' }); browser.storage.local.set({ hasSeenWelcome: true }); } });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith("add-to-split-view-")) {
        addTabToView(tab, info.menuItemId.replace("add-to-split-view-", ""));
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
    const tabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    const selectedTabs = tabs.filter(t => t.url && !t.url.startsWith("about:") && !t.url.startsWith("moz-extension:"));
    if (selectedTabs.length < 2) {
        browser.tabs.executeScript({ code: `alert("${browser.i18n.getMessage('alertSelectTabs')}");` });
        return;
    }
    createSplitView(selectedTabs.map(t => t.url));
});

async function createSplitView(urls) {
    const viewId = Date.now().toString();
    splitViews[viewId] = urls;

    // Logique de création du titre par défaut
    let defaultTitle = urls.map(u => new URL(u).hostname.replace('www.', '')).join(' / ');
    let finalTitle = defaultTitle;
    let counter = 2;
    while (existingTitles.has(finalTitle)) {
        finalTitle = `${defaultTitle} (${counter})`;
        counter++;
    }
    existingTitles.add(finalTitle);

    // Stocker le titre pour que split-view.js puisse le récupérer
    await browser.storage.local.set({ [`viewName_${viewId}`]: finalTitle });

    const viewUrl = browser.runtime.getURL('split-view.html') + `?id=${viewId}`;
    const newTab = await browser.tabs.create({ url: viewUrl, active: true });
    viewTabs[newTab.id] = viewId;
}

async function addTabToView(tab, viewId) {
    if (splitViews[viewId] && splitViews[viewId].length >= 4) {
        browser.notifications.create({ type: 'basic', iconUrl: browser.runtime.getURL('icons/icon-48.png'), title: 'Super Split View', message: browser.i18n.getMessage('maxTabsAlert') });
        return;
    }
    if (splitViews[viewId]) {
        splitViews[viewId].push(tab.url);
        const viewTabId = Object.keys(viewTabs).find(id => viewTabs[id] === viewId);
        if (viewTabId) {
            browser.tabs.reload(parseInt(viewTabId));
        }
    }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "getUrlsForView":
            const originalUrls = splitViews[request.viewId] || [];
            Promise.all(originalUrls.map(url => getFinalUrl(url))).then(sendResponse);
            return true;

        case "getFinalUrl": // Nouveau cas pour la vérification à la volée
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

// Filet de sécurité pour garantir l'affichage du contenu forcé
browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.type !== "sub_frame") return;
        
        const responseHeaders = details.responseHeaders.filter(
            (header) => {
                const name = header.name.toLowerCase();
                return name !== "x-frame-options" && name !== "content-security-policy";
            }
        );
        return { responseHeaders };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders"]
);