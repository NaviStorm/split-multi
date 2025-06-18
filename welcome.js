// Fichier: welcome.js (Version finale avec gestion des onglets de langue)

document.addEventListener('DOMContentLoaded', () => {
    const langSwitcher = document.querySelector('.lang-switcher');
    const langTabs = document.querySelectorAll('.lang-tab');
    const contentPanels = document.querySelectorAll('.language-content');
    const optionsLinks = document.querySelectorAll('.options-link');

    /**
     * Affiche le contenu pour une langue spécifique et met à jour les boutons.
     * @param {string} targetLang - Le code de la langue à afficher (ex: "en", "fr").
     */
    function switchLanguage(targetLang) {
        // Met à jour l'état actif des boutons
        langTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.lang === targetLang);
        });

        // Met à jour la visibilité des panneaux de contenu
        contentPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.lang === targetLang);
        });
        
        // Met à jour le titre de l'onglet du navigateur
        const activeTitle = document.querySelector(`.language-content[data-lang="${targetLang}"] h1`);
        if (activeTitle) {
            document.title = activeTitle.textContent;
        }
    }

    // Gère le clic sur les boutons de langue
    langSwitcher.addEventListener('click', (e) => {
        if (e.target.matches('.lang-tab')) {
            const lang = e.target.dataset.lang;
            switchLanguage(lang);
        }
    });

    // Gère le clic sur tous les liens vers la page d'options
    optionsLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            browser.runtime.openOptionsPage();
        });
    });

    // --- Détection de la langue par défaut au chargement ---
    const userLang = browser.i18n.getUILanguage().substring(0, 2);
    // On vérifie s'il existe un bouton pour la langue de l'utilisateur
    const defaultTab = document.querySelector(`.lang-tab[data-lang="${userLang}"]`);

    if (defaultTab) {
        // S'il existe, on l'active
        switchLanguage(userLang);
    } else {
        // Sinon, on active l'anglais par défaut
        switchLanguage('en');
    }
});