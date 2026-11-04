'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {getJobs, publicSourceFailure} = require('../lib/jobs');

const RESPONSE = body => ({ok: true, json: async () => body});
const EMPTY = host => host === 'api.easyjobs.fr'
  ? {data: [], pagination: {has_next_page: false}}
  : host === 'www.arbeitnow.com' ? {data: []} : {jobs: []};

async function withProviderEnvironment(id, key, fetchImpl, work) {
  const previous = {
    fetch: global.fetch,
    id: process.env.EASYJOBS_PARTNER_ID,
    key: process.env.EASYJOBS_PARTNER_KEY,
    greenhouse: process.env.GREENHOUSE_BOARDS,
    adzunaId: process.env.ADZUNA_APP_ID,
    adzunaKey: process.env.ADZUNA_APP_KEY
  };
  if (id === null) delete process.env.EASYJOBS_PARTNER_ID;
  else process.env.EASYJOBS_PARTNER_ID = id;
  if (key === null) delete process.env.EASYJOBS_PARTNER_KEY;
  else process.env.EASYJOBS_PARTNER_KEY = key;
  delete process.env.GREENHOUSE_BOARDS;
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
  global.fetch = fetchImpl;
  try { await work(); }
  finally {
    global.fetch = previous.fetch;
    for (const [keyName, saved] of [
      ['EASYJOBS_PARTNER_ID', previous.id],
      ['EASYJOBS_PARTNER_KEY', previous.key],
      ['GREENHOUSE_BOARDS', previous.greenhouse],
      ['ADZUNA_APP_ID', previous.adzunaId],
      ['ADZUNA_APP_KEY', previous.adzunaKey]
    ]) {
      if (saved === undefined) delete process.env[keyName];
      else process.env[keyName] = saved;
    }
  }
}

test('EasyJobs anonymous calls send a nonempty User-Agent and no partner secrets', async () => {
  let verified = false;
  await withProviderEnvironment(null, null, async (url, init) => {
    const host = new URL(String(url)).hostname;
    if (host === 'api.easyjobs.fr') {
      verified = true;
      assert.match(init.headers['User-Agent'], /NikoEmploi/);
      assert.equal(init.headers.Accept, 'application/json');
      assert.equal(init.headers['X-EasyJobs-Partner'], undefined);
      assert.equal(init.headers['X-EasyJobs-Partner-Key'], undefined);
    }
    return RESPONSE(EMPTY(host));
  }, async () => {
    const data = await getJobs({q:'easyjobs-anonymous-check',location:'France'});
    assert.equal(data.sources.EasyJobs.ok, true);
  });
  assert.equal(verified, true);
});

test('EasyJobs official partner headers are sent exclusively to its fixed official API host', async () => {
  let checked = false;
  const partner = 'verified-partner';
  const secret = 'test-key-never-return';
  await withProviderEnvironment(partner, secret, async (url, init) => {
    const host = new URL(String(url)).hostname;
    if (host === 'api.easyjobs.fr') {
      checked = true;
      assert.equal(init.headers['X-EasyJobs-Partner'], partner);
      assert.equal(init.headers['X-EasyJobs-Partner-Key'], secret);
    } else {
      assert.equal(init.headers['X-EasyJobs-Partner'], undefined);
      assert.equal(init.headers['X-EasyJobs-Partner-Key'], undefined);
    }
    return RESPONSE(EMPTY(host));
  }, async () => {
    const data = await getJobs({q:'easyjobs-partner-check',location:'France'});
    assert.equal(data.sources.EasyJobs.ok, true);
    assert.equal(JSON.stringify(data).includes(secret), false);
  });
  assert.equal(checked, true);
});

test('EasyJobs denied access is reported distinctly while other real providers stay available', async () => {
  await withProviderEnvironment(null, null, async url => {
    const host = new URL(String(url)).hostname;
    if (host === 'api.easyjobs.fr') return {ok:false,status:403};
    return RESPONSE(EMPTY(host));
  }, async () => {
    const data = await getJobs({q:'easyjobs-denied-check',location:'France'});
    assert.equal(data.partial, true);
    assert.equal(data.sources.EasyJobs.ok, false);
    assert.equal(data.sources.EasyJobs.code, 'access_denied');
    assert.match(data.sources.EasyJobs.error,/403/);
    assert.equal(data.sources.Jobicy.ok, true);
    assert.equal(data.sources.Arbeitnow.ok, true);
    assert.equal(data.sources.Himalayas.ok, true);
    assert.deepEqual(data.jobs, []);
  });
});

test('Incomplete partner settings stop only EasyJobs; errors expose no credential values', async () => {
  let easyJobsRequested = false;
  await withProviderEnvironment('partner-only', null, async url => {
    const host = new URL(String(url)).hostname;
    if (host === 'api.easyjobs.fr') easyJobsRequested = true;
    return RESPONSE(EMPTY(host));
  }, async () => {
    const data = await getJobs({q:'easyjobs-incomplete-check',location:'France'});
    assert.equal(easyJobsRequested, false);
    assert.equal(data.sources.EasyJobs.code, 'configuration_incomplete');
    assert.equal(data.sources.Jobicy.ok, true);
    assert.equal(JSON.stringify(data).includes('partner-only'), false);
  });
  assert.deepEqual(publicSourceFailure({statusCode:429}),{
    error:'Quota de la source atteint (429)',code:'rate_limited'
  });
});
