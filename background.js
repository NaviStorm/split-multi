// Fichier: background.js (Version finale avec incrémentation des noms de vue)

const MAX_TABS = 4;
const PARENT_MENU_ID = "add-to-split-view-parent";

// --- Fonctions de gestion de l'état ---
async function getSplitViews() {
    let { splitViews } = await browser.storage.local.get({ splitViews: [] });
    return splitViews;
}
async function setSplitViews(views) {
    await browser.storage.local.set({ splitViews: views });
    await updateContextMenu();
}

// --- GESTION DU MENU CONTEXTUEL ---
async function updateContextMenu() {
    await browser.contextMenus.removeAll();
    const views = await getSplitViews();
    browser.contextMenus.create({
        id: PARENT_MENU_ID,
        title: browser.i18n.getMessage("contextMenuTitle"),
        contexts: ["tab"],
        enabled: views.length > 0
    });
    if (views.length > 0) {
        views.forEach(view => {
            browser.contextMenus.create({
                id: `add-to-view-${view.id}`,
                parentId: PARENT_MENU_ID,
                title: view.name,
                contexts: ["tab"]
            });
        });
    }
}

// --- ÉCOUTEURS D'ÉVÉNEMENTS ---
browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        browser.tabs.create({ url: browser.runtime.getURL("welcome.html") });
    }
    await setSplitViews([]);
});

browser.runtime.onMessage.addListener(async (message) => {
    if (message.command === 'rename-view') {
        let views = await getSplitViews();
        const viewToUpdate = views.find(v => v.id === message.id);
        if (viewToUpdate && viewToUpdate.name !== message.newName) {
            // Logique de vérification de nom unique lors du renommage
            let finalName = message.newName;
            let counter = 2;
            const otherViews = views.filter(v => v.id !== message.id);
            while (otherViews.some(v => v.name === finalName)) {
                finalName = `${message.newName} (${counter})`;
                counter++;
            }
            viewToUpdate.name = finalName;
            await setSplitViews(views);
            // On doit recréer la vue pour que le nom soit mis à jour dans son URL
            recreateTabMode(viewToUpdate.urls, viewToUpdate.id, finalName);
        }
    }
    if (message.command === 'close-view') { try { await browser.tabs.remove(message.id); } catch (e) {} }
    if (message.command === 'remove-panel') {
        let views = await getSplitViews();
        const viewToUpdate = views.find(v => v.id === message.viewId);
        if (viewToUpdate) {
            const panelIndex = viewToUpdate.urls.indexOf(message.panelUrl);
            if (panelIndex > -1) { viewToUpdate.urls.splice(panelIndex, 1); }
            if (viewToUpdate.urls.length < 2) {
                try { await browser.tabs.remove(viewToUpdate.id); } catch(e) {}
            } else {
                recreateTabMode(viewToUpdate.urls, viewToUpdate.id, viewToUpdate.name);
            }
        }
    }
});

browser.tabs.onRemoved.addListener(async (tabId) => {
    let views = await getSplitViews();
    const initialLength = views.length;
    views = views.filter(v => v.id !== tabId);
    if (views.length !== initialLength) { await setSplitViews(views); }
});

// --- GESTION DES CLICS UTILISATEUR ---
browser.contextMenus.onClicked.addListener(async (info, tabToAdd) => {
    if (info.parentMenuItemId !== PARENT_MENU_ID) return;
    if (tabToAdd.url.startsWith(browser.runtime.getURL(""))) return;
    const targetViewId = parseInt(info.menuItemId.replace('add-to-view-', ''), 10);
    let views = await getSplitViews();
    const targetView = views.find(v => v.id === targetViewId);
    if (targetView) {
        if (targetView.urls.length >= MAX_TABS) { notifyUser("maxTabsAlert"); return; }
        targetView.urls.push(tabToAdd.url);
        recreateTabMode(targetView.urls, targetView.id, targetView.name);
    }
});

