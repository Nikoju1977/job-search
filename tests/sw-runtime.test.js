'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
function harness() {
  const handlers = new Map(), stored = new Map(), updates = [];
  let online = true, fetchCount = 0;
  const cache = {
    async match(request) { return stored.get(request.url) || null; },
    async put(request, response) { stored.set(request.url, response); updates.push(request.url); },
    async addAll() {}
  };
  const caches = {open: async () => cache, keys: async () => [], match: async request => cache.match(request)};
  const self = {
    location: {origin: 'https://niko.example'},
    addEventListener(type, listener) { handlers.set(type, listener); },
    skipWaiting: async () => {}, clients: {claim: async () => {}}
  };
  const live = {ok: true, value: 'new', clone() { return {...this}; }};
  vm.runInNewContext(source, {
    self, caches, URL,
    fetch: async () => { fetchCount++; if (!online) throw Error('offline'); return live; },
    Response: {error: () => ({value: 'offline-error'})}
  });
  async function dispatch(pathname) {
    let response;
    const request = {url: 'https://niko.example' + pathname, method: 'GET', mode: 'cors'};
    handlers.get('fetch')({request, respondWith(promise) {response = promise;}});
    return response === undefined ? undefined : await response;
  }
  return {dispatch, stored, updates, setOnline(value) {online = value;}, get fetchCount() {return fetchCount;}};
}

test('the public JS shell refreshes on the network and falls back to its cached version offline', async () => {
  const browser = harness();
  const request = 'https://niko.example/app.js';
  browser.stored.set(request, {value: 'stale'});
  const online = await browser.dispatch('/app.js');
  assert.equal(online.value, 'new');
  assert.equal(browser.stored.get(request).value, 'new');
  assert.deepEqual(browser.updates, [request]);
  browser.setOnline(false);
  const offline = await browser.dispatch('/app.js');
  assert.equal(offline.value, 'new');
  assert.equal(browser.fetchCount, 2);
});

test('the service worker never intercepts API requests', async () => {
  const browser = harness();
  assert.equal(await browser.dispatch('/api/jobs'), undefined);
  assert.equal(browser.fetchCount, 0);
});
