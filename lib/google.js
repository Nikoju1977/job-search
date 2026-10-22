'use strict';
const {ApiError,encrypt,decrypt,database,eq}=require('./platform');
function gmailConfig(){if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)throw new ApiError(503,'OAuth Google non configuré.');}
function appOrigin(){return (process.env.APP_ORIGIN||'https://niko-emploi.vercel.app').replace(/\/+$/,'');}
function redirectUri(){return appOrigin()+'/api/google-callback';}
async function exchange(code){
 gmailConfig();
 const body=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,code,grant_type:'authorization_code',redirect_uri:redirectUri()});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body,signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new ApiError(502,'Échec de connexion Google.');
 const o=await r.json();
 if(!o.refresh_token||!o.access_token)throw new ApiError(400,'Accès hors ligne non accordé. Reconnectez Gmail.');
 return o;
}
async function googleToken(userId){
 gmailConfig();
 const accounts=await database('gmail_connections',{query:'user_id='+eq(userId)+'&select=refresh_ciphertext,email,auto_monitor,auto_ack'});
 const connection=accounts?.[0];if(!connection)throw new ApiError(412,'Connectez Gmail à votre espace candidat.');
 const refresh=decrypt(connection.refresh_ciphertext,userId+':refresh');
 const body=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body,signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new ApiError(401,'Autorisation Gmail expirée ou révoquée. Reconnectez Gmail.');
 const o=await r.json();if(!o.access_token)throw new ApiError(401,'Accès Gmail non disponible.');
 return {token:o.access_token,email:connection.email,monitor:connection.auto_monitor,autoAck:connection.auto_ack};
}
async function gmail(token,path,{method='GET',value}={}){
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},
  ...(value===undefined?{}:{body:JSON.stringify(value)}),signal:AbortSignal.timeout(12000)});
 let data;try{data=await r.json()}catch{data={}};
 if(!r.ok)throw new ApiError(r.status===401?401:502,'Gmail indisponible ('+r.status+').');
 return data;
}
const header=(m,key)=>(m?.payload?.headers||[]).find(h=>h.name?.toLowerCase()===key.toLowerCase())?.value||'';
function decode(str){try{return Buffer.from(str,'base64url').toString('utf8')}catch{return ''}}
function bodyText(m){
 const stack=[m?.payload],found=[];
 while(stack.length){const p=stack.pop();if(!p)continue;if(p.mimeType==='text/plain'&&p.body?.data)found.push(decode(p.body.data));if(p.parts)stack.push(...p.parts);}
 const v=(found.join('\n')||m?.snippet||'').slice(0,4000);
 return v.split(/\n(?:Le .*a écrit|On .*wrote|De\s*:|From\s*:|>)/i)[0].slice(0,1800);
}
function address(str){const s=String(str||'');const match=s.match(/<([^<>]+)>/);return (match?match[1]:s).trim().toLowerCase();}
function suspicious(from,m){
 const auto=header(m,'Auto-Submitted')+' '+header(m,'Precedence')+' '+header(m,'List-Unsubscribe');
 return /no.?reply|do.?not.?reply|mailer-daemon|postmaster/i.test(from)||/auto-replied|auto-generated|bulk|list|mailto:/i.test(auto);
}
function mimeEncoded(value){return '=?UTF-8?B?'+Buffer.from(value,'utf8').toString('base64')+'?=';}
function b64lines(value){return Buffer.from(value,'utf8').toString('base64').replace(/.{1,76}/g,'$&\r\n').trim();}
async function sendPlain({token,to,subject,body,threadId,inReplyTo}){
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to))throw new ApiError(400,'Adresse de recruteur invalide.');
 const h=['To: '+to,'Subject: '+mimeEncoded(subject.slice(0,220)),'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64'];
 if(inReplyTo && /^[<][^<>\r\n]{5,300}[>]$/.test(inReplyTo))h.splice(3,0,'In-Reply-To: '+inReplyTo,'References: '+inReplyTo);
 const raw=Buffer.from(h.join('\r\n')+'\r\n\r\n'+b64lines(body.slice(0,9000)),'utf8').toString('base64url');
 const sent=await gmail(token,'/messages/send',{method:'POST',value:{raw,...(threadId?{threadId}:{})}});
 if(!sent.id)throw new ApiError(502,'Gmail n’a pas confirmé l’envoi.');
 return sent;
}
module.exports={gmailConfig,appOrigin,redirectUri,exchange,googleToken,gmail,header,bodyText,address,suspicious,sendPlain};
