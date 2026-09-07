const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const KEY = 'ds-aravinthaya-sheet-v1';
const TMKEY = 'ds-aravinthaya-table-v1';
const tick = () => new Promise(resolve => setTimeout(resolve, 20));

async function page(t, file='index.html', storage={}, hash='') {
  const errors=[];
  const vc=new VirtualConsole();
  vc.on('jsdomError', e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), {
    url:'https://companion.test/'+file+hash, runScripts:'dangerously',virtualConsole:vc,
    beforeParse(w) {
      w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};
      w.HTMLElement.prototype.scrollIntoView=()=>{};
      w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
      Object.entries(storage).forEach(([k,v])=>w.localStorage.setItem(k,v));
    }
  });
  t.after(()=>{dom.window.close();assert.deepEqual(errors,[],'page raised runtime errors');});
  await tick();
  const w=dom.window,d=w.document;
  return {
    w,d, q:s=>d.querySelector(s),
    click(s){const e=d.querySelector(s);assert.ok(e,s);e.click();},
    set(s,value,event='input'){const e=d.querySelector(s);e.value=value;e.dispatchEvent(new w.Event(event,{bubbles:true}));},
    state(){return JSON.parse(w.localStorage.getItem(file==='index.html'?KEY:TMKEY));}
  };
}

test('round triggers survive My turn and reset only on New round; undo works', async t=>{
  const p=await page(t);p.click('#bStart');p.click('#gMark');p.click('#gAlly');p.click('#gTrig');p.click('#bTurn');
  assert.equal(p.state().focus,4);assert.equal(p.state().mUsed,true);assert.equal(p.state().aUsed,true);assert.equal(p.state().trig,true);
  p.click('#bTurn');assert.equal(p.state().focus,4,'double tap must not add Focus twice');
  p.click('#bRound');assert.equal(p.state().round,2);assert.equal(p.state().focus,4);assert.equal(p.state().mUsed,false);
  p.click('#bUndo');assert.equal(p.state().round,1);assert.equal(p.state().trig,true);
});

test('damage absorbs temporary Stamina, healing does not create it, combat end clears it',async t=>{
  const p=await page(t);p.click('#bStart');for(let i=0;i<5;i++)p.click('[data-d="temp:1"]');
  p.set('#stamAmount','8');p.click('#takeDamage');assert.equal(p.state().temp,0);assert.equal(p.state().stam,30);
  p.click('#healAmount');assert.equal(p.state().stam,33);assert.equal(p.state().temp,0);
  p.click('[data-d="temp:1"]');p.click('#bEnd');assert.equal(p.state().temp,0);
  p.click('#bUndo');assert.equal(p.state().temp,1);assert.equal(p.state().inCombat,true);
});

test('dying can recover outside combat, but cannot Catch Breath in combat or heal dead through Recovery',async t=>{
  const p=await page(t);p.click('#bStart');p.set('#stamAmount','35');p.click('#takeDamage');
  assert.equal(p.state().stam,-2);assert.equal(p.q('#bBreath').disabled,true);
  p.click('#bEnd');assert.equal(p.q('#bBreath').disabled,false);p.click('#bBreath');assert.equal(p.state().stam,9);assert.equal(p.state().rec,9);
  p.set('#stamAmount','99');p.click('#takeDamage');assert.equal(p.q('#bBreath').disabled,true);
});

test('kit switches update every live reference and cannot happen during combat',async t=>{
  const p=await page(t);p.click('[data-kit="mountain"]');
  assert.match(p.q('#kitSignature').textContent,/Pain for Pain/);assert.doesNotMatch(p.q('#sec-main').textContent,/Protective Attack/);
  assert.equal(p.q('#sec-main [data-melee="mind"]').textContent,'7/9/17');
  assert.equal(p.q('#sec-off [data-melee="free"]').textContent,'5/8/14');
  assert.match(p.q('#bBreath').textContent,/10 Stamina/);assert.equal(p.state().stam,30);
  p.click('#bStart');p.click('[data-kit="shining"]');assert.equal(p.state().kit2,'mountain');
  p.click('#bEnd');p.click('[data-kit="shining"]');assert.match(p.q('#kitSignature').textContent,/Protective Attack/);
});

