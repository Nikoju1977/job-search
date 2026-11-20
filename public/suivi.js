/* Niko Emploi v6 — suivi des candidatures, offline local + synchronisation volontaire. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const KEY='niko_tracker_local_v6',HISTORY_KEY='niko_history_v2',INBOX_KEY='niko_tracker_inbox_v1';
const STAGES=[
 {id:'draft',label:'À préparer',statuses:['draft']},
 {id:'sent',label:'Envoyées',statuses:['sent']},
 {id:'reply',label:'Réponses',statuses:['reply']},
 {id:'interview',label:'Entretiens',statuses:['interview']},
 {id:'offer',label:'Propositions',statuses:['offer']},
 {id:'closed',label:'Clôturées',statuses:['hired','rejected','withdrawn','failed']}
];
const LABELS={draft:'À préparer',sent:'Envoyée',reply:'Réponse reçue',interview:'Entretien',offer:'Proposition',hired:'Embauche',rejected:'Non retenue',withdrawn:'Retirée',failed:'Échec technique'};
const ACTIVE=new Set(['draft','sent','reply','interview','offer']);
const state={local:[],localEvents:[],cloud:[],cloudEvents:[],items:[],events:[],cloudReady:false,selected:null,busy:false,inbox:[],settings:{emailReminders:false}};
const norm=x=>String(x||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const dateOf=x=>{const t=Date.parse(x||'');return Number.isFinite(t)?t:0;};
const safeURL=x=>{try{const u=new URL(x);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.toString():null}catch{return null}};
const uid=()=>((globalThis.crypto&&typeof crypto.randomUUID==='function')?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2));
const fmt=x=>x&&dateOf(x)?new Date(x).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'Non définie';
const datetime=x=>x&&dateOf(x)?new Date(x).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'Non définie';
function localInput(x){
 if(!x||!dateOf(x))return '';
 const d=new Date(x),pad=n=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}
function fromInput(x){const d=x?new Date(x):null;return d&&Number.isFinite(d.getTime())?d.toISOString():null;}
function elt(tag,cl,text){const e=document.createElement(tag);if(cl)e.className=cl;if(text!==undefined)e.textContent=String(text);return e;}
function notice(message,error=false){$('trackerError').hidden=!error;$('trackerError').textContent=error?message:'';$('resultStatus').textContent=message;}
function status(message){$('saveCaseStatus').textContent=message;}
function keyOf(item){
 return item.url?'url:'+norm(item.url):'title:'+norm(item.title)+'|'+norm(item.company)+'|'+norm(item.location);
}
function readLocal(){
 try{const data=JSON.parse(localStorage.getItem(KEY)||'null');if(data&&Array.isArray(data.records)){
  state.local=data.records.slice(0,300).filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.company==='string');
  state.localEvents=Array.isArray(data.events)?data.events.slice(-1500):[];
 }}catch{notice('Les dossiers locaux enregistrés sont illisibles. Ils n’ont pas été écrasés.',true);}
}
function readInbox(){
 try{const rows=JSON.parse(localStorage.getItem(INBOX_KEY)||'[]');
   state.inbox=Array.isArray(rows)?rows.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.company==='string').slice(0,200):[];
 }catch{state.inbox=[];}
}
function removeInbox(id){
 state.inbox=state.inbox.filter(x=>x.id!==id);
 try{localStorage.setItem(INBOX_KEY,JSON.stringify(state.inbox));}
 catch{notice('Impossible de supprimer les métadonnées des réponses.',true);}
 renderInbox();
}
function persistLocal(){
 try{localStorage.setItem(KEY,JSON.stringify({version:6,records:state.local.slice(0,300),events:state.localEvents.slice(-1500)}));return true}
 catch{notice('Stockage local indisponible ou saturé. Exportez vos dossiers en JSON.',true);return false}
}
function unify(){
 const seen=new Set();
 state.items=[];
 for(const item of state.cloud.map(x=>({...x,storage:'cloud'})).concat(state.local.map(x=>({...x,storage:'local'})))){
  const key=keyOf(item);
  if(seen.has(key))continue;
  seen.add(key);state.items.push(item);
 }
 const ids=new Set(state.items.map(x=>x.id));
 state.events=state.cloudEvents.concat(state.localEvents).filter(e=>ids.has(e.applicationId));
}
async function request(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,
  headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const err=new Error(data.error||'Service indisponible ('+response.status+')');err.code=response.status;throw err;}
 return data;
}
async function refresh(silent=false){
 if(state.busy)return;
 try{
  const auth=await request('/api/auth');
  if(auth.authenticated){
   const data=await request('/api/tracker');
   if(!Array.isArray(data.applications)||!Array.isArray(data.events))throw Error('Réponse de suivi invalide.');
   state.cloud=data.applications;
   state.cloudEvents=data.events;state.cloudReady=true;
   state.settings=data.settings||{emailReminders:false};
   $('emailReminders').checked=!!state.settings.emailReminders;
   $('syncStatus').textContent='Compte connecté · dossiers chiffrés côté serveur';
   if(!silent)notice('Dossiers synchronisés. Les événements sont affichés selon les données disponibles.');
  }else{
   state.cloudReady=false;state.cloud=[];state.cloudEvents=[];
   $('syncStatus').textContent='Mode local · connexion facultative via le Studio';
   $('reminderStatus').textContent='Pour recevoir des e-mails, connectez votre compte dans le Studio.';
   if(!silent)notice('Mode local : connectez votre compte depuis le Studio pour synchroniser.');
  }
 }catch(error){
  state.cloudReady=false;state.cloud=[];state.cloudEvents=[];
  $('syncStatus').textContent='Mode local · cloud indisponible';
  if(!silent)notice('Mode local actif. Synchronisation indisponible : '+error.message,true);
 }
 unify();render();
}
function metrics(){
 const visible=state.items.filter(x=>!x.archived);
 const total=visible.length;
 const sent=visible.filter(x=>!['draft','failed'].includes(x.status)).length;
 const replies=visible.filter(x=>['reply','interview','offer','hired','rejected'].includes(x.status)).length;
 const interviews=visible.filter(x=>['interview','offer','hired'].includes(x.status)).length;
 const due=visible.filter(x=>ACTIVE.has(x.status)&&x.nextActionAt&&dateOf(x.nextActionAt)<=Date.now()).length;
 const active=visible.filter(x=>ACTIVE.has(x.status)).length;
 return {total,sent,replies,interviews,due,active,rate:sent?Math.round(100*replies/sent):null};
}
function renderMetrics(){
 const m=metrics();
 $('mTotal').textContent=m.total;$('mSent').textContent=m.sent;
 $('mReplies').textContent=m.replies;$('mInterviews').textContent=m.interviews;
 $('mDue').textContent=m.due;$('mActive').textContent=m.active;
 $('rateReply').textContent=m.rate===null?'—':m.rate+' %';
 $('rateFill').style.width=(m.rate||0)+'%';
 const interviewRate=m.sent?Math.round(100*m.interviews/m.sent):null;
 $('rateInterviews').textContent=interviewRate===null?'—':interviewRate+' %';
 const lags=state.items.filter(x=>!x.archived&&dateOf(x.sentAt)&&dateOf(x.firstReplyAt)&&dateOf(x.firstReplyAt)>=dateOf(x.sentAt))
  .map(x=>(dateOf(x.firstReplyAt)-dateOf(x.sentAt))/86400000).sort((a,b)=>a-b);
 const median=lags.length?(lags[Math.floor((lags.length-1)/2)]+lags[Math.floor(lags.length/2)])/2:null;
 $('medianReply').textContent=median===null?'—':median.toLocaleString('fr-FR',{maximumFractionDigits:1})+' j';
 const future=state.items.filter(x=>!x.archived&&x.interviewAt&&dateOf(x.interviewAt)>=Date.now())
  .sort((a,b)=>dateOf(a.interviewAt)-dateOf(b.interviewAt));
 $('nextInterview').textContent=future.length?fmt(future[0].interviewAt):'Aucun';
}
function visibleRecords(){
 const stage=$('filterStage').value,q=norm($('filterQuery').value);
 return state.items.filter(x=>{
  if(stage==='archived'&&!x.archived)return false;
  if(stage!=='archived'&&x.archived)return false;
  if(stage==='active'&&!ACTIVE.has(x.status))return false;
  if(stage==='due'&&(!ACTIVE.has(x.status)||!x.nextActionAt||dateOf(x.nextActionAt)>Date.now()))return false;
  return !q||norm([x.title,x.company,x.location,x.recruiterName].join(' ')).includes(q);
 });
}
function cardFor(item){
 const card=elt('button','job-card');
 card.type='button';card.draggable=true;card.dataset.caseId=item.id;
 const title=elt('strong','',item.title),company=elt('small','',item.company);
 const loc=elt('span','card-loc',item.location||'Lieu non précisé');
 const foot=elt('div','card-footer');
 const mode=elt('span','card-tag'+(item.submissionProof==='gmail_verified'?' verified':''),
  item.submissionProof==='gmail_verified'?'Envoi Gmail vérifié':item.storage==='local'?'Cet appareil':item.submissionProof==='self_reported'?'Déclaré manuellement':'Dossier cloud');
 foot.append(mode);
 if(item.nextActionAt&&ACTIVE.has(item.status)){
  const due=elt('span','card-tag'+(dateOf(item.nextActionAt)<=Date.now()?' due':''),dateOf(item.nextActionAt)<=Date.now()?'Relance due':fmt(item.nextActionAt));
  foot.append(due);
 }
 card.append(title,company,loc,foot);
 card.addEventListener('click',()=>openCase(item));
 card.addEventListener('dragstart',event=>{event.dataTransfer.setData('text/plain',item.id);event.dataTransfer.effectAllowed='move';});
 return card;
}
function makeLane(stage,items){
 const lane=elt('section','lane');lane.dataset.status=stage.id;
 lane.setAttribute('aria-label',stage.label);
 const head=elt('div','lane-head'),title=elt('span','',stage.label),count=elt('span','lane-count',items.length);
 head.append(title,count);lane.append(head);
 for(const item of items)lane.append(cardFor(item));
 if(!items.length)lane.append(elt('p','lane-empty','Aucune candidature à cette étape.'));
 lane.addEventListener('dragover',e=>{e.preventDefault();lane.classList.add('dragover');});
 lane.addEventListener('dragleave',()=>lane.classList.remove('dragover'));
 lane.addEventListener('drop',async e=>{
  e.preventDefault();lane.classList.remove('dragover');
  const id=e.dataTransfer.getData('text/plain'),item=state.items.find(x=>x.id===id);
  if(!item)return;
  const status=stage.id==='closed'?'rejected':stage.id;
  if(stage.id==='closed'){
   openCase(item);$('caseStatus').focus();
   statusMessage('Choisissez un statut final dans la fiche : aucun refus n’est présumé.');
   return;
  }
  if(item.status===status)return;
  await saveExisting(item,{...item,status},true);
 });
 return lane;
}
function renderBoard(){
 const board=$('board');board.replaceChildren();
 const rows=visibleRecords();
 for(const stage of STAGES)board.append(makeLane(stage,rows.filter(x=>stage.statuses.includes(x.status))));
 $('resultStatus').textContent=rows.length+' candidature(s) affichée(s) sur '+state.items.length+' dossier(s) au total.';
}
function renderDue(){
 const target=$('dueList');target.replaceChildren();
 const now=Date.now(),limit=now+14*86400000;
 const due=state.items.filter(x=>!x.archived&&ACTIVE.has(x.status)&&x.nextActionAt&&dateOf(x.nextActionAt)<=limit)
  .sort((a,b)=>dateOf(a.nextActionAt)-dateOf(b.nextActionAt)).slice(0,10);
 if(!due.length){target.append(elt('p','muted','Aucune relance dans les 14 prochains jours.'));return;}
 for(const item of due){
  const b=elt('button','due-card');b.type='button';
  const left=elt('span'),name=elt('strong','',item.title+' · '+item.company),sub=elt('small','',item.location||'Candidature');
  const delta=dateOf(item.nextActionAt)-now;
  const when=elt('b','',delta<0?'À traiter':delta<86400000?'Aujourd’hui':fmt(item.nextActionAt));
  left.append(name,sub);b.append(left,when);b.addEventListener('click',()=>openCase(item));target.append(b);
 }
}
async function importEml(event){
 const file=event.target.files&&event.target.files[0];
 if(!file)return;
 const output=$('emlStatus');
 if(!/\.eml$/i.test(file.name)||file.size>2*1024*1024){
  output.textContent='Choisissez un fichier .eml de 2 Mo maximum.';event.target.value='';return;
 }
 try{
  const source=await file.text();
  const head=source.split(/\r?\n\r?\n/,1)[0].slice(0,32000),headers={};let current='';
  for(const line of head.split(/\r?\n/)){
   if(/^\s/.test(line)&&current){headers[current]+=' '+line.trim();continue;}
   const pivot=line.indexOf(':');
   if(pivot<=0)continue;
   current=line.slice(0,pivot).toLowerCase().trim();
   if(['subject','date','message-id'].includes(current))headers[current]=line.slice(pivot+1).trim();
  }
  const subject=String(headers.subject||'Message importé').slice(0,180);
  const related=state.items.find(item=>{
   const title=norm(item.title),company=norm(item.company),message=norm(subject);
   return title.length>=5&&message.includes(title)||company.length>=6&&message.includes(company);
  });
  const uidValue='eml-'+uid();
  const when=headers.date&&dateOf(headers.date)?new Date(headers.date).toISOString():null;
  state.inbox.unshift({id:uidValue,threadId:'',title:related?.title||subject,
   company:related?.company||'Message à associer',jobUrl:related?.url||'',
   kind:'a_verifier',receivedAt:when,imported:true});
  try{localStorage.setItem(INBOX_KEY,JSON.stringify(state.inbox.slice(0,200)));}
  catch{throw Error('Stockage local indisponible');}
  renderInbox();
  output.textContent='Message importé localement, sans transmettre son contenu. Vérifiez l’e-mail original avant toute mise à jour.';
 }catch(error){output.textContent='Import impossible : '+error.message;}
 finally{event.target.value='';}
}
function renderInbox(){
 const target=$('replyInbox');if(!target)return;target.replaceChildren();
 if(!state.inbox.length){
  target.append(elt('p','muted','Aucune réponse transférée depuis le Studio. Le suivi Gmail est facultatif.'));
  return;
 }
 const labels={entretien:'Entretien possible',favorable:'Réponse potentiellement favorable',
  defavorable:'Réponse potentiellement défavorable',incertain:'À examiner',a_verifier:'À examiner'};
 for(const message of [...state.inbox].sort((a,b)=>dateOf(b.receivedAt)-dateOf(a.receivedAt)).slice(0,30)){
  const item=state.items.find(x=>message.threadId&&x.gmailThreadId===message.threadId)||
   state.items.find(x=>message.jobUrl&&x.url===message.jobUrl)||
   state.items.find(x=>norm(x.title)===norm(message.title)&&norm(x.company)===norm(message.company));
  const row=elt('div','inbox-row');
  const text=elt('div'),buttons=elt('div','inbox-actions');
  text.append(elt('strong','',message.title+' · '+message.company),
   elt('small','',(labels[message.kind]||'Réponse à vérifier')+' · '+datetime(message.receivedAt)));
  const examine=elt('button','quiet',item?'Ouvrir la fiche':'Créer une fiche');examine.type='button';
  examine.addEventListener('click',()=>{
   openCase(item||null);
   if(!item){$('caseTitle').value=message.title;$('caseCompany').value=message.company==='Message à associer'?'':message.company;$('caseUrl').value=safeURL(message.jobUrl)||'';}
   statusMessage('Réponse Gmail détectée : vérifiez le message original avant de confirmer son statut.');
  });
  const dismiss=elt('button','quiet','Retirer du tableau');dismiss.type='button';
  dismiss.addEventListener('click',()=>removeInbox(message.id));
  buttons.append(examine,dismiss);row.append(text,buttons);target.append(row);
 }
}
function render(){unify();renderMetrics();renderBoard();renderDue();renderInbox();}

function statusMessage(message){$('saveCaseStatus').textContent=message;}
function openCase(item=null){
 state.selected=item||null;const create=!item;
 $('dialogTitle').textContent=create?'Nouvelle candidature':'Suivi · '+item.company;
 const get=(key,fallback='')=>create?fallback:(item[key]??fallback);
 $('caseTitle').value=get('title');$('caseCompany').value=get('company');
 $('caseLocation').value=get('location');$('caseUrl').value=get('url');$('caseStatus').value=get('status','draft');
 $('caseChannel').value=get('channel','unspecified');$('caseRecruiter').value=get('recruiterName');
 $('caseEmail').value=get('to');$('caseNextAction').value=localInput(get('nextActionAt'));
 $('caseInterview').value=localInput(get('interviewAt'));$('caseInterviewFormat').value=get('interviewFormat');
 $('caseInterviewPlace').value=get('interviewPlace');$('caseCvVersion').value=get('cvVersion');$('caseNotes').value=get('notes');
 $('caseArchived').checked=Boolean(get('archived',false));
 $('deleteCase').hidden=create;
 $('caseTimelineSection').hidden=create;$('draftSection').hidden=create;
 $('dialogEvidence').textContent=create?'Une candidature enregistrée comme envoyée est une déclaration de votre part, pas une preuve d’envoi.':
  item.submissionProof==='gmail_verified'?'Cet envoi Gmail a été vérifié au moment de sa synchronisation. Les modifications de statut restent déclaratives.':
  'Statut manuel ou historique importé : son exactitude n’est pas vérifiée auprès du recruteur.';
 statusMessage('');$('caseTimeline').replaceChildren();
 if(!create){drawTimeline(item);makeFollowup(item);}
 $('applicationDialog').showModal();
}
function closeCase(){$('applicationDialog').close();state.selected=null;}
function drawTimeline(item){
 const events=state.events.filter(x=>x.applicationId===item.id)
  .sort((a,b)=>dateOf(b.date)-dateOf(a.date)).slice(0,60);
 $('caseTimelineSection').hidden=false;
 const target=$('caseTimeline');target.replaceChildren();
 if(!events.length){target.append(elt('p','muted','Aucun événement enregistré pour cette fiche.'));return;}
 for(const ev of events){
  const block=elt('div','timeline-item');
  const detail=ev.kind==='status'?'Statut : '+(LABELS[ev.oldStatus]||ev.oldStatus||'—')+' → '+(LABELS[ev.status]||ev.status||'—')
   :ev.kind==='imported'?'Historique local importé':ev.kind==='created'?'Dossier ajouté':'Fiche modifiée';
  block.append(elt('strong','',detail),elt('time','',datetime(ev.date)));
  if(ev.note)block.append(elt('p','',ev.note));
  target.append(block);
 }
}
function makeFollowup(item){
 $('draftSection').hidden=false;
 const name=item.recruiterName?item.recruiterName:'Madame, Monsieur';
 $('followupDraft').value='Bonjour '+name+',\n\nJe me permets de revenir vers vous au sujet de ma candidature au poste de '+item.title+' au sein de '+item.company+'.\n\nPourriez-vous m’indiquer si vous avez eu l’occasion de l’examiner ? Je reste disponible pour tout complément d’information.\n\nJe vous remercie de votre attention.\n\nBien cordialement,';
}
function collect(){
 const title=$('caseTitle').value.trim(),company=$('caseCompany').value.trim();
 const url=$('caseUrl').value.trim();
 if(!title||!company)throw Error('Le poste et l’employeur sont requis.');
 if(url&&!safeURL(url))throw Error('Lien d’annonce invalide.');
 const email=$('caseEmail').value.trim();
 if(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw Error('Adresse e-mail du recruteur invalide.');
 return {
  job:{title,company,url,location:$('caseLocation').value.trim(),source:state.selected?.source||'Saisie manuelle'},
  status:$('caseStatus').value,channel:$('caseChannel').value,recruiterName:$('caseRecruiter').value.trim(),
  to:email,nextActionAt:fromInput($('caseNextAction').value),interviewAt:fromInput($('caseInterview').value),
  interviewFormat:$('caseInterviewFormat').value,interviewPlace:$('caseInterviewPlace').value.trim(),
  cvVersion:$('caseCvVersion').value.trim(),notes:$('caseNotes').value.trim(),
  archived:$('caseArchived').checked
 };
}
function eventLocal(item,kind,oldStatus,note=''){
 state.localEvents.push({id:'ev-'+uid(),applicationId:item.id,kind,oldStatus:oldStatus||null,
  status:item.status,date:new Date().toISOString(),note:note.slice(0,500)});
}
function localInsert(data){
 const id='local-'+uid(),now=new Date().toISOString();
 const job=data.job;
 const record={...job,id,storage:'local',status:data.status,channel:data.channel,to:data.to||'',
   recruiterName:data.recruiterName||'',notes:data.notes||'',nextActionAt:data.nextActionAt,
   interviewAt:data.interviewAt,interviewFormat:data.interviewFormat||'',interviewPlace:data.interviewPlace||'',
   cvVersion:data.cvVersion||'',archived:data.archived||false,submissionProof:data.status==='draft'?'not_sent':'self_reported',
   sentAt:null,updatedAt:now,statusUpdatedAt:now,version:1};
 const previousEventCount=state.localEvents.length;
 state.local.unshift(record);eventLocal(record,'created',null);
 if(!persistLocal()){
  state.local.shift();state.localEvents.length=previousEventCount;
  throw Error('Dossier non enregistré : espace local insuffisant ou stockage bloqué.');
 }
 render();return record;
}
function localPatch(item,data){
 const index=state.local.findIndex(x=>x.id===item.id);
 if(index<0)throw Error('Candidature locale introuvable.');
 const old=state.local[index],now=new Date().toISOString();
 const next={...old,...data.job,...data,id:old.id,storage:'local',source:data.job.source,
   version:(old.version||1)+1,updatedAt:now,
   statusUpdatedAt:old.status===data.status?old.statusUpdatedAt:now,
   submissionProof:old.submissionProof==='gmail_verified'?'gmail_verified':
     data.status==='draft'?'not_sent':old.submissionProof==='not_sent'?'self_reported':old.submissionProof};
 delete next.job;
 const previousEventCount=state.localEvents.length;
 state.local[index]=next;
 eventLocal(next,old.status!==next.status?'status':'edited',old.status,old.notes===next.notes?'':next.notes);
 if(!persistLocal()){
  state.local[index]=old;state.localEvents.length=previousEventCount;
  throw Error('Modification non enregistrée : stockage local indisponible.');
 }
 render();return next;
}
async function saveExisting(item,data,fromDrag=false){
 const payload=data.job?data:{job:{title:item.title,company:item.company,url:item.url,location:item.location,source:item.source},
  status:data.status,channel:item.channel||'unspecified',to:item.to||'',recruiterName:item.recruiterName||'',
  nextActionAt:item.nextActionAt||null,interviewAt:item.interviewAt||null,interviewFormat:item.interviewFormat||'',
  interviewPlace:item.interviewPlace||'',cvVersion:item.cvVersion||'',notes:item.notes||'',archived:item.archived||false};
 if(item.storage==='cloud'){
  try{
   await request('/api/tracker',{method:'PATCH',body:JSON.stringify({id:item.id,version:item.version,consent:true,...payload})});
   await refresh(true);
   if(fromDrag)notice('Statut modifié dans votre compte.');
  }catch(error){notice('Modification non enregistrée : '+error.message,true);throw error;}
 }else{
  localPatch(item,payload);
  if(fromDrag)notice('Statut modifié localement.');
 }
}
async function saveCase(event){
 event.preventDefault();if(state.busy)return;
 let data;
 try{data=collect();}catch(error){statusMessage(error.message);return;}
 state.busy=true;$('saveCase').disabled=true;statusMessage('Enregistrement…');
 try{
  if(state.selected)await saveExisting(state.selected,data);
  else if(state.cloudReady){await request('/api/tracker',{method:'POST',body:JSON.stringify({action:'create',consent:true,...data})});await refresh(true);}
  else localInsert(data);
  closeCase();notice('Candidature enregistrée, sans aucun envoi au recruteur.');
 }catch(error){statusMessage(error.message);notice('Sauvegarde refusée : '+error.message,true);}
 finally{state.busy=false;$('saveCase').disabled=false;}
}
async function deleteCase(){
 const item=state.selected;if(!item)return;
 if(!confirm('Supprimer définitivement cette candidature, ses notes et son historique ?'))return;
 try{
  if(item.storage==='cloud'){await request('/api/tracker',{method:'DELETE',body:JSON.stringify({id:item.id,consent:true})});await refresh(true);}
  else{state.local=state.local.filter(x=>x.id!==item.id);state.localEvents=state.localEvents.filter(x=>x.applicationId!==item.id);persistLocal();render();}
  closeCase();notice('Dossier et historique supprimés.');
 }catch(error){statusMessage('Suppression impossible : '+error.message);}
}
function download(filename,text,type){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function icsEsc(x){return String(x||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);}
function calendarCase(){
 const when=fromInput($('caseInterview').value);
 if(!when){statusMessage('Renseignez d’abord une date d’entretien.');return;}
 const start=new Date(when),end=new Date(start.getTime()+3600000);
 const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const company=$('caseCompany').value.trim(),title=$('caseTitle').value.trim();
 const place=$('caseInterviewPlace').value.trim();
 const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Niko Emploi//Suivi//FR','BEGIN:VEVENT',
  'UID:'+uid()+'@niko-emploi','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(start),
  'DTEND:'+stamp(end),'SUMMARY:'+icsEsc('Entretien '+title+' - '+company),
  'LOCATION:'+icsEsc(place),
  'DESCRIPTION:'+icsEsc('Événement ajouté par le candidat. Confirmer la date avec le recruteur.'),
  'END:VEVENT','END:VCALENDAR'].join('\r\n');
 download('niko-entretien.ics',ics,'text/calendar;charset=utf-8');
 statusMessage('Fichier calendrier téléchargé. Aucune invitation envoyée.');
}
function scheduleWeek(){
 const days=Number($('reminderDays').value)||7;
 const date=new Date(Date.now()+days*86400000);
 $('caseNextAction').value=localInput(date);statusMessage('Relance proposée dans '+days+' jours. Enregistrez le dossier pour confirmer.');
}
async function copyDraft(){
 const content=$('followupDraft').value;
 try{await navigator.clipboard.writeText(content);statusMessage('Brouillon copié. Aucun e-mail envoyé.');}
 catch{statusMessage('Copie indisponible. Sélectionnez le texte pour le copier.');}
}
function openMail(){
 const to=$('caseEmail').value.trim();
 if(!to||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)){statusMessage('Saisissez une adresse de recruteur valide.');return;}
 const subject='Relance de candidature — '+$('caseTitle').value.trim();
 window.location.href='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent($('followupDraft').value);
 statusMessage('Messagerie ouverte. Vérifiez le destinataire et envoyez vous-même.');
}
function csvVal(value){
 let t=String(value==null?'':value);
 if(/^[\s]*[=+\-@\t\r]/.test(t))t="'"+t;
 return '"'+t.replace(/"/g,'""')+'"';
}
function exportData(format){
 if(!state.items.length){$('migrationStatus').textContent='Aucune candidature à exporter.';return;}
 if(!confirm('Exporter vos candidatures, contacts et notes personnelles vers un fichier sur cet appareil ?'))return;
 const fields=['title','company','location','status','url','source','to','recruiterName','nextActionAt','interviewAt','cvVersion','notes','updatedAt','submissionProof'];
 const rows=state.items;
 if(format==='csv'){
  const csv=[fields.join(';')].concat(rows.map(item=>fields.map(k=>csvVal(item[k])).join(';'))).join('\r\n');
  download('niko-candidatures.csv','\uFEFF'+csv,'text/csv;charset=utf-8');
 }else{
  download('niko-candidatures.json',JSON.stringify({exportedAt:new Date().toISOString(),version:6,applications:rows,events:state.events},null,2),'application/json;charset=utf-8');
 }
 $('migrationStatus').textContent='Sauvegarde téléchargée. Gardez ce fichier privé.';
}
function clearLocal(){
 if(!state.local.length){$('migrationStatus').textContent='Aucun dossier local à supprimer.';return;}
 if(!confirm('Supprimer définitivement les dossiers et événements enregistrés sur cet appareil ? Les dossiers cloud ne seront pas supprimés.'))return;
 state.local=[];state.localEvents=[];persistLocal();render();
 $('migrationStatus').textContent='Dossiers locaux supprimés. Le compte cloud est inchangé.';
}
function clearInbox(){
 if(!state.inbox.length){$('migrationStatus').textContent='Aucune métadonnée Gmail à supprimer.';return;}
 if(!confirm('Effacer les métadonnées Gmail locales ? Les messages de votre messagerie ne seront pas modifiés.'))return;
 state.inbox=[];try{localStorage.removeItem(INBOX_KEY);}catch{}
 renderInbox();$('migrationStatus').textContent='Métadonnées locales supprimées, sans modifier Gmail.';
}
function importHistory(){
 let legacy=[];try{legacy=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch{}
 if(!Array.isArray(legacy)||!legacy.length){$('migrationStatus').textContent='Aucun ancien historique disponible sur cet appareil.';return;}
 if(!confirm('Importer les candidatures de l’ancien historique de ce navigateur ? Leurs statuts seront étiquetés comme historiques, sans nouvelle confirmation d’envoi.'))return;
 let added=0;const seen=new Set(state.items.map(keyOf));
 const ordered=[...legacy].filter(x=>x&&x.title&&x.company).sort((a,b)=>dateOf(b.date)-dateOf(a.date));
 for(const h of ordered){
  const item={title:String(h.title).slice(0,180),company:String(h.company).slice(0,150),
   url:safeURL(h.url)||'',location:String(h.location||'').slice(0,150)};
  const key=keyOf(item);if(seen.has(key))continue;
  const value=norm(h.status);
  const mapped=value.includes('envoy')?'sent':value.includes('entretien')?'interview':
   value.includes('reponse')?'reply':value.includes('refus')?'rejected':'draft';
  const now=dateOf(h.date)?new Date(h.date).toISOString():new Date().toISOString();
  const record={...item,id:'local-'+uid(),source:'Historique local',storage:'local',status:mapped,
   channel:'unspecified',to:h.to||'',recruiterName:'',notes:'',cvVersion:'',nextActionAt:null,
   interviewAt:null,interviewFormat:'',interviewPlace:'',archived:false,
   submissionProof:'legacy',sentAt:mapped==='sent'?now:null,updatedAt:now,statusUpdatedAt:now,version:1};
  state.local.push(record);
  state.localEvents.push({id:'ev-'+uid(),applicationId:record.id,kind:'imported',
   oldStatus:null,status:record.status,date:now,note:''});
  seen.add(key);added++;if(added>=150)break;
 }
 persistLocal();render();$('migrationStatus').textContent=added+' dossier(s) historiques importé(s) localement, sans envoi ni modification dans Gmail.';
}
async function syncLocal(){
 if(!state.cloudReady){$('migrationStatus').textContent='Connectez un compte configuré dans le Studio et actualisez cette page.';return;}
 if(!state.local.length){$('migrationStatus').textContent='Aucun dossier local à synchroniser.';return;}
 if(!confirm('Transférer les dossiers locaux vers votre compte chiffré ? Les notes et les contacts seront enregistrés sur le serveur.'))return;
 $('syncLocal').disabled=true;
 let copied=0,duplicates=0,failed=0;
 for(const item of state.local.slice(0,20)){
  try{
   await request('/api/tracker',{method:'POST',body:JSON.stringify({
    action:'create',consent:true,job:{title:item.title,company:item.company,location:item.location,url:item.url,source:item.source},
    status:item.status==='failed'?'draft':item.status,channel:item.channel||'unspecified',
    to:item.to||'',recruiterName:item.recruiterName||'',notes:item.notes||'',
    nextActionAt:item.nextActionAt||null,interviewAt:item.interviewAt||null,
    interviewFormat:item.interviewFormat||'',interviewPlace:item.interviewPlace||'',
    cvVersion:item.cvVersion||'',archived:item.archived,
    history:state.localEvents.filter(ev=>ev.applicationId===item.id).slice(-20).map(ev=>({
      kind:ev.kind,oldStatus:ev.oldStatus||null,status:ev.status||null,date:ev.date,note:ev.note||''
    }))
   })});
   state.local=state.local.filter(x=>x.id!==item.id);state.localEvents=state.localEvents.filter(x=>x.applicationId!==item.id);
   copied++;
  }catch(error){if(error.code===409)duplicates++;else failed++;}
 }
 const localUpdated=persistLocal();await refresh(true);$('syncLocal').disabled=false;
 $('migrationStatus').textContent=(localUpdated?'':'Attention : transfert cloud effectué mais nettoyage local non enregistré. Rechargez et vérifiez les doublons. ')+copied+' dossier(s) transféré(s), '+duplicates+' doublon(s) conservé(s) localement, '+failed+' échec(s). Maximum 20 dossiers par opération.';
}
async function saveReminderSettings(){
 const enabled=$('emailReminders').checked;
 if(!state.cloudReady){$('emailReminders').checked=false;$('reminderStatus').textContent='Connexion et migration de la base nécessaires.';return;}
 if(enabled&&!confirm('Autoriser Niko Emploi à envoyer un récapitulatif quotidien uniquement quand une relance arrive à échéance ?')){$('emailReminders').checked=false;return;}
 try{
  await request('/api/tracker',{method:'POST',body:JSON.stringify({action:'settings',consent:true,emailReminders:enabled,emailConsent:enabled})});
  $('reminderStatus').textContent=enabled?'Alertes e-mail autorisées. Envoi soumis à la configuration du cron.':'Alertes e-mail désactivées.';
 }catch(error){$('emailReminders').checked=!enabled;$('reminderStatus').textContent=error.message;}
}
function bind(){
 $('addApplication').addEventListener('click',()=>openCase());
 $('closeDialog').addEventListener('click',closeCase);$('cancelCase').addEventListener('click',closeCase);
 $('caseForm').addEventListener('submit',saveCase);
 $('deleteCase').addEventListener('click',deleteCase);
 $('filterQuery').addEventListener('input',renderBoard);
 $('filterStage').addEventListener('change',renderBoard);
 $('refreshTracker').addEventListener('click',()=>refresh(false));
 $('scheduleWeek').addEventListener('click',scheduleWeek);
 $('copyDraft').addEventListener('click',copyDraft);
 $('openMail').addEventListener('click',openMail);
 $('calendarCase').addEventListener('click',calendarCase);
 $('importHistory').addEventListener('click',importHistory);
 $('syncLocal').addEventListener('click',syncLocal);
 $('exportCsv').addEventListener('click',()=>exportData('csv'));
 $('exportJson').addEventListener('click',()=>exportData('json'));
 $('clearLocal').addEventListener('click',clearLocal);
 $('clearInbox').addEventListener('click',clearInbox);
 $('saveReminderSettings').addEventListener('click',saveReminderSettings);
 $('importEml').addEventListener('change',importEml);
 window.addEventListener('storage',event=>{if([KEY,HISTORY_KEY,INBOX_KEY].includes(event.key)){readLocal();readInbox();render();}});
}
function init(){bind();readLocal();readInbox();render();refresh(true);}
document.addEventListener('DOMContentLoaded',init);
})();
