// split-view.js (Version finale avec overlay sur contenu forcé)

const params = new URLSearchParams(window.location.search);
const urls = params.get('urls').split(',');
const viewId = params.get('viewId');
const container = document.getElementById('container');
const viewNameInput = document.getElementById('view-name-input');
const closeViewButton = document.getElementById('close-view-button');

let panels = [];

function getDomainName(urlString) {
    try {
        const hostname = new URL(urlString).hostname;
        return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    } catch (e) { return "URL invalide"; }
}

function showWarningOverlay(panelWrapper, domain) {
    if (panelWrapper.querySelector('.warning-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'warning-overlay';

    const box = document.createElement('div');
    box.className = 'warning-box';

    const title = browser.i18n.getMessage("forceInfoTitle");
    const message = browser.i18n.getMessage("forceInfoMessage", domain);
    const optionsButtonText = browser.i18n.getMessage("forceInfoButton");
    
    box.innerHTML = `
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="domain-to-add">
            <code>${domain}</code>
        </div>
        <div class="button-group">
            <button class="show-anyway-btn">Afficher quand même</button>
            <button class="options-btn">${optionsButtonText}</button>
        </div>
    `;

    overlay.appendChild(box);
    panelWrapper.appendChild(overlay);

    box.querySelector('.show-anyway-btn').addEventListener('click', () => {
        overlay.remove();
    });

    box.querySelector('.options-btn').addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });
}

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

    urlInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            let newUrl = urlInput.value.trim();
            if (newUrl && !newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
                newUrl = 'https://' + newUrl;
            }
            iframe.src = newUrl;
        }
    });

    closePanelButton.addEventListener('click', () => removePanel(wrapper));

    return wrapper;
}

function renderPanels() {
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
    panels = panels.filter(p => p !== panelToRemove);
    if (panels.length > 0) {
        renderPanels();
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

document.addEventListener('DOMContentLoaded', () => {
    panels = urls.map(createPanel);
    renderPanels();
    updateTabTitle();

    const initialName = `Split - ${viewId.split('-')[1].substring(0, 5)}`;
    viewNameInput.value = initialName;

    browser.runtime.sendMessage({
        type: 'REGISTER_VIEW', viewId: viewId, name: initialName,
        urls: urls.map(decodeURIComponent)
    });

    viewNameInput.addEventListener('change', () => {
        const newName = viewNameInput.value.trim();
        if (newName) {
            browser.runtime.sendMessage({ type: 'UPDATE_VIEW_NAME', viewId: viewId, newName: newName });
        }
    });
    
    closeViewButton.addEventListener('click', () => window.close());

    browser.runtime.onMessage.addListener((message) => {
        if (message.type === 'FRAME_FORCED' && message.url) {
            setTimeout(() => {
                const targetPanel = panels.find(p => p.querySelector('iframe')?.src === message.url);
                if (targetPanel) {
                    const domain = getDomainName(message.url);
                    showWarningOverlay(targetPanel, domain);
                }
            }, 500);
        }
    });

    window.addEventListener('message', (event) => {
        // Sécurité : n'accepter les messages que de notre propre origine
        if (event.origin !== window.origin) return;

        if (event.data && event.data.type === 'SUPER_SPLIT_VIEW_URL_CHANGE') {
            const sourceIframe = Array.from(document.querySelectorAll('iframe'))
                                    .find(iframe => iframe.contentWindow === event.source);
            if (sourceIframe) {
                const urlInput = sourceIframe.closest('.iframe-wrapper').querySelector('.url-input');
                if (urlInput) {
                    urlInput.value = event.data.url;
                }
                updateTabTitle();
            }
        }
    });
});

window.addEventListener('beforeunload', () => {
    browser.runtime.sendMessage({ type: 'UNREGISTER_VIEW', viewId: viewId });
});