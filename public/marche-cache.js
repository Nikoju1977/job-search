/* Niko Emploi — prospecting evidence is a public establishment, never a claimed vacancy. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={companies:[],page:1,next:false,busy:false,request:0,last:null};
const el=(tag,cl,text)=>{
 const node=document.createElement(tag);
 if(cl)node.className=cl;
 if(text!==undefined)node.textContent=String(text);
 return node;
};
function status(message,error=false){
 $('status').textContent=message;
 $('status').style.color=error?'#a53633':'#4e5f75';
}
function button(text,onClick,kind=''){
 const b=el('button','radar-action'+(kind?' '+kind:''),text);
 b.type='button';b.addEventListener('click',onClick);
 return b;
}
function link(text,url) {
 const a=el('a','radar-action',text);
 a.href=url;a.rel='noopener noreferrer nofollow';a.target='_blank';
 return a;
}
function newMessage(company,role) {
 return 'Objet : Candidature spontanée — '+role+'\n\nBonjour,\n\nJe me permets de vous contacter afin de vous proposer ma candidature spontanée pour un poste de '+role+' au sein de '+company.name+'.\n\nJe serais heureux(se) de vous présenter mon expérience et d\'échanger sur vos besoins éventuels.\n\nBien cordialement,\n[Votre nom]';
}
function prepare(company){
 const role=$('role').value.trim()||'poste à définir';
 const selected={title:'Candidature spontanée — '+role,company:company.name,
   location:[company.postcode,company.city].filter(Boolean).join(' '),
   source:'Entreprise repérée — aucun recrutement confirmé',
   url:company.directoryUrl,excerpt:'Démarche spontanée. Vérifiez les besoins de recrutement directement auprès de l’entreprise.',contract:'Non communiqué',remote:false};
 try{
  sessionStorage.setItem('niko_selected_job',JSON.stringify(selected));
  window.location.assign('/candidatures.html');
 }catch{
  status('Stockage de session indisponible : ouvrez le Studio et renseignez manuellement l’entreprise.',true);
 }
}
function render(){
 const items=state.companies,container=$('companyList');
 container.replaceChildren();
 $('resultCount').textContent=state.last?'('+items.length+' affichées)':'';
 $('exportButton').disabled=!items.length;
 $('prevPage').disabled=state.busy||state.page===1;
 $('nextPage').disabled=state.busy||!state.next;
 $('pageNumber').textContent='Page '+state.page;
 if(!state.last)return;
 $('resultMeta').textContent=state.last.center.name+' ('+state.last.center.zip+') · '+state.last.radiusKm+' km · données consultées '+new Date(state.last.retrievedAt).toLocaleString('fr-FR');
 if(!items.length) {
  container.append(el('p','', 'Aucun établissement trouvé avec ces critères. Essayez un rayon plus large ou « Tous les secteurs ».'));
  return;
 }
 for(const c of items){
  const card=el('article','radar-company');
  card.append(el('h3','',c.name));
  const meta=el('div','meta');
  meta.append(el('span','',([c.postcode,c.city].filter(Boolean).join(' ')||'Localisation non communiquée')),
    el('span','','SIREN '+c.siren));
  if(c.activity)meta.append(el('span','','NAF '+c.activity));
  if(c.establishments)meta.append(el('span','',c.establishments+' établissement(s) déclaré(s)'));
  card.append(meta,el('p','','Piste de candidature spontanée : aucun poste ouvert confirmé par cette source.'));
  const actions=el('div','radar-actions');
  actions.append(link('Fiche officielle ↗',c.directoryUrl));
  actions.append(button('Préparer une candidature',()=>prepare(c),'primary'));
  actions.append(button('Copier un message',async()=>{
   try{await navigator.clipboard.writeText(newMessage(c,$('role').value.trim()||'poste à définir'));status('Brouillon copié. Aucun message envoyé.');}
   catch{status('Copie indisponible : vérifiez les autorisations du navigateur.',true);}
  }));
  card.append(actions);container.append(card);
 }
}
async function run(page=1){
 if(state.busy)return;
 const zip=$('zip').value.trim();
 if(!/^\d{5}$/.test(zip)){status('Renseignez un code postal à 5 chiffres.',true);return;}
 const params=new URLSearchParams({zip,radius:$('radius').value,sector:$('sector').value,page:String(page)});
 const id=++state.request;state.busy=true;
 $('searchButton').disabled=true; $('searchButton').textContent='Recherche en cours…';
 status('Consultation des registres officiels…');
 try{
  const response=await fetch('/api/hidden-market?'+params,{cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Service indisponible ('+response.status+')');
  if(id!==state.request)return;
  if(!Array.isArray(data.companies))throw Error('Données publiques incomplètes.');
  state.page=page;state.companies=data.companies;state.next=data.nextPage===true;state.last=data;
  status(data.companies.length?'Entreprises identifiées dans les registres publics. Aucune offre confirmée.':'Aucun résultat sur cette page.');
 }catch(error){
  state.companies=[];state.last=null;state.next=false;state.page=page;
  $('resultMeta').textContent='La recherche n’a pas retourné de données vérifiées.';
  status(error.message||'Service indisponible.',true);
 }finally{
  state.busy=false;$('searchButton').disabled=false;$('searchButton').textContent='Repérer des entreprises';
  render();
 }
}
function csvCell(value){
 let text=String(value??'');
 if(/^[\s]*[=+@\-]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function exportCSV(){
 if(!state.companies.length)return;
 const columns=['name','siren','city','postcode','activity','directoryUrl'];
 const rows=[['Entreprise','SIREN','Ville','Code postal','NAF','Fiche officielle'].map(csvCell).join(';')];
 rows.push(...state.companies.map(c=>columns.map(key=>csvCell(c[key])).join(';')));
 const blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=el('a');
 a.href=url;a.download='niko-emploi-entreprises-'+$('zip').value.trim()+'-p'+state.page+'.csv';
 document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
 status('Liste exportée : entreprises réelles, sans prétendre qu’elles recrutent.');
}
$('radarForm').addEventListener('submit',event=>{event.preventDefault();run(1);});
$('prevPage').addEventListener('click',()=>run(state.page-1));
$('nextPage').addEventListener('click',()=>run(state.page+1));
$('exportButton').addEventListener('click',exportCSV);
// Do not automatically contact or send personal information to employers.
render();
})();