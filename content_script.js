// Ce script s'exécute dans toutes les pages, mais nous ne voulons agir
// que s'il est injecté dans un iframe de notre extension.
// La vérification window.self !== window.top garantit cela.
if (window.self !== window.top) {
    // Fonction pour envoyer la mise à jour de l'URL au parent (split-view.html)
    const sendUrlUpdate = () => {
        try {
            // Le message contient un type unique et l'URL actuelle
            window.parent.postMessage({
                type: 'SVD_URL_CHANGED',
                url: window.location.href
            }, '*'); // L'origine du parent ne peut pas être connue à l'avance, '*' est requis.
        } catch (e) {
            // Peut échouer si le parent a déjà été déchargé, c'est sans gravité.
            console.warn("Super Split View: Could not send URL update to parent.", e);
        }
    };

    // Envoyer l'URL une première fois dès que le script est prêt
    sendUrlUpdate();

    // Pour les applications modernes (Single Page Apps) qui changent l'URL sans recharger la page,
    // on observe les changements dans le DOM. C'est une heuristique, mais elle couvre de nombreux cas.
    let lastUrl = window.location.href;
    new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            sendUrlUpdate();
        }
    }).observe(document.body, { subtree: true, childList: true });
}