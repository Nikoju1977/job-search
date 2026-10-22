'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../public/niko-neuromatch-core');
const engine=require('../public/niko-engine');
const good={title:'Coordinateur administratif',company:'Entreprise',location:'Nantes',source:'Greenhouse',url:'https://example.org/a',excerpt:'Coordination de projets, Excel, facturation et gestion administrative',date:new Date().toISOString(),remote:false};
const bad={...good,title:'Développeur système',url:'https://example.org/b',excerpt:'Rust, C++ et Linux, architecture des systèmes'};
const candidate={targetRole:'Assistant administratif',targetLocation:'Nantes',cvText:'Assistant administratif. Gestion administrative, Excel et facturation. Gestion de projet et relation client.'};
test('NeuroMatch 5.0 is client-side and strips personal health/status declarations',()=>{
 assert.equal(core.VERSION,'5.0.0');
 const raw='Assistante administrative, relation client\nRQTH reconnue par la MDPH\nExpérience Excel et facturation\nE-mail: alice@example.com';
 const clean=core.sanitizeCV(raw);
 assert.match(clean,/Excel/);
 assert.doesNotMatch(clean,/RQTH|MDPH|alice@example\.com/);
 assert.doesNotMatch(core.profileText({...candidate,cvText:raw}),/RQTH|MDPH|alice@example\.com/);
});
test('Skills passport derives explicit CV skills and honest career paths',()=>{
 const p=core.passport(candidate.cvText,engine.skillSignals);
 assert.ok(p.skills.includes('excel'));
 assert.ok(p.skills.includes('administration'));
 assert.ok(p.paths.some(x=>x.title==='Coordination administrative'));
 assert.ok(p.paths.every(x=>x.shared.length>=2));
 const negated=core.passport('Aucune expérience en Python. Maîtrise Excel',engine.skillSignals);
 assert.ok(!negated.skills.includes('python'));
 assert.equal(core.passport('',engine.skillSignals).paths.length,0);
});
test('Semantic ranking keeps actual jobs, refuses unsafe URLs and skips sent/financial warnings',()=>{
 const jobs=[good,bad,{...good,url:'javascript:alert(1)',company:'Unsafe'}, {...good,url:'https://example.org/fraud',excerpt:'Paiement avant embauche, acheter un kit obligatoire'}];
 const ranks=core.rank(jobs,[.82,.12,.99,.95],candidate,engine,{sentUrls:[]});
 assert.equal(ranks[0].job.url,good.url);
 assert.ok(ranks.every(x=>!x.job.url.startsWith('javascript:')));
 assert.ok(ranks.every(x=>!x.job.url.includes('fraud')));
 assert.ok(ranks.every(x=>x.fit.score!==null));
 assert.equal(core.rank(jobs,[.85,.2,.9,.9],candidate,engine,{sentUrls:[good.url]}).some(x=>x.job.url===good.url),false);
});
test('Invalid/synthetic or cross-origin credentials job links are not accepted',()=>{
 assert.equal(core.validJob({...good,url:'javascript:alert(1)'}),false);
 assert.equal(core.validJob({...good,url:'https://user:secret@example.org/job'}),false);
 assert.equal(core.validJob({...good,url:''}),false);
 assert.equal(core.validJob(good),true);
 assert.equal(core.cosineLabel(NaN),'Non évaluée');
});
test('UI wires opt-in worker without disabling the existing no-cost baseline',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 const frontend=fs.readFileSync(path.join(__dirname,'../public/niko-neuromatch.js'),'utf8');
 const worker=fs.readFileSync(path.join(__dirname,'../public/niko-neuromatch-worker.js'),'utf8');
 new vm.Script(frontend);new vm.Script(worker);
 assert.match(html,/src="\/niko-neuromatch-core\.js"/);
 assert.match(html,/src="\/niko-neuromatch\.js"/);
 assert.match(html,/src="\/niko-engine\.js"/);
 for(const [,id] of frontend.matchAll(/\$\('([a-zA-Z][\w-]+)'\)/g))
  assert.ok(html.includes('id="'+id+'"'),'Missing UI control '+id);
 assert.match(frontend,/new Worker\('\/niko-neuromatch-worker\.js'/);
 assert.match(frontend,/\.terminate\(\)/);
 assert.match(worker,/Xenova\/paraphrase-multilingual-MiniLM-L12-v2/);
 assert.match(worker,/@huggingface\/transformers@4\.3\.1/);
 assert.doesNotMatch(frontend,/\/api\/letter|\/api\/reply-agent|\/api\/applications/);
 assert.doesNotMatch(worker,/\/api\/letter|\/api\/reply-agent|\/api\/applications/);
 assert.match(html,/id="nikoAnalyze"/);
});
