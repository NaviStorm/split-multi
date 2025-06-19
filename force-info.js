// Fichier : force-info.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const domain = urlParams.get('domain');
    const urlToLoad = urlParams.get('urlToLoad');

    // 1. Appliquer les traductions pour les textes simples
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        if (el.id === 'info-message') return;
        const key = el.getAttribute('data-i18n-key');
        const text = browser.i18n.getMessage(key);
        if (text) el.textContent = text;
    });

    // 2. Gérer le message complexe séparément
    if (domain) {
        document.getElementById('domain-to-add').textContent = domain;

        let messageText = browser.i18n.getMessage('forceInfoMessage');
        // Remplacement du placeholder personnalisé
        messageText = messageText.replace(/__DOMAIN__/g, `<strong>${domain}</strong>`);
        
        document.getElementById('info-message').innerHTML = messageText;
    }
    
    // 3. Lier les événements des boutons
    document.getElementById('show-anyway-button').addEventListener('click', () => {
        window.parent.postMessage({ type: 'SVD_HIDE_FORCE_INFO', urlToLoad: urlToLoad }, '*');
    });

    document.getElementById('options-button').addEventListener('click', () => {
        window.parent.postMessage({ type: 'SVD_OPEN_OPTIONS' }, '*');
    });
});