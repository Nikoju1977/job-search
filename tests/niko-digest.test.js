'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {notifyNewMatches}=require('../lib/niko-digest');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('Digest never sends without credentials or new matches',async()=>{
 const original=process.env.RESEND_API_KEY;delete process.env.RESEND_API_KEY;
 try{const r=await notifyNewMatches({userId:'candidate',newCount:8,runDay:'2026-10-22',queryFn:()=>{throw Error('must not access db')},fetchFn:()=>{throw Error('must not send')}});assert.equal(r.status,'skipped');}
 finally{if(original!==undefined)process.env.RESEND_API_KEY=original;}
});
test('Daily digest is consent based, idempotent and contains no RQTH/profile information',async()=>{
 const keys=['RESEND_API_KEY','EMAIL_FROM','APP_ORIGIN'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{RESEND_API_KEY:'unit_dummy',EMAIL_FROM:'alerts@domain.example',APP_ORIGIN:'https://niko-emploi.vercel.app'});
 let sent=0;let claims=0;let record='';
 const db=async(q,args)=>{
  if(q.includes('select u.email'))return [{email:'test@example.org'}];
  if(q.includes('insert into public.niko_agent_digests')){claims++;return claims===1?[{user_id:'u-test'}]:[];}
  if(q.includes('update public.niko_agent_digests'))return [];
  throw Error('Unexpected DB query');
 };
 const fetchFn=async(url,options)=>{sent++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],'niko-digest:u-test:2026-10-22');record=options.body;return {ok:true,json:async()=>({id:'email-confirmed'})};};
 try{
  const options={userId:'u-test',newCount:3,runDay:'2026-10-22',queryFn:db,fetchFn};
  const first=await notifyNewMatches(options),second=await notifyNewMatches(options);
  assert.equal(first.status,'sent');assert.equal(second.status,'already_processed');assert.equal(sent,1);
  assert.match(record,/3 nouvelles offres/);assert.doesNotMatch(record,/RQTH|handicap|cvText|candidateProfile/i);
  assert.doesNotMatch(record,/recruteur@/i);
 }finally{for(const [k,value] of Object.entries(old)){if(value===undefined)delete process.env[k];else process.env[k]=value;}}
});
test('Rejects unconsented digest without touching email API',async()=>{
 const keys=['RESEND_API_KEY','EMAIL_FROM','APP_ORIGIN'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{RESEND_API_KEY:'unit_dummy',EMAIL_FROM:'alerts@domain.example',APP_ORIGIN:'https://niko-emploi.vercel.app'});
 try{
  const result=await notifyNewMatches({userId:'someone',newCount:2,runDay:'2026-10-22',queryFn:async()=>[],fetchFn:()=>{throw Error('must not send')}});
  assert.equal(result.status,'disabled');
 }finally{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('Agent UI offers save, dismiss and digest consent controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 const browser=fs.readFileSync(path.join(__dirname,'../public/niko-autonomy.js'),'utf8');
 new vm.Script(browser);
 for(const id of ['naDigest','naDigestConsent','naStop','naEnabled'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(browser,/action:'feedback'/);assert.match(browser,/kind==='dismissed'/);assert.match(browser,/digestConsent:/);
});
