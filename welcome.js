// welcome.js

const allMessages = {
    en: {
        title: "welcomeTitle",
        subtitle: "welcomeSubtitle",
        header1: "welcomeHeader1",
        step1_1: "welcomeStep1_1",
        step1_2: "welcomeStep1_2",
        step1_3: "welcomeStep1_3",
        header2: "welcomeHeader2",
        step2_1: "welcomeStep2_1",
        step2_2: "welcomeStep2_2",
        step2_3: "welcomeStep2_3",
        header3: "welcomeHeader3",
        step3_1: "welcomeStep3_1",
        step3_2: "welcomeStep3_2",
        step3_3: "welcomeStep3_3",
        step3_4: "welcomeStep3_4",
        footer: "welcomeFooter",
        warningTitle: "welcomeWarningTitle",
        warningP1: "welcomeWarningP1",
        warningP2: "welcomeWarningP2",
        warningP3: "welcomeWarningP3"
    },
    // Add other languages here in the same structure
    fr: {
        title: "welcomeTitle",
        subtitle: "welcomeSubtitle",
        header1: "welcomeHeader1",
        step1_1: "welcomeStep1_1",
        step1_2: "welcomeStep1_2",
        step1_3: "welcomeStep1_3",
        header2: "welcomeHeader2",
        step2_1: "welcomeStep2_1",
        step2_2: "welcomeStep2_2",
        step2_3: "welcomeStep2_3",
        header3: "welcomeHeader3",
        step3_1: "welcomeStep3_1",
        step3_2: "welcomeStep3_2",
        step3_3: "welcomeStep3_3",
        step3_4: "welcomeStep3_4",
        footer: "welcomeFooter",
        warningTitle: "welcomeWarningTitle",
        warningP1: "welcomeWarningP1",
        warningP2: "welcomeWarningP2",
        warningP3: "welcomeWarningP3"
    },
    de: {
        title: "welcomeTitle",
        subtitle: "welcomeSubtitle",
        header1: "welcomeHeader1",
        step1_1: "welcomeStep1_1",
        step1_2: "welcomeStep1_2",
        step1_3: "welcomeStep1_3",
        header2: "welcomeHeader2",
        step2_1: "welcomeStep2_1",
        step2_2: "welcomeStep2_2",
        step2_3: "welcomeStep2_3",
        header3: "welcomeHeader3",
        step3_1: "welcomeStep3_1",
        step3_2: "welcomeStep3_2",
        step3_3: "welcomeStep3_3",
        step3_4: "welcomeStep3_4",
        footer: "welcomeFooter",
        warningTitle: "welcomeWarningTitle",
        warningP1: "welcomeWarningP1",
        warningP2: "welcomeWarningP2",
        warningP3: "welcomeWarningP3"
    },
    es: {
        title: "welcomeTitle",
        subtitle: "welcomeSubtitle",
        header1: "welcomeHeader1",
        step1_1: "welcomeStep1_1",
        step1_2: "welcomeStep1_2",
        step1_3: "welcomeStep1_3",
        header2: "welcomeHeader2",
        step2_1: "welcomeStep2_1",
        step2_2: "welcomeStep2_2",
        step2_3: "welcomeStep2_3",
        header3: "welcomeHeader3",
        step3_1: "welcomeStep3_1",
        step3_2: "welcomeStep3_2",
        step3_3: "welcomeStep3_3",
        step3_4: "welcomeStep3_4",
        footer: "welcomeFooter",
        warningTitle: "welcomeWarningTitle",
        warningP1: "welcomeWarningP1",
        warningP2: "welcomeWarningP2",
        warningP3: "welcomeWarningP3"
    },
    it: {
        title: "welcomeTitle",
        subtitle: "welcomeSubtitle",
        header1: "welcomeHeader1",
        step1_1: "welcomeStep1_1",
        step1_2: "welcomeStep1_2",
        step1_3: "welcomeStep1_3",
        header2: "welcomeHeader2",
        step2_1: "welcomeStep2_1",
        step2_2: "welcomeStep2_2",
        step2_3: "welcomeStep2_3",
        header3: "welcomeHeader3",
        step3_1: "welcomeStep3_1",
        step3_2: "welcomeStep3_2",
        step3_3: "welcomeStep3_3",
        step3_4: "welcomeStep3_4",
        footer: "welcomeFooter",
        warningTitle: "welcomeWarningTitle",
        warningP1: "welcomeWarningP1",
        warningP2: "welcomeWarningP2",
        warningP3: "welcomeWarningP3"
    }
};
// To save space, I'm aliasing other languages to french structure. In a real scenario, you'd populate these.
allMessages.de = allMessages.fr;
allMessages.es = allMessages.fr;
allMessages.it = allMessages.fr;


