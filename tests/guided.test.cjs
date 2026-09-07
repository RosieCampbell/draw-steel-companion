const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const D = require("../assets/guided-engine.js");
const LIVE = "ds-aravinthaya-sheet-v1",
  PRACTICE = "ds-guided-practice-v1";
const start = () =>
  D.apply(D.apply(D.fresh(), { type: "start" }), { type: "turn" });
const options = {
  target: "Ogre",
  confirm: true,
  d1: 5,
  d2: 4,
  edges: 0,
  banes: 0,
  surges: 0,
  markEffect: true,
};
test("one complete round keeps Focus correct, spends actions, and refreshes round triggers separately", () => {
  let s = start();
  assert.equal(s.focus, 2);
  s = D.apply(s, { type: "record", id: "mark", options });
  s = D.apply(s, {
    type: "record",
    id: "patient",
    options: { ...options, hold: true, surges: 1 },
  });
  assert.equal(s.focus, 3);
  assert.equal(s.surge, 0);
  assert.deepEqual(s.guide.used, { main: true, maneuver: true, move: true });
  assert.equal(s.mUsed, true);
  assert.throws(() => D.apply(s, { type: "markHit" }));
  s = D.apply(s, { type: "watch" });
  s = D.apply(s, { type: "perk" });
  s = D.apply(s, { type: "allyHeroic" });
  s = D.apply(s, { type: "overwatch" });
  assert.equal(s.focus, 3);
  assert.equal(s.trig, true);
  s = D.apply(s, { type: "round" });
  assert.equal(s.focus, 3);
  assert.equal(s.trig, false);
  assert.equal(s.mUsed, false);
  s = D.apply(s, { type: "turn" });
  assert.equal(s.focus, 5);
});
test("preview is pure; Mind Game includes one edge, cost deducted only when recorded", () => {
  let s = start();
  s.focus = 5;
  const before = JSON.stringify(s);
  const r = D.rollResult(s, "mind", options);
  assert.equal(r.tier, 2);
  assert.equal(r.damage, 10);
  assert.equal(JSON.stringify(s), before);
  s = D.apply(s, { type: "record", id: "mind", options });
  assert.equal(s.focus, 1);
  assert.equal(s.mark, "Ogre");
  assert.equal(s.mUsed, true);
  assert.throws(() => D.apply(s, { type: "record", id: "mind", options }));
});
test("natural 19-20 beats double banes and surge overspend is rejected", () => {
  let s = start();
  const r = D.rollResult(s, "patient", { ...options, d1: 10, d2: 9, banes: 2 });
  assert.equal(r.tier, 3);
  assert.equal(r.crit, true);
  assert.throws(() => D.rollResult(s, "patient", { ...options, surges: 2 }));
  assert.throws(() => D.rollResult(s, "patient", { ...options, d1: 0 }));
  assert.throws(() =>
    D.rollResult(s, "patient", { ...options, confirm: false }),
  );
});
test("damage, direct loss, death and outside-combat recovery differ", () => {
  let s = start();
  s.temp = 5;
  s = D.apply(s, { type: "health", kind: "damage", amount: 7 });
  assert.equal(s.stam, 31);
  assert.equal(s.temp, 0);
  s.temp = 5;
  s = D.apply(s, { type: "health", kind: "loss", amount: 33 });
  assert.equal(s.stam, -2);
  assert.equal(s.temp, 5);
  assert.throws(() => D.apply(s, { type: "record", id: "recover" }));
  s = D.apply(s, { type: "end" });
  s = D.apply(s, { type: "recovery" });
  assert.equal(s.stam, 9);
  assert.equal(s.rec, 9);
  assert.equal(s.temp, 0);
  s.stam = -16;
  assert.throws(() => D.apply(s, { type: "recovery" }));
});
test("Dazed restricts actions but a rule-granted extra action can still be recorded", () => {
  let s = start();
  s.conds.Dazed = "save";
  s = D.apply(s, { type: "record", id: "mark", options });
  assert.match(D.whyUnavailable(s, "patient"), /Dazed/);
  assert.throws(() => D.apply(s, { type: "overwatch" }));
  s = D.apply(s, { type: "extra", slot: "main" });
  assert.equal(D.whyUnavailable(s, "patient"), "");
  s = D.apply(s, { type: "record", id: "patient", options });
  assert.equal(s.guide.granted, null);
});
test("main action can trade down, never up or after spending it", () => {
  let s = start();
  s = D.apply(s, { type: "record", id: "mark", options });
  s = D.apply(s, { type: "trade", slot: "maneuver" });
  assert.equal(s.guide.used.main, true);
  assert.equal(s.guide.used.maneuver, false);
  assert.throws(() => D.apply(s, { type: "trade", slot: "move" }));
});
test("legacy backup migration preserves inventory and data; corrupt inputs are rejected", () => {
  const old = D.fresh();
  delete old.guide;
  old.projects = [{ n: "A map", p: 12, g: 30 }];
  old.stam = 20;
  const s = D.validate(old);
  assert.deepEqual(s.projects, old.projects);
  assert.equal(s.stam, 20);
  assert.equal(s.guide.phase, "rest");
  for (const bad of [
    { ...old, projects: null },
    { ...old, kit2: "constructor" },
    { ...old, focus: "4" },
    { ...old, conds: { Bad: "save" } },
  ])
    assert.throws(() => D.validate(bad));
});
test("dying cannot maintain a Mark or gain its edge from Mind Game", () => {
  let s = start();
  s.stam = -1;
  s.focus = 5;
  assert.equal(D.rollResult(s, "mind", options).markEdge, false);
  s = D.apply(s, { type: "record", id: "mind", options });
  assert.equal(s.mark, "");
  assert.equal(s.focus, 0);
});
async function page(t, storage = {}) {
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e.message));
  let html = fs
    .readFileSync(path.join(__dirname, "../guided.html"), "utf8")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, {
    url: "https://companion.test/guided.html",
    runScripts: "dangerously",
    virtualConsole: vc,
    beforeParse(w) {
      w.HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
      w.HTMLDialogElement.prototype.close = function () {
        this.open = false;
      };
      w.URL.createObjectURL = () => "blob:test";
      w.URL.revokeObjectURL = () => {};
      Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
    },
  });
  for (const file of ["guided-engine.js", "guided-learning.js", "guided.js"])
    dom.window.eval(
      fs.readFileSync(path.join(__dirname, "../assets", file), "utf8"),
    );
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, []);
  });
  const w = dom.window,
    d = w.document;
  return {
    w,
    d,
    q: (s) => d.querySelector(s),
    click(s) {
      const e = d.querySelector(s);
      assert.ok(e, s);
      e.click();
    },
    fill(s, value) {
      const e = d.querySelector(s);
      e.value = value;
      e.dispatchEvent(new w.Event("input", { bubbles: true }));
    },
    check(s) {
      const e = d.querySelector(s);
      e.checked = true;
      e.dispatchEvent(new w.Event("input", { bubbles: true }));
    },
    state(key = PRACTICE) {
      return JSON.parse(w.localStorage.getItem(key));
    },
  };
}
test("practice round through the UI resolves an attack, records once, undoes, and leaves live data unchanged", async (t) => {
  const live = D.fresh();
  live.stam = 17;
  const raw = JSON.stringify(live),
    p = await page(t, { [LIVE]: raw });
  p.click("#start");
  p.click("#watchBeginTurn");
  p.click('[data-action="mark"]');
  p.fill("#target", "Ogre");
  p.check("#targetConfirmed");
  p.click("#recordSimple");
  assert.equal(p.state().mark, "Ogre");
  p.click('[data-action="patient"]');
  p.check("#targetConfirmed");
  p.fill("#die1", "5");
  p.fill("#die2", "4");
  p.click("#resolveDice");
  assert.match(p.q("#rollResult").textContent, /8 damage/);
  assert.equal(p.state().guide.used.main, false);
  p.click("#recordRoll");
  assert.equal(p.state().focus, 3);
  assert.equal(p.state().guide.used.main, true);
  p.click("#undo");
  assert.equal(p.state().focus, 2);
  assert.equal(p.state().guide.used.main, false);
  assert.equal(p.w.localStorage.getItem(LIVE), raw);
});
test("changing dice invalidates the preview and reopening a simple action has no stale input handler", async (t) => {
  const p = await page(t);
  p.click("#start");
  p.click("#watchBeginTurn");
  p.click('[data-action="patient"]');
  p.fill("#target", "Ogre");
  p.check("#targetConfirmed");
  p.fill("#die1", "5");
  p.fill("#die2", "4");
  p.click("#resolveDice");
  p.fill("#die1", "6");
  assert.equal(p.q("#rollResult").hidden, true);
  p.click("#actionDialog [data-close]");
  p.click('[data-action="mark"]');
  p.fill("#target", "Ogre");
  p.check("#targetConfirmed");
  p.click("#recordSimple");
  assert.equal(p.state().mark, "Ogre");
});
test("live mode requires explicit confirmation and preserves existing campaign data", async (t) => {
  const s = D.fresh();
  s.stam = 15;
  s.vict = 4;
  s.projects = [{ n: "Map", p: 2, g: 9 }];
  const p = await page(t, { [LIVE]: JSON.stringify(s) });
  p.click("#switchMode");
  assert.equal(p.q("#modeLabel").textContent, "Practice");
  p.click("#confirmMode");
  assert.equal(p.q("#stamina").value, "15");
  p.click("#start");
  assert.equal(p.state(LIVE).focus, 4);
  assert.deepEqual(p.state(LIVE).projects, s.projects);
  assert.equal(p.w.localStorage.getItem(PRACTICE), null);
});
test("conflicting live updates are loaded without overwriting another tracker", async (t) => {
  const s = D.fresh(),
    p = await page(t, { [LIVE]: JSON.stringify(s), "ds-guided-mode": "live" });
  const newer = D.fresh();
  newer.stam = 7;
  p.w.localStorage.setItem(LIVE, JSON.stringify(newer));
  p.click("#start");
  assert.equal(p.state(LIVE).stam, 7);
  assert.equal(p.state(LIVE).inCombat, false);
  assert.match(p.q("#notice").textContent, /changed in another tracker/);
});
test("all labels target controls and all linked local pages exist", async (t) => {
  const p = await page(t),
    ids = [...p.d.querySelectorAll("[id]")].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const label of p.d.querySelectorAll("label[for]"))
    assert.ok(p.d.getElementById(label.htmlFor));
  for (const a of p.d.querySelectorAll("a[href]")) {
    const file = a.getAttribute("href").split("#")[0];
    if (file) assert.ok(fs.existsSync(path.join(__dirname, "..", file)), file);
  }
});

