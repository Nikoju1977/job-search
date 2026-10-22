'use strict';
const crypto=require('node:crypto');
const {ApiError}=require('./platform');
function secret(){const s=process.env.DATA_ENCRYPTION_KEY;if(!s||Buffer.from(s,'base64').length!==32)throw new ApiError(503,'Secret de connexion indisponible.');return Buffer.from(s,'base64');}
function sign(userId){
 const payload=Buffer.from(JSON.stringify({uid:userId,exp:Date.now()+10*60*1000,nonce:crypto.randomBytes(12).toString('hex')})).toString('base64url');
 const mac=crypto.createHmac('sha256',secret()).update('niko-oauth:'+payload).digest('base64url');
 return payload+'.'+mac;
}
function verify(state){
 const [payload,mac]=String(state||'').split('.');
 if(!payload||!mac||payload.length>1500||mac.length!==43)throw new ApiError(400,'État OAuth invalide.');
 const expected=crypto.createHmac('sha256',secret()).update('niko-oauth:'+payload).digest('base64url');
 if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(mac)))throw new ApiError(400,'État OAuth falsifié.');
 let data;try{data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))}catch{throw new ApiError(400,'État OAuth illisible.')}
 if(Date.now()>data.exp||data.exp>Date.now()+610000||!data.uid)throw new ApiError(400,'Session de connexion expirée.');
 return data.uid;
}
module.exports={sign,verify};
