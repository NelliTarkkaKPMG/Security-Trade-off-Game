const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../js/data.js");
const engine = require("../js/engine.js");

const ransomware = data.scenarios.find((s) => s.id === "ransomware");
const always = () => 0; // roll 0 < p → every stage with any defence blocks
const never = () => 0.999999; // nothing blocks, nothing detected

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
  const r = engine.runAttack(ransomware, ["email"], data, 1, always);
  assert.equal(r.blockedAt, 0);
  assert.equal(r.damage, 0);
  assert.equal(r.grade.id, "blocked");
});

test("undefended attack causes full damage", () => {
  const r = engine.runAttack(ransomware, [], data, 1, never);
  assert.ok(r.breached);
  assert.equal(r.damage, ransomware.impact);
  assert.equal(r.grade.id, "critical");
});

test("backups reduce breach damage", () => {
  const r = engine.runAttack(ransomware, ["backup"], data, 1, never);
  assert.ok(r.breached);
  assert.ok(Math.abs(r.damage - ransomware.impact * 0.3) < 1e-9);
});

test("impact scales with difficulty", () => {
  const r = engine.runAttack(ransomware, [], data, 2, never);
  assert.equal(r.damage, ransomware.impact * 2);
});

test("expected loss matches simulation average", () => {
  const sel = ["email", "edr", "backup", "siem"];
  const expected = engine.expectedLoss(ransomware, sel, data, 1).loss;
  let seed = 42;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let sum = 0;
  const n = 50000;
  for (let i = 0; i < n; i++) sum += engine.runAttack(ransomware, sel, data, 1, rng).damage;
  assert.ok(Math.abs(sum / n - expected) / expected < 0.05, `${sum / n} vs ${expected}`);
});

test("more controls never increase expected loss when friction stays under limit", () => {
  const base = engine.riskProfile(["email"], data, 1).totalLoss;
  const more = engine.riskProfile(["email", "siem"], data, 1).totalLoss;
  assert.ok(more < base);
});

test("bestAdditions suggests relevant controls and flags affordability", () => {
  const adds = engine.bestAdditions(ransomware, [], data, 1, 20);
  assert.ok(adds.length > 0);
  assert.equal(adds[0].control.id, "backup");
  assert.equal(adds.find((a) => a.control.id === "siem").affordable, false);
});

test("unusedControls lists selected controls irrelevant to the scenario", () => {
  const unused = engine.unusedControls(ransomware, ["ddos", "email"], data).map((c) => c.id);
  assert.deepEqual(unused, ["ddos"]);
});
