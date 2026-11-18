'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {ApiError,encrypt}=require('../lib/platform');
const {
 STATUSES,validId,validVersion,normalizeJob,cleanUpdate,optionalDate,mapApplication,mapEvent,metrics
}=require('../lib/tracker');

test('Candidate states and version numbers cannot bypass validation',()=>{
 assert.ok(STATUSES.includes('sent')&&STATUSES.includes('interview')&&STATUSES.includes('withdrawn'));
 assert.equal(validVersion(1),1);
 assert.throws(()=>validVersion(0),e=>e instanceof ApiError&&e.status===400);
 assert.throws(()=>validVersion('1.3'),e=>e instanceof ApiError&&e.status===400);
 assert.throws(()=>validId('../../somewhere'),e=>e instanceof ApiError&&e.status===400);
 assert.equal(validId('f8db20aa-2fca-456b-85d0-92074ed95ca2'),'f8db20aa-2fca-456b-85d0-92074ed95ca2');
 assert.throws(()=>cleanUpdate({status:'accepted',channel:'other'}),e=>e.status===400);
});
test('Manual or spontaneous job can be saved without a fabricated offer URL',()=>{
 assert.deepEqual(normalizeJob({title:'Agent d’entretien',company:'Établissement scolaire',url:''}),{
  title:'Agent d’entretien',company:'Établissement scolaire',url:null,location:'',source:'Saisie manuelle'});
 assert.throws(()=>normalizeJob({title:'Agent',company:'Employeur',url:'javascript:alert(1)'}));
 assert.throws(()=>normalizeJob({title:'Agent',company:''}));
});
test('Tracker deadlines, contact information and notes are validated server-side',()=>{
 const v=cleanUpdate({status:'sent',channel:'email',interviewFormat:'visio',
  to:'recruteur@example.fr',nextActionAt:'2026-12-01T08:00:00.000Z',notes:'Test'});
 assert.equal(v.recipientEmail,'recruteur@example.fr');
 assert.match(v.nextActionAt,/2026-12-01/);
 assert.equal(v.notes,'Test');
 assert.equal(optionalDate(''),null);
 assert.throws(()=>optionalDate('9999-01-01'),e=>e.status===400);
 assert.throws(()=>cleanUpdate({status:'draft',channel:'other',to:'bad-email'}),e=>e.status===400);
 assert.throws(()=>cleanUpdate({status:'draft',channel:'bad'}),e=>e.status===400);
});
test('Cloud notes decrypt only for authenticated owner AAD',()=>{
 const saved=process.env.DATA_ENCRYPTION_KEY;
 process.env.DATA_ENCRYPTION_KEY=Buffer.alloc(32,23).toString('base64');
 try{
  const row={id:'record',title:'Designer',company:'Studio',status:'draft',notes_ciphertext:encrypt('Notes privées','owner-1:tracker_note'),
   version:3,updated_at:'2026-11-18T12:00:00.000Z'};
  const result=mapApplication(row,'owner-1');
  assert.equal(result.notes,'Notes privées');assert.equal(result.version,3);
  assert.throws(()=>mapApplication(row,'owner-2'));
  const event={id:7,application_id:'record',kind:'note',message_ciphertext:encrypt('Suivi secret','owner-1:tracker_event')};
  assert.equal(mapEvent(event,'owner-1').note,'Suivi secret');
  assert.throws(()=>mapEvent(event,'owner-2'));
 }finally{if(saved===undefined)delete process.env.DATA_ENCRYPTION_KEY;else process.env.DATA_ENCRYPTION_KEY=saved;}
});
test('Stats count dossiers and actual declared states, not the events count',()=>{
 const rows=[{id:'1',status:'draft',archived:false},{id:'2',status:'sent',archived:false,
  nextActionAt:'2026-11-01T09:00:00Z'},{id:'3',status:'interview',archived:false},
  {id:'4',status:'rejected',archived:true}];
 const m=metrics(rows,Date.parse('2026-11-18T12:00:00Z'));
 assert.deepEqual(m,{total:3,sent:2,replied:1,interviews:1,due:1,pending:3,responseRate:50});
});
test('Kanban and protected endpoint are wired without fictitious offers or auto sending',()=>{
 const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'public/suivi.html'),'utf8');
 const script=fs.readFileSync(path.join(root,'public/suivi.js'),'utf8');
 const api=fs.readFileSync(path.join(root,'api/tracker.js'),'utf8');
 const schema=fs.readFileSync(path.join(root,'database/niko-tracker-v6.sql'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(script));
 for(const id of ['board','caseForm','saveCase','caseStatus','caseNextAction','caseTimeline',
  'caseInterview','emailReminders','importHistory','syncLocal','exportCsv','exportJson'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(api,/currentUser\(req\)/);
 assert.match(api,/secureOrigin\(req\)/);
 assert.match(api,/version=\$3/);
 assert.match(api,/returning a\.id,a\.status,a\.version/);
 assert.match(api,/encrypt\(v\.notes/);
 assert.match(schema,/REFERENCES public\.niko_applications\(id\) ON DELETE CASCADE/);
 assert.match(schema,/submission_proof/);
 assert.match(script,/relance.*sans envoi|Aucun e-mail envoyé/i);
 assert.match(script,/textContent/);
 assert.doesNotMatch(script,/innerHTML\s*=\s*.*item\.notes/);
});
