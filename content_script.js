// Fichier : content_script.js (Version finale et fiable)

// Cette fonction s'assure que nous n'exécutons le code qu'une seule fois par page.
if (window.hasRunSuperSplitViewContentScript !== true) {
  window.hasRunSuperSplitViewContentScript = true;

  /**
   * La fonction qui envoie l'URL mise à jour à la page parente (split-view).
   */
  const reportUrlChange = () => {
    // On vérifie qu'on est bien dans un iframe et non dans la fenêtre principale.
    if (window.self !== window.top) {
      // Envoi du message à la page split-view.
      window.top.postMessage({
        type: 'SUPER_SPLIT_VIEW_URL_CHANGE',
        url: window.location.href
      }, '*'); // La cible est une ressource de l'extension, '*' est sécuritaire.
    }
  };

  // --- Interception de l'API History ---
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    reportUrlChange();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    reportUrlChange();
    return result;
  };

  // --- Gestion des événements de navigation classiques ---
  window.addEventListener('popstate', reportUrlChange);

  // --- Envoi de l'URL initiale ---
  setTimeout(reportUrlChange, 100);
}