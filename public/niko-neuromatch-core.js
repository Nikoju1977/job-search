/* NeuroMatch Core 5.0. Pure, client-side candidate enrichment. No model and no CV leaves the browser. */
(function(root,factory){
 'use strict';
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 if(root)root.NikoNeuroCore=value;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PRIVATE=/\b(rqth|boeth|mdph|invalidit[eé]|diagnostic|maladie|pathologie|traitement m[eé]dical|grossesse|religion|syndicat|orientation sexuelle)\b/i;
 const PERSONAL_HEALTH=/\b(je suis (?:en situation de handicap|handicap[eé])|j.ai un handicap|reconnu[e]? travailleur handicap[eé])\b/i;
 const ROLES=[
  {name:'Coordination administrative',skill:['administration','gestion de projet','bureautique','excel'],needs:2,why:'organisation et suivi des dossiers'},
  {name:'Relation clients / support',skill:['relation client','accueil','crm','bureautique'],needs:2,why:'communication et accompagnement des clients'},
  {name:'Assistant RH',skill:['recrutement','administration','paie','bureautique'],needs:2,why:'gestion des dossiers et processus RH'},
  {name:'Logistique / approvisionnement',skill:['logistique','gestion de stocks','excel','administration'],needs:2,why:'gestion des flux et des stocks'},
  {name:'Analyse / reporting',skill:['analyse de données','excel','sql','bureautique'],needs:2,why:'reporting et traitement des données'},
  {name:'Gestion commerciale',skill:['vente','prospection','relation client','crm'],needs:2,why:'développement commercial et relation client'}
 ];
 function safeText(value,limit=1600){return String(value==null?'':value).replace(/\0/g,' ').slice(0,limit);}
 function normalize(value){return safeText(value,2600).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
 function sanitizeCV(cv) {
  return safeText(cv,22000).split(/\r?\n/)
   .filter(line=>!PRIVATE.test(line)&&!PERSONAL_HEALTH.test(line))
   .join('\n')
   .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g,' ')
   .replace(/(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/g,' ')
   .replace(/https?:\/\/\S+/g,' ')
   .slice(0,3000);
 }
 function profileText(profile={}){
  const role=safeText(profile.targetRole,150);
  const cv=sanitizeCV(profile.cvText||'').slice(0,1300);
  return [role?'Métier recherché : '+role:'',cv?'Compétences et expérience : '+cv:''].filter(Boolean).join('. ').slice(0,1550);
 }
 function jobText(job={}){
  return ['Poste : '+safeText(job.title,160),'Missions : '+safeText(job.excerpt||job.description,380),'Contrat : '+safeText(job.contract,70)]
   .join('. ').slice(0,670);
 }
 function validJob(job){
  if(!job?.title||!job?.company||!job?.url)return false;
  try{const u=new URL(job.url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}
 }
 function passport(cv,skillsFn) {
  const text=sanitizeCV(cv);
  const skills=typeof skillsFn==='function'?skillsFn(text,{isCV:true}).filter(s=>s!=='accessibilité'):[];
  const unique=[...new Set(skills)].slice(0,30);
  const paths=ROLES.map(role=>{
    const shared=role.skill.filter(s=>unique.includes(s));
    return {title:role.name,shared,missing:role.skill.filter(s=>!unique.includes(s)),why:role.why};
   }).filter(x=>x.shared.length>=2).sort((a,b)=>b.shared.length-a.shared.length).slice(0,4);
  return {skills:unique,paths,provenance:'Signaux textuels repérés dans le CV, non vérifiés par un organisme certificateur.'};
 }
 function cosineLabel(v){
  if(!Number.isFinite(v))return 'Non évaluée';
  return v>=.57?'Proximité sémantique élevée':v>=.36?'Proximité à explorer':'Proximité limitée';
 }
 function rank(jobs,similarities,profile,engine,options={}){
  if(!Array.isArray(jobs)||!Array.isArray(similarities)||!engine||typeof engine.screen!=='function')return [];
  const excluded=new Set(Array.isArray(options.sentUrls)?options.sentUrls:[]);
  const ignored=new Set(Array.isArray(options.ignoredUrls)?options.ignoredUrls:[]);
  const result=[];
  for(let i=0;i<Math.min(jobs.length,similarities.length,40);i++){
   const job=jobs[i];if(!validJob(job)||excluded.has(job.url)||ignored.has(job.url))continue;
   const semantic=Number(similarities[i]);
   if(!Number.isFinite(semantic)||semantic< -1||semantic>1)continue;
   const fit=engine.screen({cvText:sanitizeCV(profile.cvText||''),targetRole:profile.targetRole||'',targetLocation:profile.targetLocation||''},job);
   if(fit.score===null||fit.watchouts?.some(x=>/demande financière/i.test(x)))continue;
   const combined=(semantic+1)*.5*.6+(fit.score/100)*.4;
   result.push({job,semantic,fit,rankScore:combined,semanticLabel:cosineLabel(semantic)});
  }
  return result.sort((a,b)=>b.rankScore-a.rankScore||String(a.job.url).localeCompare(String(b.job.url))).slice(0,10);
 }
 return {VERSION:'5.0.0',sanitizeCV,profileText,jobText,passport,rank,validJob,cosineLabel,normalize};
});