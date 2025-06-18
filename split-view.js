// Fichier: split-view.js (Version finale complète avec documentation)

const container = document.getElementById('container');
const nameInput = document.getElementById('view-name-input');
const closeViewButton = document.getElementById('close-view-button');
let currentResizer = null;
let thisViewId = null; // Stocke l'ID de cet onglet de vue pour la communication

/**
 * Fonction principale qui efface et reconstruit toute la vue partagée.
 * @param {Array<{url: string}>} tabs - La liste complète des onglets à afficher.
 * @returns {void}
 */
function renderView(tabs) {
  container.innerHTML = '';

  tabs.forEach((tab, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'iframe-wrapper';
    wrapper.style.flexBasis = `${100 / tabs.length}%`;

    const addressBar = document.createElement('div');
    addressBar.className = 'address-bar';

    const urlInput = document.createElement('input');
    urlInput.className = 'url-input';
    urlInput.type = 'text';
    urlInput.value = tab.url;
    urlInput.spellcheck = false;

    const closePanelButton = document.createElement('button');
    closePanelButton.className = 'close-panel-button';
    closePanelButton.textContent = '×';
    closePanelButton.title = 'Retirer ce panneau';
    
    addressBar.appendChild(urlInput);
    addressBar.appendChild(closePanelButton);

    const iframe = document.createElement('iframe');
    iframe.src = tab.url;

    wrapper.appendChild(addressBar);
    wrapper.appendChild(iframe);
    container.appendChild(wrapper);

    // Événement pour le bouton "X" de ce panneau
    closePanelButton.addEventListener('click', (e) => {
        e.stopPropagation();
        browser.runtime.sendMessage({
            command: 'remove-panel',
            viewId: thisViewId,
            panelUrl: tab.url
        });
    });

    // Événement pour la barre d'adresse de ce panneau
    urlInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        let newUrl = urlInput.value.trim();
        if (!/^(https?:\/\/)/i.test(newUrl)) { newUrl = 'https://' + newUrl; }
        iframe.src = newUrl;
        urlInput.value = newUrl;
      }
    });

    // Événement après navigation dans l'iframe (laissé vide pour éviter les erreurs)
    iframe.addEventListener('load', () => {});

    // Ajoute la poignée de redimensionnement
    if (index < tabs.length - 1) {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      container.appendChild(handle);
      handle.addEventListener('mousedown', (e) => {
        currentResizer = e.target;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
      });
    }
  });
}

/**
 * Gère le changement de nom de la vue, met à jour le titre de l'onglet
 * et informe le script d'arrière-plan.
 * @returns {void}
 */
function handleNameChange() {
    const newName = nameInput.value.trim();
    if (newName && thisViewId) {
        document.title = newName;
        browser.runtime.sendMessage({
            command: 'rename-view',
            id: thisViewId,
            newName: newName
        });
    }
}

/**
 * Point d'entrée : lit les infos depuis l'URL de la page et initialise la vue.
 * @returns {void}
 */
function initializeView() {
  const params = new URLSearchParams(window.location.search);
  
  thisViewId = parseInt(params.get('id'), 10);
  const viewName = decodeURIComponent(params.get('name'));

  if (viewName) {
    nameInput.value = viewName;
    document.title = viewName;
  }

  const encodedUrlsString = params.get('tabs');
  if (encodedUrlsString) {
    const urls = encodedUrlsString.split(',').map(url => decodeURIComponent(url));
    const tabsToRender = urls.map((url, index) => ({ id: `initial-${index}`, url: url }));
    renderView(tabsToRender);
  }
}

/**
 * Gère le mouvement de la souris lors du redimensionnement d'un panneau.
 * @param {MouseEvent} e - L'objet événement de la souris.
 * @returns {void}
 */
function onMouseMove(e) {
  if (!currentResizer) return;
  const prevPanel = currentResizer.previousElementSibling;
  const nextPanel = currentResizer.nextElementSibling;
  if (!prevPanel || !nextPanel) return;
  
  container.querySelectorAll('iframe').forEach(iframe => iframe.style.pointerEvents = 'none');
  const newPrevPanelWidth = e.clientX - prevPanel.getBoundingClientRect().left;
  const combinedWidth = prevPanel.offsetWidth + nextPanel.offsetWidth;
  const newPrevFlexBasis = (newPrevPanelWidth / combinedWidth) * (parseFloat(prevPanel.style.flexBasis) + parseFloat(nextPanel.style.flexBasis));
  const newNextFlexBasis = ((combinedWidth - newPrevPanelWidth) / combinedWidth) * (parseFloat(prevPanel.style.flexBasis) + parseFloat(nextPanel.style.flexBasis));
  prevPanel.style.flexBasis = `${newPrevFlexBasis}%`;
  nextPanel.style.flexBasis = `${newNextFlexBasis}%`;
}

/**
 * Gère le relâchement du clic de la souris, terminant le redimensionnement.
 * @returns {void}
 */
function onMouseUp() {
  currentResizer = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  container.querySelectorAll('iframe').forEach(iframe => iframe.style.pointerEvents = 'auto');
}

// --- ÉCOUTEURS D'ÉVÉNEMENTS GLOBAUX ---

// Gère le clic sur le bouton de fermeture de la vue entière.
closeViewButton.addEventListener('click', () => {
    if (thisViewId) {
        browser.runtime.sendMessage({ command: 'close-view', id: thisViewId });
    }
});

// Gère la sauvegarde du nom de la vue.
nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleNameChange();
        nameInput.blur();
    }
});
nameInput.addEventListener('blur', handleNameChange);

// Lance l'initialisation au chargement de la page.
initializeView();