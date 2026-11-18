'use strict';
// Rappels des échéances DÛES uniquement, opt-in, aucun e-mail aux recruteurs.
const {query}=require('./niko-db');
const {validEmail}=require('./platform');
function ready(){
 return Boolean(process.env.DATABASE_URL&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&process.env.APP_ORIGIN);
}
async function notifyUser({userId,email,dueCount,day,queryFn=query,fetchFn=fetch}){
 if(!ready()||!userId||!validEmail(email)||!Number.isInteger(dueCount)||dueCount<1)return {status:'skipped'};
 const enabled=await queryFn([
  'select 1 from public.niko_tracker_settings p join public.niko_users u on u.id=p.user_id',
  'where p.user_id=$1 and p.email_reminders=true and u.email=$2 and u.deleted_at is null'
 ].join(' '),[userId,email]);
 if(!enabled.length)return {status:'disabled'};
 const reserved=await queryFn([
  'insert into public.niko_tracker_digest_log(user_id,reminder_date,status)',
  "values($1,$2,'pending') on conflict do nothing returning user_id"
 ].join(' '),[userId,day]);
 if(!reserved.length)return {status:'already_processed'};
 const link=String(process.env.APP_ORIGIN).replace(/\/+$/,'')+'/suivi.html';
 const payload={
  from:process.env.EMAIL_FROM,to:[email],
  subject:'Niko Emploi — '+dueCount+' action'+(dueCount>1?'s':'')+' de candidature à suivre',
  text:'Vous avez '+dueCount+' action'+(dueCount>1?'s':'')+' de candidature arrivée'+(dueCount>1?'s':'')+' à échéance.\n\nOuvrez votre espace personnel pour les consulter : '+link+
   '\n\nAucune relance ni candidature n’a été envoyée à un recruteur. Vous pouvez désactiver ces messages à tout moment dans votre suivi.'
 };
 try{
  const response=await fetchFn('https://api.resend.com/emails',{method:'POST',headers:{
   'Content-Type':'application/json',Authorization:'Bearer '+process.env.RESEND_API_KEY,
   'Idempotency-Key':'niko-tracker:'+userId+':'+day
  },body:JSON.stringify(payload),signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('EMAIL_SEND_FAILED');
  const result=await response.json();
  if(!result?.id)throw Error('EMAIL_UNCONFIRMED');
  await queryFn("update public.niko_tracker_digest_log set status='sent',provider_message_id=$3,delivered_at=now() where user_id=$1 and reminder_date=$2",
   [userId,day,result.id]);
  return {status:'sent'};
 }catch{
  await queryFn("update public.niko_tracker_digest_log set status='failed' where user_id=$1 and reminder_date=$2 and status='pending'",[userId,day]).catch(()=>{});
  return {status:'failed'};
 }
}
async function runTrackerReminders({maxUsers=6,queryFn=query,fetchFn=fetch}={}){
 if(!ready())return {status:'paused',reason:'Paramètres e-mail ou base absents',sent:0};
 const day=new Date().toISOString().slice(0,10);
 let candidates;
 try{
  candidates=await queryFn([
   'select u.id as user_id,u.email,count(a.id)::int as due_count',
   'from public.niko_tracker_settings p join public.niko_users u on u.id=p.user_id',
   'join public.niko_applications a on a.user_id=u.id',
   'where p.email_reminders=true and u.deleted_at is null and a.archived_at is null',
   "and a.status in ('draft','sent','reply','interview','offer')",
   'and a.next_action_at is not null and a.next_action_at<=now()',
   'group by u.id,u.email order by min(a.next_action_at) asc limit $1'
  ].join(' '),[Math.min(20,Math.max(1,Number(maxUsers)||6))]);
 }catch(error){
  if(['42P01','42703'].includes(error?.code))return {status:'migration_required',sent:0};
  return {status:'source_unavailable',sent:0};
 }
 const outcomes=[];
 // Protect provider quotas: sequential, small daily batch, at-most-once per user/day.
 for(const item of candidates){
  outcomes.push(await notifyUser({userId:item.user_id,email:item.email,dueCount:Number(item.due_count),day,queryFn,fetchFn}));
 }
 return {status:'completed',processed:outcomes.length,sent:outcomes.filter(o=>o.status==='sent').length,
  failed:outcomes.filter(o=>o.status==='failed').length};
}
module.exports={ready,notifyUser,runTrackerReminders};
