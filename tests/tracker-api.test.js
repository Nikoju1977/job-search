'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../lib/niko-db'),auth=require('../lib/niko-auth');
const savedQuery=db.query,savedCurrent=auth.currentUser;
const id='b79fd138-551e-49bf-a701-9e720c6b82b4',uid='dc71a06c-1d17-43c3-b116-74602a671a54';
function harness(queryFn){
 db.query=queryFn;
 auth.currentUser=async()=>({id:uid,email:'candidate@example.org'});
 delete require.cache[require.resolve('../api/tracker')];
 const tracker=require('../api/tracker');
 async function call(method,body={},headers={origin:'https://niko-emploi.vercel.app',host:'niko-emploi.vercel.app','x-forwarded-proto':'https'}){
  const req={method,body,query:{},headers},response={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};
  await tracker(req,response);
  return response;
 }
 return {call};
}
test.after(()=>{db.query=savedQuery;auth.currentUser=savedCurrent;delete require.cache[require.resolve('../api/tracker')];});
const base={title:'Technicien',company:'Entreprise Exemple',url:'https://example.org/jobs/123',location:'Nantes',source:'Site entreprise'};
const patch={id,version:2,consent:true,job:base,status:'sent',channel:'email',nextActionAt:null,interviewAt:null,interviewFormat:'',to:'rh@example.org',recruiterName:'RH',notes:'Note candidat',archived:false};
test('Cloud tracker rejects cross-origin and requires explicit consent before writes',async()=>{
 const {call}=harness(async()=>{throw Error('DB should not be accessed');});
 const bad=await call('PATCH',patch,{origin:'https://evil.invalid',host:'niko-emploi.vercel.app','x-forwarded-proto':'https'});
 assert.equal(bad.statusCode,403);
 const missing=await call('PATCH',{...patch,consent:false});
 assert.equal(missing.statusCode,400);
});
test('Cloud create never invents a Gmail sent confirmation',async()=>{
 const old=process.env.DATA_ENCRYPTION_KEY;process.env.DATA_ENCRYPTION_KEY=Buffer.alloc(32,18).toString('base64');
 let sql='',args;
 try{
  const {call}=harness(async(query,params)=>{sql=query;args=params;return [{id,status:'sent'}];});
  const response=await call('POST',{action:'create',consent:true,job:base,status:'sent',channel:'portal',
   notes:'candidature déclarée',nextActionAt:null,interviewAt:null,interviewFormat:''});
  assert.equal(response.statusCode,201);
  assert.equal(response.data.id,id);
  assert.match(sql,/on conflict \(user_id,job_url\) do nothing/);
  assert.equal(args[0],uid);
  assert.equal(args[16],'self_reported');
  assert.doesNotMatch(sql,/gmail_message_id|gmailAccessToken|verifyGmailSend/);
 }finally{if(old===undefined)delete process.env.DATA_ENCRYPTION_KEY;else process.env.DATA_ENCRYPTION_KEY=old;}
});
test('Cloud patch applies per-user optimistic concurrency and encrypts notes',async()=>{
 const old=process.env.DATA_ENCRYPTION_KEY;process.env.DATA_ENCRYPTION_KEY=Buffer.alloc(32,18).toString('base64');
 let sql='',args=[];
 try{
  const {call}=harness(async(query,params)=>{sql=query;args=params;return [{id,status:'sent',version:3}];});
  const response=await call('PATCH',patch);
  assert.equal(response.statusCode,200);
  assert.equal(response.data.version,3);
  assert.match(sql,/where a.user_id=\$1 and a.id=p.id and a.version=\$3/);
  assert.equal(args[0],uid);assert.equal(args[1],id);assert.equal(args[2],2);
  assert.notEqual(args[6],'Note candidat');
  assert.equal(args[3],'sent');
  assert.equal(args[16],base.title);
 }finally{if(old===undefined)delete process.env.DATA_ENCRYPTION_KEY;else process.env.DATA_ENCRYPTION_KEY=old;}
});
test('Stale candidate versions fail without silent overwrite',async()=>{
 const {call}=harness(async()=>[]);
 const res=await call('PATCH',{...patch,notes:''});
 assert.equal(res.statusCode,409);
 assert.match(res.data.error,/changé|n’existe plus/);
});
test('Delete affects only the authenticated owner and requires confirmation',async()=>{
 let sql,params;
 const {call}=harness(async(query,args)=>{sql=query;params=args;return [{id}];});
 const r=await call('DELETE',{id,consent:true});
 assert.equal(r.statusCode,200);assert.equal(r.data.deleted,true);
 assert.match(sql,/where id=\$1 and user_id=\$2/);
 assert.deepEqual(params,[id,uid]);
});
test('Owner-scoped data retrieval does not include other user records',async()=>{
 const statements=[];
 const {call}=harness(async(sql,args)=>{
  statements.push({sql,args});
  if(sql.includes('from public.niko_tracker_settings'))return [{email_reminders:false}];
  return [];
 });
 const r=await call('GET');
 assert.equal(r.statusCode,200);
 assert.deepEqual(r.data.applications,[]);
 assert.deepEqual(r.data.events,[]);
 assert.ok(statements.every(x=>x.sql.includes('user_id=$1')&&x.args[0]===uid));
});

test('Legacy event import uses source dates and encrypted notes within the atomic dossier create',async()=>{
 const old=process.env.DATA_ENCRYPTION_KEY;process.env.DATA_ENCRYPTION_KEY=Buffer.alloc(32,21).toString('base64');
 let statement='',parameters=[];
 try{
  const {call}=harness(async(sql,args)=>{statement=sql;parameters=args;return [{id,status:'draft'}];});
  const response=await call('POST',{action:'create',consent:true,job:base,status:'draft',
   channel:'portal',notes:'',nextActionAt:null,interviewAt:null,interviewFormat:'',
   history:[{kind:'imported',status:'sent',date:'2026-10-10T09:00:00Z',note:'Note historique'}]});
  assert.equal(response.statusCode,201);
  assert.match(statement,/jsonb_to_recordset\(\$19::jsonb\)/);
  const imported=JSON.parse(parameters[18]);
  assert.equal(imported.length,1);
  assert.equal(imported[0].occurred_at,'2026-10-10T09:00:00.000Z');
  assert.notEqual(imported[0].message_ciphertext,'Note historique');
 }finally{if(old===undefined)delete process.env.DATA_ENCRYPTION_KEY;else process.env.DATA_ENCRYPTION_KEY=old;}
});
