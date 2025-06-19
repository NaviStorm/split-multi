// Fichier: welcome.js (Version finale qui utilise les fichiers messages.json)
document.addEventListener('DOMContentLoaded', async () => {
    const langTabs = document.querySelectorAll('.lang-tab');
    const contentBlocks = document.querySelectorAll('.language-content');
    const languages = ['en', 'fr', 'de', 'es', 'it'];
    let translations = {};

    // Étape 1: Charger toutes les traductions en mémoire
    for (const lang of languages) {
        try {
            const response = await fetch(`_locales/${lang}/messages.json`);
            translations[lang] = await response.json();
        } catch (e) {
            console.error(`Could not load translations for ${lang}`, e);
            translations[lang] = {};
        }
    }

    // Le modèle HTML unique pour tous les contenus
    const templateHTML = `
        <header><img src="icons/icon-96.png" alt="Extension Icon"><h1 data-i18n="welcomeTitle"></h1><p data-i18n="welcomeSubtitle"></p></header>
        <section class="step"><h2 data-i18n="welcomeHeader1"></h2><ol><li data-i18n="welcomeStep1_1"></li><li data-i18n="welcomeStep1_2"></li><li data-i18n="welcomeStep1_3"></li></ol></section>
        <section class="step"><h2 data-i18n="welcomeHeader2"></h2><ul><li data-i18n="welcomeStep2_1"></li><li data-i18n="welcomeStep2_2"></li><li data-i18n="welcomeStep2_3"></li></ul></section>
        <section class="step"><h2 data-i18n="welcomeHeader3"></h2><ol><li data-i18n="welcomeStep3_1"></li><li data-i18n="welcomeStep3_2"></li><li data-i18n="welcomeStep3_3"></li><li data-i18n="welcomeStep3_4"></li></ol></section>
        <section class="warning-section"><h3 data-i18n="welcomeWarningTitle"></h3><p data-i18n="welcomeWarningP1"></p><p data-i18n="welcomeWarningP2"></p><img src="need-windows.png" alt="Error message screenshot"><p data-i18n="welcomeWarningP3"></p></section>
        <footer><p data-i18n="welcomeFooter"></p></footer>
    `;

    // Étape 2: Remplir chaque bloc de langue avec le contenu traduit
    contentBlocks.forEach(block => {
        const lang = block.dataset.lang;
        block.innerHTML = templateHTML; // Insérer le modèle
        // Remplir le modèle avec les traductions chargées
        block.querySelectorAll('[data-i18n]').forEach(elem => {
            const key = elem.dataset.i18n;
            if (translations[lang] && translations[lang][key]) {
                elem.innerHTML = translations[lang][key].message;
            }
        });
    });

    // Fonction pour changer de langue
    function switchLanguage(targetLang) {
        contentBlocks.forEach(content => {
            content.classList.toggle('active', content.dataset.lang === targetLang);
        });
        langTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.lang === targetLang);
        });
        const visibleContent = document.querySelector(`.language-content[data-lang="${targetLang}"]`);
        if (visibleContent) {
            visibleContent.querySelectorAll('.options-link').forEach(link => {
                const newLink = link.cloneNode(true);
                link.parentNode.replaceChild(newLink, link);
                newLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    browser.runtime.openOptionsPage();
                });
            });
        }
        browser.storage.local.set({ preferredLanguage: targetLang });
    }

    // Étape 3: Déterminer la langue initiale et l'afficher
    const result = await browser.storage.local.get('preferredLanguage');
    let initialLang = result.preferredLanguage;
    if (!languages.includes(initialLang)) {
        const uiLang = browser.i18n.getUILanguage();
        initialLang = languages.find(l => uiLang.startsWith(l)) || 'en';
    }
    switchLanguage(initialLang);

    // Étape 4: Ajouter les écouteurs sur les onglets
    langTabs.forEach(tab => {
        tab.addEventListener('click', () => switchLanguage(tab.dataset.lang));
    });
});