'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {notifyUser,runTrackerReminders,ready}=require('../lib/tracker-reminders');
const base={DATABASE_URL:'postgresql://test.invalid/db',RESEND_API_KEY:'resend-test-secret',EMAIL_FROM:'Niko <niko@example.org>',APP_ORIGIN:'https://niko-emploi.vercel.app'};
async function envSetup(fn){
 const previous=Object.fromEntries(Object.keys(base).map(k=>[k,process.env[k]]));
 Object.assign(process.env,base);
 try{return await fn()}finally{
  for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
}
test('Reminder delivery refuses missing environment and is never automatic by default',async()=>{
 const key=process.env.RESEND_API_KEY;delete process.env.RESEND_API_KEY;
 try{assert.equal(ready(),false);}finally{if(key!==undefined)process.env.RESEND_API_KEY=key;}
});
test('Daily digest requires explicit user opt-in, goes only to candidate and prevents duplicate sends',async()=>{
 await envSetup(async()=>{
  let sent=0,reserved=false;const queries=[];
  const queryFn=async(sql,args)=>{
   queries.push(sql);
   if(sql.includes('from public.niko_tracker_settings'))return [{one:1}];
   if(sql.includes('insert into public.niko_tracker_digest_log')){
    if(reserved)return [];
    reserved=true;return [{user_id:args[0]}];
   }
   return [];
  };
  const fetchFn=async(url,opts)=>{
   sent++;assert.equal(url,'https://api.resend.com/emails');
   const payload=JSON.parse(opts.body);
   assert.deepEqual(payload.to,['candidate@example.org']);
   assert.doesNotMatch(payload.text,/CV|RQTH|rémunération|recruteur@example\.org/);
   assert.match(payload.text,/Aucune relance ni candidature n’a été envoyée/);
   assert.match(opts.headers['Idempotency-Key'],/niko-tracker/);
   return {ok:true,json:async()=>({id:'email-test-id'})};
  };
  const args={userId:'user-1',email:'candidate@example.org',dueCount:2,day:'2026-11-18',queryFn,fetchFn};
  assert.deepEqual(await notifyUser(args),{status:'sent'});
  assert.deepEqual(await notifyUser(args),{status:'already_processed'});
  assert.equal(sent,1);assert.ok(queries.some(x=>x.includes('email_reminders=true')));
 });
});
test('Disabled reminders do not reserve or send e-mail',async()=>{
 await envSetup(async()=>{
  let calls=0;
  const queryFn=async()=>[];
  const fetchFn=async()=>{calls++;throw Error('Unexpected send')};
  const result=await notifyUser({userId:'user-2',email:'candidate@example.org',dueCount:2,day:'2026-11-18',queryFn,fetchFn});
  assert.equal(result.status,'disabled');assert.equal(calls,0);
 });
});
test('Missing tracker migration leaves daily job operational without leaking database errors',async()=>{
 await envSetup(async()=>{
  const result=await runTrackerReminders({queryFn:async()=>{const e=new Error('table missing');e.code='42P01';throw e;}});
  assert.equal(result.status,'migration_required');assert.equal(result.sent,0);
 });
});
test('Exactly one daily Vercel Cron runs candidate reminders in addition to job scans',()=>{
 const root=path.join(__dirname,'..');
 const cron=fs.readFileSync(path.join(root,'api/engine-cron.js'),'utf8');
 const conf=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 assert.match(cron,/runTrackerReminders/);
 assert.deepEqual(conf.crons,[{path:'/api/engine-cron',schedule:'0 6 * * *'}]);
});
