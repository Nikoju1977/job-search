/* Niko Emploi · Studio candidature et agent de suivi Gmail */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={file:null,jobs:[],selected:null,queue:[],history:[],replies:[],handled:new Set(),token:'',userEmail:'',config:{},timer:null,busy:false};
const PKEY='niko_profile_v2',HKEY='niko_history_v2',RKEY='niko_replies_handled_v2';
const skills=['excel','word','powerpoint','gestion de projet','management','relation client','accueil','vente','comptabilité','facturation','recrutement','logistique','maintenance','qualité','production','métrologie','industrie','mécanique','électronique','python','javascript','react','sql','data','design','figma','marketing','anglais','formation','soins','sécurité','communication','organisation','autonomie','crm','sap','permis b'];
const stop=new Set('avec pour dans sans bien vous nous chez sont avoir votre notre toutes tous cette poste emploi entreprise elle etre faire also from with and this that they'.split(' '));
const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const words=v=>[...new Set(norm(v).split(/\s+/).filter(w=>w.length>3&&!stop.has(w)))];
const detected=v=>skills.filter(s=>(' '+norm(v)+' ').includes(' '+norm(s)+' '));
const eligibleMention=j=>/\b(rqth|boeth|handicap|handi accueille|handi engage|handi recrute|amenagement de poste|poste amenage|inclusion handicap)\b/.test(norm([j.title,j.excerpt].join(' ')));
const urlOf=s=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.toString():'';}catch{return ''}};
const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||'')&&!/[\r\n]/.test(s||'');
const prof=()=>({fullName:$('fullName').value.trim(),email:$('email').value.trim(),targetRole:$('targetRole').value.trim(),targetLocation:$('targetLocation').value.trim(),cvText:$('cvText').value.trim()});
function el(t,cl,tx){const x=document.createElement(t);if(cl)x.className=cl;if(tx!==undefined)x.textContent=tx;return x;}
function show(msg,error=false){$('notice').hidden=false;$('notice').textContent=msg;$('notice').classList.toggle('error',error);}
function busy(id,on,txt){const b=$(id);if(!b.dataset.original)b.dataset.original=b.textContent;b.disabled=on;b.textContent=on?txt:b.dataset.original;}
function saveProfile(){if($('remember').checked){try{localStorage.setItem(PKEY,JSON.stringify(prof()))}catch{show('Espace local insuffisant pour conserver le profil.',true)}}else localStorage.removeItem(PKEY);}
function persistHistory(){try{localStorage.setItem(HKEY,JSON.stringify(state.history.slice(0,100)))}catch{}}
function history(job,status,extra={}){state.history.unshift({title:job.title,company:job.company,url:job.url||'',status,date:new Date().toISOString(),...extra});persistHistory();renderHistory();}
function renderHistory(){const area=$('history');area.replaceChildren();if(!state.history.length){area.append(el('div','studio-empty','Aucune candidature enregistrée.'));return;}for(const h of state.history.slice(0,70)){const row=el('div','history-entry'),left=el('div');left.append(el('strong','',h.title+' · '+h.company),el('small','',new Date(h.date).toLocaleString('fr-FR')));row.append(left,el('span','history-tag'+(h.status==='Envoyée'?' sent':''),h.status));area.append(row);}}
async function requireLibrary(src){return new Promise((resolve,reject)=>{if(document.querySelector('script[src="'+src+'"]'))return resolve();let s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Librairie externe inaccessible'));document.head.append(s);});}
async function pdfText(f){
 const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;let t='';
 for(let i=1;i<=Math.min(40,pdf.numPages);i++){const items=(await(await pdf.getPage(i)).getTextContent()).items;t+='\n'+items.map(x=>x.str||'').join(' ');if(t.length>26000)break;}
 return t;
}
async function loadCV(f){if(!f)return;if(f.size>8*1024*1024||!/\.(pdf|docx|txt)$/i.test(f.name)){show('Format accepté : PDF, DOCX, TXT, 8 Mo maximum.',true);return;}
 $('cvSummary').textContent='Lecture en cours…';
 try{let text;if(/\.pdf$/i.test(f.name))text=await pdfText(f);else if(/\.docx$/i.test(f.name)){await requireLibrary('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.9.0/mammoth.browser.min.js');text=(await window.mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()})).value;}else text=await f.text();
 if((text||'').trim().length<25)throw new Error('Ce CV semble être une image scannée. Utilisez un PDF avec OCR ou collez son texte.');
 state.file=f;$('cvText').value=text.trim().slice(0,25000);$('cvFileName').hidden=false;$('cvFileName').textContent=f.name+' · '+Math.ceil(f.size/1024)+' Ko';
 const match=text.match(/[\w.+-]+@[\w.-]+\.[A-Z]{2,}/i);if(match&&!$('email').value)$('email').value=match[0];
 const skillsFound=detected(text);$('cvSummary').textContent=skillsFound.length+' compétences reconnues. Vérifiez le texte ci-dessous.';saveProfile();show('CV importé avec succès. Vérifiez les informations extraites.');
 }catch(e){$('cvSummary').textContent='Impossible de lire ce CV.';show('Import du CV : '+e.message,true);}
}
function match(j){const p=prof(),cv=norm(p.cvText),title=norm(j.title),ad=norm(j.title+' '+(j.excerpt||'')),want=words(p.targetRole),cvSkills=detected(cv),adSkills=detected(ad),shared=adSkills.filter(s=>cvSkills.includes(s)),common=words(cv).slice(0,40).filter(w=>ad.includes(w));
 if(!want.length&&cv.length<35)return null;
 return {score:Math.min(100,(want.length?Math.round(55*want.filter(w=>title.includes(w)).length/want.length):0)+(adSkills.length?Math.round(30*shared.length/adSkills.length):0)+(cv.length?Math.round(15*common.length/Math.max(8,Math.min(30,words(cv).length))):0)),shared,missing:adSkills.filter(s=>!cvSkills.includes(s))};}
function selectJob(j){state.selected=j;$('letterCompany').value=j.company||'';$('letterPosition').value=j.title||'';$('recruiterEmail').value=state.queue.find(x=>x.url===j.url)?.recruiterEmail||'';$('chosenJob').replaceChildren(el('strong','',j.title+' — '+j.company),el('p','',j.location+' · '+j.source));$('letterText').value=state.queue.find(x=>x.url===j.url)?.letter||'';renderJobs();document.getElementById('lettre').scrollIntoView({behavior:'smooth'});}
function toggleQueue(j){const i=state.queue.findIndex(x=>x.url===j.url);if(i>=0)state.queue.splice(i,1);else if(state.queue.length<20)state.queue.push({...j,recruiterEmail:'',letter:''});else return show('20 annonces maximum par sélection.',true);renderJobs();renderQueue();}
function renderJobs(){const b=$('jobResults');b.replaceChildren();let rows=state.jobs.map(job=>({job,fit:match(job)}));if($('rqthOnly').checked)rows=rows.filter(({job})=>eligibleMention(job));if($('relevantOnly').checked)rows.sort((a,b)=>(b.fit?.score||0)-(a.fit?.score||0));$('jobsCount').textContent=rows.length+' offre'+(rows.length>1?'s':'')+' affichée'+(rows.length>1?'s':'');
 if(!rows.length){b.append(el('div','studio-empty',state.jobs.length?'Aucune annonce consultée ne mentionne explicitement ces critères : les offres générales restent accessibles.':'Aucune annonce reçue pour cette recherche. Élargissez vos critères.'));return;}
 for(const {job:j,fit} of rows.slice(0,60)){const a=el('article','studio-job'+(state.selected?.url===j.url?' selected':'')),body=el('div');body.append(el('h3','',j.title),el('small','',j.company+' · '+j.location));const meta=el('div','job-source-line');meta.append(el('span','',j.source),el('span','',j.contract||'Contrat non précisé'));if(eligibleMention(j))meta.append(el('span','rqth-signal','Mention inclusion / RQTH'));body.append(meta,el('p','',j.excerpt||'Consulter la fiche détaillée chez le fournisseur.'));
 if(fit?.shared.length)body.append(el('small','matched-terms','Compétences communes : '+fit.shared.join(' · ')));
 if(fit?.missing.length)body.append(el('small','missed-terms','Compétences à vérifier : '+fit.missing.slice(0,5).join(' · ')));
 const actions=el('div','job-match');actions.append(el('b','',fit?fit.score+' % indicatif':'Profil à compléter'));
 const pick=el('button','','Préparer →');pick.type='button';pick.onclick=()=>selectJob(j);
 const basket=el('button','queue-add',state.queue.some(x=>x.url===j.url)?'✓ Sélectionnée':'+ Sélection');basket.type='button';basket.onclick=()=>toggleQueue(j);actions.append(pick,basket);
 if(urlOf(j.url)){const link=el('a','job-open-link','Annonce source ↗');link.href=urlOf(j.url);link.target='_blank';link.rel='noopener noreferrer nofollow';actions.append(link);}
 a.append(body,actions);b.append(a);}
 if(rows.length>60)b.append(el('div','studio-empty','Affichage limité à 60 offres. Affinez la recherche.'));
}
async function loadJobs(evt){evt?.preventDefault();const p=prof(),params=new URLSearchParams({q:$('jobKeyword').value.trim()||p.targetRole,location:$('jobLocation').value.trim()||p.targetLocation||'Toute la France'});busy('findJobsBtn',true,'Recherche…');$('jobResults').replaceChildren(el('div','studio-empty','Recherche des offres réelles en cours…'));
 try{const r=await fetch('/api/jobs?'+params,{signal:AbortSignal.timeout(32000)});if(!r.ok)throw Error('Service indisponible ('+r.status+')');const data=await r.json();if(!Array.isArray(data.jobs))throw Error('Réponse du service invalide');state.jobs=data.jobs.filter(j=>j&&urlOf(j.url));renderJobs();if(data.partial)show('Certaines sources sont momentanément inaccessibles, les résultats sont partiels.');document.getElementById('offres-studio').scrollIntoView({behavior:'smooth'});}catch(e){state.jobs=[];renderJobs();show('Erreur de recherche : '+e.message,true)}finally{busy('findJobsBtn',false);}
}
function renderQueue(){const area=$('queue');area.replaceChildren();if(!state.queue.length){area.append(el('div','studio-empty','Ajoutez des offres depuis les résultats.'));return;}
 for(const job of state.queue){const row=el('div','queue-entry'),desc=el('div','queue-title');desc.append(el('strong','',job.title+' · '+job.company),el('small','',job.letter?'Lettre préparée':'Lettre non préparée'));
 const field=el('input');field.type='email';field.placeholder='E-mail du recruteur';field.setAttribute('aria-label','Recruteur : '+job.company);field.value=job.recruiterEmail||'';field.oninput=()=>job.recruiterEmail=field.value.trim();
 const buttons=el('div','queue-row-actions'),open=el('button','button-secondary','Voir');open.type='button';open.onclick=()=>selectJob(job);
 const rem=el('button','text-action','Retirer');rem.type='button';rem.onclick=()=>toggleQueue(job);
 buttons.append(open,rem);row.append(desc,field,buttons);area.append(row);}
}
function fallbackLetter(job,p=prof()){
 const company=job.company||'[Entreprise]',title=job.title||'[Poste]',matched=detected(p.cvText).filter(x=>detected(job.excerpt||'').includes(x));
 const picked=(matched.length?matched:detected(p.cvText)).slice(0,3);
 const evidence=picked.length?'Mon CV fait apparaître des compétences en '+picked.join(', ')+'. Je serais heureux(se) de vous présenter leur lien avec ce poste.':'Je souhaiterais vous présenter plus précisément mon parcours et ses liens avec les missions envisagées.';
 const rqth=$('discloseRqth').checked?'\n\nJe bénéficie d’une reconnaissance de la qualité de travailleur handicapé (RQTH) et reste disponible, si nécessaire, pour échanger sur les modalités de travail adaptées au poste.':'';
 return [(p.fullName||'[Votre nom]'),'','Objet : Candidature au poste de '+title,'','Madame, Monsieur,','','Votre offre pour le poste de '+title+' chez '+company+' a retenu mon attention. Je vous propose ma candidature.','',evidence,'','Je souhaiterais pouvoir échanger avec vous sur vos attentes et sur la manière dont je pourrais contribuer à votre équipe.'+rqth,'','Je vous remercie du temps consacré à l’étude de ma candidature et reste à votre disposition pour un entretien.','','Veuillez agréer, Madame, Monsieur, mes salutations distinguées.','',p.fullName||'[Votre nom]'].join('\n');
}
async function generate(job=state.selected,quiet=false){const p=prof();job=job||{title:$('letterPosition').value.trim(),company:$('letterCompany').value.trim(),excerpt:''};if(p.cvText.length<35||!job.title||!job.company){if(!quiet)show('Complétez le texte du CV, le poste et l’entreprise.',true);return null;}
 let letter=fallbackLetter(job,p),mode='local';
 if($('aiConsent').checked && state.config.aiConfigured){try{
 const r=await fetch('/api/letter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:p,job,aiConsent:true,discloseRqth:$('discloseRqth').checked}),signal:AbortSignal.timeout(23000)});
 const data=await r.json();if(!r.ok||!data.letter)throw Error(data.error||'Service IA indisponible');letter=data.letter;mode='IA';
 }catch(e){if(!quiet)show('IA indisponible : une proposition locale a été produite. '+e.message);}}
 if(!quiet){$('letterText').value=letter;$('generationMode').textContent='Lettre générée en mode '+mode+'. Vérifiez les éléments avant envoi.';history(job,'Préparée');}
 const saved=state.queue.find(x=>x.url===job.url);if(saved)saved.letter=letter;
 renderQueue();return letter;
}
async function gmailAuth(){
 if(!state.config.googleClientId)throw Error('Connexion Gmail non configurée : ajouter GOOGLE_CLIENT_ID sur Vercel et autoriser ce domaine dans Google Cloud.');
 if(state.token)return state.token;
 await requireLibrary('https://accounts.google.com/gsi/client');
 return new Promise((resolve,reject)=>{
 let finished=false;const timeout=setTimeout(()=>{if(!finished){finished=true;reject(Error('Autorisation Google expirée.'))}},60000);
 const client=google.accounts.oauth2.initTokenClient({client_id:state.config.googleClientId,scope:'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',callback:async token=>{
 if(finished)return;finished=true;clearTimeout(timeout);
 if(token.error)return reject(Error('Google : '+token.error));state.token=token.access_token;try{const me=await gmail('/profile');state.userEmail=me.emailAddress||'';}catch{};resolve(state.token);
 }});
 client.requestAccessToken({prompt:'consent'});
 });
}
async function gmail(path,opt={}){
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me'+path,{...opt,headers:{'Authorization':'Bearer '+state.token,'Content-Type':'application/json',...(opt.headers||{})}});
 if(!r.ok){if(r.status===401)state.token='';throw Error('Gmail : erreur '+r.status+(r.status===403?' — vérifiez les autorisations OAuth.':''));}
 return r.json();
}
function toB64(bytes){let s='';const stride=16384;for(let i=0;i<bytes.length;i+=stride)s+=String.fromCharCode(...bytes.subarray(i,i+stride));return btoa(s);}
function textB64(s){return toB64(new TextEncoder().encode(s));}
function foldedB64(b64){const chunks=[];for(let i=0;i<b64.length;i+=76)chunks.push(b64.slice(i,i+76));return chunks.join('\r\n');}
function urlB64(s){return textB64(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function mimeName(name){return "=?UTF-8?B?"+textB64(name)+"?=";}
function safeAddr(addr){if(!validEmail(addr))throw Error('Adresse e-mail invalide.');return addr.trim();}
function buildEmail(to,subject,body,file,thread={}){
 to=safeAddr(to);const boundary='niko_'+crypto.randomUUID().replace(/-/g,'');
 const hdr=['To: '+to,'Subject: '+mimeName(subject),'MIME-Version: 1.0'];
 if(thread.messageId)hdr.push('In-Reply-To: '+thread.messageId,'References: '+thread.messageId);
 if(file){
  const name=file.name.replace(/[\r\n"\\]/g,'_').slice(0,100);
  return file.arrayBuffer().then(buf=>{
   const raw=[...hdr,'Content-Type: multipart/mixed; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',foldedB64(textB64(body)),'--'+boundary,'Content-Type: application/octet-stream; name="'+name+'"','Content-Disposition: attachment; filename="'+name+'"','Content-Transfer-Encoding: base64','',foldedB64(toB64(new Uint8Array(buf))),'--'+boundary+'--'].join('\r\n');
   return toB64(new TextEncoder().encode(raw)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  });
 }
 const raw=[...hdr,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',foldedB64(textB64(body))].join('\r\n');
 return Promise.resolve(toB64(new TextEncoder().encode(raw)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
}
async function gmailSend(to,subject,body,file=null,thread={}){
 const raw=await buildEmail(to,subject,body,file,thread);
 const result=await gmail('/messages/send',{method:'POST',body:JSON.stringify({raw,...(thread.threadId?{threadId:thread.threadId}:{})})});
 if(!result.id)throw Error('Gmail n’a pas confirmé l’envoi.');return result;
}
async function syncConfirmedSend(job,to,letter,sent){
 if(!$('v2SyncSent')?.checked||!job?.url||!state.token)return;
 let session;try{session=JSON.parse(sessionStorage.getItem('niko_secure_session_v2')||'null')}catch{return}
 if(!session?.access_token)return;
 try{
  const response=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'sent',consent:true,job,to,letter,threadId:sent.threadId,messageId:sent.id,gmailAccessToken:state.token})});
  if(response.ok)return;
  const data=await response.json().catch(()=>({}));
  if(response.status!==409)show('E-mail envoyé. Synchronisation du suivi impossible : '+(data.error||response.status),true);
 }catch{show('E-mail envoyé, mais la synchronisation du suivi a échoué.',true);}
}
async function sendCurrent(){
 if(!$('sendConsent').checked)return show('Cochez votre autorisation d’envoi après avoir relu la candidature.',true);
 const p=prof(),job=state.selected||{title:$('letterPosition').value.trim(),company:$('letterCompany').value.trim()};
 const text=$('letterText').value.trim(),to=$('recruiterEmail').value.trim();
 if(!state.file)return show('Réimportez votre fichier CV pour le joindre à la candidature.',true);
 if(!validEmail(to)||!validEmail(p.email)||!text||!job.title)return show('Vérifiez le destinataire, votre adresse, le poste et la lettre.',true);
 busy('sendBtn',true,'Envoi en cours…');
 try{await gmailAuth();const sent=await gmailSend(to,'Candidature — '+job.title+' — '+(p.fullName||'Candidat'),text,state.file);
 history(job,'Envoyée',{threadId:sent.threadId,to,messageId:sent.id});void syncConfirmedSend(job,to,text,sent);show('Candidature envoyée par Gmail. ID de suivi : '+sent.id);$('sendConsent').checked=false;
 }catch(e){show('Envoi non confirmé : '+e.message,true)}finally{busy('sendBtn',false);}
}
async function sendBatch(){
 if(!$('batchConsent').checked)return show('Vous devez autoriser explicitement les envois du lot.',true);
 const jobs=state.queue.slice(0,5),p=prof();if(!jobs.length||!state.file||!validEmail(p.email))return show('Ajoutez des offres, importez le CV et vérifiez votre adresse e-mail.',true);
 if(jobs.some(j=>!validEmail(j.recruiterEmail)))return show('Chaque offre du lot doit avoir une adresse de recruteur valide.',true);
 if(jobs.some(j=>!j.letter))return show('Préparez toutes les lettres avant d’envoyer.',true);
 if(!confirm('Envoyer '+jobs.length+' candidatures avec CV joint, aux adresses indiquées ?'))return;
 busy('sendBatch',true,'Envoi…');
 try{await gmailAuth();let done=0;for(const job of jobs){
 try{const sent=await gmailSend(job.recruiterEmail,'Candidature — '+job.title+' — '+(p.fullName||'Candidat'),job.letter,state.file);history(job,'Envoyée',{threadId:sent.threadId,to:job.recruiterEmail,messageId:sent.id});void syncConfirmedSend(job,job.recruiterEmail,job.letter,sent);state.queue=state.queue.filter(j=>j.url!==job.url);done++;
 }catch(err){show(done+' envoyée(s). Échec sur '+job.company+' : '+err.message,true);break;}
 }renderQueue();show(done+' candidature(s) confirmée(s) comme envoyée(s) sur '+jobs.length+'.');$('batchConsent').checked=false;
 }catch(e){show('Envoi du lot interrompu : '+e.message,true)}finally{busy('sendBatch',false);}
}
function subjectReply(s){return /^re\s*:/i.test(s)?s:'Re: '+s;}
function classification(body){
 const s=norm(body.slice(0,1800));
 if(/\b(entretien|rendez vous|rdv|visioconference|visio|disponibilite|creneau|telephone|rencontrer|echange telephonique|invitation)\b/.test(s))return 'entretien';
 if(/\b(malheureusement|candidature non retenue|ne pas donner suite|ne pouvons donner suite|refus|pas retenu|ne sera pas retenue|not selected|not moving forward)\b/.test(s))return 'defavorable';
 if(/\b(retenu votre candidature|candidature retenue|suite favorable|interesse par votre profil|interesses par votre profil|votre profil nous interesse|favorable a votre candidature)\b/.test(s))return 'favorable';
 return 'incertain';
}
function replyText(type, name=''){
 const signature='\n\nBien cordialement,\n'+(name||'[Votre nom]');
 if(type==='defavorable')return 'Bonjour,\n\nJe vous remercie d’avoir étudié ma candidature et de m’avoir informé de votre décision. Je vous souhaite une excellente continuation.'+signature;
 if(type==='favorable')return 'Bonjour,\n\nMerci pour votre retour favorable et l’intérêt porté à ma candidature. Je suis heureux(se) de poursuivre nos échanges et reste à votre disposition pour les prochaines étapes.'+signature;
 if(type==='entretien')return 'Bonjour,\n\nJe vous remercie pour votre proposition d’entretien. Je suis intéressé(e) et souhaiterais convenir avec vous d’un créneau adapté. Pourriez-vous me préciser les modalités et les horaires possibles ?'+signature;
 return 'Bonjour,\n\nJe vous remercie pour votre retour. Je reste à votre disposition pour toute information complémentaire.'+signature;
}
function header(msg,name){return msg.payload?.headers?.find(x=>x.name.toLowerCase()===name.toLowerCase())?.value||'';}
function decode64(s){try{const str=atob(s.replace(/-/g,'+').replace(/_/g,'/'));return new TextDecoder().decode(Uint8Array.from(str,c=>c.charCodeAt(0)));}catch{return '';}}
function bodyOf(msg){
 const stack=[msg.payload],texts=[];
 while(stack.length){const p=stack.pop();if(!p)continue;if(p.mimeType==='text/plain'&&p.body?.data)texts.push(decode64(p.body.data));if(Array.isArray(p.parts))stack.push(...p.parts);}
 const t=(texts.join('\n')||msg.snippet||'').slice(0,4000);
 return t.split(/\n(?:Le .* a écrit\s*:|On .* wrote\s*:|De\s*:|From\s*:|>)/i)[0].slice(0,1700);
}
const isRobot=(from,headers)=>/no.?reply|do.?not.?reply|mailer-daemon|postmaster|newsletter|noreply|notification/i.test(from)||/auto-replied|auto-generated/i.test(headers);
function renderReplies(){const target=$('replies');if(!target)return;target.replaceChildren();if(!state.replies.length){target.append(el('div','studio-empty','Aucune nouvelle réponse reliée à vos candidatures envoyées.'));return;}
 for(const item of state.replies){
 const card=el('article','agent-reply'),head=el('div','agent-reply-head');
 head.append(el('strong','',item.company+' · '+item.title),el('span','agent-badge '+item.kind,item.kind==='entretien'?'Entretien proposé':item.kind==='favorable'?'Réponse favorable':item.kind==='defavorable'?'Réponse défavorable':'À examiner'));card.append(head,el('small','',item.from+' · '+new Date(item.date).toLocaleString('fr-FR')));
 const quote=el('p','agent-message',item.body||'Message sans texte extrait.');card.append(quote);if(item.summary)card.append(el('p','agent-summary','Analyse IA : '+item.summary));
 const label=el('label','agent-label','Réponse proposée (modifiable)');const area=el('textarea','agent-text');area.rows=5;area.value=item.draft;area.setAttribute('aria-label','Réponse au recruteur');area.oninput=()=>item.draft=area.value;card.append(label,area);
 const controls=el('div','agent-actions');
 const send=el('button','button-primary','Valider et répondre');send.type='button';send.onclick=()=>sendReply(item);
 const skip=el('button','button-secondary','Classer sans répondre');skip.type='button';skip.onclick=()=>{state.handled.add(item.id);persistHandled();state.replies=state.replies.filter(x=>x.id!==item.id);renderReplies();};
 controls.append(send,skip);card.append(controls);target.append(card);
 }
}
function persistHandled(){try{localStorage.setItem(RKEY,JSON.stringify([...state.handled].slice(-500)))}catch{}}
async function checkReplies(fromTimer=false){
 if(state.busy)return;if(!state.history.some(h=>h.status==='Envoyée'&&h.threadId)){if(!fromTimer)show('Envoyez une candidature avec Gmail pour pouvoir suivre son fil de discussion.',true);return;}
 state.busy=true;if(!fromTimer)busy('checkReplies',true,'Analyse des réponses…');
 try{await gmailAuth();let found=0;
 const followed=[...new Map(state.history.filter(h=>h.status==='Envoyée'&&h.threadId).map(h=>[h.threadId,h])).values()].slice(0,30);
 for(const h of followed){
  const thread=await gmail('/threads/'+encodeURIComponent(h.threadId)+'?format=full');
  for(const msg of thread.messages||[]){
   if(state.handled.has(msg.id)||state.replies.some(x=>x.id===msg.id)||msg.labelIds?.includes('SENT'))continue;
   const from=header(msg,'From'), subject=header(msg,'Subject'),headers=(header(msg,'Auto-Submitted')+' '+header(msg,'Precedence'));
   if((state.userEmail&&from.toLowerCase().includes(state.userEmail.toLowerCase()))||isRobot(from,headers))continue;
   if(Number(msg.internalDate)<Date.parse(h.date))continue;
   const body=bodyOf(msg),kind=classification(body);const entry={id:msg.id,threadId:msg.threadId,from,subject,messageId:header(msg,'Message-ID'),company:h.company,title:h.title,body,kind,date:Number(msg.internalDate),draft:replyText(kind,prof().fullName)};
   if($('aiReplyConsent')?.checked && state.config.aiConfigured && body.length>15){
    try{const result=await fetch('/api/reply-agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:{body,subject,from},job:{company:h.company,title:h.title},profile:{fullName:prof().fullName},aiConsent:true}),signal:AbortSignal.timeout(20000)});
      if(result.ok){const analysis=await result.json();if(analysis.category && typeof analysis.draft==='string'){entry.kind=analysis.category;entry.draft=analysis.draft;entry.summary=analysis.summary;}}
    }catch{/* Le tri local reste utilisable même sans IA. */}
   }
   state.replies.push(entry);found++;
   if($('autoAcknowledgements')?.checked && kind===entry.kind && ['favorable','defavorable'].includes(kind) && body.length>25 && body.length<1500 && validEmail(parseAddr(from)) && !/(contrat|salaire|date de debut|confirme|proposition|signature|urgent|avant le)/i.test(body)){
    // Jamais de génération IA envoyée sans relecture; automatisme limité à un texte constant.
    try{await gmailSend(parseAddr(from),subjectReply(subject),replyText(kind,prof().fullName),null,{threadId:entry.threadId,messageId:entry.messageId});
      state.handled.add(entry.id);persistHandled();state.replies=state.replies.filter(x=>x.id!==entry.id);history(h,'Réponse automatique envoyée');
    }catch{/* Garder la réponse à relire si l’automatisme échoue. */}
   }
  }
 }
 renderReplies();$('agentStatus').textContent=found?found+' nouvelle(s) réponse(s) trouvée(s).':'Aucune nouvelle réponse détectée.';
 if(!fromTimer)show(found+' nouvelle(s) réponse(s) analysée(s).');
 }catch(e){$('agentStatus').textContent='Échec de vérification : '+e.message;if(!fromTimer)show('Gmail : '+e.message,true)}
 finally{state.busy=false;if(!fromTimer)busy('checkReplies',false);}
}
function parseAddr(from){const m=String(from).match(/<([^>]+)>/);return (m?m[1]:from).trim();}
async function sendReply(item){const to=parseAddr(item.from);if(!validEmail(to)||!item.draft.trim())return show('Adresse du recruteur ou réponse invalide.',true);
 if(!confirm('Envoyer votre réponse à '+to+' ?'))return;
 try{await gmailAuth();await gmailSend(to,subjectReply(item.subject),item.draft,null,{threadId:item.threadId,messageId:item.messageId});
 state.handled.add(item.id);persistHandled();state.replies=state.replies.filter(x=>x.id!==item.id);renderReplies();history({title:item.title,company:item.company},'Réponse envoyée');show('Réponse envoyée au recruteur.');
 }catch(e){show('Réponse non confirmée : '+e.message,true);}
}
function autoLoop(){if(state.timer){clearInterval(state.timer);state.timer=null;}if($('autoAcknowledgements')?.checked){state.timer=setInterval(()=>{if(document.visibilityState==='visible')checkReplies(true);},5*60*1000);}}
async function init(){
 try{const resp=await fetch('/api/config',{cache:'no-store'});if(resp.ok)state.config=await resp.json();}catch{}
 $('generationMode').textContent=state.config.aiConfigured?'L’IA est disponible avec votre consentement.':'Mode local disponible · Connexion IA non configurée.';
 $('gmailStatus').textContent=state.config.gmailConfigured?'Gmail disponible après autorisation Google.':'Gmail nécessite une configuration OAuth par l’administrateur.';
 try{const data=JSON.parse(localStorage.getItem(PKEY)||'null');if(data){for(const id of ['fullName','email','targetRole','targetLocation','cvText'])if(typeof data[id]==='string')$(id).value=data[id];$('remember').checked=true;$('cvSummary').textContent='Profil restauré. Réimportez le CV pour l’envoyer en pièce jointe.';}}
 catch{}
 try{state.history=JSON.parse(localStorage.getItem(HKEY)||'[]');if(!Array.isArray(state.history))state.history=[];}catch{state.history=[];}
 try{state.handled=new Set(JSON.parse(localStorage.getItem(RKEY)||'[]'));}catch{}
 renderHistory();renderQueue();renderReplies();
 try{const incoming=JSON.parse(sessionStorage.getItem('niko_selected_job')||'null');sessionStorage.removeItem('niko_selected_job');if(incoming && incoming.title && incoming.company && urlOf(incoming.url))selectJob(incoming);}catch{}
 $('cvFile').onchange=e=>loadCV(e.target.files?.[0]);
 const drop=$('dropZone');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag-over')};drop.ondragleave=()=>drop.classList.remove('drag-over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');loadCV(e.dataTransfer.files?.[0]);};
 drop.onkeydown=e=>{if(e.target===drop && (e.key==='Enter'||e.key===' ')){e.preventDefault();$('cvFile').click();}};
 for(const id of ['fullName','email','targetRole','targetLocation','cvText'])$(id).addEventListener('input',saveProfile);
 $('remember').onchange=saveProfile;
 $('clearProfile').onclick=()=>{if(!confirm('Supprimer le CV et vos informations enregistrées dans ce navigateur ?'))return;state.file=null;for(const id of ['fullName','email','targetRole','cvText'])$(id).value='';$('targetLocation').value='Toute la France';$('cvFile').value='';$('cvFileName').hidden=true;localStorage.removeItem(PKEY);$('remember').checked=false;show('Profil local effacé.');};
 $('findJobsBtn').onclick=()=>{$('jobKeyword').value=$('targetRole').value;$('jobLocation').value=$('targetLocation').value;loadJobs();};
 $('jobSearch').onsubmit=loadJobs;
 $('rqthOnly').onchange=renderJobs;$('relevantOnly').onchange=renderJobs;
 $('generateBtn').onclick=async()=>{busy('generateBtn',true,'Rédaction…');try{await generate();}finally{busy('generateBtn',false)}};
 $('copyLetter').onclick=async()=>{try{await navigator.clipboard.writeText($('letterText').value);show('Lettre copiée.')}catch{show('Copie indisponible sur ce navigateur.',true)}};
 $('downloadLetter').onclick=()=>{const text=$('letterText').value.trim();if(!text)return show('Générez d’abord une lettre.',true);const obj=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=obj;a.download='lettre-de-motivation-niko.txt';a.click();setTimeout(()=>URL.revokeObjectURL(obj),1000);};
 $('openJob').onclick=()=>{const url=urlOf(state.selected?.url);if(url)window.open(url,'_blank','noopener');else show('Sélectionnez d’abord une offre.',true);};
 $('sendBtn').onclick=sendCurrent;
 $('emailFallback').onclick=()=>{const to=$('recruiterEmail').value.trim();if(!validEmail(to))return show('Renseignez une adresse de recruteur valide.',true);const url='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent('Candidature — '+$('letterPosition').value)+'&body='+encodeURIComponent($('letterText').value);window.location.href=url;show('Votre logiciel de messagerie doit s’ouvrir. Ajoutez manuellement votre CV en pièce jointe.');};
 $('prepareBatch').onclick=async()=>{if(!state.queue.length)return show('Ajoutez d’abord des annonces.',true);busy('prepareBatch',true,'Préparation…');try{for(const job of state.queue)if(!job.letter)await generate(job,true);renderQueue();show('Lettres préparées : ouvrez chaque annonce pour les vérifier avant envoi.');}finally{busy('prepareBatch',false)}};
 $('sendBatch').onclick=sendBatch;
 $('clearHistory').onclick=()=>{if(confirm('Effacer l’historique local des candidatures ?')){state.history=[];persistHistory();renderHistory();}};
 $('checkReplies').onclick=()=>checkReplies(false);
 $('autoAcknowledgements').onchange=()=>{if($('autoAcknowledgements').checked&&!confirm('Activer les accusés de réception automatiques pour les réponses favorables ou défavorables clairement identifiées ? Ce mode fonctionne uniquement lorsque cette page reste ouverte.')){$('autoAcknowledgements').checked=false;}autoLoop();};
 $('stopAgent').onclick=()=>{$('autoAcknowledgements').checked=false;autoLoop();show('Envoi automatique désactivé.');};
 $('agentStatus').textContent='Prêt à examiner les réponses aux candidatures envoyées via Niko Emploi.';
}
init();
})();