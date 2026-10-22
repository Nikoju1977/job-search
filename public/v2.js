/* Niko Emploi 2.0 — cockpit candidat, session facultative, coaching d'entretien. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const authKey='niko_secure_session_v2',historyKey='niko_emploi_history_v2';
let session=null,online={applications:[],replies:[],interviews:[]},lastStatus='local';
const empty=(s)=>typeof s==='string'?s:'';
const formatDate=(d)=>{const date=new Date(d);return Number.isFinite(date.getTime())?date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}):'';};
function announce(s,error=false){const e=$('notice');if(!e)return;e.hidden=false;e.textContent=s;e.classList.toggle('error',error);}
function sessionGet(){return null;}
function sessionSet(s){session=s;}
async function accountFetch(path,options={}){
 if(!session?.authenticated)throw Error('Connexion requise.');
 const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})},cache:'no-store'});
 if(response.status===401){sessionSet(null);renderAuth();throw Error('Session expirée. Reconnectez-vous.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Service indisponible ('+response.status+')');
 return data;
}
async function authRedirect(){
 const params=new URLSearchParams(location.search);
 const token=params.get('login_token');
 if(!token)return;
 history.replaceState({},'',location.pathname);
 try{
  const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',token})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'Lien expiré.');
  sessionSet(data);
 }catch(e){announce('Connexion : '+e.message,true);}
}
function getLocalHistory(){try{const data=JSON.parse(localStorage.getItem('niko_history_v2')||'[]');return Array.isArray(data)?data:[]}catch{return []}}
function eventsSorted(){
 const local=getLocalHistory().map(h=>({type:h.status||'Inconnu',label:(h.title||'Candidature')+' — '+(h.company||'Entreprise'),date:h.date,local:true}));
 const remote=(online.applications||[]).map(a=>({type:statusLabel(a.status),label:a.title+' — '+a.company,date:a.updatedAt,local:false}));
 return [...local,...remote].filter(x=>x.date).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5);
}
function statusLabel(s){return ({draft:'Brouillon',sent:'Envoyée',reply:'Réponse reçue',interview:'Entretien',rejected:'Refus',hired:'Embauche',failed:'Échec'})[s]||s||'Suivi';}
function renderMetrics(){
 const local=getLocalHistory();const remote=online.applications||[];
 const cloudSent=remote.filter(a=>['sent','reply','interview','rejected','hired'].includes(a.status)).length;
 const localSent=local.filter(a=>a.status==='Envoyée').length;
 $('v2Sent').textContent=String(session?Math.max(cloudSent,localSent):localSent);
 $('v2Replies').textContent=String((online.replies||[]).length);
 $('v2Interviews').textContent=String(remote.filter(x=>x.status==='interview').length+(online.interviews||[]).length);
 $('v2Prepared').textContent=String(local.filter(a=>a.status==='Préparée').length+remote.filter(a=>a.status==='draft').length);
 const rows=$('v2Activity');rows.replaceChildren();
 const events=eventsSorted();if(!events.length){rows.textContent='Votre activité réelle apparaîtra ici après vos premières candidatures.';return;}
 for(const h of events){const row=document.createElement('div');row.className='v2-activity-row';const left=document.createElement('div'),title=document.createElement('strong'),stamp=document.createElement('span'),tag=document.createElement('span');title.textContent=h.label;stamp.textContent=formatDate(h.date)+(h.local?' · Cet appareil':' · Compte sécurisé');tag.textContent=h.type;tag.className='v2-activity-tag';left.append(title,stamp);row.append(left,tag);rows.append(row);}
}
function renderAuth(){
 const ready=lastStatus==='ready';
 $('v2LoginForm').hidden=!ready||Boolean(session?.authenticated);
 $('v2AccountActions').hidden=!ready||!session?.authenticated;
 $('v2CloudStatus').textContent=!ready?'Le service de comptes sécurisés n’est pas encore activé. Votre espace local continue de fonctionner.':session?.authenticated?'Compte connecté, stockage chiffré disponible sur demande.':'Un compte facultatif permet de retrouver votre profil et les candidatures enregistrées.';
 $('v2AccountIdentity').textContent=session?.email||'Session connectée';
 renderMetrics();
}
async function loadAccount(){
 if(!session?.authenticated)return;
 try{
  const account=await accountFetch('/api/account');
  session.email=account.email;
  online={applications:account.applications||[],replies:account.replies||[],interviews:account.interviews||[]};
  const profile=account.profile||{};
  for(const [id,key] of [['fullName','fullName'],['targetRole','targetRole'],['targetLocation','targetLocation'],['cvText','cvText']]){
   const el=$(id);if(el&&!el.value&&profile[key])el.value=profile[key];
  }
  renderAuth();document.dispatchEvent(new Event('niko:session'));
 }catch(e){announce('Synchronisation : '+e.message,true);}
}
async function signin(e){
 e.preventDefault();const address=$('v2AccountEmail').value.trim();if(!address)return;
 const button=$('v2LoginForm').querySelector('button');button.disabled=true;
 try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email:address})});const d=await r.json();if(!r.ok)throw Error(d.error||'Envoi impossible');announce('Consultez votre boîte e-mail : le lien de connexion vient d’être demandé.');}catch(e){announce(e.message,true)}finally{button.disabled=false;}
}
async function cloudSave(){
 if(!session?.authenticated)return announce('Connectez votre compte pour synchroniser.',true);
 const profile={fullName:empty($('fullName').value),targetRole:empty($('targetRole').value),targetLocation:empty($('targetLocation').value),cvText:empty($('cvText').value)};
 if(!profile.cvText.trim())return announce('Importez ou collez votre CV avant la sauvegarde chiffrée.',true);
 if(!confirm('Enregistrer une copie chiffrée de ce CV dans votre compte personnel sécurisé ?'))return;
 try{await accountFetch('/api/account',{method:'POST',body:JSON.stringify({profile,dataConsent:true})});announce('Profil chiffré sauvegardé dans votre compte.');await loadAccount();}catch(e){announce('Sauvegarde impossible : '+e.message,true);}
}
async function wipeCloud(){
 if(!session?.authenticated)return;
 if(!confirm('Supprimer définitivement les CV, candidatures, événements et connexions Gmail stockés pour ce compte Niko Emploi ?'))return;
 try{await accountFetch('/api/account',{method:'DELETE'});sessionSet(null);online={applications:[],replies:[],interviews:[]};renderAuth();announce('Compte Niko Emploi et données associées supprimés. Votre adresse e-mail personnelle reste intacte.');}catch(e){announce(e.message,true);}
}
async function logout(){await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});sessionSet(null);online={applications:[],replies:[],interviews:[]};renderAuth();announce('Déconnecté de votre compte autonome. Le profil local n’a pas été effacé.');document.dispatchEvent(new Event('niko:session'));}

const QUESTION_SETS={
 rh:['Présentez votre parcours et expliquez ce qui vous attire dans ce poste.','Qu’avez-vous appris de votre dernière expérience professionnelle ?','Racontez une situation où vous avez réussi à résoudre un problème.','Comment réagissez-vous lorsque plusieurs priorités se présentent en même temps ?','Quelles questions souhaitez-vous poser à votre futur employeur ?'],
 metier:['Décrivez une réalisation professionnelle représentative de votre savoir-faire.','Comment organisez-vous les étapes d’une mission complexe ?','Parlez d’une difficulté technique et de la façon dont vous l’avez surmontée.','Comment vérifiez-vous la qualité et la fiabilité de votre travail ?','Quelles méthodes ou outils souhaitez-vous approfondir dans ce métier ?'],
 inclusion:['Quelles conditions de travail vous permettent d’exprimer au mieux vos compétences ?','Comment pourriez-vous aborder un besoin d’aménagement sans divulguer de détails médicaux ?','Quelles modalités d’organisation ou de télétravail sont importantes pour vous ?','Comment expliqueriez-vous au recruteur les résultats de votre travail et vos atouts ?','Quelles questions pouvez-vous poser sur les conditions de travail et l’accueil des collaborateurs ?']
};
let questionIndex=0;
function currentQuestions(){return QUESTION_SETS[$('v2InterviewType').value]||QUESTION_SETS.rh}
function renderQuestion(){
 const role=$('v2InterviewRole').value.trim()||$('targetRole')?.value.trim()||'le poste';
 const questions=currentQuestions();$('v2QuestionNumber').textContent='QUESTION '+(questionIndex+1)+' / '+questions.length;
 $('v2Question').textContent=questions[questionIndex].replace('ce poste',role).replace('ce métier',role);
 $('v2PreviousQuestion').disabled=questionIndex===0;
}
function feedback(){
 const s=$('v2PracticeAnswer').value.trim();const out=$('v2FeedbackOutput');
 if(s.length<80){out.textContent='Développez votre réponse : au moins quelques phrases concrètes sont nécessaires pour une analyse utile.';return;}
 const n=s.toLowerCase(),ideas=[];
 if(!/situation|contexte|équipe|mission|projet|service/.test(n))ideas.push('Situation : situez le contexte, sans divulguer de données confidentielles.');
 if(!/objectif|devais|tâche|responsable|attendu/.test(n))ideas.push('Tâche : précisez le résultat attendu ou votre responsabilité.');
 if(!/j.ai|j'ai|nous avons|mis en place|réalis|créé|coordonn/.test(n))ideas.push('Action : décrivez précisément ce que vous avez fait personnellement.');
 if(!/résultat|obtenu|réussi|amélior|appris|impact|bilan/.test(n))ideas.push('Résultat : expliquez le résultat réel, même s’il n’est pas chiffré.');
 out.textContent=ideas.length?'Conseils de structure (analyse locale) :\n• '+ideas.join('\n• '):'Votre réponse évoque les quatre éléments STAR. Vérifiez qu’elle reste concrète, sincère et concise.';
}
function downloadText(filename,content,type='text/plain;charset=utf-8'){
 const blob=new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function saveAnswer(){
 const s=$('v2PracticeAnswer').value.trim();if(!s)return announce('Rédigez une réponse avant de la télécharger.',true);
 downloadText('niko-preparation-entretien.txt','Poste : '+$('v2InterviewRole').value+'\n\nQuestion : '+$('v2Question').textContent+'\n\nRéponse :\n'+s);
}
function icsEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);}
function calendarEvent(){
 const date=$('v2InterviewDate').value,company=$('v2InterviewCompany').value.trim(),title=$('v2InterviewRole').value.trim()||$('targetRole')?.value.trim()||'Emploi';
 if(!date||!company)return announce('Renseignez la date, l’heure et l’entreprise.',true);
 const start=new Date(date);if(!Number.isFinite(start.getTime()))return announce('Date invalide.',true);
 const end=new Date(start.getTime()+3600000);
 const iso=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Niko Emploi//Interview//FR','BEGIN:VEVENT','UID:'+Date.now()+'@niko-emploi','DTSTAMP:'+iso(new Date()),'DTSTART:'+iso(start),'DTEND:'+iso(end),'SUMMARY:'+icsEscape('Entretien '+title+' - '+company),'DESCRIPTION:'+icsEscape('Entretien à confirmer avec le recruteur. Aucune invitation envoyée.'),'END:VEVENT','END:VCALENDAR'].join('\r\n');
 downloadText('niko-entretien.ics',body,'text/calendar;charset=utf-8');announce('Invitation calendrier téléchargée. Confirmez toujours la date auprès du recruteur.');
}
async function init(){
 session=sessionGet();await authRedirect();
 $('v2LoginForm').addEventListener('submit',signin);
 $('v2SyncProfile').onclick=cloudSave;$('v2ReloadAccount').onclick=loadAccount;$('v2Logout').onclick=logout;$('v2DeleteAccountData').onclick=wipeCloud;
 try{const d=await(await fetch('/api/account?public=true',{cache:'no-store'})).json();lastStatus=d.accountsAvailable?'ready':'local';}catch{lastStatus='local';}
 if(lastStatus==='ready'&&!session?.authenticated){try{const a=await(await fetch('/api/auth',{credentials:'same-origin',cache:'no-store'})).json();if(a.authenticated)sessionSet(a);}catch{}}
 renderAuth();if(session?.authenticated)await loadAccount();
 $('v2InterviewRole').value=$('targetRole')?.value||'';
 $('v2InterviewType').onchange=()=>{questionIndex=0;renderQuestion();};
 $('v2InterviewRole').oninput=renderQuestion;
 $('v2NextQuestion').onclick=()=>{questionIndex=(questionIndex+1)%currentQuestions().length;renderQuestion();$('v2FeedbackOutput').textContent='';};
 $('v2PreviousQuestion').onclick=()=>{questionIndex=Math.max(0,questionIndex-1);renderQuestion();};
 $('v2ReadQuestion').onclick=()=>{
  if(!('speechSynthesis' in window))return announce('Lecture vocale non disponible sur ce navigateur.',true);
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance($('v2Question').textContent);utterance.lang='fr-FR';utterance.rate=.95;speechSynthesis.speak(utterance);
 };
 $('v2Feedback').onclick=feedback;$('v2SaveAnswer').onclick=saveAnswer;$('v2CalendarEvent').onclick=calendarEvent;
 renderQuestion();
 setInterval(renderMetrics,5000);
 window.addEventListener('storage',renderMetrics);
 document.addEventListener('niko:history',renderMetrics);
}
document.addEventListener('DOMContentLoaded',init);
})();
