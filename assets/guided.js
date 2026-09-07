(function () {
  "use strict";
  const D = window.DrawSteel,
    $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  const LIVE = "ds-aravinthaya-sheet-v1",
    PRACTICE = "ds-guided-practice-v1";
  let mode = "practice",
    state = D.fresh(),
    history = [],
    lastRaw = null,
    saveProblem = "",
    view = "play",
    phase = "rest",
    intent = "all",
    timer, learning;
  const editingRows = new Set(), newRows = new Set();
  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      saveProblem = "Saving is unavailable. Download a backup before closing.";
      return null;
    }
  }
  try {
    mode = read("ds-guided-mode") === "live" ? "live" : "practice";
  } catch (e) {}
  function key() {
    return mode === "live" ? LIVE : PRACTICE;
  }
  function load() {
    editingRows.clear(); newRows.clear();
    lastRaw = read(key());
    try {
      state = lastRaw ? D.validate(JSON.parse(lastRaw)) : D.fresh();
    } catch (e) {
      state = D.fresh();
      saveProblem =
        "Saved data could not be read. It has been preserved. Restore a valid backup to continue.";
    }
    phase = state.guide.phase;
  }
  load();
  function notice(text) {
    const dialog = $("dialog[open]");
    if (dialog) {
      let msg = dialog.querySelector("[data-dialog-notice]");
      if (!msg) {
        msg = document.createElement("p");
        msg.dataset.dialogNotice = "";
        msg.className = "inline-error";
        msg.setAttribute("role", "alert");
        dialog.append(msg);
      }
      msg.textContent = text;
    }
    $("#notice").textContent = text;
    $("#notice").classList.add("visible");
    clearTimeout(timer);
    timer = setTimeout(() => $("#notice").classList.remove("visible"), 4500);
  }
  function escapeText(text) {
    const el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  }
  function saved() {
    try {
      const raw = JSON.stringify(state);
      localStorage.setItem(key(), raw);
      lastRaw = raw;
      saveProblem = "";
    } catch (e) {
      saveProblem = "Not saved. Download a backup before closing.";
    }
    $("#saveStatus").textContent =
      saveProblem ||
      (mode === "practice"
        ? "Practice saved separately."
        : "Hero saved in this browser.");
  }
  function conflict() {
    const latest = read(key());
    if (latest !== lastRaw) {
      load();
      history = [];
      render();
      notice(
        "This hero changed in another tracker. Loaded the latest data; try your action again.",
      );
      return true;
    }
    if (saveProblem.includes("could not be read")) {
      notice(saveProblem);
      return true;
    }
    return false;
  }
  function commit(event) {
    if (conflict()) return false;
    try {
      const next = D.apply(state, event);
      history.push(JSON.stringify(state));
      if (history.length > 40) history.shift();
      state = next;
      phase = state.guide.phase;
      saved();
      render();
      return true;
    } catch (e) {
      notice(e.message);
      return false;
    }
  }
  function showView(next) {
    view = next;
    render();
    $("#content").focus({ preventScroll: true });
  }
  function openDialog(dialog) {
    if (dialog.open) dialog.close();
    dialog.showModal();
  }
  function utility(title, body) {
    $("#utilityDialog [data-dialog-notice]")?.remove();
    $("#utilityTitle").textContent = title;
    $("#utilityBody").innerHTML = body;
    openDialog($("#utilityDialog"));
  }
  function detail(text) {
    return "<p>" + escapeText(text) + "</p>";
  }
  const TERMS = {
    stamina:
      "Stamina is how much punishment you can take. At half your maximum or less, you are winded. At 0 or less, you are dying and bleeding, but can still act. Death occurs at negative your winded value.",
    focus:
      "Focus is your tactician resource. Start combat with Focus equal to your Victories; gain 2 at the start of your turn. Two separate events can each grant 1 more per round: damage to your Mark, and an ally within 10 using a heroic ability. Unspent Focus ends with the encounter.",
    surge:
      "A surge can add 2 damage to one target of rolled damage for Aravinthaya. Spend up to 3 per hit. Two surges can instead raise a potency by 1; subtract two surges directly when you choose that option. Surges disappear at encounter end.",
    mark: "Mark is a maneuver targeting a creature within 10 squares. You and allies within your line of effect gain an edge on power rolls against it while the target is also within your line of effect. On qualifying rolled damage, spend 1 Focus for one Mark benefit.",
    edge: "One edge adds 2 to a power roll. Two edges raise the outcome by one tier instead. Banes work in reverse. Count up to two of each, then cancel them. Natural 19–20 is always tier 3.",
    recovery:
      "A Recovery is a limited healing resource, not an amount of extra Stamina. Spend one to regain a third of maximum Stamina, rounded down. Catch Breath costs a maneuver in combat and cannot be used while dying; outside combat, you can spend Recoveries even while dying.",
    turn: "Your turn is your opportunity to take a main action, maneuver and move action. A round contains everyone’s turns. Beginning your turn grants Focus; beginning a new round refreshes round-limited benefits. Those are different moments.",
  };
  function render() {
    const k = D.KITS[state.kit2],
      g = state.guide;
    $("#modeLabel").textContent =
      mode === "practice" ? "Practice" : "Live hero";
    $("#switchMode").textContent =
      mode === "practice" ? "Use my saved hero" : "Return to practice";
    $("#modeNote").textContent =
      mode === "practice"
        ? "Try a round here. Practice never changes your saved hero."
        : "Live hero · changes save in this browser.";
    $("#saveStatus").textContent =
      saveProblem ||
      (mode === "practice"
        ? "Practice saved separately."
        : "Hero saved in this browser.");
    $("#undo").disabled = !history.length;
    $("#stamina").value = state.stam;
    $("#maxStamina").textContent = k.max;
    $("#healthFill").style.width =
      (Math.max(0, state.stam) / k.max) * 100 + "%";
    $("#healthFill").style.background =
      state.stam <= k.wind ? "var(--red)" : "var(--green)";
    $("#healthState").textContent =
      state.stam <= -k.wind
        ? "Dead"
        : state.stam <= 0
          ? "Dying"
          : state.stam <= k.wind
            ? "Winded"
            : "Steady";
    $("#tempStamina").textContent = state.temp
      ? state.temp + " temporary Stamina · absorbs damage first"
      : "Winded at " + k.wind + " · Recovery value " + k.heal;
    $("#focus").value = state.focus;
    $("#surges").value = state.surge;
    $("#markName").textContent = state.mark || "No one yet";
    $("#conditionsList").replaceChildren();
    let conditions = Object.keys(state.conds);
    if (state.stam <= 0 && !conditions.includes("Bleeding"))
      conditions.push("Bleeding");
    if (!conditions.length)
      $("#conditionsList").innerHTML =
        '<p class="small muted">No active conditions.</p>';
    for (const name of conditions) {
      const el = document.createElement("div");
      el.className = "condition-chip";
      el.innerHTML =
        "<b>" +
        escapeText(name) +
        (state.conds[name] === "save"
          ? " · save ends"
          : state.conds[name] === "eot"
            ? " · EoT"
            : " · dying") +
        "</b><p>" +
        escapeText(D.CONDITIONS[name]) +
        "</p>";
      $("#conditionsList").append(el);
    }
    for (const name of ["play", "hero", "learn"])
      $("#" + name + "View").hidden = view !== name;
    $$(".primary [data-view]").forEach((b) =>
      b.setAttribute(
        "aria-current",
        b.dataset.view === view ? "page" : "false",
      ),
    );
    $$("[data-phase]").forEach((b) => {
      b.classList.toggle("active", b.dataset.phase === phase);
      b.setAttribute("aria-pressed", String(b.dataset.phase === phase));
    });
    for (const name of ["turn", "watch", "rest"])
      $("#" + name + "Panel").hidden = phase !== name;
    $("#roundLabel").textContent = state.inCombat
      ? "ROUND " +
        state.round +
        " / " +
        (state.turnTaken ? "TURN RECORDED" : "YOUR TURN AWAITS")
      : "BEFORE THE NEXT ROLL";
    $("#playTitle").textContent =
      phase === "turn"
        ? "What’s your next move?"
        : phase === "watch"
          ? "Other turns"
          : state.guide.log.length
            ? "Between encounters"
            : "Before combat";
    $("#playIntro").textContent =
      phase === "turn"
        ? "Choose an action below. Your available actions and Focus are tracked here."
        : phase === "watch"
          ? "Record your class triggers when their conditions are met."
          : "Check your resources, recover, or start an encounter.";
    $("#victories").textContent = state.vict;
    $("#recoveries").textContent = state.rec;
    $("#recoveryValue").textContent = k.heal;
    $("#start").disabled = state.inCombat;
    $("#recover").disabled =
      state.inCombat ||
      state.rec < 1 ||
      state.stam >= k.max ||
      state.stam <= -k.wind;
    $("#recover").textContent = "Spend a Recovery · +" + k.heal;
    $("#victory").disabled = state.inCombat;
    $("#respite").disabled = state.inCombat || state.stam <= -k.wind;
    $("#turnStartCard").hidden = state.inCombat && g.phase === "turn";
    $("#beginTurn").disabled = !state.inCombat || state.turnTaken;
    $("#watchBeginTurn").disabled = !state.inCombat || state.turnTaken;
    $("#nextRound").disabled = !state.inCombat;
    $("#endCombat").disabled = !state.inCombat;
    $("#endTurn").disabled = !state.inCombat || g.phase !== "turn";
    $("#actionBudget").innerHTML = ["main", "maneuver", "move"]
      .map(
        (t) =>
          '<span class="' +
          (g.used[t] ? "used" : "") +
          '">' +
          (g.used[t] ? "✓ Used" : "○ Available") +
          " · " +
          t +
          "</span>",
      )
      .join("");
    const abilities = D.abilities(state),
      ids =
        intent === "all"
          ? ["mark", "patient", "melee", "strike"]
          : Object.keys(abilities).filter(
              (id) => abilities[id].intent === intent && id !== "creative",
            );
    if (intent === "protect" && state.kit2 === "shining") ids.unshift("melee");
    $("#actionCards").replaceChildren();
    for (const id of ids) {
      const a = abilities[id],
        why = D.whyUnavailable(state, id),
        article = document.createElement("article");
      article.className = "action-card" + (id === "mark" ? " featured" : "");
      article.innerHTML =
        '<span class="origin '+D.origin(id,state).scope+'">'+D.origin(id,state).label+'</span><div class="meta">' +
        a.type +
        " action · " +
        a.cost +
        " Focus</div><h3>" +
        a.name +
        "</h3><p>" +
        a.blurb +
        '</p><button class="text-button" data-action="' +
        id +
        '">' +
        (why ? "Read ability" : "Choose this") +
        " →</button>" +
        (why ? '<p class="reason">' + escapeText(why) + "</p>" : "");
      $("#actionCards").append(article);
    }
    $$("[data-intent]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.intent === intent)),
    );
    $("#markHit").disabled = !state.inCombat || !state.mark || state.mUsed;
    $("#markPerk").disabled =
      !state.inCombat || !state.mark || state.focus < 1 || !!state.conds.Dazed;
    $("#allyHeroic").disabled = !state.inCombat || state.aUsed;
    $("#overwatch").disabled =
      !state.inCombat ||
      state.trig ||
      !!state.conds.Dazed ||
      state.stam <= -k.wind;
    $("#markHitStatus").textContent = state.mUsed
      ? "Already gained this round."
      : !state.mark
        ? "Mark a creature first."
        : "";
    $("#allyStatus").textContent = state.aUsed
      ? "Already gained this round."
      : "";
    $("#overwatchStatus").textContent = state.trig
      ? "Triggered action already used this round."
      : state.conds.Dazed
        ? "Dazed: triggered actions are unavailable."
        : "Uses your one triggered action for the round.";
    $("#freeStrikeNumbers").textContent =
      "Your melee free strike: 2d10 +2; damage " + k.free.join(" / ") + ".";
    $("#journal").replaceChildren();
    for (const entry of g.log) {
      const li = document.createElement("li");
      li.textContent = entry;
      $("#journal").append(li);
    }
    if (!g.log.length)
      $("#journal").innerHTML =
        "<li>Your recorded actions will appear here.</li>";
    $("#kitName").textContent = k.name + " + Sniper";
    $("#kitSummary").textContent =
      "Stamina " +
      k.max +
      " · Stability " +
      k.stability +
      " · Speed 6 · Disengage shift 2." +
      (state.kit2 === "mountain"
        ? " Mountain damage includes your campaign’s Heelcutter +1."
        : "");
    $("#kitSelect").value = state.kit2;
    $("#kitSelect").disabled = state.inCombat;
    $("#kitHelp").textContent = state.inCombat
      ? "Locked during combat. After a 24-hour respite, record it in Play before changing kits."
      : "Change only after a completed respite. You can record the respite in Play; this selector relies on you to confirm the timing.";
    if (document.activeElement !== $("#notes")) $("#notes").value = g.notes;
    $("#adjustments").innerHTML = ["focus", "surge", "rec", "vict", "tok"]
      .map(
        (key) =>
          '<div class="adjust-row"><span>' +
          {
            focus: "Focus",
            surge: "Surges",
            rec: "Recoveries",
            vict: "Victories",
            tok: "Hero tokens",
          }[key] +
          ": " +
          state[key] +
          '</span><button data-adjust="' +
          key +
          '" data-delta="-1" aria-label="Decrease ' +
          key +
          '">−</button><button data-adjust="' +
          key +
          '" data-delta="1" aria-label="Increase ' +
          key +
          '">+</button></div>',
      )
      .join("");
    renderCampaign();
    learning?.refresh();
  }
  function renderCampaign() {
    const names={wealth:'Wealth',renown:'Renown',xp:'Experience'};
    $('#campaignFields').innerHTML=Object.entries(names).map(([key,label])=>'<label>'+label+'<input type="number" min="0" step="1" data-set="'+key+'" value="'+state[key]+'"></label>').join('');
    const schemas = {
      projects: {n: 'Project name', p: 'Progress', g: 'Goal'},
      items: {n: 'Consumable name', c: 'Quantity'},
      gear: {n: 'Equipment name', d: 'Notes'}
    };
    const titles = {projects: 'Projects', items: 'Consumables', gear: 'Equipment'};
    const singular = {projects: 'project', items: 'consumable', gear: 'equipment'};
    $('#campaignLists').innerHTML = Object.entries(schemas).map(([key, fields]) =>
      '<section><h3>' + titles[key] + '</h3>' + state[key].map((row, index) =>
        '<div class="campaign-row" data-list-row="' + key + '" data-index="' + index + '">' +
        (editingRows.has(key + ':' + index) ? Object.entries(fields).map(([field, label]) => {
          const value = escapeText(String(row[field]));
          const control = field === 'd'
            ? '<textarea data-field="d" rows="3">' + value + '</textarea>'
            : '<input data-field="' + field + '" type="' + (typeof row[field] === 'number' ? 'number' : 'text') + '" value="' + value.replaceAll('"', '&quot;') + '">';
          return '<label class="campaign-field field-' + field + '">' + label + control + '</label>';
        }).join('') +
        '<div class="campaign-actions"><button data-list="' + key + '" data-operation="save">Save changes</button><button data-list="' + key + '" data-operation="cancel">Cancel</button></div>' :
        '<div class="campaign-summary"><h4>' + escapeText(row.n || 'Unnamed ' + singular[key]) + '</h4>' +
        (key === 'gear' ? '<p>' + escapeText(row.d || 'No notes.') + '</p>' : '<p>' + (key === 'projects' ? 'Progress: ' + row.p + ' / ' + row.g : 'Quantity: ' + row.c) + '</p>') +
        '</div><div class="campaign-actions"><button data-list="' + key + '" data-operation="edit">Edit</button><button data-list="' + key + '" data-operation="remove">Remove</button></div>') + '</div>'
      ).join('') + '<button data-list="' + key + '" data-operation="add">Add ' + singular[key] + '</button></section>'
    ).join('');
  }

  function actionOptions() {
    return {
      target: $("#target")?.value || "",
      confirm: $("#targetConfirmed")?.checked || false,
      d1: Number($("#die1")?.value),
      d2: Number($("#die2")?.value),
      edges: Number($("#edges")?.value || 0),
      banes: Number($("#banes")?.value || 0),
      surges: Number($("#spendSurges")?.value || 0),
      markEffect: $("#markEffect")?.checked || false,
      adjacent: $("#adjacent")?.checked || false,
      hold: $("#hold")?.checked || false,
      hurt: $("#hurt")?.checked || false,
      ranged: $("#attackRange")?.value === "ranged",
    };
  }
  function openAction(id) {
    $("#actionDialog [data-dialog-notice]")?.remove();
    $("#actionBody").oninput = null;
    const a = D.abilities(state)[id],
      why = D.whyUnavailable(state, id);
    $("#actionTitle").textContent = a.name;
    let html =
      '<p class="meta">' +
      a.type +
      " action · " +
      a.cost +
      " Focus · " +
      a.range +
      "</p>" +
      detail(a.blurb) +
      '<section class="rule-detail"><h3>How it works</h3>' +
      detail(a.detail) +
      "</section>";
    html = '<p class="origin">'+D.origin(id,state).label+'</p>'+html+window.GuidedLearning.mathBlock(state,id);
    if (id === "creative") {
      html += detail(
        "Describe what you want to accomplish. Ask the Director for the action cost and roll. Record any resource changes in My Hero, and look up general actions in Learn.",
      );
      $("#actionBody").innerHTML = html;
      openDialog($("#actionDialog"));
      return;
    }
    if (why) {
      html += '<p class="inline-error">' + escapeText(why) + "</p>";
      $("#actionBody").innerHTML = html;
      openDialog($("#actionDialog"));
      return;
    }
    if (a.target)
      html +=
        '<label for="target">' +
        (id === "strike" ? "Which ally?" : "Which creature?") +
        '</label><input id="target" maxlength="120" autocomplete="off" value="' +
        escapeText(id === "strike" ? "" : state.mark).replaceAll(
          '"',
          "&quot;",
        ) +
        '" placeholder="A name you’ll recognize"><label class="checkbox"><input id="targetConfirmed" type="checkbox">I confirm the target is allowed, in range and within line of effect.</label>';
    if (a.damage) {
      if (id === "mind")
        html +=
          '<label for="attackRange">Weapon</label><select id="attackRange"><option value="melee">Melee · adjacent</option><option value="ranged">Bow · within 15 squares</option></select>';
      html +=
        '<label class="checkbox"><input id="markEffect" type="checkbox" checked>Mark’s line-of-effect requirements are met. ' +
        (id === "mind"
          ? "Mind Game applies Mark before the roll."
          : "An edge is included if this is your Mark.") +
        "</label>";
      if (id === "patient" || id === "mind")
        html +=
          '<label class="checkbox"><input id="adjacent" type="checkbox">An enemy is adjacent to me (bane on a ranged strike).</label>';
      if (id === "patient")
        html +=
          '<label class="checkbox"><input id="hold" type="checkbox" ' +
          (state.guide.used.move ? "disabled" : "") +
          ">I will not use my move action this turn (+2 damage).</label>";
      if (id === "melee" && state.kit2 === "mountain")
        html +=
          '<label class="checkbox"><input id="hurt" type="checkbox">This foe damaged me since the end of my last turn (+2 damage).</label>';
      html +=
        '<div class="form-grid"><div><label for="edges">Other edges</label><select id="edges"><option>0</option><option>1</option><option>2</option></select></div><div><label for="banes">Other banes</label><select id="banes"><option>0</option><option>1</option><option>2</option></select></div></div><p class="small muted">Mark, Weakened, Prone, Restrained and the adjacent-enemy checkbox are counted for you. Add other modifiers here, including terrain, cover, fear or taunt.</p><label for="spendSurges">Surges to spend on damage (you have ' +
        state.surge +
        ')</label><select id="spendSurges">' +
        Array.from(
          { length: Math.min(3, state.surge) + 1 },
          (_, n) => "<option>" + n + "</option>",
        ).join("") +
        '</select><div class="form-grid"><div><label for="die1">First d10</label><input id="die1" type="number" min="1" max="10" inputmode="numeric"></div><div><label for="die2">Second d10</label><input id="die2" type="number" min="1" max="10" inputmode="numeric"></div></div><div class="button-row"><button id="rollDice" class="secondary">Roll for me</button><button id="resolveDice" class="primary-button">Use these dice →</button></div><div id="rollError" class="inline-error" role="alert"></div><div id="rollResult" hidden></div>';
    } else
      html +=
        '<button id="recordSimple" class="primary-button">Record ' +
        escapeText(a.name) +
        " →</button>";
    $("#actionBody").innerHTML = html;
    openDialog($("#actionDialog"));
    if (!a.damage) {
      $("#recordSimple").onclick = () => {
        if (commit({ type: "record", id, options: actionOptions() })) {
          $("#actionDialog").close();
          notice(a.name + " recorded.");
        }
      };
      return;
    }
    let prepared = null;
    function preview() {
      try {
        const o = actionOptions(),
          r = D.rollResult(state, id, o);
        prepared = o;
        $("#rollError").textContent = "";
        $("#rollResult").hidden = false;
        $("#rollResult").innerHTML =
          '<div class="result"><p class="eyebrow">SAY IT AT THE TABLE</p><div class="result-number">' +
          r.damage +
          " <small>damage · tier " +
          r.tier +
          '</small></div><p class="say">“' +
          escapeText(r.say) +
          '”</p><p class="math">' +
          escapeText(r.math) +
          "<br>Damage includes Might, kit bonuses and " +
          o.surges +
          " surge(s)." +
          (r.markEdge ? " Mark edge included." : "") +
          '</p><button id="recordRoll" class="primary-button">Record action' +
          (a.cost ? " · spend " + a.cost + " Focus" : "") +
          ' →</button><p class="small muted">Recording updates your action, Focus and surges together. Rolling alone changes nothing.</p></div>';
        $("#recordRoll").onclick = () => {
          if (prepared && commit({ type: "record", id, options: prepared })) {
            $("#actionDialog").close();
            notice("Action recorded. Undo is available.");
          }
        };
      } catch (e) {
        $("#rollError").textContent = e.message;
        $("#rollResult").hidden = true;
        prepared = null;
      }
    }
    $("#rollDice").onclick = () => {
      $("#die1").value = 1 + Math.floor(Math.random() * 10);
      $("#die2").value = 1 + Math.floor(Math.random() * 10);
      preview();
    };
    $("#resolveDice").onclick = preview;
    $("#actionBody").oninput = () => {
      prepared = null;
      $("#rollResult").hidden = true;
    };
  }
  function switchMode() {
    const next = mode === "practice" ? "live" : "practice";
    utility(
      next === "live" ? "Use your saved hero?" : "Return to practice?",
      detail(
        next === "live"
          ? read(LIVE)
            ? "Actions will update your saved hero. Your practice encounter stays separate."
            : "There is no saved hero at this address yet. Live mode will start a fresh hero. To bring an existing session here, switch modes and restore its JSON backup under My Hero. Practice stays separate."
          : "Your live hero stays saved. You’ll return to your separate practice encounter.",
      ) +
        '<button id="confirmMode" class="primary-button">' +
        (next === "live" ? "Use my saved hero" : "Return to practice") +
        "</button>",
    );
    $("#confirmMode").onclick = () => {
      mode = next;
      saveProblem = "";
      history = [];
      load();
      try {
        localStorage.setItem("ds-guided-mode", mode);
      } catch (e) {}
      view = "play";
      $("#utilityDialog").close();
      render();
    };
  }
  function conditionDialog() {
    utility(
      "What’s affecting you?",
      '<label for="conditionName">Condition</label><select id="conditionName">' +
        Object.keys(D.CONDITIONS)
          .map((n) => "<option>" + n + "</option>")
          .join("") +
        '</select><label for="conditionDuration">Duration</label><select id="conditionDuration"><option value="save">Save ends</option><option value="eot">End of next turn (EoT)</option><option value="clear">Remove condition</option></select><p class="small muted">Track the source and timing at the table. Save ends: roll a d10 at the end of your turn; 6+ ends it. Dying bleeding stays until you are healed.</p><button id="applyCondition" class="primary-button">Update condition</button>',
    );
    $("#applyCondition").onclick = () => {
      if (
        commit({
          type: "condition",
          name: $("#conditionName").value,
          duration: $("#conditionDuration").value,
        })
      )
        $("#utilityDialog").close();
    };
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      mode === "practice"
        ? "aravinthaya-practice.json"
        : "aravinthaya-tracker.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("Backup downloaded.");
  }
  function endTurn() {
    if (commit({ type: "watch" })) {
      const saves = Object.keys(state.conds).filter(
        (n) => state.conds[n] === "save",
      );
      utility(
        "Before you pass the turn.",
        detail(
          saves.length
            ? "Roll a d10 for each save-ends condition: " +
                saves.join(", ") +
                ". A 6+ ends that effect."
            : "No save-ends conditions are recorded. Check for effects ending now.",
        ) +
          detail(
            "Resolve bleeding from your actions and any EoT effects with the table. Use Conditions to remove an effect that ended.",
          ) +
          '<button class="primary-button" data-close>Watch the next turn →</button>',
      );
    }
  }
  const clickEvents = {
    start: { type: "start" },
    beginTurn: { type: "turn" },
    watchBeginTurn: { type: "turn" },
    nextRound: { type: "round" },
    endCombat: { type: "end" },
    recover: { type: "recovery" },
    victory: { type: "adjust", key: "vict", delta: 1 },
    markHit: { type: "markHit" },
    allyHeroic: { type: "allyHeroic" },
  };
  for (const [id, event] of Object.entries(clickEvents))
    $("#" + id).onclick = () => {
      if (commit(event)) notice(state.guide.log[0]);
    };
  $('#respite').onclick = () => {
    utility('Complete a respite', detail('Confirm that your hero has completed 24 uninterrupted hours of rest. This restores all Stamina and Recoveries and converts your '+state.vict+' Victories to XP. Ending a fight alone is not a respite. Resolve your respite activity and any lasting effects with the Director.') + '<button id="confirmRespite" class="primary-button">Record completed respite</button>');
    $('#confirmRespite').onclick = () => { if(commit({type:'respite'})){ $('#utilityDialog').close(); notice('Respite recorded. Change kits in My Hero if needed.'); } };
  };
  $("#endTurn").onclick = endTurn;

  $("#conditionOpen").onclick = conditionDialog;
  $("#switchMode").onclick = switchMode;
  $("#download").onclick = download;
  $("#resetIntent").onclick = () => {
    intent = "all";
    render();
  };
  $("#creative").onclick = () => openAction("creative");
  $("#undo").onclick = () => {
    if (!history.length || conflict()) return;
    state = D.validate(JSON.parse(history.pop()));
    phase = state.guide.phase;
    saved();
    render();
    notice("Last change undone.");
  };
  $("#kitSelect").onchange = (e) =>
    commit({ type: "kit", kit: e.target.value });
  $("#saveNotes").onclick = () => {
    if (commit({ type: "notes", text: $("#notes").value }))
      notice("Notes saved.");
  };
  $("#extraAction").onclick = () => {
    utility(
      "An extra action or a correction.",
      detail(
        "Use this only when a rule grants an extra action, such as a critical hit, or to correct the tracker. It does not grant extra actions by itself.",
      ) +
        '<p><b>Trade your available main action</b> for another maneuver or move:</p><div class="button-row"><button class="secondary" data-trade="maneuver">Main → maneuver</button><button class="secondary" data-trade="move">Main → move</button></div><p>Or record an action granted by a rule / correct a mistake:</p><div class="button-row">' +
        ["main", "maneuver", "move"]
          .map(
            (slot) =>
              '<button class="secondary" data-extra="' +
              slot +
              '">Make ' +
              slot +
              " available</button>",
          )
          .join("") +
        "</div>",
    );
  };
  $("#overwatch").onclick = () => {
    utility(
      "Overwatch · Your class",
      detail(
        "Confirm the moving creature is within 10 squares and line of effect. Choose an ally who can legally free-strike it during the movement. The ally resolves their own attack.",
      ) +
        '<button id="confirmOverwatch" class="primary-button">Confirm · use triggered action</button><p class="small muted">Optional 1-Focus slow against Reason below 1: subtract 1 Focus directly if you choose that option.</p>',
    );
    $("#confirmOverwatch").onclick = () => {
      if (commit({ type: "overwatch" })) $("#utilityDialog").close();
    };
  };
  $("#markPerk").onclick = () => {
    utility(
      "Mark benefit · Your class",
      detail(
        "Confirm you or an ally dealt rolled damage to your Mark with an ability. Choose one benefit for that hit:",
      ) +
        '<ul><li>Deal 4 extra damage.</li><li>The attacker may spend one of their own Recoveries.</li><li>The attacker may shift up to 2 squares.</li><li>Only on your own melee hit: taunt the target until the end of its next turn.</li></ul><p>The attacker records their own healing or movement. This spends 1 Focus and does not use your regular triggered action.</p><button id="confirmPerk" class="primary-button">Confirm a benefit · spend 1 Focus</button>',
    );
    $("#confirmPerk").onclick = () => {
      if (commit({ type: "perk" })) $("#utilityDialog").close();
    };
  };
  $("#restoreFile").onchange = async function () {
    const file = this.files[0];
    this.value = "";
    if (!file) return;
    try {
      const next = D.validate(JSON.parse(await file.text()));
      if (read(key()) !== lastRaw) {
        notice("Saved data changed elsewhere; reload before restoring.");
        return;
      }
      history.push(JSON.stringify(state));
      state = next;
      editingRows.clear(); newRows.clear();
      phase = state.guide.phase;
      saveProblem = "";
      saved();
      render();
      notice("Backup restored. Undo is available.");
    } catch (e) {
      notice("Could not restore: " + e.message);
    }
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-close")) {
      b.closest("dialog").close();
      return;
    }
    if (b.dataset.view) {
      showView(b.dataset.view);
      return;
    }
    if (b.dataset.phase) {
      phase = b.dataset.phase;
      render();
      return;
    }
    if (b.dataset.intent) {
      intent = b.dataset.intent;
      render();
      return;
    }
    if (b.dataset.action) {
      openAction(b.dataset.action);
      return;
    }
    if (b.dataset.term) {
      utility(
        b.textContent === "?" ? "A quick explanation" : b.textContent,
        detail(TERMS[b.dataset.term]),
      );
      return;
    }
    if (b.dataset.rule) { b.closest('dialog')?.close(); learning.open(b.dataset.rule); return; }
    if (b.dataset.quickDamage || b.dataset.quickHeal) { commit({type:'health',kind:b.dataset.quickDamage?'damage':'heal',amount:Number(b.dataset.quickDamage||b.dataset.quickHeal)});return; }
    if (b.dataset.list) {
      const key = b.dataset.list, operation = b.dataset.operation;
      const parent = b.closest('[data-list-row]'), index = Number(parent?.dataset.index);
      const token = key + ':' + index;
      if (operation === 'edit') { editingRows.add(token); renderCampaign(); return; }
      if (operation === 'cancel') {
        if (newRows.has(token) && !commit({type:'list',key,operation:'remove',index})) return;
        editingRows.delete(token); newRows.delete(token); renderCampaign(); return;
      }
      const row = {};
      parent?.querySelectorAll('[data-field]').forEach(i => row[i.dataset.field] = i.type === 'number' ? Number(i.value) : i.value);
      if (commit({type:'list',key,operation,index,row})) {
        editingRows.clear(); newRows.clear();
        if (operation === 'add') { const added = key + ':' + (state[key].length - 1); editingRows.add(added); newRows.add(added); }
        renderCampaign();
        if (operation === 'save') notice(saveProblem || 'Changes saved.');
      }
      return;
    }
    if (b.dataset.staminaExtra) {
      const temporary = b.dataset.staminaExtra === 'temp';
      utility(temporary ? 'Temporary Stamina' : 'Bleeding / direct Stamina loss',
        detail(temporary
          ? 'Only add this when an ability or effect grants temporary Stamina. It is a separate buffer, not healing. Your damage buttons use it first automatically. A new amount replaces the old buffer only if larger; the amounts do not add together.'
          : 'Enter the Stamina loss specified by the effect. This bypasses temporary Stamina. For ordinary damage, use the minus buttons instead.') +
        '<label for="healthAmount">' + (temporary ? 'Temporary Stamina granted' : 'Stamina lost') + '</label><input id="healthAmount" type="number" min="1" max="9999" value="1"><button class="primary-button" data-health="' + (temporary ? 'temp' : 'loss') + '">' + (temporary ? 'Apply temporary Stamina' : 'Record Stamina loss') + '</button>');
      return;
    }
    if (b.dataset.health) {
      const previousTemp = state.temp;
      if (
        commit({
          type: "health",
          kind: b.dataset.health,
          amount: Number($("#healthAmount").value),
        })
      ) {
        $('#utilityDialog').close();
        if(b.dataset.health === 'temp') notice(state.temp === previousTemp
          ? 'Temporary Stamina stays at '+state.temp+'. Keep the higher amount; it does not add together.'
          : 'Temporary Stamina is now '+state.temp+'.');
      }
      return;
    }
    if (b.dataset.trade) {
      if (commit({ type: "trade", slot: b.dataset.trade }))
        $("#utilityDialog").close();
      return;
    }
    if (b.dataset.extra) {
      if (commit({ type: "extra", slot: b.dataset.extra }))
        $("#utilityDialog").close();
      return;
    }
    if (b.dataset.adjust) {
      commit({
        type: "adjust",
        key: b.dataset.adjust,
        delta: Number(b.dataset.delta),
      });
      return;
    }

  });
  window.addEventListener("storage", (e) => {
    if (e.key === key()) {
      for (const dialog of $$("dialog[open]")) dialog.close();
      load();
      history = [];
      render();
      notice("Updated from the other tracker.");
    }
  });
  document.addEventListener('change',e=>{
    const key=e.target.dataset.set||({stamina:'stam',focus:'focus',surges:'surge'}[e.target.id]);
    if(key){if(!commit({type:'set',key,value:e.target.value.trim()===''?NaN:Number(e.target.value)}))render();}
  });
  learning=window.GuidedLearning.mount({getState:()=>state,showLearn:()=>showView('learn')});
  render();
  if(location.hash.startsWith('#learn'))learning.open(location.hash.split('/')[1]||'start');
})();
