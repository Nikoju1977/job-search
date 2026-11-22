/* Niko Emploi PWA: cache only the public application shell. Never cache applicant data, APIs or responses. */
'use strict';
const CACHE_NAME = 'niko-emploi-shell-v6-radar-recovery-20261122';
const CACHE_PREFIX = 'niko-emploi-shell-';
const APP_SHELL = [
  '/', '/index.html', '/marche-cache.html', '/app.js', '/styles.css', '/premium-2026.css', '/studio-niko-core.js',
  '/pwa.js', '/pwa.css', '/marche-cache.js', '/marche-cache.css', '/radar-suivi.js', '/offline.html', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png'
];
const STATIC_PATHS = new Set(APP_SHELL.filter(url => url !== '/' && url !== '/index.html'));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // No storage of CV/profile/account data, application statuses, server AI, API results or tokens.
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        // Public radar shell can reopen offline; local follow-ups live in localStorage.
        if (url.pathname === '/marche-cache.html') {
          const radar = await cache.match('/marche-cache.html');
          if (radar) return radar;
        }
        if (url.pathname === '/' || url.pathname === '/index.html') {
          const shell = await cache.match('/');
          if (shell) return shell;
        }
        return (await cache.match('/offline.html')) || Response.error();
      }
    })());
    return;
  }
  if (!STATIC_PATHS.has(url.pathname)) return;
  // Serve versioned static public assets only. Bypass cache for URLs with search params.
  if (url.search) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Network first: a new deployment must not be hidden by the previous JS/CSS cache.
      const fresh = await fetch(request);
      if (fresh.ok) await cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    } catch (_) {
      // Offline fallback is limited to public, previously cached static assets.
      return (await cache.match(request)) || Response.error();
    }
  })());
});
