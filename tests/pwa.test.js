'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const publicDir = path.join(__dirname, '..', 'public');
const read = file => fs.readFileSync(path.join(publicDir, file), 'utf8');

test('manifeste PWA complet, français et installable', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.lang, 'fr-FR');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.ok(m.name.includes('Niko Emploi'));
  for (const dimension of ['192x192', '512x512'])
    assert.ok(m.icons.some(icon => icon.sizes === dimension && icon.type === 'image/png'));
  assert.ok(m.icons.some(icon => icon.purpose === 'maskable'));
});

test('icônes PNG réelles et dimensions conformes', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  for (const icon of m.icons) {
    const data = fs.readFileSync(path.join(publicDir, icon.src.substring(1)));
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const expected = Number(icon.sizes.split('x')[0]);
    assert.equal(data.readUInt32BE(16), expected);
    assert.equal(data.readUInt32BE(20), expected);
  }
});

test('PWA liée depuis les trois pages publiques', () => {
  for (const html of ['index.html', 'candidatures.html', 'confidentialite.html']) {
    assert.match(read(html), /rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(read(html), /src="\/pwa\.js"/);
    assert.match(read(html), /rel="apple-touch-icon"/);
  }
});

test('service worker précharge seulement des ressources statiques', () => {
  const sw = read('sw.js');
  const shell = sw.split('const APP_SHELL = ')[1]?.split('];')[0];
  assert.ok(shell);
  assert.doesNotMatch(shell, /\/api\/|candidatures\.html|confidentialite\.html|applications|profile|account/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.ok(fs.existsSync(path.join(publicDir, 'offline.html')));
});

test('l’installation affiche la procédure iOS et Android et ne prétend pas avoir des offres hors ligne', () => {
  const pwa = read('pwa.js');
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /appinstalled/);
  assert.match(pwa, /Ajouter à l’écran d’accueil/);
  assert.match(pwa, /serviceWorker\.register/);
  assert.match(pwa, /Mode hors ligne/);
});


test('installation DOM sans injection HTML et fermeture compatible', () => {
  const vm = require('node:vm');
  const listeners = {};
  function element(tag) {
    return {tag, children: [], attrs: {}, listeners: {}, open: false,
      append(...nodes) { this.children.push(...nodes); }, appendChild(n) { this.children.push(n); },
      setAttribute(k,v) { this.attrs[k]=v; if(k==='open') this.open=true; },
      removeAttribute(k) { delete this.attrs[k]; if(k==='open') this.open=false; },
      addEventListener(k,fn) { this.listeners[k]=fn; },
      querySelector(s) { const find=n=>n.id===s.slice(1)?n:n.children.map(find).find(Boolean); return find(this); }
    };
  }
  const body=element('body');
  vm.runInNewContext(read('pwa.js'), {document:{body,readyState:'complete',createElement:element},navigator:{userAgent:'iPhone',onLine:true},window:{matchMedia:()=>({matches:false}),addEventListener:(k,f)=>listeners[k]=f}});
  const [button,dialog]=body.children;
  assert.equal(button.children[1].textContent,'Installer Niko Emploi');
  button.listeners.click(); assert.equal(dialog.open,true);
  assert.match(dialog.querySelector('#pwaInstallInstructions').textContent,/iPhone/);
  listeners.appinstalled(); assert.equal(dialog.open,false); assert.equal(button.hidden,true);
  assert.doesNotMatch(read('pwa.js'),/\\.innerHTML\\s*=/);
});
