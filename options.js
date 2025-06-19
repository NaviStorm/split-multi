const DEFAULT_PROTECTED_DOMAINS = [
    'accounts.google.com',
    'facebook.com',
    'twitter.com',
    'linkedin.com',
    'github.com',
    'addons.mozilla.org',
    'www.paypal.com',
    'paypal.com'
].join('\n');

function save_options() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const showWarning = document.getElementById('show-framing-warning').checked;
    const forceWindowDomains = document.getElementById('force-window-domains').value;
    browser.storage.local.set({
        mode: mode,
        showFramingWarning: showWarning,
        forceWindowDomains: forceWindowDomains
    }).then(() => {
        let status = document.getElementById('status');
        status.textContent = browser.i18n.getMessage("optionsSavedStatus");
        setTimeout(() => { status.textContent = ''; }, 1500);
    });
}

function restore_options() {
    browser.storage.local.get({
        mode: 'window',
        showFramingWarning: true,
        forceWindowDomains: DEFAULT_PROTECTED_DOMAINS 
    }).then(items => {
        document.querySelector(`input[name="mode"][value="${items.mode}"]`).checked = true;
        document.getElementById('show-framing-warning').checked = items.showFramingWarning;
        document.getElementById('force-window-domains').value = items.forceWindowDomains;
    });
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        elem.textContent = browser.i18n.getMessage(key);
    });
    document.title = browser.i18n.getMessage("optionsTitle");
}

document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    restore_options();
    document.getElementById('options-form').addEventListener('change', save_options);
    document.getElementById('force-window-domains').addEventListener('input', save_options);
    const helpLink = document.getElementById('help-link');
    if (helpLink) {
        helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            browser.tabs.create({ url: 'welcome.html' });
        });
    }
});