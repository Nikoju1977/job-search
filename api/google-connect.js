'use strict';
const {authenticate,sendError,ApiError}=require('../lib/platform');
const {sign}=require('../lib/google-oauth-state');
const {gmailConfig,redirectUri}=require('../lib/google');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='GET')throw new ApiError(405,'Méthode non autorisée.');
  gmailConfig();const user=await authenticate(req);
  const params=new URLSearchParams({response_type:'code',client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri(),scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',include_granted_scopes:'false',state:sign(user.id)});
  return res.status(200).json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params.toString()});
 }catch(e){return sendError(res,e);}
};
