'use strict';
const {ApiError,validEmail}=require('./platform');
const ID=/^[A-Za-z0-9_-]{8,200}$/;
function addresses(s){
 const text=String(s||'').replace(/[\r\n]/g,' ');
 return (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[]).map(x=>x.toLowerCase());
}
async function verifyGmailSend({accessToken,messageId,threadId,recipient}){
 if(typeof accessToken!=='string'||accessToken.length<30||accessToken.length>4000)throw new ApiError(400,'Autorisation Gmail manquante.');
 if(!ID.test(messageId||'')||!ID.test(threadId||''))throw new ApiError(400,'Identifiants Gmail invalides.');
 if(!validEmail(recipient))throw new ApiError(400,'Adresse destinataire invalide.');
 const url='https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(messageId)+'?format=metadata&metadataHeaders=To';
 let response;
 try{response=await fetch(url,{headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},signal:AbortSignal.timeout(10000)});}catch{throw new ApiError(502,'Vérification Gmail momentanément indisponible.');}
 if(!response.ok)throw new ApiError(422,'Envoi Gmail non vérifié. Vérifiez les autorisations de lecture et votre compte.');
 const data=await response.json();
 const to=(data.payload?.headers||[]).filter(h=>h.name?.toLowerCase()==='to').map(h=>h.value).join(',');
 if(data.id!==messageId||data.threadId!==threadId||!data.labelIds?.includes('SENT')||!addresses(to).includes(recipient.toLowerCase()))throw new ApiError(422,'Le message confirmé par Gmail ne correspond pas à cette candidature.');
 return {messageId:data.id,threadId:data.threadId};
}
module.exports={verifyGmailSend,addresses};
