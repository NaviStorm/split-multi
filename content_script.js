// Fichier : content_script.js

if (window.self !== window.top) {
    const sendUrlUpdate = () => {
        try {
            window.parent.postMessage({
                type: 'SVD_URL_CHANGED',
                url: window.location.href,
                title: document.title
            }, '*');
        } catch (e) {
            console.warn("Super Split View: Could not send URL update.", e);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sendUrlUpdate);
    } else {
        sendUrlUpdate();
    }

    let lastUrl = window.location.href;
    new MutationObserver(() => {
        const url = window.location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            sendUrlUpdate();
        }
    }).observe(document.body, { subtree: true, childList: true });
}