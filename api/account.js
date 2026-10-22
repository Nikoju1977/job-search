'use strict';
const {ApiError,encrypt,decrypt,clean,sendError,secureOrigin}=require('../lib/platform');
const {authReady,currentUser,cookieHeader}=require('../lib/niko-auth');
const {query}=require('../lib/niko-db');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 try{
  if(req.method==='GET'&&req.query?.public==='true'){
   return res.status(200).json({accountsAvailable:authReady(),backgroundAvailable:Boolean(process.env.DATABASE_URL&&process.env.DATA_ENCRYPTION_KEY&&process.env.CRON_SECRET),supabase:false});
  }
  if(!['GET','POST','DELETE'].includes(req.method))throw new ApiError(405,'Méthode non autorisée.');
  secureOrigin(req);
  const user=await currentUser(req);
  if(req.method==='GET'){
   const [profileRows,appRows,policyRows]=await Promise.all([
    query('select full_name,target_role,target_location,cv_ciphertext from public.niko_profiles where user_id=$1',[user.id]),
    query('select id,job_url,title,company,location,source,recipient_email,letter_ciphertext,status,gmail_thread_id,sent_at,updated_at from public.niko_applications where user_id=$1 order by updated_at desc limit 150',[user.id]),
    query('select enabled,min_score,remote_only,inclusive_only,max_results,updated_at from public.niko_agent_policies where user_id=$1',[user.id])
   ]);
   const p=profileRows[0]||{},apps=appRows||[];
   return res.status(200).json({
    email:user.email,
    profile:{fullName:p.full_name||'',targetRole:p.target_role||'',targetLocation:p.target_location||'',cvText:p.cv_ciphertext?decrypt(p.cv_ciphertext,user.id+':cv'):''},
    applications:apps.map(a=>({id:a.id,url:a.job_url,title:a.title,company:a.company,location:a.location,source:a.source,to:a.recipient_email,letter:a.letter_ciphertext?decrypt(a.letter_ciphertext,user.id+':letter'):'',status:a.status,sentAt:a.sent_at,updatedAt:a.updated_at})),
    replies:[],interviews:[],gmail:{connected:false},agent:policyRows[0]||{enabled:false}
   });
  }
  if(req.method==='DELETE'){
   await query('delete from public.niko_login_links where email=$1',[user.email]);
   await query('delete from public.niko_users where id=$1',[user.id]);
   res.setHeader('Set-Cookie',cookieHeader('',0));
   return res.status(200).json({deleted:true,accountDeleted:true});
  }
  if(req.body?.dataConsent!==true||!req.body?.profile||typeof req.body.profile!=='object')throw new ApiError(400,'Sauvegarde du profil sans consentement interdite.');
  const p=req.body.profile,raw=clean(p.cvText,24000);
  if(raw.length>22000)throw new ApiError(413,'CV trop long.');
  const row={fullName:clean(p.fullName,100),targetRole:clean(p.targetRole,120),targetLocation:clean(p.targetLocation,120)};
  await query('insert into public.niko_profiles(user_id,full_name,target_role,target_location,cv_ciphertext) values($1,$2,$3,$4,$5) on conflict(user_id) do update set full_name=excluded.full_name,target_role=excluded.target_role,target_location=excluded.target_location,cv_ciphertext=excluded.cv_ciphertext,updated_at=now()',[
   user.id,row.fullName,row.targetRole,row.targetLocation,raw?encrypt(raw,user.id+':cv'):null
  ]);
  return res.status(200).json({saved:true});
 }catch(e){return sendError(res,e);}
};