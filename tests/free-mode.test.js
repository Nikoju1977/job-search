'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const config=require('../api/config');
function serve(method='GET'){
 let statusCode=200,payload=null,headers={};
 const res={setHeader(k,v){headers[k]=v;},status(v){statusCode=v;return this;},
 json(v){payload=v;return this}};
 config({method},res);
 return {statusCode,payload,headers};
}
test('free-first mode never claims cloud AI or Gmail integrations are available without credentials',()=>{
 const original=new Map();
 const keys=['OPENAI_API_KEY','GOOGLE_CLIENT_ID','DATABASE_URL','RESEND_API_KEY','EMAIL_FROM'];
 for(const k of keys){original.set(k,process.env[k]);delete process.env[k]}
 try{
  const response=serve();
  assert.equal(response.statusCode,200);
  assert.equal(response.payload.aiConfigured,false);
  assert.equal(response.payload.gmailConfigured,false);
  assert.equal(response.payload.accountsAvailable,false);
  assert.equal(response.payload.backgroundAvailable,false);
  assert.equal(response.headers['Cache-Control'],'no-store');
 }finally{for(const [key,value] of original){if(value===undefined)delete process.env[key];else process.env[key]=value}}
});
test('public candidate studio offers a keyless manual reply flow and protects unavailable Gmail controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/candidatures.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/candidatures.js'),'utf8');
 for(const id of ['manualReplyInput','manualReplyAnalyze','manualReplyDraft','manualReplyCopy','manualReplyResult']){
  assert.ok(html.includes('id="'+id+'"'),'Missing manual reply control '+id);
 }
 assert.match(js,/function analyzeManualReply/);
 assert.match(js,/disabled=!googleReady/);
 assert.match(js,/classification\(body\)/);
 assert.match(html,/Le texte reste dans votre navigateur/);
 assert.match(html,/ajoutez votre CV manuellement/);
 assert.doesNotMatch(js.match(/function analyzeManualReply\(\)\{[\s\S]*?\n\}/)?.[0]||'',/\bfetch\s*\(/);
});
