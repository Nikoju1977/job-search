'use strict';
const crypto=require('node:crypto');
const {ApiError,validEmail,clean}=require('./platform');
const {query}=require('./niko-db');
const COOKIE='niko_session';
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function origin(){return (process.env.APP_ORIGIN||'https://niko-emploi.vercel.app').replace(/\/+$/,'');}
function authReady(){return Boolean(process.env.DATABASE_URL&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&process.env.DATA_ENCRYPTION_KEY&&process.env.APP_ORIGIN);}
function cookieToken(req){const header=String(req.headers?.cookie||'');const raw=header.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));const token=raw?.slice(COOKIE.length+1)||'';return /^[A-Za-z0-9_-]{32,100}$/.test(token)?token:'';}
function cookieHeader(token,age=14*86400){
 const secure=origin().startsWith('https:')?'; Secure':'';
 return COOKIE+'='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+secure;
}
async function currentUser(req){
 if(!process.env.DATABASE_URL)throw new ApiError(503,'Compte autonome non configuré.');
 const token=cookieToken(req);
 if(!token)throw new ApiError(401,'Connectez-vous à votre espace candidat.');
 const rows=await query('select u.id,u.email from public.niko_sessions s join public.niko_users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now() and s.revoked_at is null and u.deleted_at is null limit 1',[hash(token)]);
 if(!rows.length)throw new ApiError(401,'Session expirée. Reconnectez-vous.');
 return rows[0];
}
async function issueLoginLink(email){
 if(!authReady())throw new ApiError(503,'Connexion en attente de configuration.');
 const normalized=clean(email,180).toLowerCase();
 if(!validEmail(normalized))throw new ApiError(400,'Adresse e-mail incorrecte.');
 const rate=await query("select count(*)::int as n from public.niko_login_links where email=$1 and created_at>now()-interval '60 minutes'",[normalized]);
 if((rate[0]?.n||0)>=3)throw new ApiError(429,'Trop de liens demandés. Réessayez dans une heure.');
 const token=crypto.randomBytes(32).toString('base64url');
 await query("insert into public.niko_login_links(token_hash,email,expires_at) values($1,$2,now()+interval '15 minutes')",[hash(token),normalized]);
 const link=origin()+'/candidatures.html?login_token='+encodeURIComponent(token);
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[normalized],subject:'Votre lien sécurisé Niko Emploi',html:'<p>Connexion à Niko Emploi : <a href="'+link+'">ouvrir mon espace candidat</a>.</p><p>Ce lien expire dans 15 minutes. Si vous ne l’avez pas demandé, ignorez ce message.</p>',text:'Votre lien de connexion Niko Emploi (15 minutes) : '+link}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new ApiError(502,'Impossible d’envoyer le lien de connexion pour le moment.');
 return {emailSent:true};
}
async function consumeLink(token,res){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{35,100}$/.test(token))throw new ApiError(400,'Lien de connexion invalide.');
 const rows=await query('update public.niko_login_links set consumed_at=now() where token_hash=$1 and consumed_at is null and expires_at>now() returning email',[hash(token)]);
 if(!rows.length)throw new ApiError(401,'Lien déjà utilisé ou expiré. Demandez un nouveau lien.');
 const email=rows[0].email;
 const users=await query('insert into public.niko_users(email) values($1) on conflict(email) do update set email=excluded.email returning id,email',[email]);
 const value=crypto.randomBytes(32).toString('base64url');
 await query("insert into public.niko_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '14 days')",[hash(value),users[0].id]);
 res.setHeader('Set-Cookie',cookieHeader(value));
 return {authenticated:true,email:users[0].email};
}
async function logout(req,res){
 const token=cookieToken(req);
 if(token&&process.env.DATABASE_URL)await query('update public.niko_sessions set revoked_at=now() where token_hash=$1',[hash(token)]);
 res.setHeader('Set-Cookie',cookieHeader('',0));
 return {authenticated:false};
}
module.exports={authReady,currentUser,issueLoginLink,consumeLink,logout,cookieHeader,hash};