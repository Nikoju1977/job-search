'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/suivi.js'),'utf8');
const tick=()=>new Promise(done=>setImmediate(done));
function harness(legacy=[]){
 const storage=new Map([['niko_history_v2',JSON.stringify(legacy)]]);
 const elements=new Map();
 const el=(tag='div',id='')=>({
  tagName:tag,id,value:'',checked:false,hidden:false,disabled:false,textContent:'',className:'',style:{},dataset:{},children:[],listeners:{},attributes:{},
  classList:{add(){},remove(){},toggle(){}},
  addEventListener(kind,fn){this.listeners[kind]=fn;},
  append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},
  showModal(){this.open=true;},close(){this.open=false;},
  focus(){},remove(){},click(){}
 });
 const get=id=>{if(!elements.has(id))elements.set(id,el('div',id));return elements.get(id);};
 const handlers={},document={
  getElementById:get,createElement:tag=>el(tag),
  addEventListener(kind,fn){handlers[kind]=fn;},
  body:el('body')
 };
 const window={addEventListener(){},location:{href:''}};
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 const fetch=async url=>{
  if(url==='/api/auth')return {ok:true,json:async()=>({authenticated:false})};
  throw Error('Unexpected endpoint '+url);
 };
 const context={document,window,localStorage,fetch,URL,Date,Blob,Math,JSON,
  navigator:{clipboard:{writeText:async()=>{}}},confirm:()=>true,console,setTimeout:fn=>fn()};
 vm.runInNewContext(source,context,{filename:'suivi.js'});
 handlers.DOMContentLoaded();
 return {get,storage,tick,window};
}
test('Tracker works without account and never invents vacancies',async()=>{
 const h=harness();await tick();
 assert.equal(h.get('mTotal').textContent,0);
 assert.match(h.get('syncStatus').textContent,/Mode local/);
 assert.equal(h.get('board').children.length,6);
 assert.equal(h.get('dueList').children.length,1);
});
test('New application is saved locally with declared status and no fake sending evidence',async()=>{
 const h=harness();await tick();
 h.get('addApplication').listeners.click();
 assert.equal(h.get('applicationDialog').open,true);
 h.get('caseTitle').value='Agent entretien';
 h.get('caseCompany').value='Lycée exemple';
 h.get('caseLocation').value='Châteaubriant';
 h.get('caseStatus').value='sent';
 h.get('caseChannel').value='portal';
 h.get('caseUrl').value='https://example.org/jobs/123?id=77';
 h.get('caseInterviewFormat').value='';
 await h.get('caseForm').listeners.submit({preventDefault(){}});
 const stored=JSON.parse(h.storage.get('niko_tracker_local_v6'));
 assert.equal(stored.records.length,1);
 assert.equal(stored.records[0].status,'sent');
 assert.equal(stored.records[0].submissionProof,'self_reported');
 assert.equal(stored.records[0].company,'Lycée exemple');
 assert.equal(stored.events.length,1);
 assert.equal(h.get('mTotal').textContent,1);
 assert.equal(h.get('applicationDialog').open,false);
});
test('Legacy imports are explicit and duplicate links keep distinct job ID query parameters',async()=>{
 const h=harness([
  {title:'Chargé RH',company:'Entreprise',url:'https://example.org/posting?id=1',status:'Envoyée',date:'2026-11-10T10:00:00Z'},
  {title:'Chargé RH',company:'Entreprise',url:'https://example.org/posting?id=2',status:'Envoyée',date:'2026-11-11T10:00:00Z'},
  {title:'Chargé RH',company:'Entreprise',url:'https://example.org/posting?id=1',status:'Réponse envoyée',date:'2026-11-12T10:00:00Z'}
 ]);await tick();
 assert.equal(h.get('mTotal').textContent,0);
 h.get('importHistory').listeners.click();
 const stored=JSON.parse(h.storage.get('niko_tracker_local_v6'));
 assert.equal(stored.records.length,2);
 assert.ok(stored.records.every(x=>x.submissionProof==='legacy'));
 assert.equal(h.get('mTotal').textContent,2);
});
test('Gmail inbox metadata never modifies a job status without the user saving a case',async()=>{
 const h=harness();await tick();
 h.storage.set('niko_tracker_inbox_v1',JSON.stringify([{id:'gmail-1',title:'Graphiste',company:'Atelier',
  threadId:'thread-1',jobUrl:'',kind:'entretien',receivedAt:'2026-11-18T11:00:00Z'}]));
 h.get('addApplication').listeners.click();
 h.get('caseTitle').value='Graphiste';h.get('caseCompany').value='Atelier';
 await h.get('caseForm').listeners.submit({preventDefault(){}});
 assert.equal(h.get('mTotal').textContent,1);
 const current=JSON.parse(h.storage.get('niko_tracker_local_v6'));
 assert.equal(current.records[0].status,'draft');
 assert.match(source,/Réponse Gmail détectée : vérifiez le message original/);
});
