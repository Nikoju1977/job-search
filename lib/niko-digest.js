'use strict';
// Notification-only agent: NEVER sends to recruiters and NEVER includes CV/RQTH data.
const {query}=require('./niko-db');
function notificationReady(){return Boolean(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&process.env.APP_ORIGIN);}
async function notifyNewMatches({userId,newCount,runDay,queryFn=query,fetchFn=fetch}){
 if(!notificationReady()||!userId||!Number.isInteger(newCount)||newCount<1)return {status:'skipped'};
 // Verify live consent just before reserving a notification. Stop controls prevail.
 const rows=await queryFn('select u.email from public.niko_users u join public.niko_agent_policies p on p.user_id=u.id where u.id=$1 and p.enabled=true and p.email_digest=true and p.consent_at is not null and u.deleted_at is null',[userId]);
 if(!rows?.length)return {status:'disabled'};
 const email=rows[0].email;
 const reserved=await queryFn('insert into public.niko_agent_digests(user_id,run_day,new_matches,status) values($1,$2,$3,$4) on conflict do nothing returning user_id',[userId,runDay,newCount,'pending']);
 if(!reserved?.length)return {status:'already_processed'};
 const destination=String(process.env.APP_ORIGIN).replace(/\/+$/,'')+'/candidatures.html#autonomie';
 const subject='Niko Emploi — '+newCount+' nouvelle'+(newCount>1?'s':'')+' opportunité'+(newCount>1?'s':'');
 const content='Votre agent Niko Intelligence a repéré '+newCount+' nouvelle'+(newCount>1?'s':'')+' offre'+(newCount>1?'s':'')+' à examiner. Ouvrez votre cockpit pour consulter les détails : '+destination+'. Vous pouvez désactiver cette alerte dans votre espace candidat. Aucune candidature n’a été envoyée automatiquement.';
 // Stable payload+key: prevents duplicates on provider retries within its idempotency window.
 const payload={from:process.env.EMAIL_FROM,to:[email],subject,text:content};
 try{
  const response=await fetchFn('https://api.resend.com/emails',{method:'POST',headers:{
   Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json',
   'Idempotency-Key':'niko-digest:'+userId+':'+runDay
  },body:JSON.stringify(payload),signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('SEND_FAILED');
  const sent=await response.json();
  if(!sent.id)throw Error('SEND_UNCONFIRMED');
  await queryFn("update public.niko_agent_digests set status='sent',provider_id=$3,delivered_at=now() where user_id=$1 and run_day=$2",[userId,runDay,sent.id]);
  return {status:'sent'};
 }catch{
  await queryFn("update public.niko_agent_digests set status='failed' where user_id=$1 and run_day=$2 and status='pending'",[userId,runDay]).catch(()=>{});
  return {status:'failed'};
 }
}
module.exports={notifyNewMatches,notificationReady};
