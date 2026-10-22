'use strict';
const {authenticate,database,encrypt,clean,validEmail,validUrl,secureOrigin,sendError,ApiError,eq,userQuery}=require('../lib/platform');
const {verifyGmailSend}=require('../lib/gmail-proof');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try{
  secureOrigin(req);
  if(req.method!=='POST')throw new ApiError(405,'Méthode non autorisée.');
  const user=await authenticate(req),d=req.body||{},j=d.job||{};
  if(d.consent!==true)throw new ApiError(400,'Autorisation de stockage explicite requise.');
  if(!validUrl(j.url)||!clean(j.title)||!clean(j.company))throw new ApiError(400,'L’annonce doit avoir un titre, un employeur et une URL valide.');
  const hasProof=d.action==='sent';
  if(!['draft','sent'].includes(d.action))throw new ApiError(400,'Action de candidature invalide.');
  if(hasProof)await verifyGmailSend({accessToken:d.gmailAccessToken,messageId:d.messageId,threadId:d.threadId,recipient:d.to});
  const letter=clean(d.letter,10000),jobUrl=clean(j.url,1600);
  const payload={
   user_id:user.id,job_url:jobUrl,title:clean(j.title,180),company:clean(j.company,150),location:clean(j.location,160),
   source:clean(j.source,80),recipient_email:validEmail(d.to)?clean(d.to,254):null,
   letter_ciphertext:letter?encrypt(letter,user.id+':letter'):null,
   status:hasProof?'sent':'draft',
   gmail_thread_id:hasProof?clean(d.threadId,250):null,
   gmail_message_id:hasProof?clean(d.messageId,250):null,
   sent_at:hasProof?new Date().toISOString():null,
   updated_at:new Date().toISOString()
  };
  const existing=await database('applications',{query:userQuery(user.id,'job_url='+eq(jobUrl)+'&select=id,status')});
  if(existing?.[0]?.status==='sent' && d.action==='draft')throw new ApiError(409,'Cette candidature est déjà marquée envoyée.');
  if(existing?.[0]?.status==='sent' && d.action==='sent')throw new ApiError(409,'Candidature déjà enregistrée comme envoyée.');
  if(existing?.[0]?.id){
   await database('applications',{method:'PATCH',query:userQuery(user.id,'id='+eq(existing[0].id)),value:payload});
  }else{
   await database('applications',{method:'POST',value:payload});
  }
  return res.status(200).json({saved:true,status:payload.status});
 }catch(e){return sendError(res,e);}
};
