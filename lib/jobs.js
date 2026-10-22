'use strict';

const { createHash } = require('node:crypto');
const SOURCES = ['EasyJobs', 'Jobicy', 'Arbeitnow', 'Himalayas', 'Adzuna', 'Greenhouse'];
const CACHE_TTL_MS = 1000 * 60 * 5;
const cache = new Map();
const providerCache = new Map();
const PROVIDER_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

function text(value) {
  if (typeof value === 'string') return value.trim();
  return value == null ? '' : String(value).trim();
}
function cleanHTML(value) {
  return text(value).replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
}
function norm(value) {
  return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(sarl|sas|sa|sasu|ltd|inc|corp|gmbh|limited)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function safeURL(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.toString() : null; }
  catch { return null; }
}
function urlFingerprint(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '').toLowerCase();
    // Ignore only proven tracker keys, never a meaningful job ID in ?id=... .
    const identifying = [...u.searchParams.entries()].filter(([key]) => !/^(utm_|mtm_|fbclid$|gclid$|msclkid$)/i.test(key)).sort(([a],[b])=>a.localeCompare(b));
    return host + path + (identifying.length ? '?' + new URLSearchParams(identifying).toString() : '');
  } catch { return ''; }
}
function cleanDate(value) {
  if (!value) return null;
  const d = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  if (d.getTime() > Date.now() + 86400000) return null;
  return d.toISOString();
}
function salaryText(min, max, curr, period) {
  const vals = [Number(min), Number(max)].filter(v => Number.isFinite(v) && v > 0);
  if (!vals.length) return '';
  const amount = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
  const range = vals.length > 1 && vals[0] !== vals[1] ? `${amount(vals[0])}–${amount(vals[1])}` : amount(vals[0]);
  return `${range} ${curr || ''}${/year|annual/i.test(period || '') ? '/an' : /hour/i.test(period || '') ? '/h' : ''}`.trim();
}
function compactJob(raw) {
  const url = safeURL(raw.url);
  const title = text(raw.title), company = text(raw.company), location = text(raw.location);
  if (!url || !title || !company || !location || !SOURCES.includes(raw.source)) return null;
  const contract = text(raw.contract).slice(0, 70);
  const id = createHash('sha256').update(raw.source + ':' + text(raw.providerId || url)).digest('hex').slice(0, 18);
  return {
    id, title: title.slice(0, 180), company: company.slice(0, 150), location: location.slice(0, 160),
    source: raw.source, url, remote: Boolean(raw.remote), contract,
    ...(raw.source === 'Himalayas' ? {sourceUrl:'https://himalayas.app'} : {}),
    salary: text(raw.salary).slice(0, 90), date: cleanDate(raw.date),
    excerpt: cleanHTML(raw.excerpt).slice(0, 360), collectedAt: new Date().toISOString(),
  };
}
function normaliseEasy(raw) {
  return compactJob({source: 'EasyJobs', providerId: raw.id, title: raw.title, company: raw.company,
    location: raw.location || 'France', url: raw.job_url, contract: raw.contract_type || raw.work_hours,
    salary: raw.salary, date: raw.published_at, excerpt: raw.description_excerpt,
    remote: /télétravail|remote|distance/i.test([raw.location, raw.description_excerpt].join(' '))});
}
function eligibleJobicy(job) {
  // The Europe API returns Spain-only, Germany-only, etc. jobs too. Exclude them.
  const geo = norm(job.location);
  return /\b(france|europe|european union|emea|worldwide|anywhere|global|international|eu)\b/.test(geo);
}
function normaliseJobicy(raw) {
  return compactJob({source: 'Jobicy', providerId: raw.id, title: raw.jobTitle, company: raw.companyName,
    location: raw.jobGeo || 'Télétravail international', url: raw.url,
    contract: Array.isArray(raw.jobType) ? raw.jobType.join(' / ') : raw.jobType,
    salary: salaryText(raw.salaryMin, raw.salaryMax, raw.salaryCurrency, raw.salaryPeriod),
    date: raw.pubDate, excerpt: raw.jobExcerpt || raw.jobDescription, remote: true});
}
function normaliseArbeitnow(raw) {
  return compactJob({source: 'Arbeitnow', providerId: raw.slug || raw.url, title: raw.title, company: raw.company_name,
    location: raw.location || 'Europe', url: raw.url,
    contract: Array.isArray(raw.job_types) ? raw.job_types.join(' / ') : '',
    date: raw.created_at, excerpt: raw.description, remote: raw.remote});
}
function eligibleArbeitnow(job) {
  // Avoid describing a Germany-only position as a job in France.
  const loc = norm(job.location);
  return /\b(france|paris|nantes|lyon|bordeaux|lille|marseille|toulouse|rennes|strasbourg|nice|montpellier|french)\b/.test(loc)
    || (job.remote && /\b(europe|eu|emea|worldwide|anywhere|global|international|remote)\b/.test(loc));
}
function dedupe(jobs) {
  // Exact links first, then company+job title+location. Separate postings in different cities are retained.
  const urls = new Set(), fingerprints = new Set(), out = [];
  for (const job of jobs) {
    if (!job) continue;
    const u = urlFingerprint(job.url);
    const core = [norm(job.company), norm(job.title)].join('|');
    const location = norm(job.location)
      .replace(/\b(teletravail|remote|hybride|hybrid|onsite|full time|part time|france|europe|emea|anywhere|worldwide)\b/g, ' ').trim();
    // Location is part of identity; only merge the same role in the same location.
    const fp = `${core}|${location || (job.remote ? 'remote' : 'inconnu')}`;
    if (urls.has(u) || fingerprints.has(fp)) continue;
    urls.add(u); fingerprints.add(fp); out.push(job);
  }
  return {jobs: out, removed: jobs.filter(Boolean).length - out.length};
}
async function fetchJson(url, timeout = 10000, extraHeaders = {}) {
  const response = await fetch(url, {headers: {'Accept': 'application/json', 'User-Agent': 'NikoEmploi/1.0 (job search aggregator; source attribution)', ...extraHeaders},
    signal: AbortSignal.timeout(timeout)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}
async function easyJobs(query, location) {
  const parameters = new URLSearchParams({limit:'50', page:'1'});
  if (query) parameters.set('query', query);
  if (location && !/^toute la france$|^france$/i.test(location)) parameters.set('location', location);
  // Respect API pagination, no invented total count.
  const first = await fetchJson(`https://api.easyjobs.fr/public/v1/jobs/search?${parameters}`, 11000);
  if (!Array.isArray(first.data)) throw new Error('Format de réponse inattendu');
  const all = first.data;
  if (first.pagination?.has_next_page) {
    parameters.set('page', '2');
    try {
      const second = await fetchJson(`https://api.easyjobs.fr/public/v1/jobs/search?${parameters}`, 10000);
      if (Array.isArray(second.data)) all.push(...second.data);
    } catch { /* page 1 is still genuine and usable */ }
  }
  return all.map(normaliseEasy).filter(Boolean);
}
async function jobicy() {
  // A Europe search may contain Spain-only roles: filter eligibility explicitly.
  const feeds = await Promise.allSettled([
    fetchJson('https://jobicy.com/api/jobs?count=200&geo=europe', 11000),
    fetchJson('https://jobicy.com/api/jobs?count=200&geo=france', 11000)
  ]);
  const raw = feeds.filter(x=>x.status==='fulfilled' && Array.isArray(x.value.jobs)).flatMap(x=>x.value.jobs);
  if (!raw.length && feeds.every(x=>x.status==='rejected')) throw new Error('Source inaccessible');
  return raw.map(normaliseJobicy).filter(Boolean).filter(eligibleJobicy);
}

async function arbeitnow() {
  const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api', 11000);
  if (!Array.isArray(data.data)) throw new Error('Format de réponse inattendu');
  return data.data.map(normaliseArbeitnow).filter(Boolean).filter(eligibleArbeitnow);
}

/* Himalayas: free JSON jobs API. Country=FR includes listings eligible for France,
   plus worldwide roles; never transform a US-only restriction into a France job.
   Do not send these listings to third-party job aggregators. */
function franceAllowed(restrictions) {
 if (!Array.isArray(restrictions)) return false;
 if (!restrictions.length) return true; // Provider explicitly declares worldwide.
 return restrictions.some(x => {
  const value=typeof x==='string'?x: [x.alpha2,x.name,x.slug].filter(Boolean).join(' ');
  return /\b(fr|france)\b/i.test(value);
 });
}
function franceTimezoneAllowed(offsets) {
 if(!Array.isArray(offsets)||!offsets.length)return true;
 return offsets.some(entry=>{
  const raw=String(entry).trim().toUpperCase();
  const match=raw.match(/^(?:UTC|GMT)?([+-]?\d{1,2})(?::00)?$/);
  if(!match)return false;
  const n=Number(match[1]);
  return n===1||n===2;
 });
}
function eligibleHimalayas(raw) {
 if(!raw || !franceAllowed(raw.locationRestrictions)||!franceTimezoneAllowed(raw.timezoneRestrictions)) return false;
 if(raw.expiryDate) {
  const n=Number(raw.expiryDate);
  if(!Number.isFinite(n)||n<=0) return false;
  const expiry=n>1e12?n:n*1000;
  if(expiry<Date.now()) return false;
 }
 return Boolean(raw.applicationLink && raw.title && raw.companyName);
}
function timeFromProvider(value) {
 const n=Number(value);
 if(Number.isFinite(n)&&n>0)return n>1e12?new Date(n).toISOString():new Date(n*1000).toISOString();
 return value||null;
}
function normaliseHimalayas(raw) {
 if(!eligibleHimalayas(raw)) return null;
 const restrictions=raw.locationRestrictions;
 const international=restrictions.length===0;
 const where=international?'Télétravail — Monde':restrictions.map(x=>typeof x==='string'?x:x.name||x.alpha2).filter(Boolean).join(', ');
 return compactJob({source:'Himalayas',providerId:raw.guid||raw.applicationLink,title:raw.title,company:raw.companyName,
  location: where||'Télétravail — France',url:raw.applicationLink,remote:true,
  contract:raw.employmentType,salary:salaryText(raw.minSalary,raw.maxSalary,raw.currency,raw.salaryPeriod),
  date:timeFromProvider(raw.pubDate),excerpt:raw.excerpt||raw.description});
}
async function sharedProvider(key,ttl,task) {
 const prev=providerCache.get(key);
 if(prev && prev.until>Date.now()) return prev.value;
 if(prev?.inflight) return prev.inflight;
 const inflight=Promise.resolve().then(task);
 providerCache.set(key,{inflight});
 try {
  const value=await inflight;
  providerCache.set(key,{value,until:Date.now()+ttl});
  if(providerCache.size>40)providerCache.delete(providerCache.keys().next().value);
  return value;
 }catch(error){
  if(prev?.value)providerCache.set(key,{value:prev.value,until:Date.now()+30*60*1000});
  else providerCache.delete(key);
  throw error;
 }
}
async function himalayas(query='') {
 const q=text(query).slice(0,90);
 // API refreshes daily. One shared lookup per query per warm server instance.
 return sharedProvider('himalayas:'+q,PROVIDER_CACHE_TTL_MS,async()=>{
  const args=new URLSearchParams({country:'FR',sort:'recent',page:'1'});
  if(q)args.set('q',q);
  const headers=process.env.HIMALAYAS_API_KEY?{Authorization:'Bearer '+process.env.HIMALAYAS_API_KEY}:{};
  const response=await fetchJson('https://himalayas.app/jobs/api/search?'+args.toString(),10500,headers);
  if(!Array.isArray(response.jobs))throw Error('Format Himalayas inattendu');
  return response.jobs.slice(0,40).map(normaliseHimalayas).filter(Boolean);
 });
}
/* Adzuna: France index, credential-gated, no API secrets on the browser. */
function normaliseAdzuna(raw) {
 if(!raw) return null;
 const loc=raw.location?.display_name||(Array.isArray(raw.location?.area)?raw.location.area.slice(-1)[0]:null)||'France';
 const remote=/(t[eé]l[eé]travail|remote|100% distance)/i.test([raw.title,raw.description,loc].join(' '));
 return compactJob({source:'Adzuna',providerId:raw.id||raw.redirect_url,title:raw.title,company:raw.company?.display_name,
  location:loc,url:raw.redirect_url,contract:raw.contract_type||raw.contract_time,
  salary:salaryText(raw.salary_min,raw.salary_max,'EUR','annual'),date:raw.created,excerpt:raw.description,remote});
}
async function adzuna(query='',location='Toute la France') {
 const params=new URLSearchParams({
  app_id:process.env.ADZUNA_APP_ID,app_key:process.env.ADZUNA_APP_KEY,
  results_per_page:'50',sort_by:'date'
 });
 if(query)params.set('what',query);
 if(location&&!/^france$|^toute la france$/i.test(location))params.set('where',location);
 const response=await fetchJson('https://api.adzuna.com/v1/api/jobs/fr/search/1?'+params.toString(),10500);
 if(!Array.isArray(response.results))throw Error('Format Adzuna inattendu');
 return response.results.map(normaliseAdzuna).filter(Boolean);
}
/* Published job boards for explicitly configured companies only.
   GREENHOUSE_BOARDS=acme:Acme SA;companytoken:Display Name
   All requests target the fixed official Greenhouse host, never user-controlled URLs. */
function eligibleGreenhouse(raw) {
 const loc=norm(raw?.location?.name||'');
 return /\b(france|paris|nantes|lyon|bordeaux|lille|marseille|toulouse|rennes|strasbourg|nice|montpellier|grenoble)\b/.test(loc)
  || /\b(worldwide|anywhere|europe|emea|global)\b/.test(loc);
}
function normaliseGreenhouse(raw,company) {
 if(!raw||!eligibleGreenhouse(raw))return null;
 const loc=text(raw.location?.name);
 return compactJob({source:'Greenhouse',providerId:raw.id||raw.absolute_url,title:raw.title,
  company,location:loc,url:raw.absolute_url,contract:'',date:raw.updated_at,excerpt:raw.content,
  remote:/\b(remote|t[eé]l[eé]travail)\b/i.test(loc)});
}
async function greenhouse() {
 const conf=text(process.env.GREENHOUSE_BOARDS).split(';').slice(0,4)
  .map(x=>x.trim()).filter(Boolean).map(x=>{
   const pivot=x.indexOf(':');
   if(pivot<=0)return {token:'',company:''};
   return {token:x.slice(0,pivot),company:x.slice(pivot+1).trim()};
  }).filter(x=>/^[a-z0-9-]{2,64}$/i.test(x.token)&&x.company.length>1&&x.company.length<=100);
 if(!conf.length)return [];
 const results=await Promise.allSettled(conf.map(async c=>{
  const feed=await fetchJson('https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(c.token)+'/jobs?content=true',11000);
  if(!Array.isArray(feed.jobs))throw Error('Format Greenhouse inattendu');
  return feed.jobs.map(x=>normaliseGreenhouse(x,c.company)).filter(Boolean).slice(0,200);
 }));
 if(results.every(x=>x.status==='rejected'))throw Error('Greenhouse inaccessible');
 return results.filter(x=>x.status==='fulfilled').flatMap(x=>x.value);
}

function matches(job, query, location, remoteOnly, contract) {
  const haystack = norm([job.title, job.company, job.excerpt, job.contract].join(' '));
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length && !words.every(word => haystack.includes(word))) return false;
  if (remoteOnly && !job.remote) return false;
  if (contract && contract !== 'Tous' && !norm(job.contract).includes(norm(contract))) return false;
  if (location && !/^toute la france$|^france$|^partout$|^tous$/i.test(location)) {
    const wanted = norm(location);
    if (!norm(job.location).includes(wanted) && !job.remote) return false;
  }
  return true;
}
async function getJobs(params = {}) {
  const query = text(params.q).slice(0, 120);
  const location = text(params.location || 'Toute la France').slice(0, 120);
  const remoteOnly = String(params.remote) === 'true';
  const contract = text(params.contract || 'Tous').slice(0, 30);
  // Cache upstream payload only by query+location; never cache fabricated results.
  const cacheKey = JSON.stringify({query, location});
  let response = cache.get(cacheKey);
  if (!response || Date.now() - response.time > CACHE_TTL_MS) {
    const tasks = [
      ['EasyJobs', easyJobs(query, location)],
      ['Jobicy', jobicy()],
      ['Arbeitnow', arbeitnow()],
      ['Himalayas', himalayas(query)]
    ];
    if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) tasks.push(['Adzuna', adzuna(query, location)]);
    if (text(process.env.GREENHOUSE_BOARDS)) tasks.push(['Greenhouse', greenhouse()]);
    const settled = await Promise.allSettled(tasks.map(x => x[1]));
    const sourceStatus = {}; const fetched = [];
    settled.forEach((item, index) => {
      const source = tasks[index][0];
      if (item.status === 'fulfilled') {
        sourceStatus[source] = {ok: true, received: item.value.length};
        fetched.push(...item.value);
      } else {
        sourceStatus[source] = {ok: false, received: 0, error: 'Source temporairement indisponible'};
      }
    });
    const { jobs, removed } = dedupe(fetched);
    response = {time: Date.now(), jobs, removed, sourceStatus};
    cache.set(cacheKey, response);
    if (cache.size > 30) cache.delete(cache.keys().next().value);
  }
  const filtered = response.jobs.filter(job => matches(job, query, location, remoteOnly, contract));
  filtered.sort((a,b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
  return {
    jobs: filtered, count: filtered.length, scanned: response.jobs.length,
    duplicatesRemoved: response.removed, sources: response.sourceStatus,
    retrievedAt: new Date(response.time).toISOString(),
    completeness: 'Nombre d’annonces récupérées et filtrées, pas le total du marché de l’emploi.',
    partial: Object.values(response.sourceStatus).some(s => !s.ok),
    nextPageAvailable: false
  };
}
module.exports = {getJobs, dedupe, compactJob, normaliseEasy, normaliseJobicy, normaliseArbeitnow, eligibleArbeitnow, eligibleJobicy, normaliseHimalayas, eligibleHimalayas, normaliseAdzuna, normaliseGreenhouse, eligibleGreenhouse, matches, norm};