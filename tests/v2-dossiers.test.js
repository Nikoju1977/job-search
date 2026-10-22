'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('Candidate dossier interface is complete and has no inactive buttons',()=>{
 const page=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/v2-dossiers.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(js));
 for(const [,id] of js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)){
  assert.ok(page.includes('id="'+id+'"'),id+' is missing from candidate page');
 }
 for(const id of ['v2DossierSave','v2FraudCheck','v2DossierStatus','v2FraudFindings']){
  assert.ok(page.includes('id="'+id+'"'));
 }
});
test('No fraud result pretends to certify an employer',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/v2-dossiers.js'),'utf8');
 assert.match(js,/ne prouve pas que l’offre soit authentique/);
 assert.match(js,/confirm\(/);
 assert.match(js,/action:'draft'/);
 assert.doesNotMatch(js,/action:'sent'/);
});