test('direct counters apply damage through temporary Stamina and support editing and undo without dialogs',async t=>{
 const p=await page(t);p.click('[data-quick-damage="5"]');assert.equal(p.state(PRACTICE).stam,D.fresh().stam-5);assert.equal(p.q('dialog[open]'),null);
 const input=p.q('#focus');input.value='7';input.dispatchEvent(new p.w.Event('change',{bubbles:true}));assert.equal(p.state(PRACTICE).focus,7);p.click('#undo');assert.equal(p.state(PRACTICE).focus,0);
 input.value='-1';input.dispatchEvent(new p.w.Event('change',{bubbles:true}));assert.equal(p.state(PRACTICE).focus,0);assert.equal(input.value,'0');
});
test('damage breakdown matches actual unmodified ability damage for both kits and weapons',()=>{
 for(const kit of ['shining','mountain'])for(const id of ['patient','melee','mind'])for(const ranged of [false,true]){
 const s=start();s.kit2=kit;const b=D.breakdown(s,id,ranged);for(const [i,dice] of [[0,[1,1]],[1,[6,6]],[2,[10,10]]]){const r=D.rollResult(s,id,{...options,d1:dice[0],d2:dice[1],markEffect:false,ranged});assert.equal(r.damage,b.base[i]+b.stat[i]+b.kit[i]+b.treasure[i],kit+' '+id+' '+i);}
 }
});
test('campaign list editing saves literal text, persists, and undo restores removed entries',async t=>{
 const p=await page(t);p.click('[data-view="hero"]');p.click('[data-list="projects"][data-operation="add"]');const row=p.q('[data-list-row="projects"]');row.querySelector('[data-field="n"]').value='<b>Map</b>';row.querySelector('[data-field="p"]').value='3';row.querySelector('[data-field="g"]').value='10';p.click('[data-list="projects"][data-operation="save"]');assert.equal(p.state(PRACTICE).projects[0].n,'<b>Map</b>');p.click('[data-list="projects"][data-operation="remove"]');assert.equal(p.state(PRACTICE).projects.length,0);p.click('#undo');assert.equal(p.state(PRACTICE).projects[0].p,3);
});
test('saved equipment displays as text; Edit opens a form and Cancel discards changes', async t => {
  const p = await page(t);
  p.click('[data-view="hero"]');
  assert.equal(p.q('[data-list-row="gear"] input'), null);
  p.click('[data-list="gear"][data-operation="edit"]');
  const original = p.q('[data-list-row="gear"] textarea').value;
  p.q('[data-list-row="gear"] textarea').value = 'Discard this';
  p.click('[data-list="gear"][data-operation="cancel"]');
  assert.equal(p.q('[data-list-row="gear"] textarea'), null);
  assert.ok(p.q('[data-list-row="gear"]').textContent.includes(original));
  p.click('[data-list="gear"][data-operation="edit"]');
  p.q('[data-list-row="gear"] textarea').value = 'Updated\nnotes';
  p.click('[data-list="gear"][data-operation="save"]');
  assert.equal(p.q('[data-list-row="gear"] textarea'), null);
  assert.equal(p.state(PRACTICE).gear[0].d, 'Updated\nnotes');
});

