'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const tick=()=>new Promise(done=>setImmediate(done));

function run(storage,responses) {
  const nodes=new Map();
  const controls=new Map(); // stable browser-like DOM nodes retain event listeners
  const session=new Map();
  function element(id){
    if(!nodes.has(id)){
      const node={value:'',checked:false,hidden:false,textContent:'',innerHTML:'',
        className:'',dataset:{},listeners:{},classList:{toggle(){}},
        addEventListener(event,cb){this.listeners[event]=cb;},
        scrollIntoView(){},showModal(){},close(){},
        querySelectorAll(selector){
          if(id!=='jobList')return [];
          const prop=selector==='[data-favorite]'?'favorite':selector==='[data-prepare]'?'prepare':null;
          if(!prop)return [];
          return [...this.innerHTML.matchAll(new RegExp('data-'+prop+'="([^"]+)"','g'))].map(match=>{
            const key=prop+':'+match[1];
            if(!controls.has(key))controls.set(key,{
              dataset:{[prop]:match[1]},listeners:{},
              addEventListener(event,cb){this.listeners[event]=cb;}
            });
            return controls.get(key);
          });
        }};
      nodes.set(id,node);
    }
    return nodes.get(id);
  }
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const sessionStorage={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)};
  const document={getElementById:element,querySelectorAll:()=>[]};
  const fetch=async()=>({ok:true,json:async()=>responses.shift()||{jobs:[],sources:{},partial:false}});
  vm.runInNewContext(source,{document,localStorage,sessionStorage,URL,URLSearchParams,AbortSignal,console,fetch});
  return {element,session};
}
const data=(id,title)=>({jobs:[{id,title,company:'Atelier Niko',location:'Nantes, France',
  source:'EasyJobs',url:'https://example.org/jobs/'+id,remote:false}],
  sources:{EasyJobs:{ok:true,received:1}},partial:false});
test('Favorite cards survive another search and a complete page reload without paid cloud storage',async()=>{
  const storage=new Map();
  const h=run(storage,[data('a','Premier poste'),data('b','Autre poste')]);
  await tick();
  const btn=h.element('jobList').querySelectorAll('[data-favorite]')[0];
  assert.ok(btn);
  btn.listeners.click();
  assert.equal(JSON.parse(storage.get('niko_emploi_favoris_details_v2')).length,1);
  h.element('keyword').value='autre';
  h.element('searchForm').listeners.submit({preventDefault(){}});
  await tick();
  assert.doesNotMatch(h.element('jobList').innerHTML,/Premier poste/);
  h.element('savedBtn').listeners.click();
  assert.match(h.element('jobList').innerHTML,/Premier poste/);
  const prepare=h.element('jobList').querySelectorAll('[data-prepare]')[0];
  prepare.listeners.click();
  assert.equal(JSON.parse(h.session.get('niko_selected_job')).title,'Premier poste');
  const reload=run(storage,[data('c','Troisième poste')]);
  await tick();
  reload.element('savedBtn').listeners.click();
  assert.match(reload.element('jobList').innerHTML,/Premier poste/);
  const remove=reload.element('jobList').querySelectorAll('[data-favorite]')[0];
  remove.listeners.click();
  assert.equal(JSON.parse(storage.get('niko_emploi_favoris_details_v2')).length,0);
  assert.equal(JSON.parse(storage.get('niko_emploi_favoris_v1')).length,0);
});
test('Rejects unsafe favorited URLs in local storage rather than opening script links',async()=>{
  const storage=new Map([
    ['niko_emploi_favoris_v1','["malicious"]'],
    ['niko_emploi_favoris_details_v2',JSON.stringify([{id:'malicious',title:'Intrus',company:'Test',
      url:'javascript:alert(1)',location:'Nantes'}])]
  ]);
  const h=run(storage,[{jobs:[],sources:{},partial:false}]);
  await tick();
  h.element('savedBtn').listeners.click();
  assert.doesNotMatch(h.element('jobList').innerHTML,/javascript:alert/);
});
