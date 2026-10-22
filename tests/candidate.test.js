'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {analyseCV,scoreJob,accessibleMention,draftLetter}=require('../lib/candidate');
const cv={fullName:'Marie Exemple',targetRole:'Chargée de relation client',cvText:'Marie Exemple\nRelation client, accueil, organisation et Excel.\nExpérience au service clients.'};
const job={title:'Chargée de relation client',company:'Atelier RH',location:'Nantes',excerpt:'Relation client, accueil, Excel, logiciel CRM'};
test('Extracts CV skills and produces a bounded ATS indicative score',()=>{
 const a=analyseCV(cv.cvText);
 assert.ok(a.skills.includes('relation client'));
 const m=scoreJob(cv,job);
 assert.ok(m.score>=0 && m.score<=100);assert.ok(m.matchedSkills.includes('relation client'));
 assert.ok(m.missingSkills.includes('crm'));
});
test('RQTH filters only explicit listing mentions and does not infer candidate status',()=>{
 assert.equal(accessibleMention({...job,excerpt:'Entreprise handi-engagée, aménagement de poste possible'}),true);
 assert.equal(accessibleMention({...job,excerpt:'Bureau accessible par tram'}),false);
 assert.equal(accessibleMention({...job,excerpt:'Offre ouverte aux candidats RQTH'}),true);
});
test('Local draft is grounded in genuine CV evidence and does not disclose RQTH by default',()=>{
 const text=draftLetter(cv,job);
 assert.ok(text.includes('Atelier RH'));assert.ok(text.includes('relation client'));assert.ok(!/rqth/i.test(text));
 const rqth=draftLetter(cv,job,{discloseRqth:true});
 assert.match(rqth,/RQTH/);
});
test('Browser script syntax and required DOM bindings are valid',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../public/candidatures.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'candidatures.js'}));
 const ids=[...js.matchAll(/\$\('([a-zA-Z][a-zA-Z0-9_-]*)'\)/g)].map(x=>x[1]);
 for(const id of new Set(ids))assert.ok(html.includes('id="'+id+'"'),'Missing interface element: '+id);
});
test('No unconfigured provider keys are hard-coded in client-side files',()=>{
 const content=fs.readFileSync(path.join(__dirname,'../public/candidatures.js'),'utf8');
 assert.ok(!/sk-proj-[A-Za-z0-9]/.test(content));
});
