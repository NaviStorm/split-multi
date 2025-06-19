// content_script.js (Version finale avec sabotage)

// Ce script s'exécute dans un "monde isolé". Pour modifier la page elle-même,
// nous devons injecter un autre script dans le "monde principal".

// Ne rien faire si on n'est pas dans un iframe.
if (window.self === window.top) {
    return;
}

// Fonction pour injecter notre script de sabotage.
const injectSabotageScript = () => {
    try {
        const script = document.createElement('script');
        // Ce code sera exécuté dans le contexte de la page web (ex: lemonde.fr)
        script.textContent = `
            // On empêche les scripts de la page de faire des vérifications d'iframe fiables.
            // En rendant 'frameElement' indétectable, beaucoup de vérifications échouent.
            Object.defineProperty(window, 'frameElement', {
                get: function() { return null; },
                configurable: true
            });
            // On peut aussi essayer de tromper la vérification la plus commune.
            if (window.self !== window.top) {
                try {
                    window.self = window.top;
                } catch(e) {
                    // Ignorer les erreurs, la modification de frameElement est souvent suffisante.
                }
            }
        `;
        // On l'ajoute au tout début de la page pour qu'il s'exécute avant les scripts du site.
        (document.head || document.documentElement).appendChild(script);
        // On le retire immédiatement après l'avoir ajouté pour ne pas polluer le DOM.
        // Le script a déjà été exécuté par le navigateur à ce stade.
        script.remove();
    } catch (e) {
        console.warn('Super Split View: Sabotage script injection failed.', e);
    }
};

// Exécuter le sabotage immédiatement.
injectSabotageScript();


// --- Section pour le rapport d'URL (mise à jour de la barre d'adresse) ---
// Cette partie est distincte du sabotage et reste nécessaire.
if (window.hasRunSuperSplitViewURLReporter !== true) {
    window.hasRunSuperSplitViewURLReporter = true;
  
    const reportUrlChange = () => {
      try {
        window.top.postMessage({
          type: 'SUPER_SPLIT_VIEW_URL_CHANGE',
          url: window.location.href
        }, browser.runtime.getURL('').slice(0, -1));
      } catch(e) { /* Ne rien faire */ }
    };
  
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      reportUrlChange();
    };
  
    const originalReplaceState = history.replaceState;
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      reportUrlChange();
    };
  
    window.addEventListener('popstate', reportUrlChange);
    window.addEventListener('load', () => setTimeout(reportUrlChange, 200), { once: true });
}