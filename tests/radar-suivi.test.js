'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const content=fs.readFileSync(path.join(__dirname,'../public/radar-suivi.js'),'utf8');
function harness(failWrites=false){
 const store=new Map(),elements=new Map(),hooks={};
 function node(tag='div'){
  return {tagName:tag,children:[],listeners:{},style:{},value:'',disabled:false,checked:false,textContent:'',
    append(...children){this.children.push(...children)},prepend(...children){this.children.unshift(...children)},
    replaceChildren(...children){this.children=[...children]},
    addEventListener(name,fn){this.listeners[name]=fn},
    remove(){},scrollIntoView(){}
  };
 }
 const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
 const document={
  getElementById:get,createElement:node,createTextNode:text=>node('text'),
  addEventListener(name,fn){hooks[name]=fn},
  body:node('body')
 };
 const localStorage={
  getItem:key=>store.get(key)||null,
  setItem(key,value){if(failWrites)throw Error('QUOTA');store.set(key,value)}
 };
 const window={addEventListener(){},NikoRadarTracker:null};
 const context={document,window,localStorage,confirm:()=>true,Date,JSON,String,Number,Object,Set,Array,Intl,
    Blob,URL,console,setTimeout,Error};
 vm.runInNewContext(content,context,{filename:'radar-suivi.js'});
 hooks.DOMContentLoaded();
 return {api:window.NikoRadarTracker,get,store,document};
}
const company={siren:'123456789',name:'Employeur exemple',city:'Châteaubriant',postcode:'44110',
 directoryUrl:'https://annuaire-entreprises.data.gouv.fr/entreprise/123456789'};
test('private tracker stores a genuine company without fabricating a job or contacting anyone',()=>{
 const h=harness();
 assert.equal(h.api.saveCompany(company,'Agent entretien'),true);
 const records=JSON.parse(h.store.get('niko_radar_prospection_v1'));
 assert.equal(records.length,1);
 assert.equal(records[0].name,company.name);
 assert.equal(records[0].role,'Agent entretien');
 assert.equal(records[0].stage,'reperee');
 assert.equal(records[0].lbbChecked,false);
 assert.equal(h.get('trackerCount').textContent,'1');
 assert.equal(h.api.saveCompany(company,'Agent entretien'),true);
 assert.equal(JSON.parse(h.store.get('niko_radar_prospection_v1')).length,1);
});
test('failed browser storage writes do not create phantom saved companies',()=>{
 const h=harness(true);
 assert.equal(h.api.saveCompany(company,'Agent entretien'),false);
 assert.equal(h.store.has('niko_radar_prospection_v1'),false);
 assert.equal(h.get('trackerCount').textContent,'0');
 assert.match(h.get('trackerNotice').textContent,/pas été enregistré/);
});
test('tracker source is strictly client-side and no automatic recruiter outreach is present',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/marche-cache.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../public/marche-cache.js'),'utf8');
 const sw=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8');
 assert.match(html,/src="\/radar-suivi\.js"/);
 assert.match(html,/trackerList/);
 assert.match(html,/habilitatio[n]? France Travail/);
 assert.match(js,/NikoRadarTracker\?\.decorate/);
 assert.match(content,/localStorage\.setItem/);
 assert.match(content,/lbbChecked:.*===true/);
 assert.doesNotMatch(content,/\bfetch\s*\(|\/api\/(account|tracker|applications)|messages\/send|api\.resend\.com/);
 const shell=sw.split('const APP_SHELL = ')[1]?.split('];')[0];
 assert.match(shell,/radar-suivi\.js/);
 assert.doesNotMatch(shell,/\/api\/|client_secret|data_encryption/);
});

test('scheduled follow-up becomes an actual importable iCalendar event without sending email',()=>{
 const h=harness();
 h.api.saveCompany(company,'Agent entretien');
 const record=JSON.parse(h.store.get('niko_radar_prospection_v1'))[0];
 record.nextAction='2026-11-25';
 const ics=h.api.calendarText(record);
 assert.match(ics,/BEGIN:VCALENDAR\r\n/);
 assert.match(ics,/DTSTART;VALUE=DATE:20261125/);
 assert.match(ics,/DTEND;VALUE=DATE:20261126/);
 assert.match(ics,/BEGIN:VALARM[\s\S]*TRIGGER:-P1D/);
 assert.match(ics,/Employeur exemple/);
 assert.doesNotMatch(ics,/mailto:|http:\/\/|https:\/\/|Bearer /);
 assert.throws(()=>h.api.calendarText({...record,nextAction:''}),/invalide/);
});
