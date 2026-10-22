'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
let server,base;
async function started(){
 const port=18977;const env={...process.env,PORT:String(port)};
 delete env.OPENAI_API_KEY;delete env.GOOGLE_CLIENT_ID;delete env.SUPABASE_URL;delete env.SUPABASE_ANON_KEY;delete env.SUPABASE_SERVICE_ROLE_KEY;delete env.DATA_ENCRYPTION_KEY;
 server=spawn(process.execPath,['server.js'],{env,stdio:['ignore','pipe','pipe'],cwd:require('node:path').join(__dirname,'..')});
 base='http://127.0.0.1:'+port;
 for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/config');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,80));}
 throw Error('Server did not start');
}
test('Local candidate studio and API integration',async t=>{
 await started();
 t.after(()=>{server.kill('SIGTERM')});
 await t.test('Homepage and studio are served, including candidate features',async()=>{
  let r=await fetch(base+'/');let html=await r.text();assert.equal(r.status,200);assert.match(html,/candidatures\.html/);
  r=await fetch(base+'/candidatures.html');html=await r.text();assert.equal(r.status,200);assert.match(html,/autoAcknowledgements/);assert.match(html,/rqthOnly/);
 });
 await t.test('Unconfigured API reports reality rather than claiming readiness',async()=>{
  const r=await fetch(base+'/api/config');const c=await r.json();
  assert.equal(r.status,200);assert.equal(c.aiConfigured,false);assert.equal(c.gmailConfigured,false);
 });
 await t.test('V2 cockpit pages and account readiness endpoint respond correctly',async()=>{
  let response=await fetch(base+'/candidatures.html');let html=await response.text();assert.equal(response.status,200);assert.match(html,/v2InterviewRole/);assert.match(html,/v2Sent/);
  response=await fetch(base+'/v2.js');assert.equal(response.status,200);
  response=await fetch(base+'/api/account?public=true');let data=await response.json();assert.equal(response.status,200);assert.equal(data.accountsAvailable,false);assert.equal(data.backgroundAvailable,false);
 });
 await t.test('Account APIs safely refuse missing external configuration',async()=>{
  let response=await fetch(base+'/api/account');assert.equal(response.status,503);
  response=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:'candidate@example.org'})});assert.equal(response.status,503);
  response=await fetch(base+'/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'draft',consent:true,job:{title:'Test',company:'Entreprise',url:'https://example.org'}})});assert.equal(response.status,503);
 });
 await t.test('Generative endpoint requires consent and valid CV',async()=>{
  const r=await fetch(base+'/api/letter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:{cvText:'N/A'},job:{title:'Vendeur',company:'A'}})});
  assert.equal(r.status,400);const x=await r.json();assert.ok(x.error);
 });
 await t.test('Unconfigured AI cannot silently impersonate a recruiter',async()=>{
  const r=await fetch(base+'/api/reply-agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aiConsent:true,message:{body:'Nous souhaitons vous rencontrer pour un entretien.'}})});
  assert.equal(r.status,503);const x=await r.json();assert.ok(x.error);
 });
 await t.test('Oversized profile requests are rejected',async()=>{
  const r=await fetch(base+'/api/letter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'A'.repeat(200000)})});
  assert.equal(r.status,413);
 });
});
