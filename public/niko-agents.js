/* Niko Agents : orchestration locale, sans envoi ni stockage du CV distant. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
let lastJobs=[],lastPlan=null,lastScan=0,watchTimer=null;
let seen=new Set();
const memoKey='niko_engine_seen_v3';
function readSeen(){try{const v=JSON.parse(sessionStorage.getItem(memoKey)||'[]');return new Set(Array.isArray(v)?v:[]);}catch{return new Set();}}
function saveSeen(){try{sessionStorage.setItem(memoKey,JSON.stringify([...seen].slice(-300)))}catch{}}
function profile(){
 return {cvText:$('cvText')?.value||'',targetRole:$('targetRole')?.value||'',targetLocation:$('targetLocation')?.value||''};
}
function currentSent(){
 try{const h=JSON.parse(localStorage.getItem('niko_history_v2')||'[]');return Array.isArray(h)?h.filter(x=>x.status==='Envoyée'&&x.url).map(x=>x.url):[];}catch{return []}
}
function displayMessage(message){
 const target=$('nikoRecommendations');target.replaceChildren();
 const p=document.createElement('p');p.className='niko-rec-empty';p.textContent=message;target.append(p);
}
function render(plan,{notifyNew=false}={}){
 lastPlan=plan;
 $('nikoScanned').textContent=String(plan.scanned);
 $('nikoRecommended').textContent=String(plan.recommended.length);
 $('nikoScore').textContent=plan.recommended[0]?.fit.score===null?'—':plan.recommended[0]?.fit.score??'—';
 const target=$('nikoRecommendations');target.replaceChildren();
 if(!plan.scanned){displayMessage('Aucune offre reçue. Lancez une recherche pour démarrer le radar.');return;}
 if(!plan.recommended.length){displayMessage('Aucune offre ne dépasse encore le seuil de 68/100. Élargissez la recherche ou complétez votre CV ; le score ne remplace pas votre propre appréciation.');return;}
 const title=document.createElement('div');title.className='niko-rec-title';title.textContent='LES OPPORTUNITÉS À EXAMINER';target.append(title);
 for(const {job,fit} of plan.recommended.slice(0,5)){
  const row=document.createElement('article');row.className='niko-rec';
  const body=document.createElement('div');body.className='niko-rec-main';
  const heading=document.createElement('strong');heading.textContent=job.title+' · '+job.company;
  const detail=document.createElement('span');detail.textContent=job.location+' · '+(fit.matchReasons.slice(0,2).join(' · ')||'Compatibilité à vérifier');
  const cautions=document.createElement('small');cautions.textContent=fit.watchouts.slice(0,1).join(' · ');
  body.append(heading,detail);
  if(cautions.textContent)body.append(cautions);
  const actions=document.createElement('div');actions.className='niko-rec-actions';
  const score=document.createElement('b');score.textContent=fit.score+'/100';
  score.setAttribute('aria-label','Score indicatif : '+fit.score+' sur 100');
  const open=document.createElement('a');open.href=job.url;open.target='_blank';open.rel='noopener noreferrer nofollow';open.textContent='Voir l’offre ↗';
  actions.append(score,open);row.append(body,actions);target.append(row);
 }
 if(notifyNew){
  const fresh=plan.recommended.filter(x=>!seen.has(x.job.url));
  if(fresh.length&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
   // Notifications only after explicit opt-in, without CV text or sensitive signals.
   new Notification('Niko Emploi — nouvelles opportunités',{body:fresh.length+' offre(s) intéressante(s) à examiner dans le radar.'});
  }
 }
 for(const x of plan.recommended)seen.add(x.job.url);saveSeen();
}
function analyze({notifyNew=false}={}){
 const engine=window.NikoEngine;
 if(!engine)return displayMessage('Moteur intelligent indisponible, rechargez la page.');
 if(!lastJobs.length){displayMessage('Recherchez d’abord de vraies offres pour activer les agents.');return;}
 const p=profile();
 if(!p.targetRole.trim()&&p.cvText.trim().length<35){displayMessage('Précisez un métier recherché ou collez votre CV pour lancer un classement personnalisé.');return;}
 const result=engine.plan(p,lastJobs,{minScore:68,sentUrls:currentSent()});
 render(result,{notifyNew});
 $('nikoEngineStatus').textContent='Local · '+new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date());
}
function watchChanged(){
 if($('nikoWatch').checked){
  lastScan=Date.now();seen=readSeen();
  watchTimer=setInterval(()=>{
   if(document.visibilityState==='hidden'||Date.now()-lastScan<15*60*1000)return;
   lastScan=Date.now();
   if(!profile().targetRole.trim()&&profile().cvText.trim().length<35)return;
   const button=$('findJobsBtn');if(button&&!button.disabled)button.click();
  },60*1000);
  $('nikoEngineStatus').textContent='Surveillance session active';
  displayMessage('Surveillance activée. Les nouvelles offres seront examinées lorsque cet onglet est ouvert et visible. Aucun envoi automatique.');
 }else{
  if(watchTimer)clearInterval(watchTimer);
  watchTimer=null;
  $('nikoEngineStatus').textContent='Local · prêt';
  if(lastJobs.length)analyze();else displayMessage('Surveillance désactivée. Utilisez le bouton pour analyser des offres à la demande.');
 }
}
document.addEventListener('DOMContentLoaded',()=>{
 seen=readSeen();
 if(!window.NikoEngine){displayMessage('Moteur intelligent non chargé.');return;}
 $('nikoAnalyze').onclick=()=>analyze();
 $('nikoWatch').onchange=watchChanged;
 document.addEventListener('niko:jobs-loaded',ev=>{
  const received=ev.detail?.jobs;
  if(!Array.isArray(received))return;
  lastJobs=received;
  analyze({notifyNew:$('nikoWatch').checked});
 });
 for(const id of ['cvText','targetRole','targetLocation'])$(id)?.addEventListener('change',()=>{
  if(lastJobs.length)analyze();
 });
 const url=new URL(location.href);
 if(url.searchParams.has('engine'))setTimeout(()=>$('niko-intelligence').scrollIntoView({behavior:'smooth',block:'start'}),250);
});
})();