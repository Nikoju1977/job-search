'use strict';
const {ApiError,clean,validUrl,validEmail,decrypt}=require('./platform');

const STATUSES=Object.freeze(['draft','sent','reply','interview','offer','hired','rejected','withdrawn','failed']);
const ACTIVE=Object.freeze(['draft','sent','reply','interview','offer']);
const LABELS=Object.freeze({draft:'À préparer',sent:'Envoyée',reply:'Réponse reçue',interview:'Entretien',offer:'Proposition',hired:'Embauche',rejected:'Non retenue',withdrawn:'Retirée',failed:'Échec technique'});
const CHANNELS=Object.freeze(['unspecified','email','portal','direct','phone','other']);
const FORMATS=Object.freeze(['','presentiel','telephone','visio','autre']);

function validStatus(value) {
 if(!STATUSES.includes(value))throw new ApiError(400,'Statut inconnu.');
 return value;
}
function optionalDate(value) {
 if(value===null||value===''||value===undefined)return null;
 if(typeof value!=='string'||value.length>40)throw new ApiError(400,'Date invalide.');
 const parsed=Date.parse(value);
 if(!Number.isFinite(parsed)||parsed<Date.UTC(2000,0,1)||parsed>Date.UTC(2100,0,1))
  throw new ApiError(400,'Date invalide.');
 return new Date(parsed).toISOString();
}
function optionalEmail(value) {
 const email=clean(value,254);
 if(email&&!validEmail(email))throw new ApiError(400,'Adresse e-mail du recruteur invalide.');
 return email||null;
}
function normalizeJob(payload) {
 const title=clean(payload?.title,180),company=clean(payload?.company,150);
 const rawUrl=clean(payload?.url,1600);
 if(!title||!company)throw new ApiError(400,'Intitulé du poste et employeur obligatoires.');
 if(rawUrl&&!validUrl(rawUrl))throw new ApiError(400,'URL d’annonce invalide.');
 return {title,company,url:rawUrl||null,location:clean(payload?.location,150),source:clean(payload?.source,80)||'Saisie manuelle'};
}
function cleanUpdate(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new ApiError(400,'Fiche invalide.');
 const status=validStatus(payload.status);
 const format=clean(payload.interviewFormat,40),channel=clean(payload.channel,40)||'unspecified';
 if(!FORMATS.includes(format)||!CHANNELS.includes(channel))throw new ApiError(400,'Mode d’entretien ou canal incorrect.');
 return {
  status,
  recruiterName:clean(payload.recruiterName,120),
  recipientEmail:optionalEmail(payload.to),
  nextActionAt:optionalDate(payload.nextActionAt),
  interviewAt:optionalDate(payload.interviewAt),
  interviewFormat:format,interviewPlace:clean(payload.interviewPlace,180),
  cvVersion:clean(payload.cvVersion,100),notes:clean(payload.notes,4000),
  channel,archived:Boolean(payload.archived)
 };
}
function validVersion(input){
 const n=Number(input);
 if(!Number.isSafeInteger(n)||n<1||n>999999)throw new ApiError(400,'Version de la fiche invalide.');
 return n;
}
function validId(id){
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))
  throw new ApiError(400,'Identifiant de candidature invalide.');
 return id;
}
function mapApplication(row,userId){
 return {
  id:row.id,title:row.title,company:row.company,url:row.job_url||'',
  location:row.location||'',source:row.source||'',status:row.status,
  to:row.recipient_email||'',recruiterName:row.recruiter_name||'',
  notes:row.notes_ciphertext?decrypt(row.notes_ciphertext,userId+':tracker_note'):'',
  nextActionAt:row.next_action_at||null,interviewAt:row.interview_at||null,
  interviewFormat:row.interview_format||'',interviewPlace:row.interview_place||'',
  cvVersion:row.cv_version||'',channel:row.application_channel||'unspecified',
  submissionProof:(row.gmail_thread_id&&row.gmail_message_id)?'gmail_verified':(row.submission_proof||'legacy'),
  firstReplyAt:row.first_reply_at||null,sentAt:row.sent_at||null,
  statusUpdatedAt:row.status_updated_at||null,
  archived:Boolean(row.archived_at),updatedAt:row.updated_at||null,
  gmailThreadId:row.gmail_thread_id||null,version:row.version||1
 };
}
function mapEvent(row,userId) {
 return {id:String(row.id),applicationId:row.application_id,kind:row.kind,
  oldStatus:row.previous_status||null,status:row.next_status||null,
  note:row.message_ciphertext?decrypt(row.message_ciphertext,userId+':tracker_event'):'',
  date:row.occurred_at};
}
function metrics(records,now=Date.now()){
 const visible=records.filter(r=>!r.archived);
 const total=visible.length,sent=visible.filter(r=>r.status!=='draft'&&r.status!=='failed').length;
 const replied=visible.filter(r=>['reply','interview','offer','hired','rejected'].includes(r.status)).length;
 const interviews=visible.filter(r=>['interview','offer','hired'].includes(r.status)).length;
 const due=visible.filter(r=>ACTIVE.includes(r.status)&&r.nextActionAt&&Date.parse(r.nextActionAt)<=now).length;
 const pending=visible.filter(r=>ACTIVE.includes(r.status)).length;
 return {total,sent,replied,interviews,due,pending,responseRate:sent?Math.round(replied/sent*100):null};
}
module.exports={STATUSES,ACTIVE,LABELS,CHANNELS,FORMATS,validStatus,validId,validVersion,optionalDate,normalizeJob,cleanUpdate,mapApplication,mapEvent,metrics};
