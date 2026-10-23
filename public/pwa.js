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
    if (pendingPrompt) {
      const prompt = pendingPrompt;
      pendingPrompt = null;
      installButton.disabled = true;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') installButton.hidden = true;
      } catch (_) {
        showInstructions();
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
    if (typeof installDialog.showModal === 'function') installDialog.showModal();
    else installDialog.setAttribute('open', '');
  }
  function setupUI() {
    installButton = document.createElement('button');
    installButton.id = 'pwaInstallButton';
    installButton.type = 'button';
    installButton.className = 'pwa-install-button';
    installButton.setAttribute('aria-label', 'Installer Niko Emploi sur cet appareil');
    installButton.innerHTML = '<span aria-hidden="true" class="pwa-install-symbol">↧</span><span>Installer Niko Emploi</span>';
    installButton.addEventListener('click', promptInstall);
    if (installed()) installButton.hidden = true;
    document.body.appendChild(installButton);

    installDialog = document.createElement('dialog');
    installDialog.className = 'pwa-install-dialog';
    installDialog.setAttribute('aria-labelledby', 'pwaInstallTitle');
    installDialog.innerHTML = '<div class="pwa-install-dialog-inner"><img src="/icons/icon-192.png" alt="" width="65" height="65"><h2 id="pwaInstallTitle">Niko Emploi dans votre poche</h2><p id="pwaInstallInstructions"></p><p class="pwa-install-note">L’installation est gratuite. Pour consulter des annonces à jour ou envoyer une candidature, une connexion Internet est nécessaire.</p><button type="button" class="pwa-install-close">Compris</button></div>';
    installDialog.querySelector('.pwa-install-close').addEventListener('click', () => {
      if (typeof installDialog.close === 'function') installDialog.close();
      else installDialog.removeAttribute('open');
    });
    installDialog.addEventListener('click', event => {
      if (event.target === installDialog) {
        if (typeof installDialog.close === 'function') installDialog.close();
        else installDialog.removeAttribute('open');
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
    if (installDialog && installDialog.open) installDialog.close();
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
