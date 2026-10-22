'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
let server,base;
async function started(){
 const port=18977;const env={...process.env,PORT:String(port)};
 delete env.OPENAI_API_KEY;delete env.GOOGLE_CLIENT_ID;
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
