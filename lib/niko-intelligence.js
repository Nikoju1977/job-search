'use strict';
// Decision engine: deterministic, explainable, privacy-first. Does NOT send applications.
const {accessibleMention}=require('./candidate');
const Engine=require('../public/niko-engine');
const PRIVATE_TERMS=/\b(rqth|boeth|invalidit[eé]|handicap[eé]?|pathologie|diagnostic|sant[eé]|mdph)\b/i;
function redactSensitive(text){return String(text||'').split('\n').filter(line=>!PRIVATE_TERMS.test(line)).join('\n').slice(0,22000);}
function eligible(job,policy={}){
 if(!job||!job.url||!job.title||!job.company)return {ok:false,reason:'annonce incomplète'};
 if(policy.remoteOnly && job.remote!==true)return {ok:false,reason:'télétravail non confirmé'};
 if(policy.inclusiveOnly&&!accessibleMention(job))return {ok:false,reason:'aucune mention explicite d’inclusion'};
 const age=new Date(job.posted_at||job.date||Date.now()).getTime();
 if(Number.isFinite(age)&&age>Date.now()+2*864e5)return {ok:false,reason:'date de publication incohérente'};
 return {ok:true};
}
function rank(profile,job,policy={}){
 const gate=eligible(job,policy);
 if(!gate.ok)return {eligible:false,score:0,reason:gate.reason};
 const safeProfile={cvText:redactSensitive(profile.cvText||''),targetRole:profile.targetRole||'',targetLocation:profile.targetLocation||''};
 const fit=Engine.screen(safeProfile,{...job,date:job.posted_at||job.date});
 if(fit.score===null)return {eligible:false,score:0,reason:'profil incomplet'};
 if(fit.watchouts.some(w=>/demande financière/i.test(w)))return {eligible:false,score:0,reason:'signal de demande financière à vérifier'};
 const score=Math.max(0,Math.min(100,fit.score));
 return {eligible:true,score,qualified:score>=Number(policy.minScore??50),explanation:{
  type:'indice de compatibilité indicatif, non une décision RH',
  reliability:fit.reliability,
  axes:fit.axes,
  skillsMatched:fit.shared.slice(0,5),
  skillsToCheck:fit.missing.slice(0,5),
  matchReasons:fit.matchReasons.slice(0,5),
  watchouts:fit.watchouts.slice(0,5),
  location:fit.matchReasons.find(x=>/lieu|distance|région|télétravail|localisation/i.test(x))||'à vérifier',
  inclusiveMention:accessibleMention(job),
  jobSource:job.source||'source non précisée',
  cautions:['Vérifier la disponibilité de l’annonce sur le site source.','Aucune donnée de santé ou RQTH personnelle n’est transmise aux recruteurs.']
 }};
}
function shortlist(profile,jobs,policy={}){
 const cap=Math.max(1,Math.min(50,Number(policy.maxResults)||20));
 return jobs.map(job=>({job,judgment:rank(profile,job,policy)}))
  .filter(x=>x.judgment.eligible&&x.judgment.qualified)
  .sort((a,b)=>b.judgment.score-a.judgment.score||String(a.job.url).localeCompare(String(b.job.url))).slice(0,cap);
}
function classifyRecruiter(body,headers={}){
 const text=norm(String(body||'').slice(0,3500));
 const from=String(headers.from||'').toLowerCase();
 const auto=/no.?reply|mailer-daemon|postmaster/.test(from)||/auto-replied|auto-generated|bulk/.test(String(headers.autoSubmitted||''));
 if(auto)return {kind:'automatique',confidence:'high',requiresReview:true,replyAllowed:false};
 if(!text)return {kind:'incertain',confidence:'low',requiresReview:true,replyAllowed:false};
 const interview=/\b(entretien|visioconference|rencontrer|rendez vous|creneau|disponibilite|interview|schedule a call)\b/.test(text);
 const refusal=/\b(malheureusement|candidature non retenue|pas ete retenu|ne pouvons donner suite|rejet[eé]|not selected|unsuccessful|regret to inform)\b/.test(text);
 const positive=/\b(retenu|selectionne|interesse par votre profil|suite favorable|felicitations|congratulations|shortlisted)\b/.test(text);
 if(interview&&refusal||positive&&refusal)return {kind:'incertain',confidence:'low',requiresReview:true,replyAllowed:false};
 const kind=interview?'entretien':refusal?'defavorable':positive?'favorable':'incertain';
 return {kind,confidence:kind==='incertain'?'low':'medium',requiresReview:true,replyAllowed:false};
}
module.exports={rank,shortlist,eligible,classifyRecruiter,redactSensitive};