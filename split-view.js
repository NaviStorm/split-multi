// split-view.js (Version finale avec gestion des mises à jour d'URL)

const params = new URLSearchParams(window.location.search);
const urls = params.get('urls').split(',');
const viewId = params.get('viewId');
const container = document.getElementById('container');
const viewNameInput = document.getElementById('view-name-input');
const closeViewButton = document.getElementById('close-view-button');

let panels = [];

function createPanel(url) {
    const decodedUrl = decodeURIComponent(url);
    const wrapper = document.createElement('div');
    wrapper.className = 'iframe-wrapper';

    const addressBar = document.createElement('div');
    addressBar.className = 'address-bar';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'url-input';
    urlInput.value = decodedUrl;
    // La barre d'adresse sera mise à jour par le content script, donc on la laisse en lecture seule
    // pour éviter la confusion de l'utilisateur.
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
    container.innerHTML = ''; // Clear existing
    panels.forEach((panel, index) => {
        container.appendChild(panel);
        if (index < panels.length - 1) {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            // Note : La logique de redimensionnement n'est pas implémentée ici, mais le handle est présent.
            container.appendChild(handle);
        }
    });
}

function removePanel(panelToRemove) {
    panels = panels.filter(p => p !== panelToRemove);
    if (panels.length > 0) {
        renderPanels();
    } else {
        window.close(); // Close tab if no panels are left
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Set initial view name
    const initialName = `Split - ${viewId.split('-')[1].substring(0, 5)}`;
    viewNameInput.value = initialName;
    document.title = initialName;

    // Register the view with the background script
    browser.runtime.sendMessage({
        type: 'REGISTER_VIEW',
        viewId: viewId,
        name: initialName,
        urls: urls.map(decodeURIComponent)
    });

    // Create and render panels
    panels = urls.map(createPanel);
    renderPanels();

    // --- Event Listeners ---
    viewNameInput.addEventListener('change', () => {
        const newName = viewNameInput.value.trim();
        if (newName) {
            document.title = newName;
            browser.runtime.sendMessage({
                type: 'UPDATE_VIEW_NAME',
                viewId: viewId,
                newName: newName
            });
        }
    });

    closeViewButton.addEventListener('click', () => {
        window.close();
    });

    // Handle being told to add a new tab from the context menu
    browser.runtime.onMessage.addListener((message) => {
        if (message.type === 'ADD_TAB_TO_VIEW' && message.viewId === viewId) {
            if(panels.length < 4) {
                 const newPanel = createPanel(encodeURIComponent(message.tab.url));
                 panels.push(newPanel);
                 renderPanels();
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

    // =======================================================================
    // AJOUT : Écoute les messages du content_script.js pour MàJ la barre d'adresse
    // =======================================================================
    window.addEventListener('message', (event) => {
        // Vérification de sécurité de base : s'assurer que le message est bien celui attendu.
        if (event.data && event.data.type === 'SUPER_SPLIT_VIEW_URL_CHANGE') {
            // Trouve quel iframe a envoyé le message
            const sourceIframe = Array.from(document.querySelectorAll('iframe'))
                                    .find(iframe => iframe.contentWindow === event.source);

            if (sourceIframe) {
                // Trouve l'input de la barre d'adresse associé à cet iframe
                const urlInput = sourceIframe.closest('.iframe-wrapper').querySelector('.url-input');
                if (urlInput) {
                    urlInput.value = event.data.url;
                }
            }
        }
    });
});

// Inform background script on close
window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({
        type: 'UNREGISTER_VIEW',
        viewId: viewId
    });
});