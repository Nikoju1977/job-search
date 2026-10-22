/* Niko Intelligence 5.0 — on-device semantic search + evidence-based career passport. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const core=window.NikoNeuroCore;
const engine=window.NikoEngine;
let jobs=[],worker=null,nextId=0,timeoutId=null;
function setStatus(msg,problem=false){const el=$('n5Status');if(!el)return;el.textContent=msg;el.classList.toggle('is-error',problem);}
function candidate(){return {cvText:$('cvText')?.value||'',targetRole:$('targetRole')?.value||'',targetLocation:$('targetLocation')?.value||''};}
function el(tag,className,label){const n=document.createElement(tag);if(className)n.className=className;if(label!==undefined)n.textContent=label;return n;}
function clearWorker(){
 if(timeoutId!==null){clearTimeout(timeoutId);timeoutId=null;}
 if(worker){worker.terminate();worker=null;}
 const btn=$('n5Run');if(btn)btn.disabled=false;
 const stop=$('n5Cancel');if(stop)stop.hidden=true;
}
function drawPassport(){
 const box=$('n5PassportList'),paths=$('n5CareerPaths');box.replaceChildren();paths.replaceChildren();
 const profile=candidate();
 if(!profile.cvText.trim()){box.append(el('p','n5-empty','Importez ou collez votre CV pour établir un passeport de compétences indicatif.'));return;}
 const found=core.passport(profile.cvText,engine.skillSignals);
 if(!found.skills.length){box.append(el('p','n5-empty','Aucune compétence reconnue dans notre référentiel local. Cela ne signifie pas que vous n’en possédez pas.'));return;}
 for(const name of found.skills){box.append(el('span','n5-skill',name));}
 if(!found.paths.length){paths.append(el('p','n5-empty','Pas assez de compétences explicites pour proposer des passerelles fiables.'));return;}
 for(const item of found.paths){
  const card=el('article','n5-path');
  card.append(el('strong','',item.title));
  card.append(el('p','',item.shared.join(' · ')+' — '+item.why));
  card.append(el('small','', 'À vérifier : '+item.missing.join(', ')+' (absence de preuve dans le CV ≠ absence de compétence).'));
  paths.append(card);
 }
}
function results(matches){
 const container=$('n5Matches');container.replaceChildren();
 if(!matches.length){container.append(el('p','n5-empty','Pas de résultat fiable dans les offres reçues. Élargissez votre recherche.'));return;}
 const note=el('p','n5-empty','Classement exploratoire combinant similarité sémantique et critères objectifs. Il ne mesure pas les chances d’embauche.');
 container.append(note);
 for(const m of matches){
  const row=el('article','n5-match'),main=el('div','n5-match-main');
  const name=el('a','n5-match-link',m.job.title+' · '+m.job.company);
  name.href=m.job.url;name.target='_blank';name.rel='noopener noreferrer nofollow';
  main.append(name,el('small','',m.job.location+' · '+m.job.source));
  main.append(el('p','',m.semanticLabel+' · '+(m.fit.matchReasons||[]).slice(0,2).join(' · ')));
  const skills=(m.fit.shared||[]).slice(0,4);
  if(skills.length)main.append(el('small','', 'Compétences du CV : '+skills.join(', ')));
  if(m.fit.watchouts?.length)main.append(el('small','n5-caution',m.fit.watchouts.slice(0,2).join(' · ')));
  row.append(main,el('span','n5-tag',m.fit.reliability==='bonne'?'Critères bien renseignés':'Critères à vérifier'));
  container.append(row);
 }
}
function close(msg,problem=false){clearWorker();setStatus(msg,problem);}
function start(){
 if(!core||!engine){setStatus('Moteur local indisponible. Le radar existant reste utilisable.',true);return;}
 const p=candidate(),text=core.profileText(p);
 drawPassport();
 if(!text.trim()){setStatus('Indiquez un métier ou complétez votre CV avant l’analyse.',true);return;}
 const available=jobs.filter(core.validJob).slice(0,30);
 if(!available.length){setStatus('Recherchez d’abord de vraies offres pour les comparer.',true);return;}
 clearWorker();
 const sent=new Set();
 try{
  const values=JSON.parse(localStorage.getItem('niko_history_v2')||'[]');
  if(Array.isArray(values))for(const v of values){if(v?.status==='Envoyée'&&v.url)sent.add(v.url);}
 }catch{}
 const id=++nextId;
 const btn=$('n5Run');btn.disabled=true;$('n5Cancel').hidden=false;
 setStatus('Chargement du modèle multilingue gratuit sur cet appareil. Le premier téléchargement peut être volumineux.');
 try{worker=new Worker('/niko-neuromatch-worker.js',{type:'module'});}
 catch{close('Ce navigateur ne prend pas en charge ce modèle local. Le radar classique reste disponible.',true);return;}
 const localWorker=worker;
 timeoutId=setTimeout(()=>{if(worker===localWorker){close('Analyse interrompue : temps de chargement dépassé. Réessayez sur une connexion stable.',true);}},180000);
 localWorker.onmessage=event=>{
  if(worker!==localWorker||event.data?.id!==id)return;
  const data=event.data;
  if(data.type==='progress'){
   setStatus(data.stage==='download'?'Téléchargement initial du modèle : exécution ensuite sur votre appareil.':'Analyse des annonces localement, sans facturation API…');return;
  }
  if(data.type==='error'){close(data.message||'IA locale indisponible.',true);return;}
  if(data.type!=='result')return;
  const ranked=core.rank(available,data.scores,p,engine,{sentUrls:[...sent]});
  results(ranked);
  close(ranked.length+' suggestions classées sur cet appareil. Aucun CV transmis à une API d’IA, aucun e-mail envoyé.');
 };
 localWorker.onerror=()=>{if(worker===localWorker)close('Module de calcul local indisponible. Le radar classique reste actif.',true);};
 localWorker.postMessage({id,query:text,texts:available.map(core.jobText)});
}
document.addEventListener('DOMContentLoaded',()=>{
 if(!$('n5Passport'))return;
 $('n5Passport').addEventListener('click',()=>{drawPassport();setStatus('Passeport mis à jour uniquement à partir des informations présentes dans votre CV.');});
 $('n5Run').addEventListener('click',start);
 $('n5Cancel').addEventListener('click',()=>close('Analyse annulée. Les offres et votre CV n’ont pas été modifiés.'));
 document.addEventListener('niko:jobs-loaded',event=>{
  jobs=Array.isArray(event.detail?.jobs)?event.detail.jobs:[];
  if(worker)close('Recherche actualisée : relancez le calcul sémantique avec les nouvelles offres.');
  $('n5OfferCount').textContent=jobs.length+' offre'+(jobs.length>1?'s':'')+' disponible'+(jobs.length>1?'s':'');
 });
 for(const field of ['cvText','targetRole'])$(field)?.addEventListener('change',()=>{if(worker)close('Profil modifié : relancez l’analyse.');});
});
})();