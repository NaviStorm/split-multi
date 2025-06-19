// split-view.js (Version finale avec gestion des mises à jour d'URL et titre corrigé)

const params = new URLSearchParams(window.location.search);
const urls = params.get('urls').split(',');
const viewId = params.get('viewId');
const container = document.getElementById('container');
const viewNameInput = document.getElementById('view-name-input');
const closeViewButton = document.getElementById('close-view-button');

let panels = [];

/**
 * Extrait le nom de domaine principal d'une URL.
 * ex: "https://www.mac4ever.com/bidule" -> "mac4ever.com"
 * @param {string} urlString
 * @returns {string} Le nom de domaine.
 */
function getDomainName(urlString) {
    try {
        const hostname = new URL(urlString).hostname;
        const parts = hostname.startsWith('www.') ? hostname.substring(4).split('.') : hostname.split('.');
        // Retourne les deux dernières parties si possible (ex: .co.uk), sinon juste le domaine.
        return parts.slice(-2).join('.');
    } catch (e) {
        return "Invalid URL";
    }
}


function createPanel(url) {
    // ... le contenu de cette fonction reste inchangé ...
    const decodedUrl = decodeURIComponent(url);
    const wrapper = document.createElement('div');
    wrapper.className = 'iframe-wrapper';

    const addressBar = document.createElement('div');
    addressBar.className = 'address-bar';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'url-input';
    urlInput.value = decodedUrl;
    urlInput.readOnly = true;

    const closePanelButton = document.createElement('button');
    closePanelButton.className = 'close-panel-button';
    closePanelButton.innerHTML = '×';
    closePanelButton.title = "Retirer ce panneau";

    const iframe = document.createElement('iframe');
    iframe.src = decodedUrl;

    addressBar.appendChild(urlInput);
    addressBar.appendChild(closePanelButton);
    wrapper.appendChild(addressBar);
    wrapper.appendChild(iframe);

    closePanelButton.addEventListener('click', () => removePanel(wrapper));

    return wrapper;
}

function renderPanels() {
    // ... le contenu de cette fonction reste inchangé ...
    container.innerHTML = '';
    panels.forEach((panel, index) => {
        container.appendChild(panel);
        if (index < panels.length - 1) {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            container.appendChild(handle);
        }
    });
}

function removePanel(panelToRemove) {
    // ... le contenu de cette fonction reste inchangé ...
    panels = panels.filter(p => p !== panelToRemove);
    if (panels.length > 0) {
        renderPanels();
        // Mettre à jour le titre de l'onglet après suppression d'un panneau
        updateTabTitle();
    } else {
        window.close();
    }
}

function updateTabTitle() {
    const domains = panels
        .map(panel => getDomainName(panel.querySelector('iframe').src))
        .join(' / ');
    document.title = domains;
}


// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Créer les panneaux
    panels = urls.map(createPanel);
    renderPanels();
    
    // Mettre à jour le titre de l'onglet initial
    updateTabTitle();

    // Définir le nom initial de la vue (pour le menu contextuel)
    const initialName = `Split - ${viewId.split('-')[1].substring(0, 5)}`;
    viewNameInput.value = initialName;
    // Note: Le titre de l'onglet est maintenant géré par updateTabTitle(),
    // mais on garde le nom de la vue pour le menu contextuel.

    // Enregistrer la vue auprès du script d'arrière-plan
    browser.runtime.sendMessage({
        type: 'REGISTER_VIEW',
        viewId: viewId,
        name: initialName,
        urls: urls.map(decodeURIComponent)
    });

    // --- Event Listeners ---
    viewNameInput.addEventListener('change', () => {
        const newName = viewNameInput.value.trim();
        if (newName) {
            // Mettre à jour le nom pour le menu contextuel
            browser.runtime.sendMessage({
                type: 'UPDATE_VIEW_NAME',
                viewId: viewId,
                newName: newName
            });
        }
    });
    
    // ... Le reste des listeners reste inchangé ...
    closeViewButton.addEventListener('click', () => {
        window.close();
    });

    browser.runtime.onMessage.addListener((message) => {
        if (message.type === 'ADD_TAB_TO_VIEW' && message.viewId === viewId) {
            if(panels.length < 4) {
                 const newPanel = createPanel(encodeURIComponent(message.tab.url));
                 panels.push(newPanel);
                 renderPanels();
                 updateTabTitle();
            } else {
                browser.notifications.create({
                    type: 'basic',
                    iconUrl: browser.runtime.getURL('icons/icon-48.png'),
                    title: browser.i18n.getMessage('extensionName'),
                    message: browser.i18n.getMessage('maxTabsAlert')
                });
            }
        }
    });

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SUPER_SPLIT_VIEW_URL_CHANGE') {
            const sourceIframe = Array.from(document.querySelectorAll('iframe'))
                                    .find(iframe => iframe.contentWindow === event.source);
            if (sourceIframe) {
                const urlInput = sourceIframe.closest('.iframe-wrapper').querySelector('.url-input');
                if (urlInput) {
                    urlInput.value = event.data.url;
                }
                // Mettre à jour le titre de l'onglet si l'URL change
                updateTabTitle();
            }
        }
    });
});

window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({
        type: 'UNREGISTER_VIEW',
        viewId: viewId
    });
});