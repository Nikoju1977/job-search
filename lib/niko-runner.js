'use strict';
const {query}=require('./niko-db');
const {decrypt}=require('./platform');
const {shortlist}=require('./niko-intelligence');
const {notifyNewMatches}=require('./niko-digest');
function capped(n,min,max,defaultValue){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):defaultValue;}
async function scanCandidates({maxUsers=4}={}){
 maxUsers=capped(maxUsers,1,10,4);
 if(!process.env.DATABASE_URL||!process.env.DATA_ENCRYPTION_KEY)return {status:'paused',reason:'Base candidat ou chiffrement non configuré',processed:0};
 const candidates=await query(
 'select p.user_id,p.full_name,p.target_role,p.target_location,p.cv_ciphertext,pol.min_score,pol.remote_only,pol.inclusive_only,pol.max_results,pol.email_digest '+
 'from public.niko_profiles p join public.niko_agent_policies pol on pol.user_id=p.user_id '+
 'where pol.enabled=true and pol.consent_at is not null and (length(p.target_role)>0 or p.cv_ciphertext is not null) '+
 'order by coalesce((select max(r.started_at) from public.niko_agent_runs r where r.user_id=p.user_id),to_timestamp(0)) asc limit $1',[maxUsers]);
 if(!candidates.length)return {status:'idle',processed:0,ranked:0};
 const jobs=await query("select url,source,title,company,location,contract,excerpt,remote,posted_at from public.niko_public_jobs where last_seen_at > now()-interval '21 days' order by last_seen_at desc limit 300");
 let processed=0,ranked=0,skipped=0,failed=0;
 for(const c of candidates){
  const claims=await query('insert into public.niko_agent_runs(user_id) values($1) on conflict do nothing returning id',[c.user_id]);
  if(!claims.length){skipped++;continue;}
  const runId=claims[0].id;
  try{
   const profile={fullName:c.full_name,targetRole:c.target_role,targetLocation:c.target_location,cvText:c.cv_ciphertext?decrypt(c.cv_ciphertext,c.user_id+':cv'):''};
   const policy={minScore:c.min_score,remoteOnly:c.remote_only,inclusiveOnly:c.inclusive_only,maxResults:c.max_results};
   const matches=shortlist(profile,jobs,policy);
   const data=matches.map(({job,judgment})=>({url:job.url,score:judgment.score,explanation:judgment.explanation}));
   let newCount=0;
   if(data.length){
    const existing=await query('select job_url from public.niko_agent_matches where user_id=$1 and job_url = any($2::text[])',[c.user_id,data.map(d=>d.url)]);
    const old=new Set(existing.map(e=>e.job_url));newCount=data.filter(d=>!old.has(d.url)).length;
    await query('insert into public.niko_agent_matches(user_id,job_url,score,explanation) '+
     'select $1,x.url,x.score,x.explanation from jsonb_to_recordset($2::jsonb) as x(url text,score integer,explanation jsonb) '+
     'on conflict(user_id,job_url) do update set score=excluded.score,explanation=excluded.explanation,last_seen_at=now()',[c.user_id,JSON.stringify(data)]);
   }
   await query("update public.niko_agent_runs set finished_at=now(),outcome='ok',matches_found=$2 where id=$1",[runId,data.length]);
   ranked+=data.length;processed++;
   if(c.email_digest&&newCount>0){
    const day=new Date().toISOString().slice(0,10);
    await notifyNewMatches({userId:c.user_id,newCount,runDay:day}).catch(()=>{});
   }
  }catch(error){
   failed++;
   await query("update public.niko_agent_runs set finished_at=now(),outcome='error',error_code=$2 where id=$1",[runId,'MATCH_FAILED']).catch(()=>{});
  }
 }
 return {status:'completed',processed,ranked,skipped,failed,catalogCount:jobs.length};
}
module.exports={scanCandidates};