'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appScript = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

function browserHarness() {
  const elements = new Map();
  const pending = [];
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '', checked: false, hidden: false, textContent: '', innerHTML: '',
        className: '', classList: { toggle() {} }, listeners: {},
        addEventListener(name, callback) { this.listeners[name] = callback; },
        querySelectorAll() { return []; }, scrollIntoView() {}, showModal() {}, close() {}
      });
    }
    return elements.get(id);
  }
  const document = {getElementById: element, querySelectorAll() { return []; }};
  const storage = {getItem() { return null; }, setItem() {}};
  vm.runInNewContext(appScript, {
    document, localStorage: storage, sessionStorage: storage,
    URLSearchParams, AbortSignal, console,
    fetch(url) { return new Promise(resolve => pending.push({url, resolve})); }
  }, {filename: 'app.js'});
  return {element, pending};
}
const data = (id, title) => ({
  jobs: [{id, title, company: 'Entreprise Exemple', location: 'Nantes',
    url: 'https://example.org/jobs/' + id, source: 'EasyJobs'}],
  sources: {EasyJobs: {ok: true, received: 1}},
  retrievedAt: '2026-11-04T08:00:00.000Z', duplicatesRemoved: 0, partial: false
});
const tick = () => new Promise(resolve => setImmediate(resolve));

test('search displays the newest request when the older request completes last', async () => {
  const {element, pending} = browserHarness();
  assert.equal(pending.length, 1, 'initial load starts');
  element('keyword').value = 'qualité';
  element('searchForm').listeners.submit({preventDefault() {}});
  assert.equal(pending.length, 2);
  pending[1].resolve({ok: true, json: async () => data('new', 'Offre nouvelle')});
  await tick();
  pending[0].resolve({ok: true, json: async () => data('old', 'Offre ancienne')});
  await tick();
  assert.match(element('jobList').innerHTML, /Offre nouvelle/);
  assert.doesNotMatch(element('jobList').innerHTML, /Offre ancienne/);
  assert.equal(element('resultNumber').textContent, '1');
});

test('an old failed request cannot replace a newer successful search with an error', async () => {
  const {element, pending} = browserHarness();
  element('keyword').value = 'métrologue';
  element('searchForm').listeners.submit({preventDefault() {}});
  pending[1].resolve({ok: true, json: async () => data('current', 'Technicien métrologue')});
  await tick();
  pending[0].resolve({ok: false, status: 502});
  await tick();
  assert.match(element('jobList').innerHTML, /Technicien métrologue/);
  assert.equal(element('sourceNotice').hidden, true);
});
