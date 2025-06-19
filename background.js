// background.js (Version finale, complète et corrigée)

const VIEW_STATE_KEY = 'activeSplitViews';

// ... Fonctions getActiveViews, setActiveViews, updateContextMenu, getOptions, canBeIframed ...
// (Ces fonctions restent inchangées, je les omets pour la lisibilité)

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
 * Vérifie si une URL peut être chargée dans un iframe en inspectant les en-têtes de sécurité.
 * @param {string} url - L'URL à vérifier.
 * @returns {Promise<boolean>} `true` si l'URL peut être iframée, sinon `false`.
 */
async function canBeIframed(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        const csp = response.headers.get('content-security-policy') || '';
        if (csp.includes("frame-ancestors 'none'")) {
            return false;
        }
        const xfo = (response.headers.get('x-frame-options') || '').toLowerCase();
        if (xfo === 'deny' || xfo === 'sameorigin') {
            return false;
        }
        return true;
    } catch (e) {
        console.warn(`[Super Split View] Could not check headers for ${url}, assuming it can be iframed.`, e);
        return true; // Failsafe: assume it's allowed if the check fails.
    }
}


/**
 * Détermine le mode à utiliser et crée la vue partagée.
 * @param {Array<browser.tabs.Tab>} tabs - Les onglets à afficher.
 * @param {browser.windows.Window} sourceWindow - La fenêtre d'origine de l'action.
 */
async function createSplitView(tabs, sourceWindow) {
    const options = await getOptions();
    let effectiveMode = options.mode;
    let securityFallback = false;
    let reason = `User preference is '${options.mode}' mode.`;

    const forceWindowDomains = options.forceWindowDomains.split('\n').map(d => d.trim()).filter(Boolean);

    // Vérification 1: Un des domaines est-il dans la liste de forçage de l'utilisateur ?
    const forcedTab = tabs.find(tab => {
        try {
            const tabDomain = new URL(tab.url).hostname;
            return forceWindowDomains.some(domain => tabDomain.endsWith(domain));
        } catch (e) { return false; }
    });

    if (forcedTab) {
        effectiveMode = 'window';
        reason = `Forcing 'window' mode because a site (${new URL(forcedTab.url).hostname}) is in the user's force-list.`;
    } else if (options.mode === 'tab') {
        // Vérification 2: Si le mode préféré est 'onglet', un des sites a-t-il des en-têtes de sécurité ?
        for (const tab of tabs) {
            if (!await canBeIframed(tab.url)) {
                securityFallback = true;
                effectiveMode = 'window';
                reason = `Forcing 'window' mode due to security headers on ${tab.url}.`;
                break; // Pas besoin de vérifier les autres
            }
        }
    }

    console.log(`[Super Split View] Decision Log:
    - Initial preference: '${options.mode}'
    - Reason for mode choice: ${reason}
    - Final decision: Opening in '${effectiveMode}' mode.`);

    // Création de la vue en fonction du mode final
    if (effectiveMode === 'window') {
        createWindowView(tabs, sourceWindow);
        if (securityFallback && options.showFramingWarning) {
            browser.tabs.create({ url: 'dialog.html' });
        }
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
    // Correction pour le positionnement : Assurer que les valeurs 'left' et 'top' sont valides
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


// --- GESTIONNAIRES D'ÉVÉNEMENTS ---

// À l'installation ou la mise à jour
browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // Pré-remplir la liste des domaines à l'installation
        const defaultDomains = [
            'google.com',
            'facebook.com',
            'twitter.com',
            'instagram.com',
            'linkedin.com',
            'github.com',
            'addons.mozilla.org'
        ].join('\n');

        await browser.storage.local.set({
            forceWindowDomains: defaultDomains
        });

        browser.tabs.create({ url: 'welcome.html' });
    }
    setActiveViews({}); // Réinitialise l'état
    updateContextMenu();
});

// Clic sur l'icône de l'extension
browser.action.onClicked.addListener(async (tab) => {
    const tabs = await browser.tabs.query({ highlighted: true, windowId: tab.windowId });
    const sourceWindow = await browser.windows.get(tab.windowId, { populate: false });
    
    const webPageTabs = tabs.filter(t => t.url && t.url.startsWith('http'));

    if (webPageTabs.length < 2) {
        browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('icons/icon-48.png'),
            title: browser.i18n.getMessage('extensionName'),
            message: browser.i18n.getMessage('alertSelectTabs')
        });
        return;
    }
    createSplitView(webPageTabs, sourceWindow);
});


// ... Le reste des listeners (contextMenus, onMessage, onRemoved) reste inchangé ...
browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith('add-to-')) {
        const viewId = info.menuItemId.replace('add-to-', '');
        browser.runtime.sendMessage({
            type: 'ADD_TAB_TO_VIEW',
            viewId: viewId,
            tab: { url: tab.url, title: tab.title }
        });
    }
});

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

browser.tabs.onRemoved.addListener(async (tabId) => {
    const views = await getActiveViews();
    const viewIdToRemove = Object.keys(views).find(id => views[id].tabId === tabId);
    if (viewIdToRemove) {
        delete views[viewIdToRemove];
        await setActiveViews(views);
        updateContextMenu();
    }
});


// Initialisation au démarrage
updateContextMenu();