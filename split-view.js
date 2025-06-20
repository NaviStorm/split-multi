// Fichier : split-view.js

let viewId = null;
let authorizedDomains = new Set();
let history = [];

// Écouteur pour répondre aux demandes du background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAuthorizedDomains") {
        sendResponse({ authorizedDomains: Array.from(authorizedDomains) });
        return true;
    }
});

function makeResizable(container) {
    const panels = Array.from(container.children).filter(el => el.classList.contains('iframe-wrapper'));
    if (panels.length <= 1) return;
    for (let i = 0; i < panels.length - 1; i++) {
        const resizer = document.createElement('div');
        resizer.className = 'resize-handle';
        container.insertBefore(resizer, panels[i + 1]);
        let x = 0, leftWidth = 0;
        const mouseDownHandler = function (e) {
            x = e.clientX;
            leftWidth = panels[i].getBoundingClientRect().width;
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };
        const mouseMoveHandler = function (e) {
            const dx = e.clientX - x;
            panels[i].style.flex = `0 1 ${((leftWidth + dx) * 100) / container.getBoundingClientRect().width}%`;
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
    history = await browser.runtime.sendMessage({ action: "getHistory" });

    const authorizedParam = urlParams.get('authorized');
    if (authorizedParam) {
        try { authorizedDomains = new Set(JSON.parse(authorizedParam)); } catch (e) { console.error("Could not parse authorized domains:", e); }
    }

    const finalUrls = await browser.runtime.sendMessage({ action: "getUrlsForView", viewId });
    if (!finalUrls || finalUrls.length === 0) {
        browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));
        return;
    }

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
        const datalistId = `history-list-${Math.random()}`;
        urlInput.setAttribute('list', datalistId);
        const datalist = document.createElement('datalist');
        datalist.id = datalistId;

        const contentUrl = new URL(url);
        const cleanUrl = new URL(url);
        cleanUrl.searchParams.delete('svd_forced');
        cleanUrl.searchParams.delete('svd_domain');
        urlInput.value = cleanUrl.href;
        iframeWrapper.dataset.urlId = cleanUrl.href;

        const loadPage = (targetWrapper, pageUrl) => {
            const existingIframe = targetWrapper.querySelector('iframe');
            if (existingIframe) existingIframe.remove();
            const iframe = document.createElement('iframe');
            iframe.src = pageUrl;
            targetWrapper.appendChild(iframe);
        };
        
        const handleUrlSubmit = async (urlToSubmit) => {
            let newUrlStr = (urlToSubmit || urlInput.value).trim();
            if (newUrlStr.indexOf('.') === -1 && !/^(https?|ftp):\/\//i.test(newUrlStr)) {
                newUrlStr = `https://www.google.com/search?q=${encodeURIComponent(newUrlStr)}`;
            } else if (!/^(https?|ftp):\/\//i.test(newUrlStr)) {
                newUrlStr = `https://${newUrlStr}`;
            }
            urlInput.value = newUrlStr;
            while (iframeWrapper.childElementCount > 1) { iframeWrapper.lastChild.remove(); }
            const finalUrl = await browser.runtime.sendMessage({ action: "getFinalUrl", url: newUrlStr });
            const finalUrlObj = new URL(finalUrl);
            const finalCleanUrl = new URL(finalUrl);
            finalCleanUrl.searchParams.delete('svd_forced');
            finalCleanUrl.searchParams.delete('svd_domain');
            iframeWrapper.dataset.urlId = finalCleanUrl.href;
            urlInput.value = finalCleanUrl.href;
            if (finalUrlObj.searchParams.get('svd_forced') === 'true' && !authorizedDomains.has(finalUrlObj.hostname)) {
                showWarningOverlay(iframeWrapper, finalUrlObj.searchParams.get('svd_domain'), finalCleanUrl.href);
                const placeholder = document.createElement('div');
                placeholder.className = 'iframe-placeholder';
                placeholder.style.flexGrow = '1';
                placeholder.style.backgroundColor = '#f0f0f0';
                iframeWrapper.appendChild(placeholder);
            } else {
                loadPage(iframeWrapper, finalUrl);
            }
        };

        if (contentUrl.searchParams.get('svd_forced') === 'true' && !authorizedDomains.has(contentUrl.hostname)) {
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

        // Fonction pour vider la datalist de manière sécurisée
        const clearDatalist = () => {
            while (datalist.firstChild) {
                datalist.removeChild(datalist.firstChild);
            }
        };

        urlInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (history.some(item => item.url === e.target.value)) {
                handleUrlSubmit(e.target.value);
                return;
            }
            if (query.length < 2) {
                clearDatalist(); // Utilisation de la fonction sécurisée
                return;
            }
            const filteredResults = history.filter(item => item.url.toLowerCase().includes(query)).slice(0, 10);
            
            clearDatalist(); // Vider avant de remplir
            const fragment = document.createDocumentFragment();
            filteredResults.forEach(item => {
                const option = document.createElement('option');
                option.value = item.url;
                option.textContent = item.title;
                fragment.appendChild(option);
            });
            datalist.appendChild(fragment);
        });

        urlInput.addEventListener('blur', () => {
            setTimeout(() => {
                clearDatalist(); // Utilisation de la fonction sécurisée
            }, 200);
        });
        
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleUrlSubmit();
            }
        });

        const closePanelButton = document.createElement('button');
        closePanelButton.className = 'close-panel-button';
        closePanelButton.textContent = '×';
        closePanelButton.title = 'Remove this panel';
        closePanelButton.onclick = async () => {
            const remainingUrls = await browser.runtime.sendMessage({ action: "removePanelFromView", viewId: viewId, urlToRemove: url });
            if (remainingUrls && remainingUrls.length > 0) { window.location.reload(); } else { closeViewButton.click(); }
        };

        addressBarContainer.appendChild(urlInput);
        addressBarContainer.appendChild(datalist);
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
    infoFrame.style.cssText = 'width: 100%; height: 100%; border: none; background-color: transparent;';
    overlay.appendChild(infoFrame);
    iframeWrapper.appendChild(overlay);
}

