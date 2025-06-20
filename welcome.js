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
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
                const message = translations[key].message;

                if (message.includes('<') && message.includes('>')) {
                    // Pour les messages contenant du HTML (liens, strong, img, code)
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(message, 'text/html');
                    
                    // On vide l'élément avant d'ajouter les nouveaux nœuds
                    while (el.firstChild) {
                        el.removeChild(el.firstChild);
                    }
                    
                    // On transfère les nœuds du corps du document parsé vers notre élément
                    Array.from(doc.body.childNodes).forEach(node => {
                        el.appendChild(node);
                    });

                } else {
                    // Pour le texte simple, textContent est la meilleure option
                    el.textContent = message;
                }
                // =======================================================
            }
        });
        
        document.title = translations['welcomeTitle'] ? translations['welcomeTitle'].message : 'Welcome';
        
        // Gérer les liens vers les options après avoir inséré le HTML
        contentContainer.querySelectorAll('.options-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                browser.runtime.openOptionsPage();
            });
        });
    }

    // Fonction pour gérer le changement d'onglet
    function switchLanguage(targetLang) {
        langTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.lang === targetLang);
        });
        
        applyLanguage(targetLang);
        
        localStorage.setItem('svd_welcome_lang', targetLang);
    }

    langTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchLanguage(tab.dataset.lang);
        });
    });

    // Déterminer et afficher la langue par défaut au chargement
    const lastLang = localStorage.getItem('svd_welcome_lang');
    let defaultLang = browser.i18n.getUILanguage();
    let initialLang = 'en';
    const supportedLangs = langs;

    if (supportedLangs.includes(lastLang)) {
        initialLang = lastLang;
    } else if (supportedLangs.includes(defaultLang)) {
        initialLang = defaultLang;
    } else if (supportedLangs.includes(defaultLang.split('-')[0])) {
        initialLang = defaultLang.split('-')[0];
    }
    
    switchLanguage(initialLang);
});