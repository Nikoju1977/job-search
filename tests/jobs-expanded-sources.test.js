'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {eligibleRemotive,normaliseRemotive,normaliseJooble,eligibleLever,normaliseLever,getJobs}=require('../lib/jobs');

test('Remotive requires explicit geographic eligibility for France and its original URL',()=>{
 const base={id:901,title:'QA Engineer',company_name:'Entreprise Demo',url:'https://remotive.com/remote-jobs/qa/901',
 candidate_required_location:'Europe',job_type:'full_time',salary:'€40k',publication_date:'2026-11-01T10:00:00Z'};
 assert.equal(eligibleRemotive(base),true);
 assert.equal(eligibleRemotive({...base,candidate_required_location:'USA Only'}),false);
 assert.equal(eligibleRemotive({...base,candidate_required_location:''}),false);
 const job=normaliseRemotive(base);
 assert.equal(job.source,'Remotive');
 assert.equal(job.remote,true);
 assert.equal(job.url,base.url);
 assert.equal(normaliseRemotive({...base,url:'javascript:alert(1)'}),null);
 assert.equal(normaliseRemotive({...base,url:'https://evil.example/jobs/901'}),null);
});
test('Jooble France retains the documented provider fields without inventing companies',()=>{
 const raw={id:123,title:'Comptable',company:'Entreprise Exemple',location:'Nantes',
  link:'https://fr.jooble.org/jdp/123',snippet:'Facturation',type:'CDI',salary:'30 000 €',updated:'2026-11-01'};
 const job=normaliseJooble(raw);
 assert.equal(job.source,'Jooble');
 assert.equal(job.salary,'30 000 €');
 assert.equal(job.location,'Nantes');
 assert.equal(normaliseJooble({...raw,company:''}),null);
 assert.equal(normaliseJooble({...raw,link:'data:text/html,hello'}),null);
});
test('Lever public boards accept FR positions but reject US-only remote jobs',()=>{
 const raw={id:'a',text:'Chargé de communication',country:'FR',
  categories:{location:'Paris, France',commitment:'Full-time'},
  hostedUrl:'https://jobs.lever.co/example/a',workplaceType:'hybrid'};
 assert.equal(eligibleLever(raw),true);
 assert.equal(eligibleLever({...raw,country:'US',categories:{location:'New York, USA'}}),false);
 assert.equal(eligibleLever({...raw,country:'US',categories:{location:'Remote - Europe'}}),true);
 assert.equal(normaliseLever(raw,'Employeur Configuré').company,'Employeur Configuré');
 assert.equal(normaliseLever({...raw,country:'US',categories:{location:'Boston, US'}},'Employeur Configuré'),null);
});

test('Aggregator calls the new official hosts only when the sources are activated',async()=>{
 const oldFetch=global.fetch, oldJooble=process.env.JOOBLE_FR_API_KEY, oldLever=process.env.LEVER_BOARDS;
 process.env.JOOBLE_FR_API_KEY='TEST-KEY-123456';
 process.env.LEVER_BOARDS='eu/demo:Employeur Lever';
 const calls=[];
 const good=value=>({ok:true,json:async()=>value});
 global.fetch=async(url,opts={})=>{
  const u=new URL(String(url));calls.push({host:u.hostname,method:opts.method||'GET',url:u.toString()});
  if(u.hostname==='api.easyjobs.fr')return good({data:[],pagination:{}});
  if(u.hostname==='jobicy.com')return good({jobs:[]});
  if(u.hostname==='www.arbeitnow.com')return good({data:[]});
  if(u.hostname==='himalayas.app')return good({jobs:[]});
  if(u.hostname==='remotive.com')return good({jobs:[{id:700,title:'Designer',company_name:'Employeur Remotive',
    candidate_required_location:'Europe',url:'https://remotive.com/remote-jobs/design/700'}]});
  if(u.hostname==='fr.jooble.org'){
   assert.equal(opts.method,'POST');
   assert.deepEqual(JSON.parse(opts.body).location,'Nantes');
   return good({jobs:[{id:800,title:'Designer',company:'Employeur Jooble',location:'Nantes',
    link:'https://fr.jooble.org/jdp/800'}]});
  }
  if(u.hostname==='api.eu.lever.co')return good([{id:'900',text:'Designer',country:'FR',
   categories:{location:'Nantes, France'},hostedUrl:'https://jobs.eu.lever.co/demo/900'}]);
  throw Error('Unexpected host: '+u.hostname);
 };
 try{
  const result=await getJobs({q:'Designer',location:'Nantes'});
  for(const n of ['Remotive','Jooble','Lever']){
    assert.equal(result.sources[n].ok,true,n+' must return a real provider response');
  }
  assert.ok(result.jobs.some(j=>j.source==='Jooble'));
  assert.ok(result.jobs.some(j=>j.source==='Lever'));
  assert.ok(calls.some(c=>c.host==='remotive.com'));
  assert.ok(calls.some(c=>c.host==='fr.jooble.org'&&c.method==='POST'));
  assert.ok(calls.some(c=>c.host==='api.eu.lever.co'));
 }finally{
  global.fetch=oldFetch;
  if(oldJooble===undefined)delete process.env.JOOBLE_FR_API_KEY;else process.env.JOOBLE_FR_API_KEY=oldJooble;
  if(oldLever===undefined)delete process.env.LEVER_BOARDS;else process.env.LEVER_BOARDS=oldLever;
 }
});
test('Search UI exposes actual source and date filters without simulated job data',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const home=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 for(const id of ['filterSource','filterAge','clearFilters','refreshSearch','searchSummary'])
  assert.ok(home.includes('id="'+id+'"'),id+' control missing');
 assert.match(js,/state\.jobs=data\.jobs\.filter/);
 assert.match(js,/chosenSource/);
 assert.match(js,/cutoff/);
});
