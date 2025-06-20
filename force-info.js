// Fichier : force-info.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const domain = urlParams.get('domain');
    const urlToLoad = urlParams.get('urlToLoad');

    // Fonction sécurisée pour insérer du HTML
    const setHTML = (element, htmlString) => {
        // Vider l'élément avant d'ajouter le nouveau contenu
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        Array.from(doc.body.childNodes).forEach(node => {
            element.appendChild(node);
        });
    };

    // 1. Appliquer les traductions pour les textes simples (textContent est sûr)
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        if (el.id === 'info-message') return; // On traite ce cas spécial plus bas
        const key = el.getAttribute('data-i18n-key');
        const text = browser.i18n.getMessage(key);
        if (text) el.textContent = text;
    });

    // 2. Gérer le message complexe séparément et de manière sécurisée
    if (domain) {
        document.getElementById('domain-to-add').textContent = domain;

        let messageText = browser.i18n.getMessage('forceInfoMessage');
        // Remplacement du placeholder personnalisé
        messageText = messageText.replace(/__DOMAIN__/g, `<strong>${domain}</strong>`);
        
        const infoMessageElement = document.getElementById('info-message');
        if (infoMessageElement) {
            setHTML(infoMessageElement, messageText);
        }
    }
    
    // 3. Lier les événements des boutons
    document.getElementById('show-anyway-button').addEventListener('click', () => {
        window.parent.postMessage({ type: 'SVD_HIDE_FORCE_INFO', urlToLoad: urlToLoad }, '*');
    });

    document.getElementById('options-button').addEventListener('click', () => {
        window.parent.postMessage({ type: 'SVD_OPEN_OPTIONS' }, '*');
    });
});