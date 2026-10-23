'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../public',p),'utf8');

test('Premium design layer is loaded after original CSS on both pages',()=>{
 const home=read('index.html'),studio=read('candidatures.html');
 for(const html of [home,studio]){
  assert.match(html,/href="\/premium-2026\.css"/);
  assert.ok(html.indexOf('premium-2026.css')>html.indexOf('styles.css'));
  assert.match(html,/<nav class="mobile-dock" aria-label="Navigation rapide mobile">/);
 }
 assert.ok(studio.indexOf('premium-2026.css')>studio.indexOf('candidatures.css'));
});
test('Mobile navigation anchors link only to actual sections',()=>{
 const pages={home:read('index.html'),studio:read('candidatures.html')};
 for(const [page,html] of Object.entries(pages)){
  const section=html.match(/<nav class="mobile-dock"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(section,page+' mobile navigation missing');
  for(const [,anchor] of section.matchAll(/href="#([^"]+)"/g)){
   assert.ok(html.includes('id="'+anchor+'"'),page+' has broken anchor #'+anchor);
  }
  assert.match(section,/href="\/candidatures\.html"|href="#cv"/);
 }
});
test('Premium layout has explicit mobile and accessibility fallbacks',()=>{
 const css=read('premium-2026.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);
 assert.match(css,/max-width:650px/);
 assert.match(css,/\.mobile-dock/);
 assert.match(css,/\.studio-sidebar/);
 assert.match(css,/\.n5-lab/);
 assert.match(css,/\.job-card/);
 assert.match(css,/\.search-card/);
 assert.match(css,/overflow-wrap:anywhere/);
 const opening=(css.match(/\{/g)||[]).length,closing=(css.match(/\}/g)||[]).length;
 assert.equal(opening,closing,'CSS has unmatched braces');
});
test('Redesign preserves core candidate forms and controls',()=>{
 const html=read('candidatures.html'),home=read('index.html');
 for(const id of ['cvText','nikoAnalyze','n5Run','n5Passport','naStop','findJobsBtn','sendConsent','v2AccountEmail','v2Feedback']){
  assert.ok(html.includes('id="'+id+'"'),'candidate interaction missing: '+id);
 }
 for(const id of ['searchForm','keyword','location','jobList','providerList','showSaved']){
  assert.ok(home.includes('id="'+id+'"'),'search interaction missing: '+id);
 }
 assert.match(home,/Offres sourcées/);
 assert.match(home,/IA gratuite à la demande/);
});