function getMessage(key, lang) {
    // A simple polyfill for browser.i18n.getMessage for a specific language
    // This is a workaround as the API doesn't support fetching for a specific locale directly.
    // For this to work, we'd need the actual JSON files loaded or a pre-built structure.
    // For now, let's just use the default locale's messages.
    return browser.i18n.getMessage(key);
}

function renderContent(lang) {
    const messages = allMessages[lang];
    const content = `
        <header>
            <img src="icons/icon-64.png" alt="Extension Icon">
            <h1 data-i18n="${messages.title}"></h1>
            <p data-i18n="${messages.subtitle}"></p>
        </header>

        <section class="step">
            <h2 data-i18n="${messages.header1}"></h2>
            <ol>
                <li data-i18n="${messages.step1_1}"></li>
                <li data-i18n="${messages.step1_2}"></li>
                <li data-i18n="${messages.step1_3}"></li>
            </ol>
        </section>

        <section class="step">
            <h2 data-i18n="${messages.header2}"></h2>
            <ul>
                <li data-i18n="${messages.step2_1}"></li>
                <li data-i18n="${messages.step2_2}"></li>
                <li data-i18n="${messages.step2_3}"></li>
            </ul>
        </section>

        <section class="step">
            <h2 data-i18n="${messages.header3}"></h2>
            <ol>
                <li data-i18n="${messages.step3_1}"></li>
                <li data-i18n="${messages.step3_2}"></li>
                <li data-i18n="${messages.step3_3}"></li>
                <li data-i18n="${messages.step3_4}"></li>
            </ol>
        </section>

        <div class="warning-section">
            <h3 data-i18n="${messages.warningTitle}"></h3>
            <p data-i18n="${messages.warningP1}"></p>
            <p data-i18n="${messages.warningP2}"></p>
            <img src="need-windows.png" alt="Example of a framing error message">
            <p data-i18n="${messages.warningP3}"></p>
        </div>

        <footer>
            <p data-i18n="${messages.footer}"></p>
        </footer>
    `;

    const container = document.querySelector(`.language-content[data-lang="${lang}"]`);
    container.innerHTML = content;
    
    // Apply i18n to the newly added content
    const elements = container.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        // We use the browser's current UI language for translations.
        el.innerHTML = browser.i18n.getMessage(key);
    });

    // Make options links work
    container.querySelectorAll('.options-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
        });
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const langTabs = document.querySelectorAll('.lang-tab');
    const contentDivs = document.querySelectorAll('.language-content');

    // Get browser's language
    const currentLang = browser.i18n.getUILanguage().split('-')[0];
    let activeLang = 'en'; // default
    if (['en', 'fr', 'de', 'es', 'it'].includes(currentLang)) {
        activeLang = currentLang;
    }

    langTabs.forEach(tab => {
        const lang = tab.dataset.lang;
        renderContent(lang); // Render all content first

        if (lang === activeLang) {
            tab.classList.add('active');
            document.querySelector(`.language-content[data-lang="${lang}"]`).classList.add('active');
        }

        tab.addEventListener('click', () => {
            langTabs.forEach(t => t.classList.remove('active'));
            contentDivs.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.querySelector(`.language-content[data-lang="${lang}"]`).classList.add('active');
        });
    });
});