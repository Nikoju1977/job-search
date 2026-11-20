/* Niko Emploi / Radar — personal outreach register, local to this browser.
   Nothing is transmitted to recruiters or to Niko Emploi servers. */
(() => {
 'use strict';
 const KEY='niko_radar_prospection_v1';
 const MAX=300;
 const statuses=Object.freeze({
  reperee:'À étudier',
  cibler:'À contacter',
  contactee:'Contactée (déclaré)',
  relance:'Relance à préparer',
  reponse:'Réponse reçue (déclaré)',
  terminee:'Clôturée'
 });
 const $=id=>document.getElementById(id);
 let items=[];
 const create=(tag,cl,text)=>{
   const e=document.createElement(tag);
   if(cl)e.className=cl;
   if(text!==undefined)e.textContent=String(text);
   return e;
 };
 function validRecord(c){
  if(!c||!/^\d{9}$/.test(String(c.siren||'')))return false;
  if(typeof c.name!=='string'||!c.name.trim())return false;
  return true;
 }
 function safeDate(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
   !Number.isNaN(Date.parse(value+'T00:00:00Z'))?value:'';
 }
 function sanitize(item){
  return {
   siren:String(item.siren),name:String(item.name).slice(0,160),
   city:String(item.city||'').slice(0,100),postcode:String(item.postcode||'').slice(0,5),
   directoryUrl:'https://annuaire-entreprises.data.gouv.fr/entreprise/'+item.siren,
   stage:statuses[item.stage]?item.stage:'reperee',nextAction:safeDate(item.nextAction),
   note:String(item.note||'').slice(0,800),
   role:String(item.role||'').slice(0,100),
   lbbChecked:item.lbbChecked===true,updatedAt:String(item.updatedAt||'').slice(0,30)
  };
 }
 function read(){
  try{
   const parsed=JSON.parse(localStorage.getItem(KEY)||'[]');
   items=Array.isArray(parsed)?parsed.filter(validRecord).slice(0,MAX).map(sanitize):[];
  }catch{items=[];notice('Données locales illisibles : aucun dossier importé.',true)}
 }
 function write(next){
  const serialized=JSON.stringify(next);
  try{
   localStorage.setItem(KEY,serialized);
   items=next;
   return true;
  }catch{notice('Échec du stockage local. Le changement n’a pas été enregistré : exportez vos dossiers.',true);return false}
 }
 function notice(message,error=false){
  const node=$('trackerNotice');
  if(!node)return;
  node.textContent=message;
  node.style.color=error?'#a53633':'#4d6080';
 }
 const today=()=>new Date().toISOString().slice(0,10);
 function isDue(item){return item.nextAction&&item.nextAction<=today()&&item.stage!=='terminee'}
 function saveCompany(company,role=''){
  if(!validRecord(company))return false;
  const previous=items.find(x=>x.siren===company.siren);
  if(previous){notice('Cette entreprise est déjà dans votre suivi.');return true}
  if(items.length>=MAX){notice('Limite de '+MAX+' entreprises atteinte : archivez ou exportez les dossiers.',true);return false}
  const record=sanitize({...company,stage:'reperee',note:'',role,nextAction:'',lbbChecked:false,updatedAt:new Date().toISOString()});
  if(!write([record,...items]))return false;
  notice(company.name+' ajoutée à votre liste privée. Aucun message envoyé.');
  render();
  return true;
 }
 function update(siren,patch){
  const old=items.find(x=>x.siren===siren);
  if(!old)return false;
  const next=items.map(item=>item.siren!==siren?item:sanitize({...item,...patch,updatedAt:new Date().toISOString()}));
  if(!write(next))return false;
  notice('Dossier mis à jour localement. Aucun message envoyé.');
  render();
  return true;
 }
 function remove(siren){
  const old=items.find(x=>x.siren===siren);
  if(!old||!confirm('Retirer '+old.name+' de votre suivi local ?'))return;
  const next=items.filter(x=>x.siren!==siren);
  if(write(next)){notice('Dossier retiré.');render()}
 }
 function details(item){
  const panel=create('details','tracker-detail');
  const summary=create('summary','',item.name+' · '+item.city);
  panel.append(summary);
  const form=create('form','tracker-edit');
  const stageLabel=create('label','', 'État de la démarche');
  const stageSelect=create('select');stageSelect.name='stage';
  for(const [key,title] of Object.entries(statuses)){
   const option=create('option','',title);option.value=key;
   if(key===item.stage)option.selected=true;
   stageSelect.append(option);
  }stageLabel.append(stageSelect);
  const dateLabel=create('label','', 'Prochaine action / relance');
  const dateInput=create('input');dateInput.type='date';dateInput.value=item.nextAction;
  dateLabel.append(dateInput);
  const roleLabel=create('label','', 'Métier visé');
  const roleInput=create('input');roleInput.type='text';roleInput.maxLength=100;roleInput.value=item.role;
  roleLabel.append(roleInput);
  const notesLabel=create('label','', 'Notes personnelles (non chiffrées sur cet appareil)');
  const notesInput=create('textarea');notesInput.maxLength=800;notesInput.rows=3;notesInput.value=item.note;
  notesLabel.append(notesInput);
  const checkedLabel=create('label','tracker-check','');
  const checkedInput=create('input');checkedInput.type='checkbox';checkedInput.checked=item.lbbChecked;
  checkedLabel.append(checkedInput,document.createTextNode('J’ai consulté moi-même La Bonne Boîte (non vérifié automatiquement)'));
  form.append(stageLabel,dateLabel,roleLabel,notesLabel,checkedLabel);
  const buttons=create('div','radar-actions');
  const save=create('button','radar-action primary','Enregistrer le suivi');save.type='submit';
  const official=create('a','radar-action','Fiche officielle ↗');
  official.href=item.directoryUrl;official.target='_blank';official.rel='noopener noreferrer';
  const lbb=create('a','radar-action','Consulter La Bonne Boîte ↗');
  lbb.href='https://labonneboite.francetravail.fr/';lbb.target='_blank';lbb.rel='noopener noreferrer';
  const erase=create('button','radar-action','Retirer');erase.type='button';erase.addEventListener('click',()=>remove(item.siren));
  buttons.append(save,official,lbb,erase);form.append(buttons);
  form.addEventListener('submit',event=>{
   event.preventDefault();
   update(item.siren,{stage:stageSelect.value,nextAction:dateInput.value,role:roleInput.value,
    note:notesInput.value,lbbChecked:checkedInput.checked});
  });
  panel.append(form);
  if(isDue(item))panel.prepend(create('span','tracker-due','Action à effectuer'));
  return panel;
 }
 function render(){
  const list=$('trackerList');if(!list)return;
  list.replaceChildren();
  const filter=$('trackerFilter')?.value||'all';
  const records=items.filter(item=>filter==='all'||filter==='due'&&isDue(item)||filter===item.stage);
  records.sort((a,b)=>Number(isDue(b))-Number(isDue(a))||a.name.localeCompare(b.name,'fr'));
  $('trackerCount').textContent=String(items.length);
  $('trackerDueCount').textContent=String(items.filter(isDue).length);
  $('trackerExport').disabled=!items.length;
  $('trackerJSON').disabled=!items.length;
  if(!items.length){list.append(create('p','', 'Aucune entreprise enregistrée. Utilisez « Suivre » sur une fiche du radar.'));return}
  if(!records.length){list.append(create('p','', 'Aucun dossier pour ce filtre.'));return}
  for(const item of records)list.append(details(item));
 }
 function csvCell(value){
  let str=String(value??'');
  if(/^\s*[=+\-@]/.test(str))str="'"+str;
  return '"'+str.replace(/"/g,'""')+'"';
 }
 function download(name,text,type){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=create('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 }
 function exportCSV(){
  const keys=['siren','name','city','postcode','stage','role','nextAction','lbbChecked','note','directoryUrl'];
  const header=['SIREN','Entreprise','Ville','Code postal','Étape','Métier visé','Prochaine action','La Bonne Boîte consultée (déclaration)','Notes','Fiche officielle'];
  const rows=[header.map(csvCell).join(';'),...items.map(item=>keys.map(key=>csvCell(item[key])).join(';'))];
  download('niko-radar-suivi-'+today()+'.csv','\uFEFF'+rows.join('\r\n'),'text/csv;charset=utf-8');
  notice('Suivi exporté. Le fichier contient vos notes : conservez-le dans un emplacement privé.');
 }
 function exportJSON(){
  download('niko-radar-sauvegarde-'+today()+'.json',JSON.stringify({version:1,records:items},null,2),'application/json');
  notice('Sauvegarde locale exportée. Aucun fichier envoyé au serveur.');
 }
 function importJSON(file){
  if(!file||file.size>1024*1024){notice('Sauvegarde trop volumineuse (maximum 1 Mo).',true);return}
  file.text().then(text=>{
   const parsed=JSON.parse(text);
   if(parsed?.version!==1||!Array.isArray(parsed.records))throw Error('Format non reconnu');
   if(parsed.records.length>MAX)throw Error('Limite de '+MAX+' dossiers');
   if(!parsed.records.every(validRecord))throw Error('Entreprise invalide');
   const combined=new Map(items.map(x=>[x.siren,x]));
   for(const record of parsed.records)combined.set(String(record.siren),sanitize(record));
   if(combined.size>MAX)throw Error('Limite de '+MAX+' dossiers après fusion');
   if(!confirm('Importer '+parsed.records.length+' dossiers ? Les SIREN identiques seront remplacés.'))return;
   if(write([...combined.values()])){render();notice('Sauvegarde importée localement.')}
  }).catch(()=>notice('Échec de lecture de la sauvegarde JSON.',true));
 }
 function decorate(company,actions){
  if(!validRecord(company)||!actions)return;
  const btn=create('button','radar-action','Suivre cette entreprise');
  btn.type='button';
  btn.addEventListener('click',()=>{
   saveCompany(company,$('role')?.value.trim()||'');
   if($('radarTracker'))$('radarTracker').scrollIntoView({behavior:'smooth',block:'start'});
  });
  actions.append(btn);
 }
 function init(){
  read();render();
  $('trackerFilter')?.addEventListener('change',render);
  $('trackerExport')?.addEventListener('click',exportCSV);
  $('trackerJSON')?.addEventListener('click',exportJSON);
  $('trackerImport')?.addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importJSON(file);event.target.value=''});
  window.addEventListener('storage',event=>{if(event.key===KEY){read();render();notice('Suivi actualisé depuis un autre onglet.')}});
 }
 window.NikoRadarTracker={decorate,render,saveCompany};
 document.addEventListener('DOMContentLoaded',init);
})();
