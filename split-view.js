// Fichier : split-view.js

let viewId = null;

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

    viewId = new URLSearchParams(window.location.search).get('id');
    const finalUrls = await browser.runtime.sendMessage({ action: "getUrlsForView", viewId });

    if (!finalUrls || finalUrls.length === 0) {
        browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));
        return;
    }
    
    // Récupérer et définir le titre
    const storedData = await browser.storage.local.get(`viewName_${viewId}`);
    if (storedData[`viewName_${viewId}`]) {
        viewNameInput.value = storedData[`viewName_${viewId}`];
        document.title = storedData[`viewName_${viewId}`];
    }

    viewNameInput.addEventListener('change', e => {
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
        const cleanUrl = new URL(url);
        cleanUrl.searchParams.delete('svd_forced');
        cleanUrl.searchParams.delete('svd_domain');
        urlInput.value = cleanUrl.href;
        iframeWrapper.dataset.urlId = cleanUrl.href;

        const loadPage = (targetWrapper, pageUrl) => {
            const existingIframe = targetWrapper.querySelector('iframe');
            if(existingIframe) existingIframe.remove();

            const iframe = document.createElement('iframe');
            iframe.src = pageUrl;
            iframe.addEventListener('load', () => {
                try {
                    const newNavigatedUrl = iframe.contentWindow.location.href;
                    targetWrapper.querySelector('.url-input').value = newNavigatedUrl;
                } catch (e) {
                    console.warn("Could not update address bar due to cross-origin restrictions.");
                }
            });
            targetWrapper.appendChild(iframe);
        };

        if (contentUrl.searchParams.get('svd_forced') === 'true') {
            const domain = contentUrl.searchParams.get('svd_domain');
            showWarningOverlay(iframeWrapper, domain, cleanUrl.href);
            const placeholder = document.createElement('div');
            placeholder.className = 'iframe-placeholder';
            placeholder.style.flexGrow = '1';
            placeholder.style.backgroundColor = '#f0f0f0';
            iframeWrapper.appendChild(placeholder);
        } else {
            loadPage(iframeWrapper, url);
        }

        urlInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const newUrlStr = e.target.value;
                const originalUrlObj = new URL(iframeWrapper.dataset.urlId);
                const newUrlObj = new URL(newUrlStr);

                // Vide le panneau (sauf la barre d'adresse)
                while (iframeWrapper.childElementCount > 1) {
                    iframeWrapper.lastChild.remove();
                }
                
                if (originalUrlObj.hostname === newUrlObj.hostname) {
                    loadPage(iframeWrapper, newUrlStr);
                } else {
                    const finalUrl = await browser.runtime.sendMessage({ action: "getFinalUrl", url: newUrlStr });
                    const finalUrlObj = new URL(finalUrl);

                    if (finalUrlObj.searchParams.get('svd_forced') === 'true') {
                        const domain = finalUrlObj.searchParams.get('svd_domain');
                        showWarningOverlay(iframeWrapper, domain, finalUrlObj.href);
                         const placeholder = document.createElement('div');
                         placeholder.className = 'iframe-placeholder';
                         placeholder.style.flexGrow = '1';
                         placeholder.style.backgroundColor = '#f0f0f0';
                         iframeWrapper.appendChild(placeholder);
                    } else {
                        loadPage(iframeWrapper, finalUrl);
                    }
                }
                iframeWrapper.dataset.urlId = newUrlStr;
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
        const targetWrapper = document.querySelector(`[data-url-id="${urlToLoad}"]`);
        if (targetWrapper) {
            const overlay = targetWrapper.querySelector('.force-info-overlay');
            if (overlay) overlay.remove();
            
            const placeholder = targetWrapper.querySelector('.iframe-placeholder');
            if (placeholder) placeholder.remove();

            const iframe = document.createElement('iframe');
            iframe.src = urlToLoad;
            iframe.style.height = '100%';
            iframe.style.width = '100%';
            iframe.style.border = 'none';
            // Ajout de l'écouteur ici aussi
             iframe.addEventListener('load', () => {
                try {
                    targetWrapper.querySelector('.url-input').value = iframe.contentWindow.location.href;
                } catch (e) {console.warn("Cannot update address bar: cross-origin");}
            });
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