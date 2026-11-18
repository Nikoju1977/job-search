'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {eligibleAshby,normaliseAshby,eligibleSmartRecruiters,normaliseSmartRecruiters,getJobs}=require('../lib/jobs');
test('Ashby includes published France vacancies and rejects unlisted or US-only remote roles',()=>{
 const base={title:'Ingénieur QA',location:'Nantes, France',jobUrl:'https://jobs.ashbyhq.com/demo/123',
   isListed:true,isRemote:true,workplaceType:'Remote',publishedAt:'2026-11-15T10:00:00Z',
   employmentType:'FullTime',compensation:{scrapeableCompensationSalarySummary:'40 000 – 55 000 EUR'}};
 assert.equal(eligibleAshby(base),true);
 assert.equal(normaliseAshby(base,'Entreprise Demo').source,'Ashby');
 assert.equal(normaliseAshby(base,'Entreprise Demo').salary,'40 000 – 55 000 EUR');
 assert.equal(eligibleAshby({...base,isListed:false}),false);
 assert.equal(eligibleAshby({...base,location:'New York, USA'}),false);
 assert.equal(eligibleAshby({...base,location:'United States',address:{postalAddress:{addressCountry:'US'}}}),false);
});
test('SmartRecruiters excludes remote US-only and retains public source company',()=>{
 const base={id:'99',name:'Assistant administratif',location:{country:'FR',city:'Nantes',remote:false},
   typeOfEmployment:{label:'CDI'},releasedDate:'2026-11-14T10:00:00Z'};
 assert.equal(eligibleSmartRecruiters(base),true);
 const job=normaliseSmartRecruiters(base,'Entreprise Demo','demo');
 assert.equal(job.source,'SmartRecruiters');
 assert.equal(job.company,'Entreprise Demo');
 assert.equal(job.url,'https://jobs.smartrecruiters.com/demo/99');
 assert.equal(eligibleSmartRecruiters({...base,location:{country:'US',city:'Los Angeles',remote:true}}),false);
});
test('Configured ATS boards are called with official public endpoints',async()=>{
 const save={fetch:global.fetch,ashby:process.env.ASHBY_BOARDS,smart:process.env.SMARTRECRUITERS_BOARDS};
 process.env.ASHBY_BOARDS='demo:Entreprise Ashby';
 process.env.SMARTRECRUITERS_BOARDS='demo:Entreprise Smart';
 const calls=[],good=data=>({ok:true,json:async()=>data});
 global.fetch=async url=>{
   const u=new URL(String(url));calls.push(u);
   if(u.hostname==='api.easyjobs.fr')return good({data:[]});
   if(u.hostname==='jobicy.com')return good({jobs:[]});
   if(u.hostname==='www.arbeitnow.com')return good({data:[]});
   if(u.hostname==='himalayas.app')return good({jobs:[]});
   if(u.hostname==='remotive.com')return good({jobs:[]});
   if(u.hostname==='api.ashbyhq.com')return good({jobs:[{
     title:'Designer',location:'Nantes, France',isListed:true,jobUrl:'https://jobs.ashbyhq.com/demo/88'}]});
   if(u.hostname==='api.smartrecruiters.com')return good({content:[{
     id:'89',name:'Designer',location:{country:'FR',city:'Nantes'}}]});
   throw Error('Unexpected provider '+u.hostname);
 };
 try{
   const result=await getJobs({q:'Designer',location:'Nantes'});
   assert.equal(result.sources.Ashby.ok,true);
   assert.equal(result.sources.SmartRecruiters.ok,true);
   assert.equal(result.jobs.filter(j=>['Ashby','SmartRecruiters'].includes(j.source)).length,2);
   assert.ok(calls.some(x=>x.hostname==='api.ashbyhq.com'&&x.searchParams.has('includeCompensation')));
   assert.ok(calls.some(x=>x.hostname==='api.smartrecruiters.com'&&x.searchParams.get('country')==='FR'&&x.searchParams.get('destination')==='PUBLIC'));
 }finally{
   global.fetch=save.fetch;
   for(const [key,value] of [['ASHBY_BOARDS',save.ashby],['SMARTRECRUITERS_BOARDS',save.smart]]){
     if(value===undefined)delete process.env[key];else process.env[key]=value;
   }
 }
});
