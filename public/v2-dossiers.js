/* Niko Emploi v2 : contrôle des offres et sauvegarde de brouillons à la demande. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').trim();
const session=()=>{try{return JSON.parse(sessionStorage.getItem('niko_secure_session_v2')||'null')}catch{return null}};
function notify(message,failed=false){const target=$('v2DossierStatus');target.textContent=message;target.classList.toggle('is-error',failed);}
function selectedUrl(){
 const a=document.querySelector('.studio-job.selected a.job-open-link');
 return a?.href||'';
}
function getOffer(){
 return {title:clean($('letterPosition')?.value),company:clean($('letterCompany')?.value),url:clean($('v2DossierUrl')?.value)||selectedUrl(),location:'',source:'Niko Emploi'};
}
function safeUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes('.');}catch{return false;}}
function problems(offer,email,description){
 const issues=[];
 const text=(description+' '+offer.title).toLowerCase();
 if(!safeUrl(offer.url))issues.push('Aucun lien d’annonce HTTPS ou HTTP vérifiable. Retrouvez d’abord l’annonce source.');
 if(/\b(achat de kit|payer.*formation|frais de dossier|versement initial|carte cadeau|cryptomonnaie|bitcoin|virement bancaire|transfert d.argent|avance de frais)\b/i.test(text))issues.push('L’annonce semble évoquer un paiement ou une transaction : vérifiez soigneusement avant de répondre.');
 if(/\b(passeport|carte d.identit[eé]|num[eé]ro de s[eé]curit[eé] sociale|rib|relev[eé] d.identit[eé] bancaire)\b/i.test(text))issues.push('Des justificatifs ou données sensibles sont mentionnés. Vérifiez l’identité du recruteur et la nécessité de chaque document.');
 if(/(t\.me\/|telegram|wa\.me\/|whatsapp|signal\.me)/i.test(text))issues.push('Contact via messagerie externe : privilégiez les coordonnées officielles de l’entreprise.');
 if(email && /^[^\s@]+@(gmail\.com|yahoo\.\w+|hotmail\.\w+|outlook\.\w+|protonmail\.\w+)$/i.test(email))issues.push('Le contact utilise une messagerie grand public. Vérifiez son lien avec l’employeur.');
 if(email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))issues.push('Adresse e-mail du recruteur invalide.');
 if(safeUrl(offer.url)){const u=new URL(offer.url);if(u.protocol!=='https:')issues.push('Le lien de l’annonce n’utilise pas HTTPS.');if(u.hostname.includes('xn--'))issues.push('Le domaine contient des caractères internationalisés : vérifiez attentivement son orthographe.');}
 return issues;
}
function check(){
 const offer=getOffer(),email=clean($('recruiterEmail')?.value);
 const description=clean(document.querySelector('.studio-job.selected .studio-job p')?.textContent);
 const issues=problems(offer,email,description);
 const box=$('v2FraudFindings');box.replaceChildren();
 const status=document.createElement('p');status.className='v2-fraud-summary';
 status.textContent=issues.length?issues.length+' point(s) à vérifier avant candidature.':'Aucun signal prédéfini détecté. Cela ne prouve pas que l’offre soit authentique.';
 box.appendChild(status);
 if(issues.length){const list=document.createElement('ul');for(const item of issues){const li=document.createElement('li');li.textContent=item;list.appendChild(li)}box.appendChild(list);}
}
async function save(){
 const offer=getOffer(),letter=clean($('letterText')?.value),to=clean($('recruiterEmail')?.value);
 if(!offer.title||!offer.company||!safeUrl(offer.url)){notify('Choisissez une offre réelle et vérifiez son titre, son entreprise et son URL.',true);return;}
 if(!session()?.access_token){notify('Connectez votre compte dans le cockpit pour activer la sauvegarde chiffrée.',true);return;}
 if(!confirm('Enregistrer ce brouillon et cette lettre dans votre compte chiffré ?'))return;
 const button=$('v2DossierSave');button.disabled=true;notify('Enregistrement du dossier…');
 try{
  const result=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session().access_token},body:JSON.stringify({action:'draft',consent:true,job:offer,letter,to})});
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw new Error(data.error||'Enregistrement indisponible ('+result.status+')');
  notify('Brouillon sauvegardé. Utilisez « Rafraîchir » dans votre cockpit pour le retrouver.');
 }catch(err){notify('Échec : '+err.message,true)}finally{button.disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('v2DossierSave')?.addEventListener('click',save);
 $('v2FraudCheck')?.addEventListener('click',check);
 $('jobResults')?.addEventListener('click',e=>{
  if(e.target.closest('.job-match button')||e.target.closest('.studio-job')){
   const link=e.target.closest('.studio-job')?.querySelector('.job-open-link');
   if(link)$('v2DossierUrl').value=link.href;
  }
 });
 const observer=new MutationObserver(()=>{
  const link=selectedUrl();
  if(link&&$('v2DossierUrl').value!==link)$('v2DossierUrl').value=link;
 });
 const chosen=$('chosenJob');if(chosen)observer.observe(chosen,{childList:true,subtree:true});
});
})();