/* NeuroMatch local AI worker. No profile is sent to an inference API.
   Fetches only the library/model assets on explicit user request. */
'use strict';
const LIBRARY='https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const MODEL='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
let extractorPromise=null;
function localExtractor(){
 if(!extractorPromise)extractorPromise=import(LIBRARY)
  .then(({pipeline})=>pipeline('feature-extraction',MODEL,{dtype:'q8'}))
  .catch(err=>{extractorPromise=null;throw err;});
 return extractorPromise;
}
function similarity(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.length)return NaN;
 let dot=0,ma=0,mb=0;
 for(let i=0;i<a.length;i++){const x=Number(a[i]),y=Number(b[i]);if(!Number.isFinite(x)||!Number.isFinite(y))return NaN;dot+=x*y;ma+=x*x;mb+=y*y;}
 return ma&&mb?Math.max(-1,Math.min(1,dot/Math.sqrt(ma*mb))):NaN;
}
self.onmessage=async event=>{
 const id=event.data?.id;
 const query=event.data?.query;
 const texts=event.data?.texts;
 if(!Number.isSafeInteger(id)||typeof query!=='string'||!query.trim()||query.length>1800||
  !Array.isArray(texts)||texts.length<1||texts.length>30||texts.some(t=>typeof t!=='string'||t.length>750)){
  self.postMessage({id,type:'error',message:'Entrée invalide pour le moteur local.'});return;
 }
 try{
  self.postMessage({id,type:'progress',stage:'download'});
  const extractor=await localExtractor();
  self.postMessage({id,type:'progress',stage:'inference'});
  const vectors=await extractor([query,...texts],{pooling:'mean',normalize:true});
  const rows=vectors.tolist();
  if(!Array.isArray(rows)||rows.length!==texts.length+1)throw Error('Invalid model response');
  const scores=rows.slice(1).map(x=>similarity(rows[0],x));
  if(scores.some(x=>!Number.isFinite(x)))throw Error('Invalid similarities');
  self.postMessage({id,type:'result',scores});
 }catch{
  self.postMessage({id,type:'error',message:'Modèle indisponible ou appareil incompatible. Utilisez le radar classique.'});
 }
};