/* Niko Emploi — no example/fake jobs; everything rendered comes from /api/jobs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {jobs:[], shown:10, savedOnly:false, saved:new Set(), apiResponse:null, loading:false};
  const storageKey = 'niko_emploi_favoris_v1';
  try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) state.saved = new Set(saved.filter(x=>typeof x==='string')); } catch (_) {}
  const escape = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const sourceNames = ['EasyJobs','Jobicy','Arbeitnow'];
  const number = n => new Intl.NumberFormat('fr-FR').format(n);
  function dateLabel(iso){
    if (!iso) return 'Date non communiquée';
    const d = new Date(iso); if (!Number.isFinite(d.getTime())) return 'Date non communiquée';
    const days = Math.floor((Date.now()-d.getTime())/(24*3600*1000));
    if (days===0) return "Aujourd'hui";
    if (days===1) return 'Hier';
    if (days>1 && days<30) return `Il y a ${days} j`;
    return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
  }
  function redrawSavedCounts(){
    $('savedCount').textContent = state.saved.size;
    $('favoritesInFilter').textContent = state.saved.size;
    $('allBtn').classList.toggle('active',!state.savedOnly);
    $('savedBtn').classList.toggle('active',state.savedOnly);
  }
  function favoritesPersist(){try{localStorage.setItem(storageKey,JSON.stringify([...state.saved]));}catch(_){}redrawSavedCounts();}
  function getVisible(){
    let items=state.savedOnly ? state.jobs.filter(j=>state.saved.has(j.id)) : [...state.jobs];
    if($('sortOrder').value==='company') items.sort((a,b)=>a.company.localeCompare(b.company,'fr'));
    return items;
  }
  function render(){
    redrawSavedCounts();
    const all=getVisible(), display=all.slice(0,state.shown);
    $('resultNumber').textContent = state.loading ? '—' : number(all.length);
    const target=$('jobList');
    if(state.loading){target.innerHTML='<div class="loading-state"><span class="loader"></span><h3>Nous interrogeons les plateformes…</h3><p>Seules les annonces réellement reçues seront affichées.</p></div>'; $('listFooter').hidden=true;return;}
    if(!all.length){
      target.innerHTML=`<div class="empty-state"><span class="empty-icon">${icon(state.savedOnly?'heart':'search')}</span><h3>${state.savedOnly?'Aucune annonce enregistrée':'Aucune offre trouvée dans les sources consultées'}</h3><p>${state.savedOnly?'Enregistrez vos annonces préférées avec le cœur présent sur chaque fiche.':'Essayez un mot-clé plus large ou une autre ville. Les résultats ne sont jamais inventés pour remplir la page.'}</p><button id="resetSearch">${state.savedOnly?'Afficher toutes les offres':'Effacer les filtres'}</button></div>`;
      const reset=$('resetSearch');reset?.addEventListener('click',()=>{if(state.savedOnly){state.savedOnly=false;render();}else{$('keyword').value='';$('location').value='Toute la France';$('remote').checked=false;$('filterContract').value='Tous';load();}});
      $('listFooter').hidden=true;return;
    }
    target.innerHTML=display.map(job=>{
      const saved=state.saved.has(job.id);
      const loc=job.location||'Lieu non précisé';
      const initials=(job.company.match(/[\p{L}\p{N}]+/gu)||[]).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join('').slice(0,2);
      const meta=[`<span>${icon('pin')}${escape(loc)}</span>`];
      if(job.contract)meta.push(`<span>${icon('briefcase')}${escape(job.contract)}</span>`);
      if(job.date)meta.push(`<span>${icon('clock')}${escape(dateLabel(job.date))}</span>`);
      const badges=[job.remote?'<span class="job-badge remote">Télétravail</span>':'',job.salary?`<span class="job-badge salary">${escape(job.salary)}</span>`:''].filter(Boolean).join('');
      return `<article class="job-card"><div class="job-head"><div class="company-avatar" aria-hidden="true">${escape(initials||'J')}</div><div class="job-title-col"><h3 class="job-title">${escape(job.title)}</h3><div class="job-company">${escape(job.company)}</div></div><button class="save-btn ${saved?'saved':''}" data-favorite="${escape(job.id)}" aria-label="${saved?'Retirer des favoris':'Ajouter aux favoris'}" title="${saved?'Retirer des favoris':'Ajouter aux favoris'}">${icon('heart')}</button></div><div class="job-detail">${meta.join('')}</div>${job.excerpt?`<p class="job-excerpt">${escape(job.excerpt)}</p>`:''}<div class="job-foot"><div class="job-badges">${badges}<span class="job-source">Source : ${job.source==="Himalayas"?`<a href="https://himalayas.app" rel="noopener noreferrer" target="_blank">Himalayas ↗</a>`:escape(job.source)}</span></div><a class="studio-job-btn" href="/candidatures.html" data-prepare="${escape(job.id)}">✦ Préparer ma candidature</a><a class="apply-link" href="${escape(job.url)}" rel="noopener noreferrer nofollow" target="_blank">Voir l'offre originale ${icon('arrowup')}</a></div></article>`;
    }).join('');
    for(const button of target.querySelectorAll('[data-favorite]'))button.addEventListener('click',()=>{
      const id=button.dataset.favorite;
      if(state.saved.has(id))state.saved.delete(id);else state.saved.add(id);
      favoritesPersist();render();
    });
    for(const link of target.querySelectorAll('[data-prepare]'))link.addEventListener('click',()=>{const job=state.jobs.find(j=>j.id===link.dataset.prepare);if(job)try{sessionStorage.setItem('niko_selected_job',JSON.stringify(job));}catch{}});
    $('listFooter').hidden=all.length<=state.shown;
    $('visibleCount').textContent=`${number(Math.min(all.length,state.shown))} sur ${number(all.length)} offres chargées`;
  }
  async function load(){
    state.shown=10;state.loading=true;state.savedOnly=false;
    $('sourceNotice').hidden=true;$('dedupTag').hidden=true;
    $('liveDot').className='live-dot muted';$('liveText').textContent='Chargement des sources';
    render();
    const params=new URLSearchParams();
    const q=$('keyword').value.trim(), location=$('location').value.trim()||'Toute la France';
    if(q)params.set('q',q);
    params.set('location',location);
    if($('remote').checked)params.set('remote','true');
    if($('filterContract').value!=='Tous')params.set('contract',$('filterContract').value);
    const url='/api/jobs?'+params.toString();
    try{
      const result=await fetch(url,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(32000)});
      if(!result.ok)throw new Error('HTTP '+result.status);
      const data=await result.json();
      if(!Array.isArray(data.jobs))throw new Error('Format de réponse invalide');
      state.jobs=data.jobs.filter(j=>j&&typeof j.url==='string'&&/^https?:\/\//.test(j.url));
      state.apiResponse=data;
      const activeSources=Object.keys(data.sources||{});
      const working=activeSources.filter(n=>data.sources[n]?.ok);
      $('liveText').textContent=working.length?`${working.length} source${working.length>1?'s':''} consultée${working.length>1?'s':''}`:'Aucune source disponible';
      $('liveDot').className='live-dot '+(working.length===activeSources.length?'':working.length?'error':'muted');
      $('retrievedDate').textContent=data.retrievedAt?'Données reçues le '+new Date(data.retrievedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'Dernière mise à jour indisponible';
      const removed=Number(data.duplicatesRemoved)||0;
      if(removed){$('dedupTag').hidden=false;$('dedupTag').textContent=`${number(removed)} doublon${removed>1?'s':''} écarté${removed>1?'s':''}`;}
      if(data.partial){
        $('sourceNotice').hidden=false;
        $('sourceNotice').textContent=working.length?'Certaines sources ne répondent pas. Les résultats affichés sont partiels.':'Aucune API n’a répondu. Le compteur reste à zéro jusqu’à une réponse réelle.';
      }
      $('providerList').innerHTML=activeSources.map(name=>{
        const source=data.sources?.[name];
        const ok=source?.ok;
        return `<div class="provider-row"><span class="provider-left"><span class="provider-mark">${escape(name[0])}</span>${escape(name)}</span><span class="provider-stat ${ok?'':'offline'}">${ok?`${number(source.received||0)} reçues`:'Indisponible'}</span></div>`;
      }).join('');
    }catch(error){
      state.jobs=[];state.apiResponse=null;
      $('liveDot').className='live-dot muted';$('liveText').textContent='Service momentanément indisponible';
      $('retrievedDate').textContent='Aucune donnée chargée';
      $('providerList').innerHTML='<p class="loading-label">La connexion aux sources a échoué.</p>';
      $('sourceNotice').hidden=false;$('sourceNotice').textContent='Impossible de joindre le moteur de recherche. Aucune offre fictive n’est affichée.';
    }finally {state.loading=false;render();}
  }
  function openDialog(){$('sourceDialog').showModal();}
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();load();$('offres').scrollIntoView({behavior:'smooth'});});
  $('filterContract').addEventListener('change',load);
  $('sortOrder').addEventListener('change',render);
  $('allBtn').addEventListener('click',()=>{state.savedOnly=false;state.shown=10;render();});
  $('savedBtn').addEventListener('click',()=>{state.savedOnly=true;state.shown=10;render();});
  $('showSaved').addEventListener('click',()=>{state.savedOnly=true;state.shown=10;render();$('offres').scrollIntoView({behavior:'smooth'});});
  $('moreBtn').addEventListener('click',()=>{state.shown+=10;render();});
  for(const chip of document.querySelectorAll('[data-search]'))chip.addEventListener('click',()=>{$('keyword').value=chip.dataset.search;load();$('offres').scrollIntoView({behavior:'smooth'});});
  for(const id of ['sourcesLink','sourceExplain','footerSources'])$(id).addEventListener('click',openDialog);
  $('closeDialog').addEventListener('click',()=>$('sourceDialog').close());
  $('sourceDialog').addEventListener('click',e=>{if(e.target===$('sourceDialog'))$('sourceDialog').close();});
  redrawSavedCounts();load();
})();