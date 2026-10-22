'use strict';
const crypto=require('node:crypto');
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const hasDb=()=>Boolean(process.env.DATABASE_URL);
const publicConfig=()=>({
 accountsAvailable:Boolean(process.env.DATABASE_URL&&process.env.DATA_ENCRYPTION_KEY&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&process.env.APP_ORIGIN),
 backgroundAvailable:Boolean(process.env.DATABASE_URL&&process.env.CRON_SECRET&&process.env.DATA_ENCRYPTION_KEY),
 architecture:'niko-native-neon',
 automaticSending:false
});
function secureOrigin(req){
 if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return;
 const origin=req.headers?.origin;if(!origin)return;
 const host=req.headers?.['x-forwarded-host']||req.headers?.host;
 const scheme=req.headers?.['x-forwarded-proto']||'https';
 const expected=process.env.APP_ORIGIN||((host&&scheme+'://'+host)||null);
 if(origin!==expected)throw new ApiError(403,'Origine non autorisée.');
}
function secretKey(){const b=Buffer.from(process.env.DATA_ENCRYPTION_KEY||'','base64');if(b.length!==32)throw new ApiError(503,'Clé de chiffrement non configurée.');return b;}
function encrypt(s,aad){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secretKey(),iv);
 cipher.setAAD(Buffer.from(String(aad)));
 const result=Buffer.concat([cipher.update(String(s),'utf8'),cipher.final()]);
 return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),result.toString('base64url')].join('.');
}
function decrypt(input,aad){
 if(!input)return '';
 const [iv,tag,ciphertext]=String(input).split('.');
 if(!iv||!tag||ciphertext===undefined)throw new ApiError(500,'Donnée chiffrée invalide.');
 const d=crypto.createDecipheriv('aes-256-gcm',secretKey(),Buffer.from(iv,'base64url'));
 d.setAAD(Buffer.from(String(aad)));d.setAuthTag(Buffer.from(tag,'base64url'));
 return Buffer.concat([d.update(Buffer.from(ciphertext,'base64url')),d.final()]).toString('utf8');
}
const clean=(s,n=200)=>(typeof s==='string'?s:'').trim().slice(0,n);
const validEmail=s=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s||'')&&s.length<=254;
function validUrl(s){try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&s.length<=1600;}catch{return false;}}
function sendError(res,e){const status=Number(e?.status)||500;return res.status(status).json({error:status===500?'Erreur serveur.':e.message||'Erreur inattendue.'});}
module.exports={ApiError,hasDb,publicConfig,secureOrigin,encrypt,decrypt,clean,validEmail,validUrl,sendError};