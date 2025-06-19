// Fichier : split-view.js

let viewId = null;

// Gère le redimensionnement des panneaux
function makeResizable(container) {
    const panels = Array.from(container.children).filter(el => el.classList.contains('iframe-wrapper'));
    if (panels.length <= 1) return;

    for (let i = 0; i < panels.length - 1; i++) {
        const resizer = document.createElement('div');
        resizer.className = 'resize-handle';
        container.insertBefore(resizer, panels[i + 1]);

        let x = 0;
        let leftWidth = 0;

        const mouseDownHandler = function (e) {
            x = e.clientX;
            const leftPanel = panels[i];
            leftWidth = leftPanel.getBoundingClientRect().width;
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };

        const mouseMoveHandler = function (e) {
            const dx = e.clientX - x;
            const newLeftWidth = ((leftWidth + dx) * 100) / container.getBoundingClientRect().width;
            panels[i].style.flex = `0 1 ${newLeftWidth}%`;
        };

        const mouseUpHandler = function () {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };

        resizer.addEventListener('mousedown', mouseDownHandler);
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('container');
    const viewNameInput = document.getElementById('view-name-input');
    const closeViewButton = document.getElementById('close-view-button');

    const urlParams = new URLSearchParams(window.location.search);
    viewId = urlParams.get('id');

    const finalUrls = await browser.runtime.sendMessage({ action: "getUrlsForView", viewId: viewId });

    if (!finalUrls || finalUrls.length === 0) {
        browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));
        return;
    }

    browser.storage.local.get(`viewName_${viewId}`).then(result => {
        if (result[`viewName_${viewId}`]) {
            viewNameInput.value = result[`viewName_${viewId}`];
            document.title = result[`viewName_${viewId}`];
        } else {
            viewNameInput.placeholder = "Name this view...";
            document.title = `Split - ${viewId}`;
        }
    });

    viewNameInput.addEventListener('change', (e) => {
        browser.storage.local.set({ [`viewName_${viewId}`]: e.target.value });
        document.title = e.target.value;
    });

    closeViewButton.addEventListener('click', () => {
        browser.runtime.sendMessage({ action: "closeSplitView", viewId: viewId });
        browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));
    });

    const createPanel = (url) => {
        const iframeWrapper = document.createElement('div');
        iframeWrapper.className = 'iframe-wrapper';
        
        const addressBarContainer = document.createElement('div');
        addressBarContainer.className = 'address-bar';

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'url-input';
        
        const contentUrl = new URL(url);

        // ===== DÉBUT DE LA NOUVELLE LOGIQUE =====
        
        const loadPage = (targetWrapper, pageUrl) => {
            // Supprime un éventuel overlay existant
            const existingOverlay = targetWrapper.querySelector('.force-info-overlay');
            if (existingOverlay) existingOverlay.remove();
            
            // Supprime un placeholder s'il y en a un
            const placeholder = targetWrapper.querySelector('.iframe-placeholder');
            if(placeholder) placeholder.remove();

            const iframe = document.createElement('iframe');
            iframe.src = pageUrl;
            targetWrapper.appendChild(iframe);
        };
        
        // On nettoie l'URL pour l'affichage dans la barre d'adresse
        const cleanUrl = new URL(url);
        cleanUrl.searchParams.delete('svd_forced');
        cleanUrl.searchParams.delete('svd_domain');
        urlInput.value = cleanUrl.href;
        
        if (contentUrl.searchParams.get('svd_forced') === 'true') {
            const domain = contentUrl.searchParams.get('svd_domain');
            
            // Affiche l'overlay SANS charger la page web
            showWarningOverlay(iframeWrapper, domain, cleanUrl.href);
            
            // On met un placeholder gris pour que le panneau ne soit pas vide
            const placeholder = document.createElement('div');
            placeholder.className = 'iframe-placeholder';
            placeholder.style.flexGrow = '1';
            placeholder.style.backgroundColor = '#f0f0f0';
            iframeWrapper.appendChild(placeholder);

        } else {
            // Comportement normal : charger la page directement
            loadPage(iframeWrapper, url);
        }

        // Ajout de l'ID de l'URL au wrapper pour que l'overlay puisse le retrouver
        iframeWrapper.dataset.urlId = cleanUrl.href;

        // ===== FIN DE LA NOUVELLE LOGIQUE =====

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // On ne peut pas savoir si la nouvelle URL est forcée, donc on recharge toute la vue
                const currentUrls = Array.from(container.querySelectorAll('.iframe-wrapper')).map(wrapper => {
                    if (wrapper === iframeWrapper) return e.target.value;
                    return wrapper.querySelector('.url-input').value;
                });
                browser.runtime.sendMessage({action: "updateUrlsForView", viewId: viewId, urls: currentUrls})
                    .then(() => window.location.reload());
            }
        });

        const closePanelButton = document.createElement('button');
        closePanelButton.className = 'close-panel-button';
        closePanelButton.innerHTML = '×';
        closePanelButton.title = 'Remove this panel';
        closePanelButton.onclick = async () => {
            const remainingUrls = await browser.runtime.sendMessage({ action: "removePanelFromView", viewId: viewId, urlToRemove: url });
            if (remainingUrls && remainingUrls.length > 0) {
                window.location.reload();
            } else {
                closeViewButton.click();
            }
        };
        
        addressBarContainer.appendChild(urlInput);
        addressBarContainer.appendChild(closePanelButton);
        iframeWrapper.insertBefore(addressBarContainer, iframeWrapper.firstChild);
        container.appendChild(iframeWrapper);
    };

    finalUrls.forEach(url => createPanel(url));
    makeResizable(container);
});


