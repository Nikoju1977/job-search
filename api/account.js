'use strict';
const {authenticate,database,userQuery,eq,encrypt,decrypt,clean,secureOrigin,sendError,ApiError,publicConfig}=require('../lib/platform');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 try{
  secureOrigin(req);
  if(req.method==='GET' && req.query?.public==='true')return res.status(200).json(publicConfig());
  if(!['GET','POST','DELETE'].includes(req.method))throw new ApiError(405,'Méthode non autorisée');
  const user=await authenticate(req);
  if(req.method==='GET'){
   const [profiles,apps,interviews,events,connect]=await Promise.all([
    database('profiles',{query:userQuery(user.id)+'&select=full_name,target_role,target_location,cv_ciphertext'}),
    database('applications',{query:userQuery(user.id)+'&select=id,job_url,title,company,location,source,recipient_email,letter_ciphertext,status,gmail_thread_id,sent_at,updated_at&order=updated_at.desc&limit=200'}),
    database('interviews',{query:userQuery(user.id)+'&select=id,application_id,company,title,scheduled_at,status,created_at&order=created_at.desc&limit=50'}),
    database('agent_events',{query:userQuery(user.id)+'&select=id,application_id,category,draft_ciphertext,status,received_at&order=received_at.desc&limit=50'}),
    database('gmail_connections',{query:userQuery(user.id)+'&select=email,auto_monitor,auto_ack'})
   ]);
   const profile=profiles?.[0]||{};
   return res.status(200).json({
    profile:{fullName:profile.full_name||'',targetRole:profile.target_role||'',targetLocation:profile.target_location||'',cvText:profile.cv_ciphertext?decrypt(profile.cv_ciphertext,user.id+':cv'):''},
    applications:(apps||[]).map(a=>({id:a.id,url:a.job_url,title:a.title,company:a.company,location:a.location,source:a.source,to:a.recipient_email,status:a.status,sentAt:a.sent_at,updatedAt:a.updated_at,letter:a.letter_ciphertext?decrypt(a.letter_ciphertext,user.id+':letter'):''})),
    interviews:interviews||[],
    replies:(events||[]).map(e=>({id:e.id,applicationId:e.application_id,category:e.category,status:e.status,receivedAt:e.received_at,draft:e.draft_ciphertext?decrypt(e.draft_ciphertext,user.id+':reply'):''})),
    gmail:connect?.[0]?{connected:true,email:connect[0].email,monitor:connect[0].auto_monitor,autoAck:connect[0].auto_ack}:{connected:false},
    email:user.email
   });
  }
  if(req.method==='DELETE'){
   // La suppression cascade de la connexion est explicite; aucune donnée
   // du compte Google lui-même n'est effacée.
   for(const t of ['agent_events','interviews','applications','gmail_connections','profiles'])await database(t,{method:'DELETE',query:userQuery(user.id)});
   return res.status(200).json({deleted:true});
  }
  const {profile,dataConsent}=req.body||{};
  if(dataConsent!==true||!profile||typeof profile!=='object')throw new ApiError(400,'Consentement explicite requis pour enregistrer le profil.');
  const cv=clean(profile.cvText,23000);
  if(cv.length>22000)throw new ApiError(413,'CV trop long pour cet espace.');
  const payload={user_id:user.id,full_name:clean(profile.fullName,100),target_role:clean(profile.targetRole,120),target_location:clean(profile.targetLocation,120),cv_ciphertext:cv?encrypt(cv,user.id+':cv'):null,updated_at:new Date().toISOString()};
  await database('profiles',{method:'POST',query:'on_conflict=user_id',value:payload});
  return res.status(200).json({saved:true});
 }catch(e){return sendError(res,e);}
};