window.addEventListener('message', async (event) => {
    const extensionOrigin = browser.runtime.getURL('').slice(0, -1);
    
    if (event.data && event.data.type === 'SVD_URL_CHANGED') {
        const newUrl = event.data.url;
        const iframes = document.querySelectorAll('.iframe-wrapper iframe');
        for (const iframe of iframes) {
            if (iframe.contentWindow === event.source) {
                const wrapper = iframe.closest('.iframe-wrapper');
                if (wrapper) {
                    const urlInput = wrapper.querySelector('.url-input');
                    if (urlInput) urlInput.value = newUrl;
                    await browser.runtime.sendMessage({ action: "addToHistory", entry: { url: newUrl, title: event.data.title } });
                    history = await browser.runtime.sendMessage({ action: "getHistory" });
                }
                break;
            }
        }
    } else if (event.origin === extensionOrigin) {
        if (event.data && event.data.type === 'SVD_HIDE_FORCE_INFO') {
            const urlToLoad = event.data.urlToLoad;
            const targetWrapper = document.querySelector(`[data-url-id="${urlToLoad}"]`);
            if (targetWrapper) {
                const domain = new URL(urlToLoad).hostname;
                authorizedDomains.add(domain);
                const overlay = targetWrapper.querySelector('.force-info-overlay');
                if (overlay) overlay.remove();
                const placeholder = targetWrapper.querySelector('.iframe-placeholder');
                if (placeholder) placeholder.remove();
                const iframe = document.createElement('iframe');
                iframe.src = urlToLoad;
                iframe.style.cssText = 'height: 100%; width: 100%; border: none;';
                targetWrapper.appendChild(iframe);
            }
        } else if (event.data && event.data.type === 'SVD_OPEN_OPTIONS') {
            browser.runtime.openOptionsPage();
            const closeButton = document.getElementById('close-view-button');
            if (closeButton) closeButton.click();
        }
    }
});