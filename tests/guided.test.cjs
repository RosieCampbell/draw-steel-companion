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
  for (const file of ["guided-engine.js", "guided.js"])
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
  assert.equal(p.q("#stamina").textContent, "15");
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
test("lessons give feedback and advance, without starting combat", async (t) => {
  const p = await page(t);
  p.click('.primary [data-view="learn"]');
  p.click('[data-answer="1"]');
  assert.match(p.q("#lessonFeedback").textContent, /Not quite/);
  p.click("#nextLesson");
  assert.equal(p.state().guide.lesson, 1);
  assert.equal(p.state().inCombat, false);
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
