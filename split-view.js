// Fichier: split-view.js (Version finale complète et vérifiée)

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');
    const viewNameInput = document.getElementById('view-name-input');
    const closeViewButton = document.getElementById('close-view-button');
    
    const params = new URLSearchParams(window.location.search);
    const urlsString = params.get('urls');
    let initialUrls = urlsString ? JSON.parse(decodeURIComponent(urlsString)) : [];

    // --- CORRECTION DU TITRE INITIAL ---
    const titleFromUrl = decodeURIComponent(params.get('title') || '');
    if (titleFromUrl) {
        document.title = titleFromUrl;
        viewNameInput.value = titleFromUrl; // Utilise le titre pour le champ de saisie
    }

    // Informer le background script du nom initial
    browser.tabs.getCurrent().then(tab => {
        const nameToSend = viewNameInput.value || `Split - ${tab.id}`;
        if (!viewNameInput.value) { viewNameInput.value = nameToSend; }
        
        browser.runtime.sendMessage({
            action: 'updateViewInfo',
            name: nameToSend,
            urls: initialUrls
        });
    });

    function createPanel(url) {
        if (container.children.length >= 4) return;
        if (container.children.length > 0) {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            container.appendChild(handle);
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'iframe-wrapper';
        const addressBar = document.createElement('div');
        addressBar.className = 'address-bar';
        const urlInput = document.createElement('input');
        urlInput.className = 'url-input';
        urlInput.type = 'text';
        urlInput.value = url; 
        const iframe = document.createElement('iframe');
        iframe.src = url;
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                let newUrl = urlInput.value;
                if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
                    newUrl = 'https://' + newUrl;
                }
                iframe.src = newUrl;
            }
        });
        const closeButton = document.createElement('button');
        closeButton.className = 'close-panel-button';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => {
            const panelIndex = Array.from(container.children).indexOf(wrapper);
            if (panelIndex > 0) {
                 container.removeChild(container.children[panelIndex - 1]);
            }
            container.removeChild(wrapper);
            updateUrlsAndNotify();
        };
        addressBar.appendChild(urlInput);
        addressBar.appendChild(closeButton);
        wrapper.appendChild(addressBar);
        wrapper.appendChild(iframe);
        container.appendChild(wrapper);
        updateUrlsAndNotify();
    }

    function updateUrlsAndNotify() {
        const currentUrls = Array.from(document.querySelectorAll('.url-input')).map(input => input.value);
        browser.runtime.sendMessage({ action: 'updateViewInfo', urls: currentUrls });
    }

    initialUrls.forEach(url => createPanel(url));

    viewNameInput.addEventListener('input', () => {
        document.title = viewNameInput.value;
        browser.runtime.sendMessage({ action: 'updateViewInfo', name: viewNameInput.value });
    });
    closeViewButton.addEventListener('click', () => {
        browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));
    });
    browser.runtime.onMessage.addListener((message) => {
        if (message.action === 'addTab') {
            createPanel(message.url);
        }
    });

    // --- LOGIQUE DE RÉCEPTION ---
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SUPER_SPLIT_VIEW_URL_CHANGE') {
            const newUrl = event.data.url;
            const sourceIframeWindow = event.source;
            const allIframes = document.querySelectorAll('iframe');
            for (const iframe of allIframes) {
                if (iframe.contentWindow === sourceIframeWindow) {
                    const wrapper = iframe.closest('.iframe-wrapper');
                    if (wrapper) {
                        const urlInput = wrapper.querySelector('.url-input');
                        if (urlInput && urlInput.value !== newUrl) {
                            urlInput.value = newUrl;
                            updateUrlsAndNotify();
                        }
                    }
                    break; 
                }
            }
        }
    });
});