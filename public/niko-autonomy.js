/* NIKO INTELLIGENCE 4.0 — authenticated, consented personal radar. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
let authenticated=false;
const status=(message,error=false)=>{const el=$('naStatus');el.textContent=message;el.classList.toggle('is-error',error);};
async function request(method,path,body){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Serveur indisponible ('+response.status+')');
 return data;
}
function matchCard(item){
 const row=document.createElement('article');row.className='na-match';
 const title=document.createElement('a');title.textContent=item.title+' · '+item.company;
 const u=new URL(item.url);if(!['https:','http:'].includes(u.protocol))return row;
 title.href=u.href;title.target='_blank';title.rel='noopener noreferrer nofollow';
 const meta=document.createElement('span');meta.className='na-match-meta';meta.textContent=[item.location,item.source].filter(Boolean).join(' · ');
 const score=document.createElement('strong');score.className='na-match-score';score.textContent=item.score+'/100';
 const desc=document.createElement('p');const reasons=item.explanation||{};
 desc.textContent=[(reasons.skillsMatched||[]).length?'Compétences pertinentes : '+reasons.skillsMatched.slice(0,3).join(', '):'Compétences à comparer',reasons.location].filter(Boolean).join(' · ');
 const actions=document.createElement('div');actions.className='na-match-actions';
 for(const [kind,label] of [['saved','Enregistrer'],['dismissed','Écarter']]){
  const button=document.createElement('button');button.type='button';button.className='button-secondary';button.textContent=label;
  button.setAttribute('aria-label',label+' '+item.title+' de '+item.company);
  button.addEventListener('click',async()=>{
   button.disabled=true;
   try{await request('POST','/api/niko-agent',{action:'feedback',url:item.url,status:kind});status(kind==='saved'?'Offre enregistrée dans votre suivi.':'Offre écartée de vos suggestions.');
    if(kind==='dismissed')row.remove();else {button.textContent='Enregistrée';button.disabled=true;}
   }catch(e){status('Suivi impossible : '+e.message,true);button.disabled=false;}
  });
  actions.append(button);
 }
 const main=document.createElement('div');main.append(title,meta,desc,actions);row.append(main,score);
 return row;
}
function display(items){
 const region=$('naMatches');region.replaceChildren();$('naCount').textContent=items.length+' offre'+(items.length!==1?'s':'');
 if(!items.length){const p=document.createElement('p');p.textContent='Aucune recommandation enregistrée pour le moment. Activez l’agent et relancez une analyse.';region.append(p);return;}
 for(const item of items.slice(0,25)){try{region.append(matchCard(item))}catch{}}
}
function loadPolicy(p={}){
 $('naEnabled').checked=p.enabled===true;
 $('naThreshold').value=String(p.min_score??50);
 $('naThresholdValue').textContent=$('naThreshold').value;
 $('naRemote').checked=p.remote_only===true;
 $('naInclusive').checked=p.inclusive_only===true;
 $('naConsent').checked=false;
}
async function refresh(){
 try{
  const auth=await request('GET','/api/auth');
  authenticated=auth.authenticated===true;
  if(!authenticated){status('Connectez-vous au compte candidat pour configurer l’agent. Le radar local reste disponible.');return;}
  const data=await request('GET','/api/niko-agent');
  loadPolicy(data.policy);display((data.matches||[]).map(x=>({url:x.job_url,title:x.title,company:x.company,source:x.source,location:x.location,score:x.score,explanation:x.explanation})));
  const ran=data.runs?.[0];const seen=ran?.finished_at?new Date(ran.finished_at).toLocaleString('fr-FR'):'aucune analyse programmée terminée';
  status(data.policy?.enabled?'Veille autorisée · dernière exécution : '+seen:'Veille désactivée · analyse à la demande disponible.');
 }catch(e){status('Agent en attente : '+e.message,true);}
}
async function save(enabled){
 if(!authenticated)return status('Connectez votre compte avant de régler l’agent.',true);
 if(enabled&&!$('naConsent').checked)return status('Votre autorisation explicite est nécessaire pour activer la veille.',true);
 const data={action:'settings',enabled,consent:enabled&&$('naConsent').checked,
  minScore:Number($('naThreshold').value),remoteOnly:$('naRemote').checked,inclusiveOnly:$('naInclusive').checked,maxResults:20};
 try{await request('POST','/api/niko-agent',data);status(enabled?'Agent activé : recherches et recommandations autorisées, aucun envoi automatique.':'Agent arrêté. Les recommandations existantes restent accessibles.');await refresh();}
 catch(e){status(e.message,true);}
}
async function preview(){
 if(!authenticated)return status('Connectez votre compte pour lancer cette analyse.',true);
 $('naPreview').disabled=true;status('Analyse personnalisée en cours…');
 try{
  const data=await request('POST','/api/niko-agent',{action:'preview'});
  display(data.matches||[]);
  status('Analyse effectuée sur '+data.catalogSize+' offres récentes. Scores indicatifs, sans décision automatique.');
 }catch(e){status('Analyse indisponible : '+e.message,true);}
 finally{$('naPreview').disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('naThreshold').addEventListener('input',()=>{$('naThresholdValue').textContent=$('naThreshold').value;});
 $('naSave').onclick=()=>save($('naEnabled').checked);
 $('naStop').onclick=()=>{$('naEnabled').checked=false;save(false);};
 $('naPreview').onclick=preview;
 document.addEventListener('niko:session',refresh);
 refresh();
});
})();