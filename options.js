// Fichier : options.js

// Fonction pour sauvegarder les options sélectionnées
function saveOptions(e) {
    e.preventDefault();
    
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const showWarning = document.getElementById('show-framing-warning').checked;
    const domains = document.getElementById('force-window-domains').value.split('\n').map(d => d.trim()).filter(Boolean);

    browser.storage.local.set({
        operatingMode: mode,
        showFramingWarning: showWarning,
        forceWindowDomains: domains
    }).then(() => {
        // Affiche un message de confirmation
        const status = document.getElementById('status');
        status.textContent = browser.i18n.getMessage('optionsSavedStatus');
        setTimeout(() => {
            status.textContent = '';
        }, 1500);
    });
}

// ===== PARTIE LA PLUS IMPORTANTE : Restaurer les options sauvegardées =====
function restoreOptions() {
    // On récupère les valeurs du stockage avec des valeurs par défaut
    // La valeur par défaut pour operatingMode est maintenant 'tab'
    browser.storage.local.get({
        operatingMode: 'tab', 
        showFramingWarning: true,
        forceWindowDomains: []
    }).then((items) => {
        // Coche le bon bouton radio
        if (items.operatingMode === 'window') {
            document.getElementById('mode-window').checked = true;
        } else {
            document.getElementById('mode-tab').checked = true;
        }
        
        // Coche la case d'avertissement
        document.getElementById('show-framing-warning').checked = items.showFramingWarning;
        
        // Remplit la zone de texte des domaines
        document.getElementById('force-window-domains').value = items.forceWindowDomains.join('\n');
    });
}

// Fonction pour appliquer les traductions
function i18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = browser.i18n.getMessage(key) || key;
    });
}

// Événements
document.addEventListener('DOMContentLoaded', () => {
    i18n();
    restoreOptions(); 

    const helpLink = document.getElementById('help-link');
    if (helpLink) {
        helpLink.addEventListener('click', (e) => {
            e.preventDefault(); // Empêche le comportement par défaut du lien
            browser.tabs.create({ url: 'welcome.html' });
        });
    }

    // Sauvegarder automatiquement lors d'un changement
    document.getElementById('options-form').addEventListener('change', saveOptions);
});

// Sauvegarder automatiquement lors d'un changement
document.getElementById('options-form').addEventListener('change', saveOptions);