test('invalid backup is atomic and legacy backups import with defaults',async t=>{
  const p=await page(t);const original=p.state();
  for(const bad of [{stam:12,rec:10,projects:null},{stam:'oops',rec:10},{stam:12,rec:10,gear:[null]},[],{}, {stam:12,rec:10,kit2:'toString'}]){
    p.set('#bkText',JSON.stringify(bad));p.click('#bkLoad');assert.deepEqual(p.state(),original);
    assert.match(p.q('#bkNote').textContent,/valid backup/);
  }
  p.set('#bkText',JSON.stringify({stam:12,rec:8,projects:[{n:'Map',p:4,g:10}]}));p.click('#bkLoad');
  assert.equal(p.state().stam,12);assert.equal(p.state().inCombat,false);assert.equal(p.q('.pname').value,'Map');
  p.click('#bUndo');assert.deepEqual(p.state(),original);
});

test('file restore rejects invalid rows without changing state',async t=>{
  const p=await page(t);const before=p.state();
  const file=new p.w.File(['{"stam":5,"rec":10,"items":null}'],'broken.json',{type:'application/json'});
  Object.defineProperty(p.q('#bkFile'),'files',{value:[file]});p.q('#bkFile').dispatchEvent(new p.w.Event('change'));await tick();
  assert.deepEqual(p.state(),before);assert.match(p.q('#bkNote').textContent,/valid tracker backup/);
});

test('download uses a standard Blob and includes current state',async t=>{
  const p=await page(t);let blob,download;
  p.w.URL.createObjectURL=b=>{blob=b;return 'blob:test';};
  p.w.HTMLAnchorElement.prototype.click=function(){download=this.download;};
  assert.notEqual(p.q('#bkDl').style.display,'none');p.click('#bkDl');assert.equal(blob.type,'application/json');assert.equal(download,'aravinthaya-tracker.json');
});

test('corrupt stored state is preserved without a runtime failure',async t=>{
  const raw='{"stam":2,"rec":10,"projects":null}';const p=await page(t,'index.html',{[KEY]:raw});
  assert.equal(p.w.localStorage.getItem(KEY),raw);assert.match(p.q('#saveStatus').textContent,/could not be loaded/);
});

test('search opens matching reference, clears cleanly, and glossary supports keyboard',async t=>{
  const p=await page(t);p.set('#ruleSearch','restrained');assert.equal(p.q('#sec-cond').open,true);assert.equal(p.q('#sec-main').hidden,true);
  p.set('#ruleSearch','');assert.equal(p.q('#sec-main').hidden,false);
  const gl=p.q('.gl');gl.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(p.q('#peek').style.display,'block');
  p.d.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(p.q('#peek').style.display,'none');
});

test('trainer persists round flags, Mark and Victories across reload; undo restores state',async t=>{
  const p=await page(t,'legacy-trainer.html');p.set('#tmVict','3','change');p.click('#tmStart');p.set('#tmMark','Ogre','change');p.click('#tmGainMark');p.click('#tmTrig');p.click('#tmTurn');
  assert.equal(p.state().focus,6);assert.equal(p.state().markUsed,true);assert.equal(p.state().trigUsed,true);
  const p2=await page(t,'legacy-trainer.html',{[TMKEY]:JSON.stringify(p.state())},'#tablemode');
  assert.equal(p2.q('#tmMark').value,'Ogre');assert.equal(p2.q('#tmVict').value,'3');assert.equal(p2.q('#tmTurn').disabled,true);
  p2.click('#tmRound');assert.equal(p2.state().markUsed,false);p2.click('#tmUndo');assert.equal(p2.state().markUsed,true);
});

test('trainer dying recovery restriction changes when combat ends',async t=>{
  const p=await page(t,'legacy-trainer.html');p.click('#tmStart');for(let i=0;i<7;i++)p.click('[data-stadj="-5"]');
  assert.equal(p.state().stam,-2);assert.equal(p.q('#tmBreath').disabled,true);p.click('#tmEnd');p.click('#tmBreath');assert.equal(p.state().stam,9);assert.equal(p.state().rec,9);
});

test('Mind Game always includes exactly one Mark edge, including a checked checkbox',async t=>{
  const p=await page(t,'legacy-trainer.html');p.w.Math.random=()=>0.4; // 5+5, +2 Might; double edge would incorrectly reach tier 3
  p.click('[data-abil="mindm"]');assert.equal(p.q('#abMark').disabled,true);p.click('#aRoll');await tick();
  assert.equal(p.q('#aDmg').textContent,'10');assert.match(p.q('#aMath').textContent,/\+2.*= 14/);
  p.q('#abMark').checked=true;p.click('#aRoll');await tick();assert.equal(p.q('#aDmg').textContent,'10');
  p.click('[data-abil="patient"]');assert.equal(p.q('#abMark').disabled,false);assert.ok(p.q('[data-tg="adj"]'));
});

