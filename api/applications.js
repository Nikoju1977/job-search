'use strict';
const {ApiError,encrypt,clean,validUrl,validEmail,sendError,secureOrigin}=require('../lib/platform');
const {currentUser}=require('../lib/niko-auth');
const {query}=require('../lib/niko-db');
const {verifyGmailSend}=require('../lib/gmail-proof');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 try{
  if(req.method!=='POST')throw new ApiError(405,'Méthode non autorisée.');
  secureOrigin(req);
  const user=await currentUser(req),payload=req.body||{},job=payload.job||{};
  if(payload.consent!==true)throw new ApiError(400,'Consentement explicite requis.');
  if(!validUrl(job.url)||!clean(job.title)||!clean(job.company))throw new ApiError(400,'Annonce invalide : URL, titre et employeur requis.');
  if(!['sent','draft'].includes(payload.action))throw new ApiError(400,'Action inconnue.');
  if(payload.action==='sent')await verifyGmailSend({accessToken:payload.gmailAccessToken,messageId:payload.messageId,threadId:payload.threadId,recipient:payload.to});
  const isSent=payload.action==='sent';
  const letter=clean(payload.letter,10000),target=validEmail(payload.to)?clean(payload.to,250):null;
  const status=isSent?'sent':'draft';
  const rows=await query(
    'insert into public.niko_applications(user_id,job_url,title,company,location,source,recipient_email,letter_ciphertext,status,gmail_thread_id,gmail_message_id,sent_at) '+
    'values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict(user_id,job_url) do update set '+
    'title=excluded.title,company=excluded.company,location=excluded.location,source=excluded.source,recipient_email=excluded.recipient_email,'+
    'letter_ciphertext=excluded.letter_ciphertext,status=excluded.status,gmail_thread_id=excluded.gmail_thread_id,'+
    'gmail_message_id=excluded.gmail_message_id,sent_at=excluded.sent_at,updated_at=now() '+
    "where public.niko_applications.status='draft' returning id,status",
    [user.id,clean(job.url,1600),clean(job.title,180),clean(job.company,150),clean(job.location,150),clean(job.source,80),target,
     letter?encrypt(letter,user.id+':letter'):null,status,isSent?clean(payload.threadId,200):null,isSent?clean(payload.messageId,200):null,isSent?new Date().toISOString():null]
  );
  if(!rows.length)throw new ApiError(409,'Candidature déjà envoyée : mise à jour impossible pour éviter les doublons.');
  return res.status(200).json({saved:true,status:rows[0].status,id:rows[0].id});
 }catch(e){return sendError(res,e);}
};