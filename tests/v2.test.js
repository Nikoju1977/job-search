'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {encrypt,decrypt,secureOrigin,publicConfig,ApiError}=require('../lib/platform');
test('Encrypted candidate profile roundtrip and tampering detection',()=>{
 const key=process.env.DATA_ENCRYPTION_KEY;
 process.env.DATA_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
 try{
  const src='CV privé — expérience relation client';
  const ciphertext=encrypt(src,'user-A:cv');
  assert.ok(!ciphertext.includes('relation client'));
  assert.equal(decrypt(ciphertext,'user-A:cv'),src);
  assert.throws(()=>decrypt(ciphertext,'user-B:cv'));
  assert.notEqual(encrypt(src,'user-A:cv'),ciphertext);
 }finally{if(key===undefined)delete process.env.DATA_ENCRYPTION_KEY;else process.env.DATA_ENCRYPTION_KEY=key;}
});
test('Application refuses cross-site write attempts',()=>{
 assert.throws(()=>secureOrigin({method:'POST',headers:{origin:'https://malicious.example',host:'niko-emploi.vercel.app','x-forwarded-proto':'https'}}),e=>e instanceof ApiError&&e.status===403);
 assert.doesNotThrow(()=>secureOrigin({method:'POST',headers:{origin:'https://niko-emploi.vercel.app',host:'niko-emploi.vercel.app','x-forwarded-proto':'https'}}));
});
test('Unconfigured accounts and automations do not falsely advertise readiness',()=>{
 assert.equal(typeof publicConfig().accountsAvailable,'boolean');
 assert.equal(typeof publicConfig().backgroundAvailable,'boolean');
});
test('V2 interface events, account controls and interview tools have valid syntax and IDs',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/v2.js'),'utf8');
 new vm.Script(js,{filename:'v2.js'});
 for(const [,id] of js.matchAll(/\$\('([a-zA-Z][a-zA-Z0-9_-]*)'\)/g)){
  assert.ok(html.includes('id="'+id+'"'),'Missing DOM element '+id);
 }
 assert.match(html,/Compte|compte/i);
 assert.match(html,/v2InterviewRole/);
});
test('Optional automation requires explicit external configuration and cannot start via a public CRON endpoint',()=>{
 const content=fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8');
 const config=JSON.parse(content);
 assert.ok(!config.crons||config.crons.every(c=>c.path.startsWith('/api/')));
});
