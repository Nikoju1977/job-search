'use strict';
const {ApiError,hasDb,clean,validEmail,sendError,secureOrigin}=require('../lib/platform');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  secureOrigin(req);
  if(req.method!=='POST')throw new ApiError(405,'Méthode non autorisée.');
  if(!hasDb())throw new ApiError(503,'Comptes indisponibles.');
  const action=req.body?.action;
  const base=String(process.env.SUPABASE_URL).replace(/\/+$/,'');
  let path,body;
  if(action==='login'){
    const email=clean(req.body?.email,180).toLowerCase();
    if(!validEmail(email))throw new ApiError(400,'Adresse e-mail invalide.');
    path='/auth/v1/otp?redirect_to='+encodeURIComponent((process.env.APP_ORIGIN||'https://niko-emploi.vercel.app')+'/candidatures.html');
    body={email,create_user:true};
  }else if(action==='refresh'){
    const token=clean(req.body?.refreshToken,5000);
    if(!token)throw new ApiError(400,'Session invalide.');
    path='/auth/v1/token?grant_type=refresh_token';body={refresh_token:token};
  }else if(action==='verify'){
    const token_hash=clean(req.body?.tokenHash,500);
    if(!token_hash)throw new ApiError(400,'Lien de connexion invalide.');
    path='/auth/v1/verify';body={token_hash,type:'email'};
  }else throw new ApiError(400,'Action inconnue.');
  const response=await fetch(base+path,{method:'POST',headers:{apikey:process.env.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new ApiError(response.status===429?429:400,'Authentification indisponible ou lien expiré.');
  const result=await response.json();
  if(action==='login')return res.status(200).json({emailSent:true});
  return res.status(200).json({access_token:result.access_token,refresh_token:result.refresh_token,expires_in:result.expires_in});
 }catch(e){return sendError(res,e);}
};
