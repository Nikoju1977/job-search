'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Engine=require('../public/niko-engine');
const job=(extras={})=>({title:'Assistant administratif',company:'Entreprise',location:'Nantes',url:'https://example.org/jobs/1',excerpt:'Excel, relation client et facturation',date:new Date().toISOString(),remote:false,...extras});
test('NIKO engine works standalone in Node and browser-compatible JS',()=>{
 assert.equal(Engine.VERSION,'3.0.0');
 const source=fs.readFileSync(path.join(__dirname,'../public/niko-engine.js'),'utf8');
 new vm.Script(source);
});
test('Skills ontology recognizes common synonyms, not substring false positives',()=>{
 assert.ok(Engine.skillSignals('Maîtrise de Power Query et TCD').includes('excel'));
 assert.ok(Engine.skillSignals('PostgreSQL et JavaScript').includes('sql'));
 assert.ok(!Engine.skillSignals('Nosql engineering').includes('sql'));
 assert.ok(Engine.skillSignals('Aide-soignant et soins').includes('santé'));
});
test('Skill negations are not credited as CV experience',()=>{
 assert.ok(!Engine.skillSignals("Aucune expérience en Python",{isCV:true}).includes('python'));
 assert.ok(Engine.skillSignals('5 années avec Python',{isCV:true}).includes('python'));
});
test('Relevant job ranks above unrelated role while reporting evidence',()=>{
 const profile={cvText:'Assistant administratif, expérience Excel, relation client et facturation à Nantes.',targetRole:'assistant administratif',targetLocation:'Nantes'};
 const matching=Engine.screen(profile,job());
 const unrelated=Engine.screen(profile,job({title:'Architecte informatique',location:'Marseille',excerpt:'React, C++, sécurité des systèmes'}));
 assert.ok(matching.score>unrelated.score,{matching,unrelated});
 assert.ok(matching.shared.includes('excel'));
 assert.ok(matching.matchReasons.length>0);
 assert.ok(unrelated.watchouts.length>0);
 assert.equal(matching.axes.length,5);
});
test('No profile returns no pseudo-precision and never uses RQTH as a negative factor',()=>{
 const vacancy=job({excerpt:'Excel requis, poste aménagé pour RQTH'});
 assert.equal(Engine.screen({cvText:'',targetRole:''},vacancy).score,null);
 const a=Engine.screen({cvText:'Expérience Excel relation client',targetRole:'assistant administratif'},vacancy);
 const b=Engine.screen({cvText:'Expérience Excel relation client',targetRole:'assistant administratif'},job({excerpt:'Excel requis'}));
 assert.ok(a.inclusionMention);
 assert.ok(a.score>=0&&a.score<=100);
 assert.ok(b.score>=0&&b.score<=100);
});
test('Agent plan deduplicates and excludes sent and ignored application URLs',()=>{
 const profile={cvText:'Assistant administratif, expérience Excel et relation client.',targetRole:'assistant administratif',targetLocation:'Nantes'};
 const jobs=[job(),job(),job({url:'https://example.org/jobs/2',title:'Assistant administratif RH'})];
 const plan=Engine.plan(profile,jobs,{minScore:0,sentUrls:['https://example.org/jobs/1']});
 assert.equal(plan.scanned,2);
 assert.ok(plan.recommended.every(x=>x.job.url!=='https://example.org/jobs/1'));
 assert.equal(plan.excludedAlreadySent,1);
 assert.equal(plan.automaticallySent,0);
 assert.equal(plan.humanApprovalRequired,true);
});
test('Recruiter classification never auto-responds to interviews, refusals or uncertain messages',()=>{
 for(const sample of [
  'Nous souhaitons vous proposer un entretien mercredi à 14h',
  'Malheureusement, votre candidature n’est pas retenue.',
  'Pouvez-vous envoyer votre RIB et signer votre contrat ?',
  'Votre candidature est en cours de traitement.'
 ]){
  const result=Engine.classification(sample);
  assert.equal(result.autoReplyAllowed,false);
 }
 assert.equal(Engine.classification('Nous souhaitons vous rencontrer en entretien').category,'entretien');
 assert.equal(Engine.classification('Votre candidature n’est pas retenue').category,'defavorable');
});
test('Studio loads intelligence modules, without sending CV to ranking APIs',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/niko-agents.js'),'utf8');
 new vm.Script(js);
 assert.match(html,/src="\/niko-engine\.js"/);
 assert.match(html,/src="\/niko-agents\.js"/);
 assert.match(html,/id="nikoWatch"/);
 assert.match(js,/NikoEngine\.plan|engine\.plan/);
 assert.doesNotMatch(js,/\/api\/letter|\/api\/reply-agent/);
});
