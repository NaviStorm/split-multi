/*
 * Fichier: background.js
 * Rôle: Script principal de l'extension. Gère la logique de création des vues,
 * la communication entre les composants, le menu contextuel et les options.
 */

'use strict';

// --- Stockage en mémoire des vues partagées actives (mode onglet uniquement) ---
// La clé est l'ID de l'onglet, la valeur est un objet { id, name }
const activeSplitViews = new Map();


// =================================================================================
// FONCTIONS DE CRÉATION DES VUES
// =================================================================================

/**
 * Crée une vue partagée dans un nouvel onglet en utilisant des iframes.
 * @param {browser.tabs.Tab[]} tabs - Les onglets à inclure dans la vue.
 */
async function createSplitViewInTab(tabs) {
    const urls = tabs.map(tab => tab.url);
    const encodedUrls = urls.map(url => encodeURIComponent(url));
    const viewUrl = browser.runtime.getURL('split-view.html') + '#urls=' + encodedUrls.join(',');

    try {
        const newTab = await browser.tabs.create({ url: viewUrl, active: true });
        
        // La vue s'enregistrera elle-même via un message, mais on peut préparer son entrée
        // La vue enverra son nom par défaut peu après son chargement.
        console.log(`Split View tab created with ID: ${newTab.id}`);
    } catch (error) {
        console.error("Error creating split view tab:", error);
    }
}

/**
 * Crée une vue partagée en créant et en réorganisant de nouvelles fenêtres.
 * @param {browser.tabs.Tab[]} tabs - Les onglets à déplacer dans les nouvelles fenêtres.
 */
async function createSplitViewInWindows(tabs) {
    try {
        const displayInfo = (await browser.windows.getAll({ windowTypes: ['normal'] }))[0];
        if (!displayInfo || !displayInfo.width || !displayInfo.height) {
             console.error("Could not get display info.");
             // Fallback or alert the user
             return;
        }

        const screenWidth = displayInfo.width;
        const screenHeight = displayInfo.height;
        const screenTop = displayInfo.top || 0;
        const screenLeft = displayInfo.left || 0;
        
        const numTabs = tabs.length;
        const windowWidth = Math.floor(screenWidth / numTabs);

        for (let i = 0; i < numTabs; i++) {
            const tab = tabs[i];
            const newWindow = await browser.windows.create({
                tabId: tab.id,
                type: 'normal',
                width: windowWidth,
                height: screenHeight,
                left: screenLeft + i * windowWidth,
                top: screenTop
            });
            // Assurer que la taille et la position sont correctes après création
            await browser.windows.update(newWindow.id, {
                 width: windowWidth,
                 height: screenHeight,
                 left: screenLeft + i * windowWidth,
                 top: screenTop
            });
        }
    } catch (error) {
        console.error("Error creating tiled windows:", error);
    }
}


// =================================================================================
// LOGIQUE DE DÉTECTION "X-FRAME-OPTIONS"
// =================================================================================

/**
 * Vérifie si une URL peut être chargée dans un iframe en inspectant ses en-têtes HTTP.
 * @param {string} url - L'URL à vérifier.
 * @returns {Promise<boolean>} - Promesse qui se résout à `true` si l'URL peut être iframée, `false` sinon.
 */
function checkUrlForFraming(url) {
    // Les pages internes du navigateur n'ont pas d'en-têtes HTTP de cette manière, on les autorise.
    if (!url || !url.startsWith('http')) {
        return Promise.resolve(true);
    }

    return new Promise(resolve => {
        const listener = (details) => {
            browser.webRequest.onHeadersReceived.removeListener(listener);

            let canBeFramed = true;
            if (details.responseHeaders) {
                for (const header of details.responseHeaders) {
                    const name = header.name.toLowerCase();
                    const value = header.value.toLowerCase();

                    // Règle restrictive X-Frame-Options
                    if (name === 'x-frame-options' && (value === 'deny' || value === 'sameorigin')) {
                        canBeFramed = false;
                        break;
                    }

                    // Règle restrictive Content-Security-Policy (CSP)
                    if (name === 'content-security-policy' && (value.includes("frame-ancestors 'none'") || value.includes("frame-ancestors 'self'"))) {
                         canBeFramed = false;
                         break;
                    }
                }
            }
            resolve(canBeFramed);
        };

        browser.webRequest.onHeadersReceived.addListener(
            listener,
            { urls: [url], types: ["main_frame", "sub_frame"] },
            ["blocking", "responseHeaders"] // 'blocking' est nécessaire pour être certain d'intercepter
        );

        // Déclenche une requête HEAD pour obtenir les en-têtes sans télécharger le corps de la page.
        // On ignore les erreurs (ex: CORS) car le listener webRequest est plus fiable pour cette tâche.
        fetch(url, { method: 'HEAD', mode: 'no-cors' }).catch(() => {});
        
        // Sécurité pour éviter que le listener ne reste actif indéfiniment en cas de problème réseau.
        setTimeout(() => {
            if (browser.webRequest.onHeadersReceived.hasListener(listener)) {
                 browser.webRequest.onHeadersReceived.removeListener(listener);
                 // En cas de doute, on suppose que c'est possible pour ne pas bloquer l'utilisateur inutilement.
                 resolve(true);
            }
        }, 2500); // Timeout de 2.5 secondes.
    });
}


