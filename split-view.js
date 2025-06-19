// Fichier : split-view.js

let viewId = null;

function makeResizable(container) { /* ... fonction inchangée ... */ }

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('container');
    const viewNameInput = document.getElementById('view-name-input');
    const closeViewButton = document.getElementById('close-view-button');

    const urlParams = new URLSearchParams(window.location.search);
    viewId = urlParams.get('id');

    // NOUVELLE LOGIQUE : Demander les URLs finales au background script
    const finalUrls = await browser.runtime.sendMessage({
        action: "getUrlsForView",
        viewId: viewId
    });

    if (!finalUrls || finalUrls.length === 0) {
        // La vue est peut-être périmée, on la ferme.
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
        const newName = e.target.value;
        document.title = newName;
        browser.storage.local.set({ [`viewName_${viewId}`]: newName });
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

        const iframe = document.createElement('iframe');
        const contentUrl = new URL(url);
        
        console.log(`[split-view] Checking URL: ${url}`);
        console.log(`[split-view] contentUrl.searchParams.get('svd_forced'): `, contentUrl.searchParams.get('svd_forced'));

        // CETTE CONDITION DEVRAIT MAINTENANT ÊTRE VRAIE
        if (contentUrl.searchParams.get('svd_forced') === 'true') {
            const domain = contentUrl.searchParams.get('svd_domain');
            showWarningOverlay(iframeWrapper, domain);

            const cleanUrl = new URL(url);
            cleanUrl.searchParams.delete('svd_forced');
            cleanUrl.searchParams.delete('svd_domain');
            
            iframe.src = cleanUrl.href;
            urlInput.value = cleanUrl.href;
        } else {
            iframe.src = url;
            urlInput.value = url;
        }

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') iframe.src = urlInput.value;
        });

        const closePanelButton = document.createElement('button');
        closePanelButton.className = 'close-panel-button';
        closePanelButton.innerHTML = '×';
        closePanelButton.title = 'Remove this panel';
        closePanelButton.onclick = async () => {
            const remainingUrls = await browser.runtime.sendMessage({ action: "removePanelFromView", viewId: viewId, urlToRemove: url });
            if (remainingUrls && remainingUrls.length > 0) {
                window.location.reload(); // Le plus simple est de recharger la vue
            } else {
                closeViewButton.click();
            }
        };

        addressBarContainer.appendChild(urlInput);
        addressBarContainer.appendChild(closePanelButton);
        iframeWrapper.appendChild(addressBarContainer);
        iframeWrapper.appendChild(iframe);
        container.appendChild(iframeWrapper);
    };

    finalUrls.forEach(url => createPanel(url));
    makeResizable(container);
});

function showWarningOverlay(iframeWrapper, domain) {
    const overlay = document.createElement('div');
    overlay.className = 'force-info-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '40px';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = 'calc(100% - 40px)';
    overlay.style.zIndex = '20';
    overlay.style.backgroundColor = 'transparent';

    const infoFrame = document.createElement('iframe');
    const infoUrl = browser.runtime.getURL(`force-info.html?domain=${encodeURIComponent(domain)}`);
    infoFrame.src = infoUrl;
    infoFrame.style.width = '100%';
    infoFrame.style.height = '100%';
    infoFrame.style.border = 'none';

    overlay.appendChild(infoFrame);
    iframeWrapper.appendChild(overlay);
}

window.addEventListener('message', (event) => {
    const extensionOrigin = browser.runtime.getURL('').slice(0, -1);
    if (event.origin !== extensionOrigin) return;

    if (event.data && event.data.type === 'SVD_HIDE_FORCE_INFO') {
        const overlay = document.querySelector('.force-info-overlay');
        if (overlay) overlay.remove();
    } else if (event.data && event.data.type === 'SVD_OPEN_OPTIONS') {
        browser.runtime.openOptionsPage();
        const overlay = document.querySelector('.force-info-overlay');
        if (overlay) overlay.remove();
    }
});