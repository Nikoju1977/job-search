'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rank,shortlist,classifyRecruiter,redactSensitive}=require('../lib/niko-intelligence');
const sample={title:'Assistant administratif',company:'Société X',url:'https://emplois.example.org/assistant',location:'Nantes',excerpt:'Compétences Excel, accueil et facturation, relation client',posted_at:new Date().toISOString(),source:'Job Board'};
const profile={targetRole:'Assistant administratif',targetLocation:'Nantes',cvText:'Assistant administratif depuis 2 ans, maîtrise Excel, facturation et accueil, relation client.'};
test('Autonomous ranking uses five-axis signals with traceable evidence',()=>{
 const good=rank(profile,sample);
 const other=rank(profile,{...sample,title:'Développeur Rust',excerpt:'Microservices, sécurité, Kubernetes',location:'Brest',url:'https://emplois.example.org/rust'});
 assert.equal(good.eligible,true);
 assert.ok(good.score>other.score);
 assert.equal(good.explanation.axes.length,5);
 assert.ok(good.explanation.skillsMatched.includes('excel'));
 assert.equal(good.explanation.type.includes('RH'),true);
});
test('Personal disability declarations are removed before ranking',()=>{
 const raw='Relation client et comptabilité\nRQTH suite à un diagnostic personnel\nExpérience Excel';
 const safe=redactSensitive(raw);
 assert.doesNotMatch(safe,/RQTH|diagnostic|handicap/i);
 assert.match(safe,/Excel/);
 const score=rank({...profile,cvText:raw},sample);
 assert.equal(score.eligible,true);
});
test('Inclusive filtering relies only on explicit employer statement',()=>{
 const plain=shortlist(profile,[sample],{inclusiveOnly:true,minScore:0});
 assert.equal(plain.length,0);
 const inclusive=shortlist(profile,[{...sample,url:'https://emplois.example.org/accessible',excerpt:sample.excerpt+' Poste aménagé RQTH'}],{inclusiveOnly:true,minScore:0});
 assert.equal(inclusive.length,1);
});
test('Hard constraints and unverified financial requests block autonomous suggestions',()=>{
 assert.equal(rank(profile,{...sample,remote:false},{remoteOnly:true}).eligible,false);
 assert.equal(rank(profile,{...sample,excerpt:'Acheter un kit pour postuler - paiement avant embauche'}).eligible,false);
});
test('Recruiter assistant never authorizes automatic replies and detects ambiguous messages',()=>{
 for(const input of ['Nous souhaitons vous rencontrer en entretien','Malheureusement, votre candidature est non retenue','Envoyez-nous votre RIB','Nous sommes intéressés par votre profil']){
  const c=classifyRecruiter(input);
  assert.equal(c.replyAllowed,false);
  assert.equal(c.requiresReview,true);
 }
 assert.equal(classifyRecruiter('Entretien mercredi, mais candidature non retenue').kind,'incertain');
});
test('Autonomous server routes and browser controls exist with a working kill-switch',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 const browser=fs.readFileSync(path.join(__dirname,'../public/niko-autonomy.js'),'utf8');
 new vm.Script(browser);
 for(const [,id] of browser.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g))assert.ok(html.includes('id="'+id+'"'),'Missing control '+id);
 assert.match(browser,/save\(false\)/);
 assert.match(browser,/credentials:'same-origin'/);
 assert.match(browser,/action:'preview'/);
 const agent=fs.readFileSync(path.join(__dirname,'../api/niko-agent.js'),'utf8');
 assert.match(agent,/currentUser/);
 assert.match(agent,/consent/);
 assert.doesNotMatch(agent,/gmail\.googleapis|\/messages\/send/);
});
test('Neon worker is read-only for external recruiters, idempotent per user and day',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../database/niko-engine-v4.sql'),'utf8');
 const worker=fs.readFileSync(path.join(__dirname,'../lib/niko-runner.js'),'utf8');
 assert.match(sql,/unique index if not exists niko_agent_runs_one_daily/i);
 assert.match(worker,/on conflict do nothing returning id/);
 assert.doesNotMatch(worker,/\/messages\/send|resend\.com\/emails|\/api\/letter/);
});
