(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DrawSteel = factory();
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const KITS = {
    shining: {
      name: "Shining Armor",
      max: 33,
      wind: 16,
      heal: 11,
      stability: 1,
      free: [6, 9, 11],
      mind: [8, 10, 14],
    },
    mountain: {
      name: "Mountain",
      max: 30,
      wind: 15,
      heal: 10,
      stability: 2,
      free: [5, 8, 14],
      mind: [7, 9, 17],
    },
  };
  const CONDITIONS = {
    Bleeding:
      "After a main or triggered action, or a Might/Agility roll, lose 1d6 + your level Stamina. Record it as direct loss, not damage.",
    Dazed:
      "One main action, maneuver, or move on your turn. No triggered actions, including free ones, or free maneuvers.",
    Frightened:
      "Bane on ability rolls against the source. Its ability rolls against you gain an edge. You cannot willingly approach its known location.",
    Grabbed:
      "Speed 0. Bane on abilities that do not target the grabber. Use Escape Grab, teleport, or forced movement that separates you.",
    Prone:
      "Your strikes take a bane. Melee abilities against you gain an edge. Crawl at double movement cost; Stand Up is a maneuver.",
    Restrained:
      "Speed 0; no standing or forced movement. Bane on ability rolls and Might/Agility tests. Abilities against you gain an edge. Teleporting ends it.",
    Slowed: "Speed 2 unless already lower. You cannot shift.",
    Taunted:
      "Double bane on ability rolls that do not target the taunter while you have line of effect to them.",
    Weakened: "Bane on all power rolls. Saving throws are not power rolls.",
  };
  function fresh() {
    return {
      stam: 33,
      temp: 0,
      rec: 10,
      focus: 0,
      surge: 0,
      tok: 0,
      vict: 0,
      wealth: 1,
      renown: 1,
      xp: 0,
      conds: {},
      projects: [],
      items: [],
      gear: [
        {
          n: "Heelcutter",
          d: "Campaign heavy weapon; +1 damage included in Mountain numbers.",
        },
      ],
      kit2: "shining",
      inCombat: false,
      round: 0,
      turnTaken: false,
      mUsed: false,
      aUsed: false,
      trig: false,
      mark: "",
      guide: {
        phase: "rest",
        used: { main: false, maneuver: false, move: false },
        log: [],
        notes: "",
        lesson: 0,
        granted: null,
      },
    };
  }
  function validate(raw) {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      !Number.isSafeInteger(raw.stam) ||
      !Number.isSafeInteger(raw.rec)
    )
      throw Error("This is not a character backup.");
    const s = fresh();
    for (const key of Object.keys(s)) {
      if (!(key in raw) || key === "guide") continue;
      const value = raw[key],
        type = typeof s[key];
      if (
        type === "number" &&
        (!Number.isSafeInteger(value) || Math.abs(value) > 1000000)
      )
        throw Error("Invalid character number.");
      if (type === "boolean" && typeof value !== "boolean")
        throw Error("Invalid character flag.");
      if (
        type === "string" &&
        (typeof value !== "string" || value.length > 20000)
      )
        throw Error("Invalid character text.");
      s[key] = clone(value);
    }
    if (!Object.hasOwn(KITS, s.kit2)) throw Error("Unknown kit.");
    if (
      !s.conds ||
      Array.isArray(s.conds) ||
      typeof s.conds !== "object" ||
      Object.entries(s.conds).some(
        ([k, v]) =>
          !Object.hasOwn(CONDITIONS, k) || !["eot", "save"].includes(v),
      )
    )
      throw Error("Invalid conditions.");
    for (const [key, texts, nums] of [
      ["projects", ["n"], ["p", "g"]],
      ["items", ["n"], ["c"]],
      ["gear", ["n", "d"], []],
    ]) {
      if (!Array.isArray(s[key]) || s[key].length > 500)
        throw Error("Invalid inventory.");
      for (const row of s[key]) {
        if (!row || typeof row !== "object")
          throw Error("Invalid inventory row.");
        for (const k of texts)
          if (typeof row[k] !== "string" || row[k].length > 20000)
            throw Error("Invalid inventory text.");
        for (const k of nums)
          if (!Number.isSafeInteger(row[k]) || row[k] < 0)
            throw Error("Invalid inventory number.");
      }
    }
    if (raw.guide) {
      const g = raw.guide;
      if (
        !["rest", "turn", "watch"].includes(g.phase) ||
        !g.used ||
        ["main", "maneuver", "move"].some(
          (k) => typeof g.used[k] !== "boolean",
        ) ||
        typeof g.notes !== "string" ||
        g.notes.length > 20000 ||
        !Array.isArray(g.log) ||
        g.log.some((x) => typeof x !== "string" || x.length > 2000) ||
        !Number.isInteger(g.lesson) ||
        g.lesson < 0 ||
        g.lesson > 5
      )
        throw Error("Invalid guided session.");
      s.guide = {
        phase: g.phase,
        used: clone(g.used),
        notes: g.notes,
        log: g.log.slice(0, 30),
        lesson: g.lesson,
        granted: ["main", "maneuver", "move"].includes(g.granted)
          ? g.granted
          : null,
      };
    } else s.guide.phase = s.inCombat ? "watch" : "rest";
    return normalize(s);
  }
  function normalize(s) {
    const k = KITS[s.kit2];
    s.stam = Math.max(-k.wind, Math.min(k.max, s.stam));
    s.rec = Math.max(0, Math.min(10, s.rec));
    for (const key of [
      "temp",
      "focus",
      "surge",
      "tok",
      "vict",
      "wealth",
      "renown",
      "xp",
      "round",
    ])
      s[key] = Math.max(0, s[key]);
    if (s.stam <= 0) s.mark = "";
    if (!s.inCombat) s.guide.phase = "rest";
    return s;
  }
  function log(s, text) {
    s.guide.log.unshift(text);
    s.guide.log = s.guide.log.slice(0, 30);
  }
  function abilities(s) {
    const k = KITS[s.kit2];
    return {
      mark: {
        name: "Mark a foe",
        type: "maneuver",
        cost: 0,
        range: "10 squares",
        intent: "help",
        blurb: "Point out the enemy your party should focus on.",
        detail:
          "You and allies within your line of effect gain an edge against this creature while it is also within your line of effect. Mark ends if you mark another target, become dying, or the encounter ends.",
        target: true,
      },
      patient: {
        name: "Patient Shot",
        type: "main",
        cost: 0,
        range: "15 squares",
        intent: "hurt",
        blurb: "A steady bow shot. Stronger when you stay put.",
        detail:
          "If you do not use your move action this turn, add 2 damage. An adjacent enemy gives your ranged strike a bane.",
        damage: [5, 8, 15],
        target: true,
        ranged: true,
      },
      melee: {
        name: s.kit2 === "mountain" ? "Pain for Pain" : "Protective Attack",
        type: "main",
        cost: 0,
        range: "Adjacent",
        intent: "hurt",
        blurb:
          s.kit2 === "mountain"
            ? "Hit back harder at a foe who hurt you."
            : "Strike a foe and make ignoring you costly.",
        detail:
          s.kit2 === "mountain"
            ? "Includes Heelcutter. Add 2 damage if the target damaged you since the end of your last turn."
            : "The target is taunted by you until the end of its next turn.",
        damage: s.kit2 === "mountain" ? [6, 8, 16] : [7, 10, 13],
        target: true,
      },
      mind: {
        name: "Mind Game",
        type: "main",
        cost: 5,
        range: "Adjacent or 15 squares",
        intent: "hurt",
        blurb: "Mark, strike, and try to weaken a dangerous enemy.",
        detail:
          "Marks before the roll. Reason below 0 / 1 / 2 by tier: weakened (save ends). Before your next turn, the first ally to damage any of your Marks may spend one of their own Recoveries, no action required.",
        damage: k.mind,
        target: true,
      },
      strike: {
        name: "Strike Now!",
        type: "main",
        cost: 0,
        range: "10 squares",
        intent: "help",
        blurb: "Give an ally an immediate signature ability.",
        detail:
          "One ally uses a signature ability as a free triggered action. They resolve their own roll. The 5-Focus upgrade for two allies is available through the full reference.",
        target: true,
      },
      squad: {
        name: "Squad! Forward!",
        type: "maneuver",
        cost: 3,
        range: "10 squares",
        intent: "move",
        blurb: "Get yourself and two allies into position.",
        detail:
          "You and two allies each move up to your own speeds. This does not spend their move actions. Check opportunity attacks; this is movement, not shifting.",
      },
      advance: {
        name: "Move",
        type: "move",
        cost: 0,
        range: "Your speed",
        intent: "move",
        blurb: "Move to a better position.",
        detail:
          "Base speed 6. Movement can be split around your other actions. Account for terrain and opportunity attacks. This prototype marks the move action used, not individual squares.",
      },
      disengage: {
        name: "Disengage",
        type: "move",
        cost: 0,
        range: "Shift 2",
        intent: "move",
        blurb: "Step away without provoking opportunity attacks.",
        detail:
          "Your kits let you shift up to 2 squares. You cannot shift while slowed.",
      },
      recover: {
        name: "Catch Breath",
        type: "maneuver",
        cost: 0,
        range: "You",
        intent: "protect",
        blurb: "Spend a Recovery to regain " + k.heal + " Stamina.",
        detail:
          "Costs one of your own Recoveries. You cannot Catch Breath while dying in combat.",
      },
      defend: {
        name: "Defend",
        type: "main",
        cost: 0,
        range: "You",
        intent: "protect",
        blurb: "Protect yourself, unless a creature is taunted by you.",
        detail:
          "Until the start of your next turn, ability rolls against you have a double bane. You also gain a double edge on tests to resist environmental effects or a creature’s traits or abilities. You gain no benefit while any creature is taunted by you.",
      },
      creative: {
        name: "Try something else",
        type: "main",
        cost: 0,
        range: "Ask the Director",
        intent: "creative",
        blurb: "Describe your idea. The sheet is not the limit.",
        detail:
          "Ask the Director whether your idea needs a roll and which action it uses. Use the full reference for Charge, Grab, Aid Attack, Heal and other actions. This card does not spend an action automatically.",
      },
    };
  }
  function whyUnavailable(s, id) {
    const a = abilities(s)[id];
    if (!a) return "Unknown action.";
    if (!s.inCombat || s.guide.phase !== "turn")
      return "Begin your turn first.";
    if (s.stam <= -KITS[s.kit2].wind)
      return "This hero is dead; check with the Director.";
    if (s.guide.used[a.type])
      return "Your " + a.type + " action is already used.";
    if (
      s.conds.Dazed &&
      s.guide.granted !== a.type &&
      Object.values(s.guide.used).some(Boolean)
    )
      return "Dazed: you can take only one action on your turn.";
    if (s.focus < a.cost)
      return "Needs " + a.cost + " Focus; you have " + s.focus + ".";
    if (
      id === "recover" &&
      (s.stam <= 0 || s.rec <= 0 || s.stam >= KITS[s.kit2].max)
    )
      return "You need a Recovery, missing Stamina, and must not be dying.";
    if (
      ["advance", "disengage"].includes(id) &&
      (s.conds.Grabbed || s.conds.Restrained)
    )
      return "Speed 0: resolve your condition first.";
    if (id === "disengage" && s.conds.Slowed)
      return "Slowed: you cannot shift.";
    return "";
  }
  function rollResult(s, id, o) {
    const a = abilities(s)[id];
    if (!a || !a.damage)
      throw Error("This ability does not use your power roll.");
    for (const die of [o.d1, o.d2])
      if (!Number.isInteger(die) || die < 1 || die > 10)
        throw Error("Enter each d10 as a whole number from 1 to 10.");
    for (const v of [o.edges, o.banes])
      if (!Number.isInteger(v) || v < 0 || v > 2)
        throw Error("Choose 0, 1, or 2 edges and banes.");
    if (
      !Number.isInteger(o.surges) ||
      o.surges < 0 ||
      o.surges > 3 ||
      o.surges > s.surge
    )
      throw Error("You do not have that many surges (maximum 3).");
    if (!o.target || !o.target.trim() || !o.confirm)
      throw Error("Confirm a valid target in range and line of effect.");
    const ranged = id === "patient" || (id === "mind" && o.ranged),
      marked =
        id === "mind" ||
        (s.mark && s.mark.toLowerCase() === o.target.trim().toLowerCase());
    const markEdge = Boolean(marked && s.stam > 0 && o.markEffect),
      e = Math.min(2, o.edges + (markEdge ? 1 : 0)),
      b = Math.min(
        2,
        o.banes +
          (ranged && o.adjacent ? 1 : 0) +
          (s.conds.Weakened ? 1 : 0) +
          (s.conds.Prone ? 1 : 0) +
          (s.conds.Restrained ? 1 : 0),
      );
    const net = e - b,
      flat = Math.abs(net) === 1 ? net * 2 : 0,
      natural = o.d1 + o.d2,
      total = natural + 2 + flat,
      crit = natural >= 19;
    const tier = crit
      ? 3
      : Math.max(
          1,
          Math.min(
            3,
            (total <= 11 ? 1 : total <= 16 ? 2 : 3) +
              (Math.abs(net) === 2 ? Math.sign(net) : 0),
          ),
        );
    if (id === "patient" && o.hold && s.guide.used.move)
      throw Error("You already used your move action.");
    const bonus =
        (id === "patient" && o.hold ? 2 : 0) +
        (id === "melee" && s.kit2 === "mountain" && o.hurt ? 2 : 0),
      damage =
        (id === "mind" && ranged ? [6, 8, 16] : a.damage)[tier - 1] +
        bonus +
        o.surges * 2;
    let rider =
      id === "melee" && s.kit2 === "shining"
        ? " The target is taunted until the end of its next turn."
        : id === "mind"
          ? " Target is marked. If its Reason is below " +
            (tier - 1) +
            ", it is weakened (save ends). Remind the first ally to damage your Mark before your next turn that they may spend a Recovery."
          : "";
    return {
      tier,
      damage,
      crit,
      markEdge,
      math:
        o.d1 +
        " + " +
        o.d2 +
        " + 2 Might" +
        (flat ? " " + (flat > 0 ? "+ " : "− ") + Math.abs(flat) : "") +
        " = " +
        total +
        (Math.abs(net) === 2
          ? " · " + (net > 0 ? "up" : "down") + " one tier"
          : "") +
        (crit ? " · natural " + natural + ": automatic tier 3" : ""),
      say:
        "I use " +
        a.name +
        " on " +
        o.target.trim() +
        " and deal " +
        damage +
        " damage." +
        rider +
        (crit
          ? " Critical hit: I can immediately take an additional action."
          : ""),
    };
  }
  function apply(state, event) {
    const s = clone(state),
      g = s.guide,
      k = KITS[s.kit2];
    switch (event.type) {
      case "start":
        if (s.inCombat) throw Error("Combat is already running.");
        s.inCombat = true;
        s.round = 1;
        s.focus = s.vict;
        s.surge = 1;
        s.mark = "";
        s.turnTaken = s.mUsed = s.aUsed = s.trig = false;
        g.used = { main: false, maneuver: false, move: false };
        g.granted = null;
        g.phase = "watch";
        log(
          s,
          "Combat begins. " +
            s.focus +
            " Focus from Victories; 1 ancestry surge.",
        );
        break;
      case "turn":
        if (!s.inCombat || s.turnTaken)
          throw Error(
            "Your turn is already recorded, or combat has not started.",
          );
        s.turnTaken = true;
        s.focus += 2;
        g.phase = "turn";
        g.used = { main: false, maneuver: false, move: false };
        g.granted = null;
        log(s, "My turn begins: +2 Focus.");
        break;
      case "watch":
        if (!s.inCombat) throw Error("No combat is running.");
        g.phase = "watch";
        log(
          s,
          "My turn ends. Resolve EoT effects and save-ends conditions at the table.",
        );
        break;
      case "round":
        if (!s.inCombat) throw Error("No combat is running.");
        s.round++;
        s.turnTaken = s.mUsed = s.aUsed = s.trig = false;
        g.used = { main: false, maneuver: false, move: false };
        g.granted = null;
        g.phase = "watch";
        log(
          s,
          "Round " + s.round + " begins. Round-limited benefits refreshed.",
        );
        break;
      case "end":
        s.inCombat = false;
        s.focus = s.surge = s.temp = 0;
        s.mark = "";
        s.turnTaken = false;
        g.phase = "rest";
        log(
          s,
          "Combat ends. Focus, surges, temporary Stamina and Mark cleared.",
        );
        break;
      case "record": {
        const id = event.id,
          a = abilities(s)[id],
          o = event.options || {},
          why = whyUnavailable(s, id);
        if (why) throw Error(why);
        if (id === "creative")
          throw Error(
            "Agree the action with your Director; adjust trackers manually.",
          );
        if (a.target && (!o.confirm || !o.target?.trim()))
          throw Error("Confirm a valid target.");
        const result = a.damage ? rollResult(s, id, o) : null;
        s.focus -= a.cost;
        g.used[a.type] = true;
        if ((id === "mark" || id === "mind") && s.stam > 0)
          s.mark = o.target.trim();
        if (g.granted === a.type) g.granted = null;
        if (id === "recover") {
          s.rec--;
          s.stam += k.heal;
        }
        if (result) {
          s.surge -= o.surges;
          if (id === "patient" && o.hold) g.used.move = true;
          if (
            s.mark.toLowerCase() === o.target.trim().toLowerCase() &&
            !s.mUsed
          ) {
            s.mUsed = true;
            s.focus++;
            log(s, "First damage to my Mark this round: +1 Focus.");
          }
          if (result.crit)
            log(
              s,
              "Critical hit: take an additional action now; use the extra-action control.",
            );
        }
        log(
          s,
          result
            ? result.say
            : a.name +
                " recorded" +
                (o.target ? " · " + o.target.trim() : "") +
                ".",
        );
        break;
      }
      case "extra":
        if (!s.inCombat || g.phase !== "turn")
          throw Error("Begin your turn before correcting its actions.");
        if (!["main", "maneuver", "move"].includes(event.slot))
          throw Error("Choose an action.");
        g.used[event.slot] = false;
        g.granted = event.slot;
        log(
          s,
          "Manual correction / granted extra action: " +
            event.slot +
            " available.",
        );
        break;
      case "trade":
        if (
          !s.inCombat ||
          g.phase !== "turn" ||
          g.used.main ||
          (s.conds.Dazed && Object.values(g.used).some(Boolean)) ||
          !["maneuver", "move"].includes(event.slot)
        )
          throw Error("An available main action is required.");
        g.used.main = true;
        g.used[event.slot] = false;
        g.granted = event.slot;
        log(s, "Traded main action for an extra " + event.slot + ".");
        break;
      case "markHit":
        if (!s.inCombat || !s.mark || s.mUsed)
          throw Error("Needs your Mark and an unused round gain.");
        s.mUsed = true;
        s.focus++;
        log(s, "First damage to my Mark this round: +1 Focus.");
        break;
      case "allyHeroic":
        if (!s.inCombat || s.aUsed)
          throw Error("This round gain is already used.");
        s.aUsed = true;
        s.focus++;
        log(s, "Ally within 10 used a heroic ability: +1 Focus.");
        break;
      case "overwatch":
        if (!s.inCombat || s.trig || s.conds.Dazed || s.stam <= -k.wind)
          throw Error("Your triggered action is unavailable.");
        s.trig = true;
        log(
          s,
          "Overwatch: an ally makes a free strike during the target’s movement.",
        );
        break;
      case "perk":
        if (!s.inCombat || !s.mark || s.focus < 1 || s.conds.Dazed)
          throw Error("Needs a Mark, 1 Focus and a free triggered action.");
        s.focus--;
        log(
          s,
          "Mark benefit: spent 1 Focus. Resolve the selected benefit with the attacker.",
        );
        break;
      case "health": {
        const n = event.amount;
        if (!Number.isSafeInteger(n) || n < 1 || n > 9999)
          throw Error("Enter a positive whole number, up to 9999.");
        if (event.kind === "damage") {
          const absorbed = Math.min(s.temp, n);
          s.temp -= absorbed;
          s.stam -= n - absorbed;
        } else if (event.kind === "heal") s.stam += n;
        else if (event.kind === "loss") s.stam -= n;
        else if (event.kind === "temp") s.temp = Math.max(s.temp, n);
        else
          throw Error(
            "Choose damage, healing, direct loss or temporary Stamina.",
          );
        log(s, event.kind + ": " + n + ".");
        break;
      }
      case "recovery":
        if (s.inCombat || s.rec < 1 || s.stam <= -k.wind || s.stam >= k.max)
          throw Error("Cannot spend a Recovery now.");
        s.rec--;
        s.stam += k.heal;
        log(s, "Spent one Recovery; regained up to " + k.heal + " Stamina.");
        break;
      case "condition":
        if (!Object.hasOwn(CONDITIONS, event.name))
          throw Error("Unknown condition.");
        if (event.duration === "clear") delete s.conds[event.name];
        else if (["save", "eot"].includes(event.duration))
          s.conds[event.name] = event.duration;
        else throw Error("Choose a duration.");
        log(s, event.name + ": " + event.duration + ".");
        break;
      case "adjust":
        if (
          !["focus", "surge", "rec", "vict", "tok"].includes(event.key) ||
          !Number.isInteger(event.delta) ||
          Math.abs(event.delta) > 5
        )
          throw Error("Invalid adjustment.");
        s[event.key] += event.delta;
        log(
          s,
          "Adjusted " +
            event.key +
            " " +
            (event.delta > 0 ? "+" : "") +
            event.delta +
            ".",
        );
        break;
      case "kit":
        if (s.inCombat || !Object.hasOwn(KITS, event.kit))
          throw Error("Change kits after a respite, outside combat.");
        s.kit2 = event.kit;
        log(s, "Kit selected after respite: " + KITS[event.kit].name + ".");
        break;
      case "notes":
        if (typeof event.text !== "string" || event.text.length > 20000)
          throw Error("Notes are too long.");
        g.notes = event.text;
        break;
      case "lesson":
        g.lesson = Math.min(5, g.lesson + 1);
        break;
      default:
        throw Error("Unknown event.");
    }
    return normalize(s);
  }
  return {
    fresh,
    validate,
    apply,
    abilities,
    whyUnavailable,
    rollResult,
    KITS,
    CONDITIONS,
  };
});
