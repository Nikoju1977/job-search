'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {dedupe, compactJob, normaliseEasy, normaliseJobicy, normaliseArbeitnow, eligibleArbeitnow, eligibleJobicy, matches} = require('../lib/jobs');
const base = {source:'EasyJobs',company:'Atelier Niko',title:'Designer UX / UI',location:'Nantes',url:'https://easyjobs.fr/jobs/abc?mtm_source=source',date:'2026-10-20'};
const job = values => compactJob({...base,...values});
test('rejects invalid, unverifiable postings and unsafe links', () => {
  assert.equal(job({url:'javascript:alert(1)'}),null);
  assert.equal(job({url:'data:text/html,test'}),null);
  assert.equal(job({title:''}),null);
  assert.equal(job({company:''}),null);
  assert.equal(job({source:'inconnue'}),null);
});
test('deduplicates by canonical URL regardless of attribution parameters', () => {
  const a=job({url:'https://easyjobs.fr/jobs/abc?mtm_source=foo'});
  const b=job({url:'https://easyjobs.fr/jobs/abc?mtm_source=bar'});
  const result=dedupe([a,b]);assert.equal(result.jobs.length,1);assert.equal(result.removed,1);
});
test('deduplicates across sources by title, employer and city', () => {
  const first=job({title:'Développeur Sénior',location:'Nantes',company:'SAS Atelier Niko'});
  const second=job({source:'Arbeitnow',title:'Developpeur senior',location:'NANTES',company:'Atelier Niko',url:'https://arbeitnow.com/jobs/foo'});
  const result=dedupe([first,second]);assert.equal(result.jobs.length,1);
});
test('keeps genuinely different job localities', () => {
  const result=dedupe([job({location:'Nantes'}),job({location:'Bordeaux',url:'https://example.org/jobs/abc2'})]);
  assert.equal(result.jobs.length,2);
});
test('normalizers only include real source-provided fields', () => {
  assert.equal(normaliseEasy({id:'A',title:'Vendeur',company:'ACME',location:'Paris',job_url:'https://easyjobs.fr/j/1'}).source,'EasyJobs');
  assert.equal(normaliseJobicy({id:123,jobTitle:'QA',companyName:'ACME',jobGeo:'Europe',url:'https://jobicy.com/jobs/123',pubDate:'2026-10-20'}).remote,true);
  assert.equal(normaliseArbeitnow({slug:'hey',title:'Developer',company_name:'ACME',location:'France',url:'https://www.arbeitnow.com/jobs/1'}).source,'Arbeitnow');
});
test('Arbeitnow excludes Germany-only positions from France search', () => {
  assert.equal(eligibleArbeitnow(job({location:'Germany',remote:false})),false);
  assert.equal(eligibleArbeitnow(job({location:'France',remote:false})),true);
  assert.equal(eligibleArbeitnow(job({location:'Remote - Europe',remote:true})),true);
});
test('filters by keyword, location, remote, contract without inventing jobs', () => {
  const a=job({title:'Designer Produit',contract:'CDI',remote:false});
  assert.equal(matches(a,'designer','Nantes',false,'CDI'),true);
  assert.equal(matches(a,'développeur','Nantes',false,'CDI'),false);
  assert.equal(matches(a,'designer','Paris',false,'CDI'),false);
  assert.equal(matches(a,'designer','Nantes',true,'CDI'),false);
});

test('country-specific Jobicy listings are not misrepresented as open to France', () => {
  assert.equal(eligibleJobicy(job({location:'Spain',remote:true})),false);
  assert.equal(eligibleJobicy(job({location:'France',remote:true})),true);
  assert.equal(eligibleJobicy(job({location:'Europe',remote:true})),true);
});
test('distinct postings with IDs in URL queries are retained', () => {
  const a=job({url:'https://example.org/job?id=123',title:'QA Testeur'});
  const b=job({url:'https://example.org/job?id=124',title:'Product Designer'});
  assert.equal(dedupe([a,b]).jobs.length,2);
});