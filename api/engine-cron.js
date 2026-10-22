'use strict';
const {timingSafeEqual}=require('node:crypto');
const {getJobs}=require('../lib/jobs');
const {ApiError,sendError}=require('../lib/platform');
function authorized(req){
 const token=process.env.CRON_SECRET;
 if(typeof token!=='string'||token.length<16)return false;
 const received=String(req.headers?.authorization||'');
 const expected='Bearer '+token;
 const a=Buffer.from(received),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
async function scanPublicCatalog(sql){
 const data=await getJobs({q:'',location:'Toute la France'});
 const rows=data.jobs.slice(0,250).filter(j=>j.url&&j.title&&j.company).map(j=>({
  url:j.url,job_id:j.id,source:j.source,title:j.title,company:j.company,
  location:j.location,contract:j.contract||'',excerpt:j.excerpt||'',remote:!!j.remote,posted_at:j.date||null
 }));
 const query='insert into public.niko_public_jobs(url,job_id,source,title,company,location,contract,excerpt,remote,posted_at,last_seen_at) '+
  'select x.url,x.job_id,x.source,x.title,x.company,x.location,x.contract,x.excerpt,x.remote,x.posted_at,now() '+
  'from jsonb_to_recordset($1::jsonb) as x(url text,job_id text,source text,title text,company text,location text,contract text,excerpt text,remote boolean,posted_at timestamptz) '+
  'on conflict(url) do update set job_id=excluded.job_id,source=excluded.source,title=excluded.title,company=excluded.company,location=excluded.location,contract=excluded.contract,excerpt=excluded.excerpt,remote=excluded.remote,posted_at=excluded.posted_at,last_seen_at=excluded.last_seen_at returning url';
 const inserted=rows.length?await sql.query(query,[JSON.stringify(rows)]):[];
 await sql.query('insert into public.niko_scan_runs(offers_received,added_or_updated,partial,source_status,outcome,finished_at) values($1,$2,$3,$4::jsonb,$5,now())',[
   data.jobs.length,inserted.length,!!data.partial,JSON.stringify(data.sources),data.partial?'partial':'ok'
 ]);
 await sql.query("delete from public.niko_public_jobs where last_seen_at < now() - interval '60 days'");
 return {offersReceived:data.jobs.length,indexed:inserted.length,partial:!!data.partial,sources:data.sources};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method!=='GET')throw new ApiError(405,'Méthode non autorisée.');
  if(!process.env.DATABASE_URL)return res.status(200).json({status:'paused',reason:'DATABASE_URL non configuré',performed:false});
  if(!authorized(req))throw new ApiError(401,'Invocation non autorisée.');
  const {neon}=require('@neondatabase/serverless');
  const sql=neon(process.env.DATABASE_URL);
  const result=await scanPublicCatalog(sql);
  return res.status(200).json({status:'completed',performed:true,...result,notes:'Index d’offres publiques uniquement. Aucune candidature envoyée.'});
 }catch(e){return sendError(res,e);}
};
module.exports.scanPublicCatalog=scanPublicCatalog;
module.exports.authorized=authorized;
