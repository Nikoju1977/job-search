'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {audit,summary,BASE,CHECKS}=require('./production-audit');
const fixtures={
 '/':'<!doctype html><title>Niko Emploi</title><link href="/styles.css">',
 '/marche-cache.html':'<form id="radarForm"></form><script src="/marche-cache.js">',
 '/candidatures.html':'<textarea id="letterText"></textarea><button id="generateBtn"></button>',
 '/app.js':'search-coverage widenSearch officialSearch',
 '/marche-cache.js':'const radarForm=1',
 '/radar-suivi.js':"const STORAGE='niko_radar_prospection_v1'",
 '/styles.css':'body{margin:0}',
 '/sw.js':"const CACHE_NAME='niko-emploi-shell-v6-radar-recovery-20261122'; if(url.pathname.startsWith('/api/'))return;",
 '/api/config':JSON.stringify({aiConfigured:false,gmailConfigured:false,googleClientId:''})
};
const mime=(path)=>path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css':path==='/api/config'?'application/json':'text/html';
function mock(overrides={}){
 return async(url,options)=>{
  assert.equal(new URL(url).origin,new URL(BASE).origin,'No unexpected host');
  assert.equal(options.method,'GET','Audit must never submit applicant data');
  assert.equal(options.headers['Cache-Control'],'no-cache');
  const path=new URL(url).pathname;
  const entry=Object.hasOwn(overrides,path)?overrides[path]:fixtures[path];
  assert.notEqual(entry,undefined,'Unhandled fixture '+path);
  if(entry instanceof Error)throw entry;
  const data=typeof entry==='string'?{body:entry,status:200,type:mime(path)}:entry;
  return new Response(data.body,{status:data.status,headers:{'Content-Type':data.type||mime(path)}});
 };
}
test('public HTTP audit has nine read-only checks and no applicant endpoints',async()=>{
 assert.equal(CHECKS.length,9);
 assert.equal(CHECKS.some(x=>/account|applications|auth|letter|reply-agent|jobs\?/.test(x.path)),false);
 const result=await audit(mock());
 assert.equal(result.status,'http_verified');
 assert.equal(result.passed,9);
 assert.match(summary(result),/9\/9/);
});
test('stale service worker is not declared live',async()=>{
 const result=await audit(mock({'/sw.js':{body:"const CACHE_NAME='niko-emploi-shell-v5'; if(url.pathname.startsWith('/api/'))return;",status:200}}));
 assert.equal(result.status,'outdated_or_incomplete');
 assert.equal(result.results.find(x=>x.key==='cache-pwa').verified,false);
});
test('HTML fallback for JavaScript is not accepted as working JavaScript',async()=>{
 const result=await audit(mock({'/app.js':{body:'<!doctype html><html>search-coverage widenSearch officialSearch</html>',status:200,type:'text/html'}}));
 assert.equal(result.results.find(x=>x.key==='recherche-js').reason,'Type MIME inattendu');
});
test('public HTTP 503 and inaccessible endpoint are explicitly recorded',async()=>{
 const result=await audit(mock({'/api/config':{body:'unavailable',status:503,type:'application/json'},'/styles.css':new Error('ECONNRESET')}));
 assert.equal(result.status,'partially_unreachable');
 assert.equal(result.results.find(x=>x.key==='configuration').http_status,503);
 assert.equal(result.results.find(x=>x.key==='styles').http_status,null);
});
test('configuration must expose booleans and not merely a successful HTTP response',async()=>{
 const result=await audit(mock({'/api/config':JSON.stringify({error:'indisponible'})}));
 assert.equal(result.status,'outdated_or_incomplete');
 assert.equal(result.results.find(x=>x.key==='configuration').verified,false);
});
