// options.js

// Applies translations to the page
function i18n() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = browser.i18n.getMessage(key);
        if (translation) {
            // Use innerHTML to support simple tags like <strong> in translations
            el.innerHTML = translation;
        }
    });
}

// Saves options to browser.storage.local
function saveOptions(e) {
    e.preventDefault();
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const showWarning = document.getElementById('show-framing-warning').checked;
    const domains = document.getElementById('force-window-domains').value;

    browser.storage.local.set({
        mode: mode,
        showFramingWarning: showWarning,
        forceWindowDomains: domains
    }).then(() => {
        const status = document.getElementById('status');
        status.textContent = browser.i18n.getMessage('optionsSavedStatus');
        setTimeout(() => {
            status.textContent = '';
        }, 1500);
    });
}

// Restores options from browser.storage.local
function restoreOptions() {
    const defaults = {
        mode: 'window',
        showFramingWarning: true,
        forceWindowDomains: ''
    };
    browser.storage.local.get(defaults).then(result => {
        document.querySelector(`input[name="mode"][value="${result.mode}"]`).checked = true;
        document.getElementById('show-framing-warning').checked = result.showFramingWarning;
        document.getElementById('force-window-domains').value = result.forceWindowDomains;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    i18n();
    restoreOptions();
    document.getElementById('options-form').addEventListener('change', saveOptions);
    
    const helpLink = document.getElementById('help-link');
    helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        browser.runtime.sendMessage({ type: 'OPEN_WELCOME_PAGE' });
    });
});