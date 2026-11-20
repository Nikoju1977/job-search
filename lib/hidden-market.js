'use strict';
// Public official APIs only: no hidden offers are claimed, generated or scraped.
const ALLOWED_SECTORS = new Set(['all','N','F','P','Q','R','J','G','H','I','C','M','S']);
const memory = new Map();
const TTL = 10 * 60 * 1000;
function validate(raw={}) {
  const zip=String(raw.zip||'44520').trim();
  if(!/^\d{5}$/.test(zip))throw Object.assign(new Error('Code postal français invalide.'),{status:400});
  const radius=Number(raw.radius||20);
  if(!Number.isInteger(radius)||radius<1||radius>50)throw Object.assign(new Error('Rayon entre 1 et 50 km requis.'),{status:400});
  const sector=String(raw.sector||'all');
  if(!ALLOWED_SECTORS.has(sector))throw Object.assign(new Error('Secteur invalide.'),{status:400});
  const commune=String(raw.commune||'').trim();
  if(commune.length>80||/[<>]/.test(commune))throw Object.assign(new Error('Nom de commune invalide.'),{status:400});
  const page=Number(raw.page||1);
  if(!Number.isInteger(page)||page<1||page>10)throw Object.assign(new Error('Page invalide.'),{status:400});
  return {zip,radius,sector,page,commune};
}
async function jsonGet(url,fetchFn=fetch) {
  const response=await fetchFn(url,{headers:{Accept:'application/json','User-Agent':'NikoEmploi/1.0 (public French business directory)'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new Error('SOURCE_HTTP_'+response.status);
  const data=await response.json();
  if(!data||typeof data!=='object')throw new Error('INVALID_SOURCE');
  return data;
}
const clean=(value,max=180)=>typeof value==='string'?value.replace(/[<>]/g,'').trim().slice(0,max):'';
function normalize(item) {
  const siren=String(item?.siren||'');
  if(!/^\d{9}$/.test(siren))return null;
  const label=clean(item.nom_complet||item.nom_raison_sociale||item.sigle||item.siege?.enseigne||'',160);
  if(!label)return null;
  const est=Array.isArray(item.matching_etablissements)?item.matching_etablissements[0]:null;
  const city=clean(est?.libelle_commune||est?.commune||item.siege?.libelle_commune||'',100);
  const postcode=clean(est?.code_postal||item.siege?.code_postal||'',5);
  const activity=clean(item.activite_principale||est?.activite_principale||'',12);
  const n=Number(item.nombre_etablissements);
  return {siren,name:label,city,postcode,activity,
    establishments:Number.isInteger(n)&&n>0?n:null,
    directoryUrl:'https://annuaire-entreprises.data.gouv.fr/entreprise/'+siren,
    kind:'entreprise_identifiee',hiringConfirmed:false};
}
async function searchMarket(raw={},fetchFn=fetch) {
  const options=validate(raw);
  const key=JSON.stringify(options),existing=memory.get(key);
  if(existing&&Date.now()-existing.time<TTL)return existing.data;
  const geo=new URL('https://geo.api.gouv.fr/communes');
  geo.searchParams.set('codePostal',options.zip);
  geo.searchParams.set('fields','nom,code,centre,population');
  geo.searchParams.set('format','json');
  const towns=await jsonGet(geo.toString(),fetchFn);
  if(!Array.isArray(towns)||!towns.length)throw Object.assign(new Error('Code postal non trouvé dans le référentiel officiel.'),{status:404});
  const centers=towns.filter(c=>Array.isArray(c.centre?.coordinates)&&c.centre.coordinates.length===2);
  if(!centers.length)throw new Error('LOCALISATION_INDISPONIBLE');
  const normCity=value=>String(value||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  centers.sort((a,b)=>(Number(b.population)||0)-(Number(a.population)||0));
  const center=options.commune?centers.find(c=>normCity(c.nom)===normCity(options.commune)):centers[0];
  if(!center)throw Object.assign(new Error('Commune introuvable pour ce code postal.'),{status:404});
  const [lon,lat]=center.centre.coordinates;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error('LOCALISATION_INDISPONIBLE');
  const params=new URLSearchParams({lat:String(lat),long:String(lon),radius:String(options.radius),page:String(options.page),per_page:'20'});
  if(options.sector!=='all')params.set('section_activite_principale',options.sector);
  const result=await jsonGet('https://recherche-entreprises.api.gouv.fr/near_point?'+params,fetchFn);
  if(!Array.isArray(result.results))throw new Error('FORMAT_ENTREPRISES_INATTENDU');
  const companies=[],seen=new Set();
  for(const rawCompany of result.results) {
    if(rawCompany.etat_administratif&&rawCompany.etat_administratif!=='A')continue;
    const c=normalize(rawCompany);
    if(c&&!seen.has(c.siren)){companies.push(c);seen.add(c.siren);}
  }
  const total=Number(result.total_results);
  const data={
    companies,count:companies.length,totalReported:Number.isFinite(total)&&total>=0?total:null,
    center:{name:clean(center.nom,100),zip:options.zip},
    radiusKm:options.radius,sector:options.sector,page:options.page,
    nextPage:result.next_page===true || (Number.isFinite(total)&&options.page*20<total&&options.page<10),
    retrievedAt:new Date().toISOString(),
    interpretation:'Établissements réels repérés dans des registres publics. Il ne s’agit PAS d’offres d’emploi ni de probabilités de recrutement.',
    sources:['API Géo (DINUM)','API Recherche d’entreprises (DINUM / Insee)'],
    externalServices:{laBonneBoite:'Accès API soumis à habilitation France Travail; non connecté.',bmo:'Enquête 2026 disponible en consultation externe.'}
  };
  memory.set(key,{time:Date.now(),data});
  if(memory.size>40)memory.delete(memory.keys().next().value);
  return data;
}
module.exports={validate,normalize,searchMarket,ALLOWED_SECTORS};