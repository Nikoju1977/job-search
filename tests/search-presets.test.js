'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
test('Saved searches remain private in localStorage and restore the original filters',()=>{
 const els=new Map(),store=new Map(),calls=[];
 function element(id){
   if(!els.has(id))els.set(id,{id,value:'',checked:false,hidden:false,textContent:'',innerHTML:'',
     classList:{toggle(){}},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},
     querySelectorAll(){return[];},scrollIntoView(){},setAttribute(){},showModal(){},close(){}});
   return els.get(id);
 }
 const document={getElementById:element,querySelectorAll(){return[];}};
 const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
 vm.runInNewContext(code,{document,localStorage,sessionStorage:localStorage,URLSearchParams,AbortSignal,console,
   fetch(url){calls.push(url);return new Promise(()=>{});}}, {filename:'app.js'});
 element('keyword').value='Agent entretien';
 element('location').value='Châteaubriant';
 element('remote').checked=false;
 element('filterContract').value='CDI';
 element('filterSource').value='Toutes';
 element('filterAge').value='7';
 element('sortOrder').value='relevance';
 element('saveSearch').listeners.click();
 const saved=JSON.parse(store.get('niko_emploi_recherches_v1'));
 assert.equal(saved.length,1);
 assert.equal(saved[0].keyword,'Agent entretien');
 assert.equal(saved[0].location,'Châteaubriant');
 assert.equal(saved[0].age,'7');
 assert.match(element('searchSavedStatus').textContent,/uniquement sur cet appareil/);
 element('keyword').value='Graphiste';
 element('location').value='Paris';
 element('savedSearches').value=saved[0].id;
 element('savedSearches').listeners.change();
 assert.equal(element('keyword').value,'Agent entretien');
 assert.equal(element('location').value,'Châteaubriant');
 assert.equal(element('filterContract').value,'CDI');
 assert.equal(element('sortOrder').value,'relevance');
 assert.equal(calls.length,2,'initial search plus restored one');
 element('savedSearches').value=saved[0].id;
 element('deleteSavedSearch').listeners.click();
 assert.deepEqual(JSON.parse(store.get('niko_emploi_recherches_v1')),[]);
});
test('Search filters and save buttons are present in UI',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 for(const id of ['saveSearch','savedSearches','deleteSavedSearch','searchSavedStatus','filterAge','filterSource'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
