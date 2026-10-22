'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyGmailSend,addresses}=require('../lib/gmail-proof');
const valid={accessToken:'session_token_for_unit_testing_only_1234',messageId:'18cdb731abc',threadId:'18cdb72ffff',recipient:'recrutement@example.org'};
test('Parses actual email addresses without trusting display names',()=>{
 assert.deepEqual(addresses('Équipe RH <recrutement@example.org>, Contact <hr@example.net>'),['recrutement@example.org','hr@example.net']);
});
test('Confirms SENT status and recipient with a live-provider-shaped response',async()=>{
 const original=global.fetch;
 global.fetch=async(url,options)=>{
  assert.ok(String(url).startsWith('https://gmail.googleapis.com/gmail/v1/users/me/messages/'));
  assert.ok(options.headers.Authorization.startsWith('Bearer '));
  return {ok:true,json:async()=>({id:valid.messageId,threadId:valid.threadId,labelIds:['INBOX','SENT'],payload:{headers:[{name:'To',value:'RH <recrutement@example.org>'}]}})};
 };
 try{const result=await verifyGmailSend(valid);assert.equal(result.messageId,valid.messageId);}finally{global.fetch=original;}
});
test('Rejects false confirmation, wrong recipient, mismatched thread and invented message',async()=>{
 const original=global.fetch;
 try{
  for(const variation of [
   {labelIds:['INBOX']},
   {threadId:'18cdb72aaa'},
   {payload:{headers:[{name:'To',value:'fraud@example.org'}]}}
  ]){
   global.fetch=async()=>({ok:true,json:async()=>({id:valid.messageId,threadId:valid.threadId,labelIds:['SENT'],payload:{headers:[{name:'To',value:valid.recipient}]},...variation})});
   await assert.rejects(()=>verifyGmailSend(valid),e=>e.status===422);
  }
  global.fetch=async()=>({ok:false,status:403});
  await assert.rejects(()=>verifyGmailSend(valid),e=>e.status===422);
 }finally{global.fetch=original;}
});
test('Malformed IDs are rejected before Gmail access',async()=>{
 await assert.rejects(()=>verifyGmailSend({...valid,messageId:'../etc/passwd'}),e=>e.status===400);
 await assert.rejects(()=>verifyGmailSend({...valid,accessToken:''}),e=>e.status===400);
});
test('Cloud sent verification must be present in the application endpoint',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../api/applications.js'),'utf8');
 assert.match(source,/await verifyGmailSend/);
});
