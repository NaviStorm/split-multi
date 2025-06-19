// Fichier : background.js

let splitViews = {};
let viewTabs = {};

// Fonction pour vérifier une URL et la modifier si elle bloque le framing
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
        // La requête HEAD peut échouer (ex: CORS), mais on continue.
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
    splitViews[viewId] = urls; // On stocke les URLs originales
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
            // Recharger la vue qui va redemander les URLs
            browser.tabs.reload(parseInt(viewTabId));
        }
    }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "getUrlsForView":
            // C'EST LA PARTIE CRUCIALE
            const originalUrls = splitViews[request.viewId] || [];
            // Pour chaque URL, on la vérifie et on la modifie si besoin
            Promise.all(originalUrls.map(url => getFinalUrl(url)))
                .then(finalUrls => {
                    sendResponse(finalUrls);
                });
            return true; // Indique une réponse asynchrone

        case "closeSplitView":
            const tabIdToClose = Object.keys(viewTabs).find(id => viewTabs[id] === request.viewId);
            if (tabIdToClose) {
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
            // Renvoie les URLs restantes pour que le front puisse recharger
            sendResponse(splitViews[viewId]);
            break;

        // On ajoute un nouveau cas pour la mise à jour depuis la barre d'adresse
        case "updateUrlsForView":
            if (splitViews[request.viewId]) {
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
        delete splitViews[viewId];
        delete viewTabs[tabId];
        browser.storage.local.remove(`viewName_${viewId}`);
    }
});

// Le webRequest onHeadersReceived est maintenant un FILET DE SÉCURITÉ
// au cas où la requête HEAD aurait échoué. Il assure que le contenu s'affiche.
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