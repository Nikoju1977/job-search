/* NIKO Intelligence Engine 3.0 — moteur local, transparent et sans profilage de santé. */
(function(root,factory){
 'use strict';
 const engine=factory();
 if(typeof module==='object'&&module.exports)module.exports=engine;
 if(root)root.NikoEngine=engine;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='3.0.0';
 const normalize=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/c\+\+/g,' cpp ').replace(/c#/g,' csharp ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
 const STOP=new Set('le la les de des du et ou un une a au aux en par sur pour dans avec sans chez nous vous vos votre notre leur leurs sont est etre faire avons avait ai mes mon ma ce cette poste offre besoin recherche candidat candidature disponible travail emploi equipe entreprise from with that this role are for the into have your jobs'.split(' '));
 const GROUPS={
  'excel':['excel','tableur','spreadsheet','power query','tableaux croises dynamiques','tcd'],
  'bureautique':['pack office','microsoft 365','office 365','word','powerpoint','outlook','google workspace'],
  'administration':['administratif','assistante administrative','assistant administratif','gestion administrative','secretariat','gestion de dossiers','back office'],
  'relation client':['relation client','service client','support client','customer success','customer service','satisfaction client'],
  'accueil':['accueil','reception','standard telephonique','hotellerie accueil'],
  'vente':['vente','vendeur','vendeuse','sales','commerce','commercial','conseiller de vente','retail'],
  'prospection':['prospection','developpement commercial','business development','b2b','b2c','lead generation'],
  'comptabilité':['comptabilite','comptable','saisie comptable','rapprochement bancaire','sage compta'],
  'facturation':['facturation','factures','devis'],
  'recrutement':['recrutement','ressources humaines','rh','hr','acquisition de talents','talent acquisition'],
  'paie':['paie','payroll','bulletins de salaire','silae'],
  'logistique':['logistique','supply chain','preparation de commandes','entrepot','cariste','approvisionnement'],
  'gestion de stocks':['stock','stocks','inventaire','gestion de stock','magasinier'],
  'gestion de projet':['gestion de projet','gestion projets','project management','chef de projet','coordination de projets','scrum','agile'],
  'management':['management','encadrement','gestion equipe','team lead','supervision equipe','manager'],
  'qualité':['qualite','controle qualite','assurance qualite','qa','qse','iso 9001'],
  'maintenance':['maintenance','technicien de maintenance','depannage','intervention technique','reparation'],
  'industrie':['industrie','industriel','production industrielle','usinage','cnc','machine outil'],
  'mécanique':['mecanique','mecanicien','mecanicienne','automobile','mecanique industrielle'],
  'électronique':['electronique','electricite','electrotechnique','cablage','electromecanique'],
  'santé':['sante','aide soignant','infirmier','infirmiere','soins','medico social'],
  'restauration':['restauration','cuisine','cuisinier','cuisiniere','service en salle','haccp'],
  'python':['python','pandas','django','flask','fastapi'],
  'javascript':['javascript','typescript','node js','nodejs','ecmascript'],
  'react':['react','reactjs','next js','nextjs'],
  'sql':['sql','postgresql','mysql','sqlite','transact sql'],
  'analyse de données':['data analysis','data analyst','analyse de donnees','data visualisation','power bi','tableau','reporting'],
  'design':['design','figma','ux ui','graphisme','photoshop','illustrator'],
  'marketing':['marketing','seo','sea','communication digitale','reseaux sociaux','social media'],
  'crm':['crm','salesforce','hubspot','dynamics 365','pipedrive'],
  'sap':['sap','erp sap'],
  'anglais':['anglais','english','bilingue anglais'],
  'espagnol':['espagnol','spanish','castillan'],
  'allemand':['allemand','german','deutsch'],
  'permis B':['permis b','permis de conduire b','permis voiture'],
  'télétravail':['teletravail','remote work','travail a distance','home office'],
  'accessibilité':['amenagement de poste','poste amenage','emploi inclusif','accessibilite'],
 };
 const NEGATION=/(?:pas|aucune?|sans|manque de|not|no)\s+(?:d[' ]|de\s+)?(?:experience|connaissance|pratique|maitrise)?\s*(?:en|avec|sur)?\s*$/;
 function containsToken(normText,token){
  const needle=normalize(token);
  return needle.length>=2&&(' '+normText+' ').includes(' '+needle+' ');
 }
 function skillSignals(text,{isCV=false}={}){
  const source=normalize(text);
  const found=[];
  for(const [canonical,aliases] of Object.entries(GROUPS)){
   const hits=aliases.filter(alias=>containsToken(source,alias));
   if(!hits.length)continue;
   if(isCV){
    const reliable=hits.some(alias=>{
     const at=(' '+source+' ').indexOf(' '+normalize(alias)+' ');
     const previous=source.slice(Math.max(0,at-75),at);
     return !NEGATION.test(previous);
    });
    if(!reliable)continue;
   }
   found.push(canonical);
  }
  return found;
 }
 function tokens(s){return [...new Set(normalize(s).split(' ').filter(x=>x.length>=3&&!STOP.has(x)))];}
 const ratio=(num,den)=>den?num/den:0;
 const cap=v=>Math.max(0,Math.min(100,Math.round(v)));
 function dateFreshness(job,now){
  const timestamp=Date.parse(job.date||job.publishedAt||'');
  if(!Number.isFinite(timestamp))return null;
  const days=(now-timestamp)/86400000;
  if(days< -1)return null;
  return days<=3?1:days<=7?.9:days<=15?.72:days<=30?.5:days<=60?.25:.08;
 }
 function locationMatch(profile,job){
  const target=normalize(profile.targetLocation||profile.location||'');
  const location=normalize(job.location||'');
  if(!target||/^(france|toute la france|partout|europe)$/.test(target))return {value:null,reason:'Zone géographique non restrictive'};
  if(location.includes(target)||target.includes(location)&&location.length>=4)return {value:1,reason:'Localisation compatible'};
  if(job.remote)return {value:.76,reason:'Télétravail indiqué : vérifier les conditions et le pays'};
  return {value:0,reason:'Localisation différente : vérifiez la mobilité'};
 }
 function classification(body,headers={}){
  const clean=normalize(String(body||'').slice(0,3500));
  const sender=normalize(headers.from||'');
  const auto=normalize(headers.autoSubmitted||'');
  if(!clean)return {category:'a_verifier',confidence:0,autoReplyAllowed:false,reason:'Message sans contenu exploitable'};
  if(/\b(noreply|no reply|mailer daemon|postmaster)\b/.test(sender)||/\b(auto generated|auto replied|bulk)\b/.test(auto))return {category:'automatique',confidence:1,autoReplyAllowed:false,reason:'Expéditeur ou message automatique'};
  const interview=/\b(entretien|interview|rendez vous|rdv|creneau|disponibilite|visioconference|rencontrer|echange telephonique|invitation)\b/.test(clean);
  const negative=/\b(malheureusement|non retenu|non retenue|pas retenu|pas retenue|non selectionne|pas donner suite|sans suite|refus|not selected|unsuccessful)\b/.test(clean);
  const positive=!negative&&/\b(retenu|retenue|selectionne|interesse|interessee|suite favorable|bonne nouvelle|felicitations|pleasure to invite)\b/.test(clean);
  const sensitive=/\b(contrat|signature|salaire|remuneration|piece d identite|rib|virement|paiement|urgent|disponibilites|date|horaire|offre ferme|promesse)\b/.test(clean);
  if(interview)return {category:'entretien',confidence:.88,autoReplyAllowed:false,reason:'Rendez-vous potentiel : validation humaine nécessaire'};
  if(positive&&negative)return {category:'a_verifier',confidence:.25,autoReplyAllowed:false,reason:'Signaux contradictoires'};
  if(negative)return {category:'defavorable',confidence:.87,autoReplyAllowed:false,reason:'Refus probable : relecture conseillée'};
  if(positive)return {category:'favorable',confidence:.77,autoReplyAllowed:false,reason:sensitive?'Engagement ou condition à vérifier':'Intérêt positif à confirmer'};
  return {category:'a_verifier',confidence:.3,autoReplyAllowed:false,reason:'Nature du message incertaine'};
 }
 function screen(profile,job,options={}){
  const cv=String(profile.cvText||'').slice(0,24000);
  const targetRole=String(profile.targetRole||'').slice(0,180);
  const ad=[job.title,job.excerpt,job.description||'',job.contract||''].filter(Boolean).join(' ').slice(0,6000);
  const cvSkills=skillSignals(cv,{isCV:true}).filter(x=>x!=='accessibilité');
  const jobSkills=skillSignals(ad).filter(x=>x!=='accessibilité');
  const matched=jobSkills.filter(x=>cvSkills.includes(x)), missing=jobSkills.filter(x=>!cvSkills.includes(x));
  const titleTokens=tokens(job.title),roleTokens=tokens(targetRole);
  const titleHits=roleTokens.filter(t=>titleTokens.includes(t));
  const roleMatch=roleTokens.length?ratio(titleHits.length,roleTokens.length):null;
  const crossRole=skillSignals(targetRole).filter(x=>jobSkills.includes(x)).length;
  const titleRating=roleMatch===null?null:Math.min(1,roleMatch+Math.min(.25,crossRole*.12));
  const skillCoverage=jobSkills.length?ratio(matched.length,jobSkills.length):null;
  const adTokens=new Set(tokens(ad));
  const cvKeywords=tokens(cv).filter(t=>t.length>3).slice(0,160);
  const keywordCoverage=cvKeywords.length?ratio(cvKeywords.filter(t=>adTokens.has(t)).length,Math.max(7,Math.min(20,cvKeywords.length))):null;
  const geo=locationMatch(profile,job),fresh=dateFreshness(job,options.now||Date.now());
  const axes=[
   {key:'métier',score:titleRating,weight:40},
   {key:'compétences',score:skillCoverage,weight:35},
   {key:'parcours',score:keywordCoverage,weight:10},
   {key:'localisation',score:geo.value,weight:10},
   {key:'fraîcheur',score:fresh,weight:5}
  ];
  const available=axes.filter(x=>x.score!==null);
  const evidenceWeight=available.reduce((n,x)=>n+x.weight,0);
  const noProfile=!targetRole&&normalize(cv).length<35;
  // Les axes absents ne sont pas comptés comme des preuves positives : une annonce courte réduit la fiabilité.
  const normalized=available.reduce((n,x)=>n+x.weight*x.score,0);
  const score=noProfile?null:cap(normalized+(100-evidenceWeight)*.35);
  const reliability=evidenceWeight>=85&&jobSkills.length>=2?'bonne':evidenceWeight>=65?'moyenne':'limitée';
  const reasons=[];
  if(titleHits.length)reasons.push('Métier ciblé : '+titleHits.join(', '));
  if(matched.length)reasons.push('Compétences présentes dans le CV : '+matched.slice(0,4).join(', '));
  if(roleTokens.length&&!titleHits.length)reasons.push('Intitulé différent du métier recherché');
  if(geo.value!==null)reasons.push(geo.reason);
  if(!jobSkills.length)reasons.push('Annonce courte : exigences non détaillées');
  if(job.remote)reasons.push('Télétravail mentionné dans la source');
  const watchouts=[];
  if(missing.length)watchouts.push('Compétences non repérées dans le CV : '+missing.slice(0,5).join(', '));
  if(geo.value===0)watchouts.push('Localisation à confirmer');
  if(/(?:acheter\s+un\s+kit|frais\s+de\s+dossier|paiement\s+avant\s+embauche|virement\s+pour\s+postuler)/i.test(ad))watchouts.push('Demande financière potentiellement inhabituelle : vérification nécessaire');
  const suitable=!noProfile&&score>=68&&!watchouts.some(x=>x.startsWith('Demande financière'));
  return {version:VERSION,score,reliability,axes:axes.map(x=>({name:x.key,value:x.score===null?null:cap(x.score*100),weight:x.weight})),shared:matched,missing,matchReasons:reasons,watchouts,eligible:suitable,inclusionMention:/\b(rqth|boeth|handicap|poste amenage|amenagement de poste|emploi inclusif)\b/.test(normalize(ad))};
 }
 function rank(profile,jobs,settings={}){
  if(!Array.isArray(jobs))return [];
  const list=jobs.slice(0,500).filter(j=>j&&j.title&&j.company&&/^https?:\/\//.test(String(j.url||'')));
  const seen=new Set();
  return list.map(job=>({job,fit:screen(profile,job,settings)})).filter(x=>{
   const key=normalize(x.job.url);if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>(b.fit.score??-1)-(a.fit.score??-1) || (Date.parse(b.job.date||'')||0)-(Date.parse(a.job.date||'')||0));
 }
 function plan(profile,jobs,options={}){
  const ranked=rank(profile,jobs,options),minScore=Math.max(0,Math.min(100,Number(options.minScore??68)));
  const ignored=new Set(options.ignoredUrls||[]),sent=new Set(options.sentUrls||[]);
  const recommended=ranked.filter(r=>r.fit.score!==null&&r.fit.score>=minScore&&!ignored.has(r.job.url)&&!sent.has(r.job.url)&&!r.fit.watchouts.some(x=>x.includes('financière')));
  return {scanned:ranked.length,recommended:recommended.slice(0,10),excludedAlreadySent:ranked.filter(r=>sent.has(r.job.url)).length,excludedIgnored:ranked.filter(r=>ignored.has(r.job.url)).length,humanApprovalRequired:true,automaticallySent:0};
 }
 return {VERSION,normalize,skillSignals,screen,rank,plan,classification};
});