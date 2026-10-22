'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {normaliseHimalayas,eligibleHimalayas,normaliseAdzuna,normaliseGreenhouse,eligibleGreenhouse,dedupe,getJobs}=require('../lib/jobs');
const now=Math.floor(Date.now()/1000);
const remote={guid:'himalayas-remote-abc',title:'Product Designer',companyName:'Employeur Test',
 applicationLink:'https://himalayas.app/companies/employeur/jobs/designer',locationRestrictions:[],
 pubDate:now-3600,expiryDate:now+86400,excerpt:'Design produit et figma',employmentType:'Full Time',
 minSalary:35,maxSalary:50,currency:'EUR',salaryPeriod:'hourly'};
test('Himalayas: respects France-only and worldwide eligibility, not US/DE-only roles',()=>{
 assert.equal(eligibleHimalayas(remote),true);
 assert.equal(eligibleHimalayas({...remote,locationRestrictions:[{alpha2:'FR',name:'France'}]}),true);
 assert.equal(eligibleHimalayas({...remote,locationRestrictions:[{alpha2:'DE',name:'Germany'}]}),false);
 assert.equal(eligibleHimalayas({...remote,locationRestrictions:['United States']}),false);
 assert.equal(eligibleHimalayas({...remote,locationRestrictions:null}),false);
 assert.equal(eligibleHimalayas({...remote,expiryDate:now-60}),false);
});
test('Himalayas: exact supplied applicationLink, source attribution, salary period and expiry',()=>{
 const job=normaliseHimalayas(remote);
 assert.equal(job.url,remote.applicationLink);
 assert.equal(job.source,'Himalayas');
 assert.equal(job.sourceUrl,'https://himalayas.app');
 assert.equal(job.remote,true);
 assert.match(job.salary,/\/h/);
 assert.equal(normaliseHimalayas({...remote,applicationLink:'javascript:alert(1)'}),null);
 assert.equal(normaliseHimalayas({...remote,expiryDate:now-10}),null);
});
test('Adzuna: normalises real documented nested fields, no invented advertiser',()=>{
 const real=normaliseAdzuna({id:'a01',title:'Comptable',company:{display_name:'Cabinet Test'},
  location:{display_name:'Nantes'},redirect_url:'https://www.adzuna.fr/details/11',
  description:'Facturation',created:new Date().toISOString(),salary_min:32000,salary_max:40000});
 assert.equal(real.source,'Adzuna');
 assert.equal(real.company,'Cabinet Test');
 assert.equal(real.location,'Nantes');
 assert.ok(real.salary.includes('/an'));
 assert.equal(normaliseAdzuna({title:'Anonyme',redirect_url:'https://www.adzuna.fr/details/12'}),null);
});
test('Greenhouse: configured employer boards exclude US-only remote jobs',()=>{
 const first={id:123,title:'Developer',location:{name:'Paris, France'},absolute_url:'https://job-boards.greenhouse.io/employer/jobs/123'};
 assert.equal(eligibleGreenhouse(first),true);
 assert.equal(normaliseGreenhouse(first,'Entreprise Configuree').company,'Entreprise Configuree');
 assert.equal(eligibleGreenhouse({...first,location:{name:'Remote - United States'}}),false);
 assert.equal(eligibleGreenhouse({...first,location:{name:'Remote - Europe'}}),true);
 assert.equal(normaliseGreenhouse({...first,location:{name:'New York, USA'}},'Entreprise Configuree'),null);
});
test('Source deduplication preserves separate employers and localities',()=>{
 const a=normaliseHimalayas(remote);
 const b=normaliseHimalayas({...remote,guid:'second',applicationLink:'https://himalayas.app/companies/other/jobs/designer',companyName:'Autre Employeur'});
 assert.equal(dedupe([a,b]).jobs.length,2);
});
test('End-to-end /api/jobs aggregator includes newly fetched Himalayas jobs with source status',async()=>{
 const previous=global.fetch;
 let requested=false;
 const source=(raw)=>({ok:true,json:async()=>raw});
 global.fetch=async(url)=>{
  const host=new URL(url).hostname;
  if(host==='himalayas.app'){requested=true;assert.match(url,/country=FR/);return source({jobs:[remote],totalCount:1});}
  if(host==='api.easyjobs.fr')return source({data:[],pagination:{has_next_page:false}});
  if(host==='jobicy.com')return source({jobs:[]});
  if(host==='www.arbeitnow.com')return source({data:[]});
  throw Error('Unexpected endpoint: '+url);
 };
 try{
  const out=await getJobs({q:'',location:'Toute la France'});
  assert.equal(requested,true);
  assert.equal(out.sources.Himalayas.ok,true);
  assert.ok(out.jobs.some(j=>j.source==='Himalayas'));
  assert.ok(out.jobs.every(j=>j.url.startsWith('https://')));
 }finally{global.fetch=previous;}
});
test('Frontend shows a visible Himalayas credit link and dynamic provider list',()=>{
 const ui=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
 assert.match(ui,/https:\/\/himalayas\.app/);
 assert.match(ui,/Object\.keys\(data\.sources/);
 const studio=fs.readFileSync(require('node:path').join(__dirname,'../public/candidatures.js'),'utf8');
 assert.match(studio,/sourceTag\.href='https:\/\/himalayas\.app'/);
});