browser.browserAction.onClicked.addListener(async () => {
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    const tabsToProcess = selectedTabs.filter(t => !t.url.startsWith('about:') && !t.url.startsWith(browser.runtime.getURL(""))).slice(0, MAX_TABS);
    if (tabsToProcess.length < 2) { notifyUser("alertSelectTabs"); return; }

    const settings = await browser.storage.local.get({ mode: 'tab' });
    if (settings.mode === 'window') {
        executeWindowMode(tabsToProcess);
    } else {
        recreateTabMode(tabsToProcess.map(t => ({url: t.url, title: t.title})));
    }
});

// --- FONCTIONS PRINCIPALES ---
async function recreateTabMode(tabsOrUrls, oldTabId = null, name = null) {
    const urls = tabsOrUrls.map(item => typeof item === 'string' ? item : item.url);
    let viewName;

    if (name) {
        viewName = name;
    } else {
        const titles = tabsOrUrls.map(t => t.title.split(/\||–|-/)[0].trim());
        viewName = titles.slice(0, 2).join(' / ');
        if (tabsOrUrls.length > 2) {
            viewName += ` (+${tabsOrUrls.length - 2})`;
        }
    }
    
    // --- DÉBUT DE LA NOUVELLE LOGIQUE D'INCRÉMENTATION ---
    let finalName = viewName;
    let counter = 2;
    const existingViews = await getSplitViews();
    const otherViews = existingViews.filter(v => v.id !== oldTabId); // On ne se compare pas à soi-même lors d'une mise à jour

    // Tant qu'un nom identique existe dans les autres vues, on incrémente
    while (otherViews.some(v => v.name === finalName)) {
        finalName = `${viewName} (${counter})`;
        counter++;
    }
    // --- FIN DE LA NOUVELLE LOGIQUE D'INCRÉMENTATION ---
    
    if (oldTabId) {
        try { await browser.tabs.remove(oldTabId); } catch (e) {}
    }

    const urlsToLoad = urls.map(url => encodeURIComponent(url));
    const urlParams = new URLSearchParams();
    urlParams.append('tabs', urlsToLoad.join(','));
    urlParams.append('name', encodeURIComponent(finalName));

    const newTab = await browser.tabs.create({ url: 'about:blank', active: true });
    urlParams.append('id', newTab.id);

    const splitViewUrl = browser.runtime.getURL("split-view.html") + "?" + urlParams.toString();
    await browser.tabs.update(newTab.id, { url: splitViewUrl });

    let views = await getSplitViews();
    views = views.filter(v => v.id !== oldTabId);
    views.push({ id: newTab.id, name: finalName, urls: urls });
    await setSplitViews(views);
}

// --- Fonctions de support ---
function notifyUser(messageKey) {
    browser.notifications.create({
        "type": "basic",
        "iconUrl": browser.runtime.getURL("icon-96.png"),
        "title": browser.i18n.getMessage("extensionName"),
        "message": browser.i18n.getMessage(messageKey)
    });
}
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const modifiedHeaders = details.responseHeaders.filter(header => {
      const headerName = header.name.toLowerCase();
      return headerName !== 'x-frame-options' && headerName !== 'content-security-policy';
    });
    return { responseHeaders: modifiedHeaders };
  }, { urls: ["<all_urls>"], types: ["sub_frame"] }, ["blocking", "responseHeaders"]
);
async function executeWindowMode(tabs) {
  const numWindows = tabs.length;
  try {
    const currentWindow = await browser.windows.getCurrent();
    const areaWidth = currentWindow.width, areaHeight = currentWindow.height, areaLeft = currentWindow.left, areaTop = currentWindow.top;
    const panelWidth = Math.floor(areaWidth / numWindows);
    const creationPromises = tabs.map(tab => browser.windows.create({ url: tab.url, type: 'normal' }));
    const createdWindows = await Promise.all(creationPromises);
    const updatePromises = createdWindows.map((win, i) => {
      const newLeft = areaLeft + (i * panelWidth);
      return browser.windows.update(win.id, { left: newLeft, top: areaTop, width: panelWidth, height: areaHeight, state: "normal" });
    });
    await Promise.all(updatePromises);
    await browser.windows.update(currentWindow.id, { state: 'minimized' });
  } catch (error) { console.error("Erreur en mode fenêtre :", error); }
}