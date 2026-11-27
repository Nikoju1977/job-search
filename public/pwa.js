/* Installation PWA Niko Emploi. Aucune annonce ni information de candidature en cache. */
(() => {
  'use strict';
  let pendingPrompt = null;
  let installButton;
  let installDialog;
  const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  async function promptInstall() {
    if (installButton.hidden || installButton.disabled) return;
    if (pendingPrompt) {
      const prompt = pendingPrompt;
      pendingPrompt = null;
      installButton.disabled = true;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') installButton.hidden = true;
      } catch (_) {
        if (!installButton.hidden) showInstructions();
      } finally {
        installButton.disabled = false;
      }
      return;
    }
    showInstructions();
  }
  function showInstructions() {
    const description = installDialog.querySelector('#pwaInstallInstructions');
    if (isAppleMobile) {
      description.textContent = 'Sur iPhone ou iPad : ouvrez le menu Partager de votre navigateur, choisissez « Ajouter à l’écran d’accueil », puis confirmez avec « Ajouter ». L’installation n’utilise pas de magasin d’applications.';
    } else if (isAndroid) {
      description.textContent = 'Sur Android : dans Chrome ou Samsung Internet, ouvrez le menu du navigateur (⋮) puis « Installer l’application » ou « Ajouter à l’écran d’accueil ». Confirmez l’installation.';
    } else if (/Macintosh|Mac OS X/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) {
      description.textContent = 'Dans Safari sur Mac, ouvrez le menu Fichier puis « Ajouter au Dock ». Dans Chrome et Edge, utilisez le menu du navigateur pour installer le site comme application.';
    } else {
      description.textContent = 'Dans Chrome ou Microsoft Edge, ouvrez le menu du navigateur (⋮) puis « Installer Niko Emploi ». Le navigateur propose l’installation seulement lorsqu’il prend cette fonction en charge.';
    }
    if (installDialog.open) return;
    if (typeof installDialog.showModal === 'function') installDialog.showModal();
    else installDialog.setAttribute('open', '');
  }
  function closeInstructions() {
    if (!installDialog) return;
    if (typeof installDialog.close === 'function') installDialog.close();
    else installDialog.removeAttribute('open');
  }
  function setupUI() {
    installButton = document.createElement('button');
    installButton.id = 'pwaInstallButton';
    installButton.type = 'button';
    installButton.className = 'pwa-install-button';
    installButton.setAttribute('aria-label', 'Installer Niko Emploi sur cet appareil');
    const symbol = document.createElement('span');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.className = 'pwa-install-symbol';
    symbol.textContent = '↧';
    const label = document.createElement('span');
    label.textContent = 'Installer Niko Emploi';
    installButton.append(symbol, label);
    installButton.addEventListener('click', promptInstall);
    if (installed()) installButton.hidden = true;
    document.body.appendChild(installButton);

    installDialog = document.createElement('dialog');
    installDialog.className = 'pwa-install-dialog';
    installDialog.setAttribute('aria-labelledby', 'pwaInstallTitle');
    const inner = document.createElement('div');
    inner.className = 'pwa-install-dialog-inner';
    const image = document.createElement('img');
    image.src = '/icons/icon-192.png'; image.alt = ''; image.width = 65; image.height = 65;
    const title = document.createElement('h2');
    title.id = 'pwaInstallTitle'; title.textContent = 'Niko Emploi dans votre poche';
    const instructions = document.createElement('p');
    instructions.id = 'pwaInstallInstructions';
    const note = document.createElement('p');
    note.className = 'pwa-install-note';
    note.textContent = 'L’installation est gratuite. Pour consulter des annonces à jour ou envoyer une candidature, une connexion Internet est nécessaire.';
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'pwa-install-close'; close.textContent = 'Compris';
    close.addEventListener('click', closeInstructions);
    inner.append(image, title, instructions, note, close);
    installDialog.appendChild(inner);
    installDialog.addEventListener('click', event => {
      if (event.target === installDialog) {
        closeInstructions();
      }
    });
    document.body.appendChild(installDialog);

    const networkNotice = document.createElement('div');
    networkNotice.className = 'pwa-network-notice';
    networkNotice.setAttribute('role', 'status');
    networkNotice.setAttribute('aria-live', 'polite');
    networkNotice.textContent = 'Mode hors ligne : les offres et candidatures exigent une connexion. Les annonces ne sont pas mises en cache.';
    document.body.appendChild(networkNotice);
    const syncNetworkNotice = () => { networkNotice.hidden = navigator.onLine !== false; };
    window.addEventListener('online', syncNetworkNotice);
    window.addEventListener('offline', syncNetworkNotice);
    syncNetworkNotice();
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    if (installButton) installButton.hidden = true;
    if (installDialog && installDialog.open) closeInstructions();
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'}).catch(error => {
        console.warn('Mode PWA indisponible :', error);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUI);
  else setupUI();
})();
