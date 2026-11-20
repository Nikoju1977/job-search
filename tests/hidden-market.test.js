'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {validate,normalize,searchMarket}=require('../lib/hidden-market');
test('requires safe postal code, radius, sector and page before remote requests',()=>{
 assert.equal(validate({zip:'44520',radius:'20',sector:'N'}).radius,20);
 for(const q of [{zip:'bad'},{zip:'75001',radius:150},{zip:'44520',sector:'../../etc'},{page:1000}])
  assert.throws(()=>validate(q),/invalide|requis/);
});
test('normalization only creates verifiable public companies, not vacancy claims',()=>{
 assert.equal(normalize({siren:'not a siren',nom_complet:'X'}),null);
 const c=normalize({siren:'123456789',nom_complet:'Entreprise Exemple',etat_administratif:'A',
    nombre_etablissements:2,activite_principale:'81.21Z',matching_etablissements:[{code_postal:'44520',libelle_commune:'La Meilleraye-de-Bretagne'}]});
 assert.equal(c.name,'Entreprise Exemple');
 assert.equal(c.hiringConfirmed,false);
 assert.equal(c.kind,'entreprise_identifiee');
 assert.equal(c.directoryUrl,'https://annuaire-entreprises.data.gouv.fr/entreprise/123456789');
});
test('fetches only official Geo and company endpoints and never fabricates vacancies',async()=>{
 const requested=[];
 const mockFetch=async url=>{
  requested.push(new URL(url));
  if(String(url).startsWith('https://geo.api.gouv.fr/communes'))return {
   ok:true,json:async()=>[{nom:'Testville',population:100,centre:{coordinates:[-1.4,47.6]}}]
  };
  if(String(url).startsWith('https://recherche-entreprises.api.gouv.fr/near_point'))return {
   ok:true,json:async()=>({results:[
    {siren:'123456789',nom_complet:'Société locale',etat_administratif:'A',
      matching_etablissements:[{libelle_commune:'Testville',code_postal:'44520'}]},
    {siren:'123456789',nom_complet:'Société locale',etat_administratif:'A'},
    {siren:'987654321',nom_complet:'Société fermée',etat_administratif:'C'}
   ],total_results:3})
  };
  throw Error('Unexpected source '+url);
 };
 const out=await searchMarket({zip:'44520',radius:12,sector:'N',page:2},mockFetch);
 assert.equal(requested.length,2);
 assert.equal(requested[0].hostname,'geo.api.gouv.fr');
 assert.equal(requested[1].hostname,'recherche-entreprises.api.gouv.fr');
 assert.equal(requested[1].searchParams.get('radius'),'12');
 assert.equal(requested[1].searchParams.get('section_activite_principale'),'N');
 assert.equal(requested[1].searchParams.get('page'),'2');
 assert.equal(out.companies.length,1);
 assert.equal(out.companies[0].hiringConfirmed,false);
 assert.match(out.interpretation,/PAS d.offres/);
 assert.ok(!Object.prototype.hasOwnProperty.call(out,'jobs'));
});
test('unavailable official registry surfaces an error instead of invented employers',async()=>{
 const mock=async()=>({ok:false,status:429,json:async()=>({})});
 await assert.rejects(searchMarket({zip:'44300',radius:8,page:9},mock),/SOURCE_HTTP_429/);
});
test('public UI connects to the existing candidate studio without sending applications',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/marche-cache.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/marche-cache.js'),'utf8');
 const home=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(home,/marche-cache\.html/);
 assert.match(html,/radarForm/);
 assert.match(html,/Aucune offre ni probabilité/);
 assert.match(js,/niko_selected_job/);
 assert.match(js,/sessionStorage\.setItem/);
 assert.doesNotMatch(js,/gmail\.googleapis|messages\/send|fetch\(['"]https:\/\/api\.resend/);
});