test('Learn is a searchable reference with separate character notes and no training controls', async t => {
 const p=await page(t);p.click('[data-view="learn"]');
 assert.equal(p.q('[data-learn="quiz"]'),null);
 assert.equal(p.q('#lessonCard'),null);
 const search=p.q('#learnSearch'); search.value='Charge';search.dispatchEvent(new p.w.Event('input'));
 assert.match(p.q('#ruleLibrary').textContent,/straight line/);
 assert.match(p.q('#ruleLibrary').textContent,/Starter Rules/);
 search.value=''; search.dispatchEvent(new p.w.Event('input'));
 p.q('#learnScope').value='hero';p.q('#learnScope').dispatchEvent(new p.w.Event('change'));
 assert.equal(p.q('#rule-charge'),null);
 assert.ok(p.q('#rule-ability-patient'));
 search.value='zzzzzz';search.dispatchEvent(new p.w.Event('input'));
 assert.match(p.q('#ruleLibrary').textContent,/No matching rules/);
});
test('temporary Stamina reports non-stacking, absorbs damage, and bleeding bypasses it', async t => {
 const p=await page(t); const initial=D.fresh().stam;
 const grant=n=>{p.click('[data-stamina-extra="temp"]');p.q('#healthAmount').value=String(n);p.click('[data-health="temp"]');};
 grant(5);assert.equal(p.state(PRACTICE).temp,5);grant(3);assert.equal(p.state(PRACTICE).temp,5);assert.match(p.q('#notice').textContent,/stays at 5/);
 p.click('[data-quick-damage="1"]');assert.equal(p.state(PRACTICE).temp,4);assert.equal(p.state(PRACTICE).stam,initial);
 p.click('[data-stamina-extra="loss"]');p.q('#healthAmount').value='2';p.click('[data-health="loss"]');assert.equal(p.state(PRACTICE).temp,4);assert.equal(p.state(PRACTICE).stam,initial-2);
});
test('respite restores resources and converts Victories once, with confirmation and undo',async t=>{
 const s=D.fresh();s.stam=4;s.rec=2;s.vict=3;s.xp=7;
 const p=await page(t,{[PRACTICE]:JSON.stringify(s)});p.click('#respite');assert.equal(p.state(PRACTICE).stam,4);p.click('#confirmRespite');
 assert.equal(p.state(PRACTICE).stam,D.KITS[s.kit2].max);assert.equal(p.state(PRACTICE).rec,10);assert.equal(p.state(PRACTICE).xp,10);assert.equal(p.state(PRACTICE).vict,0);
 p.click('#respite');p.click('#confirmRespite');assert.equal(p.state(PRACTICE).xp,10);p.click('#undo');p.click('#undo');assert.equal(p.state(PRACTICE).stam,4);
 assert.throws(()=>D.apply(start(),{type:'respite'}));
});
