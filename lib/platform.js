'use strict';
const crypto=require('node:crypto');
class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
const hasDb=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY);
const publicConfig=()=>({accountsAvailable:hasDb(),backgroundAvailable:hasDb()&&Boolean(process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_CLIENT_ID&&process.env.DATA_ENCRYPTION_KEY&&process.env.CRON_SECRET)});
const apiBase=()=>String(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
function secureOrigin(req){if(!['POST','PATCH','PUT','DELETE'].includes(req.method))return;const origin=req.headers?.origin;if(!origin)return;const host=req.headers?.['x-forwarded-host']||req.headers?.host;const scheme=req.headers?.['x-forwarded-proto']||'https';const allowed=[process.env.APP_ORIGIN,host?scheme+'://'+host:null].filter(Boolean);if(!allowed.includes(origin))throw new ApiError(403,'Origine non autorisée.');}
async function parseResponse(response){let data;try{data=await response.json();}catch{data={}}if(!response.ok)throw new ApiError(response.status>=500?502:response.status,data?.message||data?.error_description||data?.error||'Service indisponible');return data;}
async function authenticate(req){if(!hasDb())throw new ApiError(503,'Comptes non activés.');const token=(req.headers?.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token||token.length>5000)throw new ApiError(401,'Connectez-vous.');const resp=await fetch(apiBase()+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_ANON_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});if(!resp.ok)throw new ApiError(401,'Session expirée.');const user=await resp.json();if(!user.id||!user.email)throw new ApiError(401,'Compte non reconnu.');return {id:user.id,email:user.email};}

async function database(table, options={}){
 if(!hasDb())throw new ApiError(503,'Base de données non configurée.');
 if(!['profiles','applications','gmail_connections','agent_events','interviews'].includes(table))throw new ApiError(400,'Table inconnue.');
 const {method='GET',query='',value}=options;
 const response=await fetch(apiBase()+'/rest/v1/'+table+(query?'?'+query:''),{
  method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:options.upsert?'resolution=merge-duplicates,return=representation':'return=representation'},
  ...(value===undefined?{}:{body:JSON.stringify(value)}),signal:AbortSignal.timeout(10000)});
 return parseResponse(response);
}
const eq=v=>'eq.'+encodeURIComponent(String(v));
const userQuery=(id,params='')=>'user_id='+eq(id)+(params?'&'+params:'');
function secretKey(){const b=Buffer.from(process.env.DATA_ENCRYPTION_KEY||'','base64');if(b.length!==32)throw new ApiError(503,'Clé de chiffrement non configurée.');return b;}
function encrypt(s,aad){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secretKey(),iv);cipher.setAAD(Buffer.from(String(aad)));const result=Buffer.concat([cipher.update(String(s),'utf8'),cipher.final()]);return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),result.toString('base64url')].join('.');}
function decrypt(input,aad){if(!input)return '';const [iv,tag,ciphertext]=String(input).split('.');if(!iv||!tag||ciphertext===undefined)throw new ApiError(500,'Donnée chiffrée invalide.');const d=crypto.createDecipheriv('aes-256-gcm',secretKey(),Buffer.from(iv,'base64url'));d.setAAD(Buffer.from(String(aad)));d.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([d.update(Buffer.from(ciphertext,'base64url')),d.final()]).toString('utf8');}
const clean=(s,n=200)=>(typeof s==='string'?s:'').trim().slice(0,n);
const validEmail=s=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s||'')&&s.length<=254;
function validUrl(s){try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&s.length<=1600;}catch{return false;}}
function sendError(res,e){const status=Number(e?.status)||500;return res.status(status).json({error:status===500?'Erreur serveur.':e.message||'Erreur inattendue.'});}
module.exports={ApiError,hasDb,publicConfig,secureOrigin,authenticate,database,eq,userQuery,encrypt,decrypt,clean,validEmail,validUrl,sendError};
