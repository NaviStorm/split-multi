// Fichier: options.js (Version finale avec lien vers l'aide)

/**
 * Traduit la page en remplaçant le contenu des éléments
 * qui ont un attribut data-i18n.
 */
function localizeHtmlPage() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const messageKey = el.getAttribute('data-i18n');
        el.textContent = browser.i18n.getMessage(messageKey);
    });
}

/**
 * Sauvegarde le mode de fonctionnement choisi par l'utilisateur.
 */
function saveOptions(e) {
  e.preventDefault();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  browser.storage.local.set({ mode: mode }).then(() => {
    const status = document.getElementById('status');
    status.textContent = browser.i18n.getMessage("optionsSavedStatus");
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
}

/**
 * Restaure les options sauvegardées au chargement de la page.
 */
function restoreOptions() {
  function setCurrentChoice(result) {
    // Le mode "tab" est la valeur par défaut.
    const mode = result.mode || 'tab';
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
  }
  browser.storage.local.get("mode").then(setCurrentChoice);
}

// --- POINT D'ENTRÉE PRINCIPAL ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Traduire et afficher les options immédiatement
    localizeHtmlPage();
    restoreOptions();

    // 2. Rendre le lien d'aide fonctionnel
    const helpLink = document.getElementById('help-link');
    if (helpLink) {
        helpLink.addEventListener('click', (e) => {
            e.preventDefault(); // Empêche le lien de faire quoi que ce soit par défaut
            // Ouvre la page welcome.html dans un nouvel onglet
            browser.tabs.create({
                url: browser.runtime.getURL("welcome.html")
            });
        });
    }
});

// Écouteur pour la sauvegarde des options
document.querySelector("#options-form").addEventListener('change', saveOptions);