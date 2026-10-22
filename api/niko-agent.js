'use strict';
const {ApiError,sendError,secureOrigin}=require('../lib/platform');
const {currentUser}=require('../lib/niko-auth');
const {query}=require('../lib/niko-db');
const {shortlist}=require('../lib/niko-intelligence');
const {decrypt}=require('../lib/platform');
const number=(x,d,min,max)=>Number.isFinite(Number(x))?Math.max(min,Math.min(max,Math.floor(Number(x)))):d;
async function status(uid){
 const [pol,matches,runs]=await Promise.all([
  query('select enabled,min_score,remote_only,inclusive_only,max_results,updated_at from public.niko_agent_policies where user_id=$1',[uid]),
  query('select m.job_url,m.score,m.explanation,m.status,m.last_seen_at,j.title,j.company,j.location,j.source,j.remote from public.niko_agent_matches m join public.niko_public_jobs j on j.url=m.job_url where m.user_id=$1 and m.status<>$2 order by m.score desc limit 30',[uid,'dismissed']),
  query('select started_at,finished_at,outcome,matches_found from public.niko_agent_runs where user_id=$1 order by started_at desc limit 5',[uid])
 ]);
 return {policy:pol[0]||{enabled:false,min_score:50,remote_only:false,inclusive_only:false,max_results:20},matches,runs};
}
async function preview(uid,policy){
 const [profiles,jobs]=await Promise.all([
  query('select full_name,target_role,target_location,cv_ciphertext from public.niko_profiles where user_id=$1',[uid]),
  query("select url,title,company,location,source,excerpt,contract,remote,posted_at from public.niko_public_jobs where last_seen_at>now()-interval '21 days' order by last_seen_at desc limit 250")
 ]);
 const p=profiles[0];
 if(!p)throw new ApiError(400,'Enregistrez votre profil dans le cockpit avant de démarrer le moteur.');
 const profile={targetRole:p.target_role,targetLocation:p.target_location,cvText:p.cv_ciphertext?decrypt(p.cv_ciphertext,uid+':cv'):''};
 const found=shortlist(profile,jobs,policy).slice(0,15).map(x=>({url:x.job.url,title:x.job.title,company:x.job.company,location:x.job.location,source:x.job.source,score:x.judgment.score,explanation:x.judgment.explanation}));
 return {matches:found,catalogSize:jobs.length,disclaimer:'Scores indicatifs. Offres et disponibilités à vérifier auprès des employeurs.'};
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 try{
  if(!['GET','POST'].includes(req.method))throw new ApiError(405,'Méthode non autorisée.');
  secureOrigin(req);const user=await currentUser(req);
  if(req.method==='GET')return res.status(200).json(await status(user.id));
  const body=req.body||{};
  if(body.action==='preview'){
   const saved=await status(user.id);
   return res.status(200).json(await preview(user.id,{minScore:saved.policy.min_score,remoteOnly:saved.policy.remote_only,inclusiveOnly:saved.policy.inclusive_only,maxResults:saved.policy.max_results}));
  }
  if(body.action==='feedback'){
   if(!['saved','dismissed','suggested'].includes(body.status)||typeof body.url!=='string'||body.url.length>1600)throw new ApiError(400,'Action de suivi invalide.');
   const rows=await query('update public.niko_agent_matches set status=$3 where user_id=$1 and job_url=$2 returning job_url',[user.id,body.url,body.status]);
   if(!rows.length)throw new ApiError(404,'Offre non suivie.');
   return res.status(200).json({saved:true});
  }
  if(body.action!=='settings')throw new ApiError(400,'Action inconnue.');
  const enabled=body.enabled===true;
  if(enabled&&body.consent!==true)throw new ApiError(400,'Activation sans consentement explicite interdite.');
  if(enabled){
   const profiles=await query('select target_role,cv_ciphertext from public.niko_profiles where user_id=$1',[user.id]);
   if(!profiles.length||!profiles[0].target_role&&!profiles[0].cv_ciphertext)throw new ApiError(400,'Sauvegardez votre profil avant d’activer l’agent.');
  }
  const policy={enabled,minScore:number(body.minScore,50,0,100),remoteOnly:body.remoteOnly===true,inclusiveOnly:body.inclusiveOnly===true,maxResults:number(body.maxResults,20,1,50)};
  await query('insert into public.niko_agent_policies(user_id,enabled,consent_at,min_score,remote_only,inclusive_only,max_results) values($1,$2,$3,$4,$5,$6,$7) '+
   'on conflict(user_id) do update set enabled=excluded.enabled,consent_at=excluded.consent_at,min_score=excluded.min_score,remote_only=excluded.remote_only,inclusive_only=excluded.inclusive_only,max_results=excluded.max_results,updated_at=now()',[
    user.id,policy.enabled,enabled?new Date().toISOString():null,policy.minScore,policy.remoteOnly,policy.inclusiveOnly,policy.maxResults
   ]);
  return res.status(200).json({saved:true,policy,delivery:'recommandations uniquement : aucun envoi de candidature ni de réponse automatique'});
 }catch(e){return sendError(res,e);}
};