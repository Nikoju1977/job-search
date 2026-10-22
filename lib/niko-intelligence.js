'use strict';
// Decision engine: deterministic, explainable, privacy-first. Does NOT send applications.
const {scoreJob,accessibleMention,norm}=require('./candidate');
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
 const gate=eligible(job,policy);if(!gate.ok)return {eligible:false,score:0,reason:gate.reason};
 const cv=redactSensitive(profile.cvText||'');
 const base=scoreJob({cvText:cv,targetRole:profile.targetRole||''},job);
 if(base.score===null)return {eligible:false,score:0,reason:'profil incomplet'};
 let points=Math.min(85,Math.round(base.score*0.82));
 const wanted=norm(profile.targetLocation),where=norm(job.location);
 const remote=job.remote===true;
 let location='non renseignée';
 if(wanted&&where.includes(wanted)){points+=10;location='lieu souhaité détecté';}
 else if(remote){points+=8;location='télétravail annoncé';}
 else if(wanted){points-=8;location='zone géographique à vérifier';}
 if(accessibleMention(job))points+=2;
 const publication=new Date(job.posted_at||job.date||0).getTime();
 const ageDays=publication>0?(Date.now()-publication)/864e5:Infinity;
 if(ageDays>=0&&ageDays<=7)points+=3;
 const score=Math.max(0,Math.min(100,points));
 const matched=(base.matchedSkills||[]).slice(0,5);
 const missing=(base.missingSkills||[]).slice(0,5);
 const explanation={
  type:'score indicatif — aucun classement RH ni décision d’embauche',
  skillsMatched:matched,
  skillsToCheck:missing,
  location,
  inclusiveMention:accessibleMention(job),
  freshness:ageDays<=7?'offre récente':'date à confirmer',
  jobSource:job.source||'source non précisée',
  cautions:['Vérifier le lien source et la disponibilité de l’offre.','Aucun statut RQTH personnel n’est inféré ou transmis.']
 };
 return {eligible:true,score,explanation,qualified:score>=Number(policy.minScore??50)};
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