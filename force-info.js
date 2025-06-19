document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('domain');

    if (!domain) return;

    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        el.textContent = browser.i18n.getMessage(el.dataset.i18nKey);
    });

    document.getElementById('info-message').innerHTML = browser.i18n.getMessage("forceInfoMessage", domain);
    document.getElementById('domain-to-add').textContent = domain;

    document.getElementById('options-button').addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });

    document.getElementById('show-anyway-button').addEventListener('click', () => {
        // Le message est simple : on demande juste à cacher l'overlay.
        window.parent.postMessage({ type: 'SUPER_SPLIT_VIEW_HIDE_OVERLAY' }, '*');
    });
});