function showWarningOverlay(iframeWrapper, domain, urlToLoad) {
    const overlay = document.createElement('div');
    overlay.className = 'force-info-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '40px';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = 'calc(100% - 40px)';
    overlay.style.zIndex = '20';

    // On passe l'URL à charger à l'iframe de l'overlay pour qu'il puisse nous la renvoyer
    const infoUrl = browser.runtime.getURL(`force-info.html?domain=${encodeURIComponent(domain)}&urlToLoad=${encodeURIComponent(urlToLoad)}`);
    const infoFrame = document.createElement('iframe');
    infoFrame.src = infoUrl;
    infoFrame.style.width = '100%';
    infoFrame.style.height = '100%';
    infoFrame.style.border = 'none';
    infoFrame.style.backgroundColor = 'transparent';

    overlay.appendChild(infoFrame);
    iframeWrapper.appendChild(overlay);
}

window.addEventListener('message', (event) => {
    const extensionOrigin = browser.runtime.getURL('').slice(0, -1);
    if (event.origin !== extensionOrigin) return;

    if (event.data && event.data.type === 'SVD_HIDE_FORCE_INFO') {
        const urlToLoad = event.data.urlToLoad;
        // On trouve le bon panneau grâce à l'URL
        const targetWrapper = document.querySelector(`[data-url-id="${urlToLoad}"]`);
        if (targetWrapper) {
            // Supprime l'overlay
            const overlay = targetWrapper.querySelector('.force-info-overlay');
            if (overlay) overlay.remove();
            
            // Supprime le placeholder
            const placeholder = targetWrapper.querySelector('.iframe-placeholder');
            if (placeholder) placeholder.remove();

            // Crée et charge l'iframe de la page web
            const iframe = document.createElement('iframe');
            iframe.src = urlToLoad;
            iframe.style.height = '100%';
            iframe.style.width = '100%';
            iframe.style.border = 'none';
            targetWrapper.appendChild(iframe);
        }

    } else if (event.data && event.data.type === 'SVD_OPEN_OPTIONS') {
        browser.runtime.openOptionsPage();
        const closeButton = document.getElementById('close-view-button');
        if (closeButton) {
            closeButton.click();
        }
    }
});