// Fichier : welcome.js

document.addEventListener('DOMContentLoaded', async () => {
    const langTabs = document.querySelectorAll('.lang-tab');
    const contentContainer = document.querySelector('.content-container');
    const allTranslations = {};

    // 1. Charger toutes les traductions en mémoire
    const langs = Array.from(langTabs).map(tab => tab.dataset.lang);
    for (const lang of langs) {
        try {
            const response = await fetch(`/_locales/${lang}/messages.json`);
            const messages = await response.json();
            allTranslations[lang] = messages;
        } catch (e) {
            console.error(`Could not load translations for ${lang}`, e);
        }
    }

    // Fonction pour appliquer une langue spécifique
    function applyLanguage(lang) {
        const translations = allTranslations[lang];
        if (!translations) return;

        contentContainer.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                el.innerHTML = translations[key].message;
            }
        });
        
        document.title = translations['welcomeTitle'] ? translations['welcomeTitle'].message : 'Welcome';
        
        // Gérer les liens vers les options
        contentContainer.querySelectorAll('.options-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                browser.runtime.openOptionsPage();
            });
        });
    }

    // Fonction pour gérer le changement d'onglet
    function switchLanguage(targetLang) {
        // Mettre à jour l'UI des onglets
        langTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.lang === targetLang);
        });
        
        // Appliquer la langue sélectionnée au contenu
        applyLanguage(targetLang);
        
        localStorage.setItem('svd_welcome_lang', targetLang);
    }

    langTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchLanguage(tab.dataset.lang);
        });
    });

    // 4. Déterminer et afficher la langue par défaut au chargement
    const lastLang = localStorage.getItem('svd_welcome_lang');
    let defaultLang = browser.i18n.getUILanguage(); // ex: "fr-FR", "en-US"

    // Essayer de trouver une correspondance exacte ou partielle
    let initialLang = 'en'; // Langue de secours
    if (langs.includes(lastLang)) {
        initialLang = lastLang;
    } else if (langs.includes(defaultLang)) {
        initialLang = defaultLang;
    } else if (langs.includes(defaultLang.split('-')[0])) {
        initialLang = defaultLang.split('-')[0];
    }
    
    switchLanguage(initialLang);
});