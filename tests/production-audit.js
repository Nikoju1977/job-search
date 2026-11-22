'use strict';
/* Audit de la production Niko Emploi : GET publics uniquement, sans données de candidats. */
const fs=require('node:fs/promises');
const BASE='https://niko-emploi.vercel.app';
const CACHE='niko-emploi-shell-v6-radar-recovery-20261122';
const CHECKS=[
 {key:'accueil',path:'/',mime:/text\/html/,check:s=>s.includes('Niko Emploi')&&s.includes('href="/styles.css"')},
 {key:'marche-cache',path:'/marche-cache.html',mime:/text\/html/,check:s=>s.includes('id="radarForm"')&&s.includes('marche-cache.js')},
 {key:'candidatures',path:'/candidatures.html',mime:/text\/html/,check:s=>s.includes('id="letterText"')&&s.includes('id="generateBtn"')},
 {key:'recherche-js',path:'/app.js',mime:/javascript/,check:s=>s.includes('search-coverage')&&s.includes('widenSearch')&&s.includes('officialSearch')},
 {key:'radar-js',path:'/marche-cache.js',mime:/javascript/,check:s=>s.includes('radarForm')},
 {key:'suivi-js',path:'/radar-suivi.js',mime:/javascript/,check:s=>s.includes('niko_radar_prospection_v1')},
 {key:'styles',path:'/styles.css',mime:/text\/css/,check:s=>s.includes('body')},
 {key:'cache-pwa',path:'/sw.js',mime:/javascript/,check:s=>s.includes(CACHE)&&s.includes("url.pathname.startsWith('/api/')")},
 {key:'configuration',path:'/api/config',mime:/json/,check:s=>{
   try{const x=JSON.parse(s);return typeof x.aiConfigured==='boolean'&&typeof x.gmailConfigured==='boolean';}
   catch{return false;}
 }}
];
async function audit(fetchFn=globalThis.fetch){
 const results=await Promise.all(CHECKS.map(async c=>{
  try{
   const response=await fetchFn(new URL(c.path,BASE).href,{
    method:'GET',redirect:'follow',signal:AbortSignal.timeout(15000),
    headers:{Accept:'*/*','Cache-Control':'no-cache'}
   });
   const type=response.headers?.get('content-type')||'';
   const payload=await response.text();
   const passed=response.status===200&&c.mime.test(type)&&c.check(payload);
   return {key:c.key,path:c.path,http_status:response.status,verified:passed,
    reason:passed?'HTTP 200, type MIME et marqueur vérifiés':
      !c.mime.test(type)?'Type MIME inattendu':response.status!==200?'Réponse HTTP '+response.status:'Marqueur manquant ou version périmée'};
  }catch(error){return {key:c.key,path:c.path,http_status:null,verified:false,reason:'Ressource inaccessible : '+String(error.message||error).slice(0,140)};}
 }));
 const successful=results.filter(x=>x.verified).length;
 return {schema:1,checked_at:new Date().toISOString(),origin:BASE,
   status:successful===CHECKS.length?'http_verified':results.some(x=>x.http_status===null)?'partially_unreachable':'outdated_or_incomplete',
   passed:successful,total:CHECKS.length,
   scope:'HTTP public seulement ; aucune offre en temps réel, aucun envoi de candidature, aucune vérification mobile réelle',
   results};
}
function summary(report){
 return ['### Niko Emploi — preuves HTTP publiques',
  '**'+report.status+'** : '+report.passed+'/'+report.total+' ressources · '+report.checked_at,
  '', '| Ressource | Statut HTTP | Validation |', '|---|---:|---|',
  ...report.results.map(x=>'| `'+x.path+'` | '+(x.http_status??'—')+' | '+(x.verified?'vérifié':x.reason.replaceAll('|','/'))+' |'),
  '','Contrôle HTTP seulement : les annonces, services d’emploi externes, candidatures et tests sur téléphone exigent des validations indépendantes.',''].join('\n');
}
async function main(){
 const result=await audit();
 console.log(JSON.stringify(result,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary(result)+'\n');
 if(process.env.NIKO_JOB_AUDIT_REPORT)await fs.writeFile(process.env.NIKO_JOB_AUDIT_REPORT,JSON.stringify(result,null,2)+'\n');
 if(result.status!=='http_verified'){
  console.log('::warning::Production Niko Emploi à contrôler : '+result.status+' ('+result.passed+'/'+result.total+')');
  if(process.env.NIKO_JOB_AUDIT_STRICT==='1')process.exitCode=1;
 }
}
module.exports={audit,summary,BASE,CACHE,CHECKS};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