test('trainer tabs expose selected panel and support arrow keys',async t=>{
  const p=await page(t,'legacy-trainer.html',{},'#conditions');const tab=p.q('[data-tab="conditions"]');
  assert.equal(tab.getAttribute('aria-selected'),'true');assert.equal(tab.tabIndex,0);
  tab.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(p.q('[data-tab="resources"]').getAttribute('aria-selected'),'true');assert.equal(p.q('#resources').classList.contains('active'),true);
});

test('every static label target and internal link exists; HTML IDs are unique',async t=>{
  for(const file of ['index.html','legacy-trainer.html']){
    const p=await page(t,file);const ids=[...p.d.querySelectorAll('[id]')].map(e=>e.id);
    assert.equal(new Set(ids).size,ids.length,file+' duplicate IDs');
    for(const e of p.d.querySelectorAll('label[for]'))assert.ok(p.d.getElementById(e.htmlFor),e.htmlFor);
    for(const a of p.d.querySelectorAll('a[href^="#"]'))assert.ok(p.d.getElementById(a.hash.slice(1)),a.hash);
  }
});

test('direct bleeding loss bypasses temporary Stamina and shows the dying reminder',async t=>{
  const p=await page(t);p.click('#bStart');for(let i=0;i<5;i++)p.click('[data-d="temp:1"]');
  p.set('#markName','Ogre');p.set('#stamAmount','34');p.click('#loseStamina');
  assert.equal(p.state().stam,-1);assert.equal(p.state().temp,5);assert.equal(p.state().mark,'');
  assert.match(p.q('#conditionNotes').textContent,/Dying: this bleeding cannot end until healed/);
  p.click('#bUndo');assert.equal(p.state().mark,'Ogre');assert.equal(p.state().stam,33);
});

test('navigation opens collapsed session tools and clears a conflicting search',async t=>{
  const p=await page(t);assert.equal(p.q('#session-tools').open,false);
  p.click('.playnav a[href="#session-tools"]');assert.equal(p.q('#session-tools').open,true);
  p.set('#ruleSearch','restrained');p.click('.playnav a[href="#sec-main"]');assert.equal(p.q('#ruleSearch').value,'');assert.equal(p.q('#sec-main').hidden,false);
});

test('valid restore after corrupt storage resumes saving',async t=>{
  const p=await page(t,'index.html',{[KEY]:'broken'});
  p.set('#bkText','{"stam":18,"rec":7}');p.click('#bkLoad');await tick();
  assert.equal(p.state().stam,18);assert.match(p.q('#saveStatus').textContent,/Saved in this browser/);
});

test('sheet reload retains round, kit, conditions and project state',async t=>{
  const p=await page(t);p.click('[data-kit="mountain"]');p.click('#bStart');p.click('#bRound');p.click('#bTurn');p.click('[data-cond="Dazed"]');
  const p2=await page(t,'index.html',{[KEY]:JSON.stringify(p.state())});
  assert.equal(p2.state().round,2);assert.match(p2.q('#kitSignature').textContent,/Pain for Pain/);
  assert.match(p2.q('#conditionNotes').textContent,/including free triggered actions/);assert.equal(p2.q('#bTurn').disabled,true);
});

test('save failure is visibly reported instead of claiming success',async t=>{
  const p=await page(t);p.w.storage.set=()=>Promise.reject(new Error('Quota exceeded'));
  p.click('[data-d="focus:1"]');await tick();assert.match(p.q('#saveStatus').textContent,/Not saved/);
});

test('natural 20 remains tier 3 with a double bane; Patient Shot applies adjacent bane',async t=>{
  const p=await page(t,'legacy-trainer.html');p.w.Math.random=()=>0.99;
  p.click('[data-ab-eb="bane"][data-dir="1"]');p.click('[data-ab-eb="bane"][data-dir="1"]');
  p.click('#aRoll');await tick();assert.equal(p.q('#aDmg').textContent,'15');assert.equal(p.q('#aCrit').classList.contains('show'),true);
  p.click('[data-ab-eb="bane"][data-dir="-1"]');p.click('[data-ab-eb="bane"][data-dir="-1"]');
  p.w.Math.random=()=>0.4;const adj=p.q('[data-tg="adj"]');adj.checked=true;adj.dispatchEvent(new p.w.Event('change'));
  p.click('#aRoll');await tick();assert.equal(p.q('#aDmg').textContent,'5');
});

 test('full sheet preserves guided notes and lesson progress',async t=>{
  const p=await page(t);const saved=p.state();saved.guide={notes:'Remember the bridge',lesson:2,phase:'rest',used:{main:false,maneuver:false,move:false},log:[]};
  const p2=await page(t,'index.html',{[KEY]:JSON.stringify(saved)});p2.click('[data-d="focus:1"]');assert.deepEqual(p2.state().guide,saved.guide);
 });
