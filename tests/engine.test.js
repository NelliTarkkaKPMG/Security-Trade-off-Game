const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../js/data.js");
const engine = require("../js/engine.js");

const ransomware = data.scenarios.find((s) => s.id === "ransomware");
const always = () => 0; // roll 0 < p → every stage with any defence blocks
const never = () => 0.999999; // nothing blocks, nothing detected
const tier = (id) => data.attackerTiers.find((t) => t.id === id);
const difficulty = (id) => data.difficulties.find((d) => d.id === id);
const sme = difficulty("sme");

test("all control references in scenarios exist", () => {
  const ids = new Set(data.controls.map((c) => c.id));
  for (const s of data.scenarios) {
    const refs = [...s.stages.flatMap((st) => Object.keys(st.prevent)), ...Object.keys(s.detect), ...Object.keys(s.recover)];
    for (const id of refs) assert.ok(ids.has(id), `${s.id} references unknown control ${id}`);
  }
});

test("every control is useful in at least one scenario", () => {
  const used = new Set();
  for (const s of data.scenarios) {
    s.stages.forEach((st) => Object.keys(st.prevent).forEach((id) => used.add(id)));
    Object.keys(s.detect).forEach((id) => used.add(id));
    Object.keys(s.recover).forEach((id) => used.add(id));
  }
  for (const c of data.controls) assert.ok(used.has(c.id), `${c.id} is never used`);
});

test("no budget can buy every control", () => {
  const all = engine.totalCost(data.controls.map((c) => c.id), data.controls);
  for (const d of data.difficulties) assert.ok(d.budget < all / 1.5, d.id);
});

test("combine uses 1 - Π(1 - p)", () => {
  const { p } = engine.combine({ a: 0.5, b: 0.5, c: 0.9 }, ["a", "b"], 1);
  assert.equal(p, 0.75);
});

test("friction above the limit weakens controls", () => {
  assert.equal(engine.effectivenessMultiplier(data.frictionLimit, data.frictionLimit), 1);
  assert.ok(engine.effectivenessMultiplier(data.frictionLimit + 2, data.frictionLimit) < 1);
  assert.ok(engine.effectivenessMultiplier(100, data.frictionLimit) >= 0.6);
});

test("attack blocked at first stage causes no damage", () => {
  const r = engine.runAttack(ransomware, ["email"], data, { rng: always });
  assert.equal(r.blockedAt, 0);
  assert.equal(r.damage, 0);
  assert.equal(r.grade.id, "blocked");
});

test("undefended attack causes full damage", () => {
  const r = engine.runAttack(ransomware, [], data, { rng: never });
  assert.ok(r.breached);
  assert.ok(Math.abs(r.damage - ransomware.impact) < 0.01);
  assert.equal(r.grade.id, "critical");
});

test("backups reduce breach damage", () => {
  const r = engine.runAttack(ransomware, ["backup"], data, { rng: never });
  assert.ok(r.breached);
  assert.ok(Math.abs(r.damage - ransomware.impact * 0.3) < 0.01);
});

test("impact scales with difficulty", () => {
  const r = engine.runAttack(ransomware, [], data, { impactScale: 2, rng: never });
  assert.ok(Math.abs(r.damage - ransomware.impact * 2) < 0.01);
});

test("expected loss matches simulation average", () => {
  const sel = ["email", "edr", "backup", "siem"];
  const opts = { tier: tier("advanced") };
  const expected = engine.expectedLoss(ransomware, sel, data, opts).loss;
  let seed = 42;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let sum = 0;
  const n = 50000;
  for (let i = 0; i < n; i++) sum += engine.runAttack(ransomware, sel, data, { ...opts, rng }).damage;
  assert.ok(Math.abs(sum / n - expected) / expected < 0.05, `${sum / n} vs ${expected}`);
});

test("more controls never increase expected loss when friction stays under limit", () => {
  const base = engine.riskProfile(["email"], data, sme).expectedLoss;
  const more = engine.riskProfile(["email", "siem"], data, sme).expectedLoss;
  assert.ok(more < base);
});

test("bestAdditions suggests relevant controls and flags affordability", () => {
  const adds = engine.bestAdditions(ransomware, [], data, {}, 20);
  assert.ok(adds.length > 0);
  assert.ok(adds.slice(0, 3).some((a) => a.control.id === "backup"));
  assert.equal(adds.find((a) => a.control.id === "siem").affordable, false);
});

test("unusedControls lists selected controls irrelevant to the scenario", () => {
  const unused = engine.unusedControls(ransomware, ["ddos", "email"], data).map((c) => c.id);
  assert.deepEqual(unused, ["ddos"]);
});

test("every scenario has a likelihood and known attacker tiers", () => {
  const tiers = new Set(data.attackerTiers.map((t) => t.id));
  for (const s of data.scenarios) {
    assert.ok(s.likelihood > 0, s.id);
    assert.ok(s.tiers.length > 0 && s.tiers.every((t) => tiers.has(t)), s.id);
  }
});

test("threat distribution sums to 1 and respects tier weights", () => {
  for (const d of data.difficulties) {
    const dist = engine.threatDistribution(d, data);
    const sum = dist.reduce((a, t) => a + t.probability, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, d.id);
    for (const [id, w] of Object.entries(d.tierWeights)) {
      const p = dist.filter((t) => t.tier.id === id).reduce((a, t) => a + t.probability, 0);
      assert.ok(Math.abs(p - w) < 1e-9, `${d.id} ${id}`);
    }
  }
});

