'use strict';
const {ApiError,encrypt,sendError,secureOrigin}=require('../lib/platform');
const {currentUser}=require('../lib/niko-auth');
const {query}=require('../lib/niko-db');
const {normalizeJob,cleanUpdate,validId,validVersion,validStatus,optionalDate,mapApplication,mapEvent}=require('../lib/tracker');

function migrationError(error){
 if(['42P01','42703','23514'].includes(error?.code))
  return new ApiError(503,'Suivi cloud en attente de migration : exécuter database/niko-tracker-v6.sql sur Neon.');
 if(error?.code==='23505')return new ApiError(409,'Cette URL appartient déjà à une autre candidature.');
 return error;
}
async function getAll(user,res){
 const [applications,events,settings]=await Promise.all([
  query('select id,job_url,title,company,location,source,recipient_email,recruiter_name,notes_ciphertext,status,submission_proof,application_channel,next_action_at,interview_at,interview_format,interview_place,cv_version,first_reply_at,sent_at,status_updated_at,archived_at,updated_at,gmail_thread_id,gmail_message_id,version from public.niko_applications where user_id=$1 order by updated_at desc limit 250',[user.id]),
  query('select id,application_id,kind,previous_status,next_status,message_ciphertext,occurred_at from public.niko_application_events where user_id=$1 order by occurred_at desc limit 1250',[user.id]),
  query('select email_reminders from public.niko_tracker_settings where user_id=$1',[user.id])
 ]);
 return res.status(200).json({
  applications:applications.map(a=>mapApplication(a,user.id)),
  events:events.map(e=>mapEvent(e,user.id)),
  settings:{emailReminders:Boolean(settings[0]?.email_reminders)},
  limitations:{maxApplications:250,maxEvents:1250,cloud:true},
  retrievedAt:new Date().toISOString()
 });
}
async function create(user,payload,res){
 if(payload.consent!==true)throw new ApiError(400,'Enregistrement soumis à votre autorisation.');
 const job=normalizeJob(payload.job||payload);
 const values=cleanUpdate({...payload,status:payload.status||'draft'});
 if(values.status==='failed')throw new ApiError(400,'Statut réservé aux erreurs techniques.');
 const notes=values.notes?encrypt(values.notes,user.id+':tracker_note'):null;
 const imports=Array.isArray(payload.history)?payload.history.slice(0,30).map(event=>{
  if(!event||!['created','status','edited','imported'].includes(event.kind))throw new ApiError(400,'Événement importé invalide.');
  return {kind:event.kind,old_status:event.oldStatus?validStatus(event.oldStatus):null,
   status:event.status?validStatus(event.status):null,
   message_ciphertext:event.note?encrypt(String(event.note).slice(0,500),user.id+':tracker_event'):null,
   occurred_at:optionalDate(event.date)||new Date().toISOString()};
 }):[];
 const stmt=[
  'with inserted as (',
  'insert into public.niko_applications(user_id,job_url,title,company,location,source,status,recipient_email,recruiter_name,',
  'notes_ciphertext,next_action_at,interview_at,interview_format,interview_place,cv_version,',
  'application_channel,submission_proof,archived_at,status_updated_at)',
  'values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,case when $18 then now() else null end,now())',
  'on conflict (user_id,job_url) do nothing returning id,status',
  '), logged as (',
  "insert into public.niko_application_events(user_id,application_id,kind,next_status)",
  "select $1,id,'created',status from inserted returning id",
  '), imported as (',
  'insert into public.niko_application_events(user_id,application_id,kind,previous_status,next_status,message_ciphertext,occurred_at)',
  'select $1,inserted.id,x.kind,x.old_status,x.status,x.message_ciphertext,x.occurred_at',
  'from inserted cross join jsonb_to_recordset($19::jsonb) as x(kind text,old_status text,status text,message_ciphertext text,occurred_at timestamptz)',
  'returning id',
  ') select id,status from inserted'
 ].join(' ');
 const result=await query(stmt,[user.id,job.url,job.title,job.company,job.location,job.source,values.status,
  values.recipientEmail,values.recruiterName,notes,values.nextActionAt,values.interviewAt,
  values.interviewFormat,values.interviewPlace,values.cvVersion,values.channel,
  values.status==='draft'?'not_sent':'self_reported',values.archived,JSON.stringify(imports)]);
 if(!result.length)throw new ApiError(409,'Cette URL est déjà enregistrée. Ouvrez la candidature existante.');
 return res.status(201).json({saved:true,id:result[0].id,status:result[0].status});
}
async function patch(user,payload,res){
 if(payload.consent!==true)throw new ApiError(400,'Modification soumise à votre autorisation.');
 const id=validId(payload.id),version=validVersion(payload.version),v=cleanUpdate(payload);
 const job=normalizeJob(payload.job||payload);
 const notes=v.notes?encrypt(v.notes,user.id+':tracker_note'):null;
 const message=v.notes?encrypt(v.notes.slice(0,500),user.id+':tracker_event'):null;
 const sql=[
  'with previous as (select id,status from public.niko_applications where user_id=$1 and id=$2 and version=$3),',
  'updated as (update public.niko_applications a set status=$4,recipient_email=$5,recruiter_name=$6,notes_ciphertext=$7,',
  'next_action_at=$8,interview_at=$9,interview_format=$10,interview_place=$11,cv_version=$12,application_channel=$13,',
  'job_url=$16,title=$17,company=$18,location=$19,source=$20,',
  'archived_at=case when $14 then coalesce(a.archived_at,now()) else null end,',
  "submission_proof=case when a.submission_proof='gmail_verified' then 'gmail_verified'",
  "when $4='draft' then 'not_sent' when $4<>'draft' and a.submission_proof in ('not_sent','legacy') then 'self_reported' else a.submission_proof end,",
  "first_reply_at=case when a.first_reply_at is null and $4 in ('reply','interview','offer','hired')",
  'then now() else a.first_reply_at end,',
  "sent_at=case when a.sent_at is null and $4='sent' then now() else a.sent_at end,",
  'status_updated_at=case when a.status<>$4 then now() else a.status_updated_at end,updated_at=now(),version=a.version+1',
  'from previous p where a.user_id=$1 and a.id=p.id and a.version=$3',
  'returning a.id,a.status,a.version,p.status as old_status),',
  'logged as (insert into public.niko_application_events(user_id,application_id,kind,previous_status,next_status,message_ciphertext)',
  "select $1,id,case when old_status<>status then 'status' else 'edited' end,old_status,status,$15",
  'from updated returning id) select id,status,version from updated'
 ].join(' ');
 const result=await query(sql,[user.id,id,version,v.status,v.recipientEmail,v.recruiterName,
  notes,v.nextActionAt,v.interviewAt,v.interviewFormat,v.interviewPlace,v.cvVersion,
  v.channel,v.archived,message,job.url,job.title,job.company,job.location,job.source]);
 if(!result.length)throw new ApiError(409,'Cette candidature a changé ou n’existe plus. Actualisez avant de modifier.');
 return res.status(200).json({saved:true,id:result[0].id,status:result[0].status,version:result[0].version});
}
async function settings(user,payload,res){
 if(payload.consent!==true)throw new ApiError(400,'Consentement requis.');
 const enabled=payload.emailReminders===true;
 if(enabled&&payload.emailConsent!==true)throw new ApiError(400,'Autorisation explicite des rappels e-mail requise.');
 await query('insert into public.niko_tracker_settings(user_id,email_reminders) values($1,$2) on conflict(user_id) do update set email_reminders=excluded.email_reminders,updated_at=now()',
   [user.id,enabled]);
 return res.status(200).json({saved:true,emailReminders:enabled});
}
async function erase(user,payload,res){
 if(payload.consent!==true)throw new ApiError(400,'Confirmez la suppression du dossier.');
 const id=validId(payload.id);
 const rows=await query('delete from public.niko_applications where id=$1 and user_id=$2 returning id',[id,user.id]);
 if(!rows.length)throw new ApiError(404,'Dossier introuvable.');
 return res.status(200).json({deleted:true});
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 try{
  if(!['GET','POST','PATCH','DELETE'].includes(req.method))throw new ApiError(405,'Méthode interdite.');
  secureOrigin(req);
  if(req.method==='GET'&&req.query?.public==='true')return res.status(200).json({cloudConfigured:Boolean(process.env.DATABASE_URL&&process.env.DATA_ENCRYPTION_KEY)});
  const user=await currentUser(req);
  if(req.method==='GET')return await getAll(user,res);
  const payload=req.body||{};
  if(JSON.stringify(payload).length>18000)throw new ApiError(413,'Dossier trop volumineux.');
  if(req.method==='DELETE')return await erase(user,payload,res);
  if(req.method==='PATCH')return await patch(user,payload,res);
  if(payload.action==='settings')return await settings(user,payload,res);
  if(payload.action==='create')return await create(user,payload,res);
  throw new ApiError(400,'Action inconnue.');
 }catch(error){return sendError(res,migrationError(error));}
};
