'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cron=require('../api/engine-cron');
test('Daily autonomous scan is OFF without persistent storage',async()=>{
 const old=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
 try{
  let result;
  const res={setHeader(){},status(status){this.statusCode=status;return this;},json(data){result=data;return this;}};
  await cron({method:'GET',headers:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(result.status,'paused');
  assert.equal(result.performed,false);
 }finally{if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;}
});
test('Protects cron with configured secret and constant-time comparison',()=>{
 const saved=process.env.CRON_SECRET;process.env.CRON_SECRET='0123456789_abcdefghijklmnopqrstuvwxyz';
 try{
  assert.equal(cron.authorized({headers:{authorization:'Bearer 0123456789_abcdefghijklmnopqrstuvwxyz'}}),true);
  assert.equal(cron.authorized({headers:{authorization:'Bearer fake'}}),false);
  assert.equal(cron.authorized({headers:{}}),false);
 }finally{if(saved===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=saved;}
});
test('Background scan uses an idempotent job index and does not send applications',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../api/engine-cron.js'),'utf8');
 assert.match(text,/on conflict\(url\)/);
 assert.match(text,/jsonb_to_recordset\(\$1::jsonb\)/);
 assert.doesNotMatch(text,/gmail\.googleapis|\/messages\/send|recruiterEmail|openai\.com\/v1/);
 const schema=fs.readFileSync(path.join(__dirname,'../database/niko-autonomy.sql'),'utf8');
 assert.match(schema,/create table if not exists public\.niko_public_jobs/);
 assert.match(schema,/url text primary key/);
 assert.doesNotMatch(schema,/cv_text|cv_ciphertext/);
});
test('The cron is on an all-plans-compatible daily cadence',()=>{
 const v=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
 assert.deepEqual(v.crons,[{path:'/api/engine-cron',schedule:'0 6 * * *'}]);
});
