'use strict';
const {ApiError,sendError,secureOrigin}=require('../lib/platform');
const {currentUser,issueLoginLink,consumeLink,logout}=require('../lib/niko-auth');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 try{
  if(req.method==='GET'){
   try{const user=await currentUser(req);return res.status(200).json({authenticated:true,email:user.email});}
   catch(e){if(e.status===401||e.status===503)return res.status(200).json({authenticated:false});throw e;}
  }
  if(req.method!=='POST')throw new ApiError(405,'Méthode non autorisée.');
  secureOrigin(req);
  const payload=req.body||{};
  switch(payload.action){
   case 'login':return res.status(200).json(await issueLoginLink(payload.email));
   case 'verify':return res.status(200).json(await consumeLink(payload.token,res));
   case 'logout':return res.status(200).json(await logout(req,res));
   default:throw new ApiError(400,'Action inconnue.');
  }
 }catch(e){return sendError(res,e);}
};