test("bigger organisations face more advanced attackers", () => {
  const apt = (d) => engine.threatDistribution(d, data).filter((t) => t.tier.id === "apt").reduce((a, t) => a + t.probability, 0);
  assert.ok(apt(difficulty("startup")) < apt(sme));
  assert.ok(apt(sme) < apt(difficulty("enterprise")));
});

test("pickThreat follows the distribution", () => {
  const d = difficulty("startup");
  let seed = 7;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let basic = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) if (engine.pickThreat(d, data, rng).tier.id === "basic") basic++;
  assert.ok(Math.abs(basic / n - d.tierWeights.basic) < 0.02);
});

test("controls work better against basic attackers than APTs", () => {
  const sel = ["email", "edr", "segment"];
  const b = engine.expectedLoss(ransomware, sel, data, { tier: tier("basic") }).breachProbability;
  const a = engine.expectedLoss(ransomware, sel, data, { tier: tier("advanced") }).breachProbability;
  const x = engine.expectedLoss(ransomware, sel, data, { tier: tier("apt") }).breachProbability;
  assert.ok(b < a && a < x, `${b} ${a} ${x}`);
});

test("basic attackers often fail even against an undefended system", () => {
  const p = engine.expectedLoss(ransomware, [], data, { tier: tier("basic") }).breachProbability;
  assert.ok(p < 0.5, String(p));
  // and a startup with no controls is not breached by every attack
  const dist = engine.threatDistribution(difficulty("startup"), data);
  const breach = dist.reduce((a, t) => a + t.probability * engine.expectedLoss(t.scenario, [], data, { tier: t.tier }).breachProbability, 0);
  assert.ok(breach < 0.75, String(breach));
});

test("an attacker giving up is reported separately from a defence block", () => {
  const r = engine.runAttack(ransomware, [], data, { tier: tier("basic"), rng: () => 0.1 });
  assert.equal(r.blockedAt, 0);
  assert.ok(r.gaveUp);
  assert.equal(r.stages[0].blocked, false);
  assert.equal(r.grade.id, "lucky");
});

test("controls that fail to stop a stage still limit the breach", () => {
  const bare = engine.runAttack(ransomware, [], data, { rng: never });
  const seg = engine.runAttack(ransomware, ["segment"], data, { rng: never });
  assert.ok(seg.breached);
  assert.ok(seg.stages[2].contained > 0);
  assert.ok(seg.damage < bare.damage);
});

test("breach severity and detection speed vary between attacks", () => {
  const damages = new Set();
  let seed = 3;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < 200; i++) {
    const r = engine.runAttack(ransomware, ["siem"], data, { rng });
    if (r.breached) damages.add(Math.round(r.damage));
  }
  assert.ok(damages.size > 20, String(damages.size));
});

test("early detection reduces damage more than late detection", () => {
  const seq = (values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };
  // 4 stages pass, severity 1, detection roll, detection speed
  const fast = engine.runAttack(ransomware, ["siem"], data, { rng: seq([0.99, 0.99, 0.99, 0.99, 0.999, 0, 0]) });
  const late = engine.runAttack(ransomware, ["siem"], data, { rng: seq([0.99, 0.99, 0.99, 0.99, 0.999, 0.99, 0]) });
  assert.ok(fast.detection.detected && !late.detection.detected);
  assert.ok(fast.damage < late.damage);
});

test("grade scale has intermediate levels", () => {
  assert.equal(engine.grade(0).id, "blocked");
  assert.equal(engine.grade(0.05).id, "minor");
  assert.equal(engine.grade(0.2).id, "moderate");
  assert.equal(engine.grade(0.4).id, "major");
  assert.equal(engine.grade(0.8).id, "critical");
  assert.equal(engine.grade(1).id, "critical");
});

test("a reasonable build produces a spread of outcomes, not just extremes", () => {
  const d = difficulty("sme");
  const build = ["mfa", "backup", "siem", "irplan", "pam"];
  let seed = 11;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const counts = {};
  for (let i = 0; i < 5000; i++) {
    const t = engine.pickThreat(d, data, rng);
    const g = engine.runAttack(t.scenario, build, data, { impactScale: d.impactScale, tier: t.tier, rng }).grade.id;
    counts[g] = (counts[g] || 0) + 1;
  }
  for (const g of ["minor", "moderate", "major"]) assert.ok((counts[g] || 0) > 5000 * 0.03, `${g}: ${counts[g]}`);
});

test("lost laptop: encryption protects the disk, MFA protects cloud logins", () => {
  const laptop = data.scenarios.find((s) => s.id === "laptop");
  const opts = { tier: tier("basic") };
  const breach = (sel) => engine.expectedLoss(laptop, sel, data, opts).breachProbability;
  // The lost device itself is not an attacker stage that can be "passed".
  assert.ok(laptop.stages.every((st) => Object.keys(st.prevent).length > 0));
  assert.ok(breach(["encryption"]) < 0.05);
  assert.ok(breach(["mfa"]) < 0.1);
  assert.ok(breach(["encryption", "mfa"]) < breach(["encryption"]));
  // Most finders never try to read the data at all.
  assert.ok(breach([]) <= 0.25);
});

test("scenario-level give-up chance applies and uses the scenario's story", () => {
  const laptop = data.scenarios.find((s) => s.id === "laptop");
  const r = engine.runAttack(laptop, [], data, { tier: tier("basic"), rng: () => 0.3 });
  assert.ok(r.gaveUp);
});
