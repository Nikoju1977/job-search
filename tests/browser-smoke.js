'use strict';
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=19463,base='http://127.0.0.1:'+port;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function poll(fn,label,timeout=23000){
 let last; const started=Date.now();
 while(Date.now()-started<timeout){
  try{const value=await fn();if(value)return value}catch(error){last=error}
  await sleep(130);
 }
 throw Error('Timeout '+label+(last?' : '+last.message:''));
}
function findChrome(){
 if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
 for(const bin of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  try{return execFileSync('which',[bin],{encoding:'utf8'}).trim()}catch{}
 }
 throw Error('Chrome/Chromium absent de GitHub Actions.');
}
async function smoke(){
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'niko-e2e-'));
 let server,chrome,ws,diagnostics='';const pending=new Map(),posts=[];let seq=0;
 try{
  server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',s=>diagnostics+=String(s).slice(-1000));
  await poll(async()=>{const r=await fetch(base+'/marche-cache.html');return r.status===200},'HTTP server');
  chrome=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--no-first-run','--no-default-browser-check','--disable-background-networking',
   '--remote-debugging-port=0','--remote-allow-origins=*',
   '--user-data-dir='+path.join(tmp,'chrome'),'about:blank'],{stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',s=>diagnostics+=String(s).slice(-1000));
  const cdport=await poll(async()=>{
   const content=await fs.readFile(path.join(tmp,'chrome','DevToolsActivePort'),'utf8');
   return Number(content.split('\n')[0]);
  },'Chrome DevTools port');
  const tabs=await(await fetch('http://127.0.0.1:'+cdport+'/json/list')).json();
  const tab=tabs.find(v=>v.type==='page');assert.ok(tab?.webSocketDebuggerUrl);
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});
  });
  ws.addEventListener('message',event=>{
   const data=JSON.parse(event.data);
   if(data.method==='Network.requestWillBeSent'&&data.params?.request?.method==='POST')posts.push(data.params.request.url);
   if(!data.id||!pending.has(data.id))return;
   const callbacks=pending.get(data.id);pending.delete(data.id);
   data.error?callbacks.reject(Error(JSON.stringify(data.error))):callbacks.resolve(data.result);
  });
  function call(method,params={}){
   const id=++seq;
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},12000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});
    ws.send(JSON.stringify({id,method,params}));
   });
  }
  async function evaluate(expression){
   const res=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(res.exceptionDetails){
    const ex=res.exceptionDetails;
    throw Error('Browser expression '+expression.slice(0,180)+' failed: '+(ex.exception?.description||ex.exception?.value||ex.text||JSON.stringify(ex)));
   }
   return res.result?.value;
  }
  const wait=(expr,label)=>poll(()=>evaluate(expr),label,16500);
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  const fixture=[
   '(()=>{',
   'const native=window.fetch.bind(window);window.confirm=()=>true;',
   'window.fetch=(input,options)=>{',
   'const url=typeof input==="string"?input:String(input?.url||"");',
   'if(url.startsWith("/api/hidden-market?")){',
   'const data={companies:[{siren:"123456789",name:"Entreprise test fictive (CI)",city:"Châteaubriant",postcode:"44110",',
   'activity:"81.21Z",establishments:1,directoryUrl:"https://annuaire-entreprises.data.gouv.fr/entreprise/123456789",',
   'kind:"entreprise_identifiee",hiringConfirmed:false}],count:1,totalReported:1,',
   'center:{name:"La Meilleraye-de-Bretagne",zip:"44520"},radiusKm:10,page:1,nextPage:false,retrievedAt:new Date().toISOString()};',
   'return Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}}));',
   '}',
   'return native(input,options);',
   '};',
   '})();'
  ].join('\n');
  await call('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
  await call('Page.navigate',{url:base+'/marche-cache.html'});
  await wait('document.readyState==="complete"&&!!document.querySelector("#radarForm")&&!!window.NikoRadarTracker','radar JS');
  assert.equal(await evaluate('document.querySelector("#sector").value'),'cleaning');
  assert.ok(await evaluate('!!document.querySelector("a[href=\"https://labonneboite.francetravail.fr/\"]")'));
  await evaluate('document.querySelector("#radarForm").requestSubmit();true');
  await wait('document.querySelectorAll(".radar-company").length===1','company search');
  assert.match(await evaluate('document.querySelector("#status").textContent'),/Aucune offre confirmée/);
  await evaluate('Array.from(document.querySelectorAll(".radar-company button")).find(b=>b.textContent.includes("Suivre cette entreprise")).click();true');
  await wait('document.querySelector("#trackerCount").textContent==="1"','follow company');
  let r=await evaluate('JSON.parse(localStorage.getItem("niko_radar_prospection_v1"))[0]');
  assert.equal(r.siren,'123456789');assert.equal(r.stage,'reperee');
  const past=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
  await evaluate('(()=>{const p=document.querySelector("#trackerList details");p.open=true;'+
   'const f=p.querySelector("form");f.querySelector("select[name=stage]").value="cibler";'+
   'f.querySelector("input[type=date]").value="'+past+'";'+
   'f.querySelector("input[type=text]").value="Agent entretien";'+
   'f.querySelector("textarea").value="Contact à préparer";f.requestSubmit();return true})()');
  await wait('document.querySelector("#trackerDueCount").textContent==="1"','due date counter');
  r=await evaluate('JSON.parse(localStorage.getItem("niko_radar_prospection_v1"))[0]');
  assert.equal(r.nextAction,past);assert.equal(r.stage,'cibler');assert.equal(r.note,'Contact à préparer');
  await evaluate('document.querySelector("#trackerList details").open=true;true');
  assert.equal(await evaluate('Array.from(document.querySelectorAll("#trackerList button")).some(b=>b.textContent.includes("Exporter la relance")&&!b.disabled)'),true);
  await call('Page.navigate',{url:base+'/marche-cache.html?reload=1'});
  await wait('document.readyState==="complete"&&document.querySelector("#trackerCount")?.textContent==="1"','persistence across page reload');
  await evaluate('document.querySelector("#radarForm").requestSubmit();true');
  await wait('document.querySelectorAll(".radar-company").length===1','second search');
  await evaluate('Array.from(document.querySelectorAll(".radar-company button")).find(b=>b.textContent.includes("Préparer une candidature")).click();true');
  await wait('location.pathname==="/candidatures.html"&&document.querySelector("#chosenJob")?.textContent.includes("Entreprise test fictive (CI)")','candidate studio handoff');
  assert.match(await evaluate('document.querySelector("#letterPosition").value'),/Candidature spontanée/);
  assert.equal(await evaluate('document.querySelector("#letterCompany").value'),'Entreprise test fictive (CI)');
  assert.equal(posts.length,0,'Unexpected automatic POST from new radar');
  console.log('CHROMIUM E2E PASS: search, follow, status, due date, persistence, calendar enabled, studio handoff, no automatic POST');
 }catch(error){throw Error(error.message+(diagnostics?'\nRunner diagnostics: '+diagnostics.slice(-1800):''))}
 finally{
  try{ws?.close()}catch{}
  try{chrome?.kill('SIGKILL')}catch{}
  try{server?.kill('SIGTERM')}catch{}
  await sleep(350);await fs.rm(tmp,{recursive:true,force:true,maxRetries:6,retryDelay:200}).catch(()=>{});
 }
}
smoke().catch(error=>{console.error(error.stack||error);process.exitCode=1});
