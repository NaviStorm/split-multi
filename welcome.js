// welcome.js (Corrected Version)

const loadedTranslations = {};

async function getTranslations(lang) {
    if (loadedTranslations[lang]) {
        return loadedTranslations[lang];
    }
    try {
        const response = await fetch(`/_locales/${lang}/messages.json`);
        if (!response.ok) throw new Error(`Could not load ${lang} locale`);
        const messages = await response.json();
        loadedTranslations[lang] = messages;
        return messages;
    } catch (error) {
        console.error(error);
        return loadedTranslations['en']; // Fallback to English
    }
}

function renderHtmlStructure(lang) {
    return `
        <header>
            <img src="icons/icon-64.png" alt="Extension Icon">
            <h1 data-i18n-key="welcomeTitle"></h1>
            <p data-i18n-key="welcomeSubtitle"></p>
        </header>
        <section class="step">
            <h2 data-i18n-key="welcomeHeader1"></h2>
            <ol>
                <li data-i18n-key="welcomeStep1_1"></li>
                <li data-i18n-key="welcomeStep1_2"></li>
                <li data-i18n-key="welcomeStep1_3"></li>
            </ol>
        </section>
        <section class="step">
            <h2 data-i18n-key="welcomeHeader2"></h2>
            <ul>
                <li data-i18n-key="welcomeStep2_1"></li>
                <li data-i18n-key="welcomeStep2_2"></li>
                <li data-i18n-key="welcomeStep2_3"></li>
            </ul>
        </section>
        <section class="step">
            <h2 data-i18n-key="welcomeHeader3"></h2>
            <ol>
                <li data-i18n-key="welcomeStep3_1"></li>
                <li data-i18n-key="welcomeStep3_2"></li>
                <li data-i18n-key="welcomeStep3_3"></li>
                <li data-i18n-key="welcomeStep3_4"></li>
            </ol>
        </section>
        <div class="warning-section">
            <h3 data-i18n-key="welcomeWarningTitle"></h3>
            <p data-i18n-key="welcomeWarningP1"></p>
            <p data-i18n-key="welcomeWarningP2"></p>
            <img src="need-windows.png" alt="Example of a framing error message">
            <p data-i18n-key="welcomeWarningP3"></p>
        </div>
        <footer>
            <p data-i18n-key="welcomeFooter"></p>
        </footer>
    `;
}

async function renderContent(lang) {
    const container = document.querySelector(`.language-content[data-lang="${lang}"]`);
    if (container.innerHTML === '') { // Only render if not already rendered
        container.innerHTML = renderHtmlStructure(lang);
    }
    
    const translations = await getTranslations(lang);
    
    container.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.getAttribute('data-i18n-key');
        if (translations[key]) {
            el.innerHTML = translations[key].message;
        }
    });

    container.querySelectorAll('.options-link').forEach(link => {
        link.onclick = (e) => { // Use onclick to avoid multiple event listeners
            e.preventDefault();
            browser.runtime.openOptionsPage();
        };
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const langTabs = document.querySelectorAll('.lang-tab');
    const contentDivs = document.querySelectorAll('.language-content');

    const uiLang = browser.i18n.getUILanguage().split('-')[0];
    const validLangs = Array.from(langTabs).map(t => t.dataset.lang);
    const activeLang = validLangs.includes(uiLang) ? uiLang : 'en';

    await getTranslations('en'); // Pre-load English as a fallback

    const switchTab = (lang) => {
        langTabs.forEach(t => t.classList.toggle('active', t.dataset.lang === lang));
        contentDivs.forEach(c => c.classList.toggle('active', c.dataset.lang === lang));
        renderContent(lang);
    };

    langTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.lang));
    });

    switchTab(activeLang);
});