// =================================================================================
// GESTION DU MENU CONTEXTUEL
// =================================================================================

/**
 * Met à jour le menu contextuel pour n'afficher que les vues actives.
 */
async function updateContextMenu() {
    await browser.contextMenus.removeAll();

    if (activeSplitViews.size === 0) {
        return; // Pas de menu si aucune vue n'est active
    }
    
    // Crée le menu parent
    browser.contextMenus.create({
        id: "add-to-split-view-parent",
        title: browser.i18n.getMessage("contextMenuTitle"),
        contexts: ["tab"]
    });

    // Ajoute une entrée pour chaque vue active
    for (const [tabId, viewData] of activeSplitViews.entries()) {
        browser.contextMenus.create({
            id: `add-to-${tabId}`,
            parentId: "add-to-split-view-parent",
            title: viewData.name,
            contexts: ["tab"]
        });
    }
}


// =================================================================================
// ÉVÉNEMENTS PRINCIPAUX DE L'EXTENSION
// =================================================================================

// --- Clic sur l'icône de l'extension ---
browser.browserAction.onClicked.addListener(async () => {
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });
    
    // Filtre pour ne garder que les onglets avec une page web chargée
    const validTabs = selectedTabs.filter(tab => tab.url && tab.url.startsWith('http'));

    if (validTabs.length < 2) {
        browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('icons/icon-96.png'),
            title: 'Super Split View',
            message: browser.i18n.getMessage("alertSelectTabs")
        });
        return;
    }

    const { mode } = await browser.storage.local.get({ mode: 'window' });
    let finalMode = mode;

    // Si le mode préféré est "onglet", on vérifie que c'est techniquement possible
    if (mode === 'tab') {
        const urls = validTabs.map(tab => tab.url);
        const checks = await Promise.all(urls.map(url => checkUrlForFraming(url)));
        const isFramingForbidden = checks.some(canFrame => !canFrame);

        if (isFramingForbidden) {
            finalMode = 'window'; // On force le mode "fenêtre"
            browser.notifications.create({
                type: 'basic',
                iconUrl: browser.runtime.getURL('icons/icon-96.png'),
                title: 'Mode de vue modifié',
                message: "Une page ne peut être affichée en mode onglet. La vue s'ouvre donc en mode fenêtres."
            });
        }
    }

    if (finalMode === 'window') {
        createSplitViewInWindows(validTabs);
    } else {
        createSplitViewInTab(validTabs);
    }
});


// --- Clic sur un élément du menu contextuel ---
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId.startsWith("add-to-")) {
        const targetTabId = parseInt(info.menuItemId.replace("add-to-", ""), 10);
        
        if (activeSplitViews.has(targetTabId) && tab.url) {
            // Envoyer un message à l'onglet de la vue partagée pour qu'il ajoute le nouvel onglet
            try {
                await browser.tabs.sendMessage(targetTabId, {
                    action: 'addPanel',
                    url: tab.url
                });
            } catch(e) {
                console.error("Could not send message to split view tab. It might be closed.", e);
                // On pourrait vouloir nettoyer l'entrée ici si l'onglet n'existe plus
                activeSplitViews.delete(targetTabId);
                updateContextMenu();
            }
        }
    }
});


// --- Installation ou mise à jour de l'extension ---
browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        browser.tabs.create({ url: browser.runtime.getURL('welcome.html') });
    }
    // Initialise le menu contextuel au démarrage
    updateContextMenu();
});


// --- Écoute des messages venant des autres scripts de l'extension ---
browser.runtime.onMessage.addListener(async (message, sender) => {
    switch (message.action) {
        case 'registerSplitView':
            if (sender.tab && sender.tab.id) {
                activeSplitViews.set(sender.tab.id, { id: sender.tab.id, name: message.name });
                await updateContextMenu();
            }
            break;

        case 'viewNameChanged':
            if (sender.tab && sender.tab.id && activeSplitViews.has(sender.tab.id)) {
                activeSplitViews.get(sender.tab.id).name = message.newName;
                await updateContextMenu();
            }
            break;
            
        case 'openOptionsPage':
             browser.runtime.openOptionsPage();
             break;
    }
});

// --- Nettoyage quand un onglet est fermé ---
browser.tabs.onRemoved.addListener(async (tabId) => {
    if (activeSplitViews.has(tabId)) {
        activeSplitViews.delete(tabId);
        await updateContextMenu();
    }
});