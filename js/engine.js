/*
 * Pelilogiikka. Puhtaita funktioita ilman DOM-riippuvuuksia, jotta niitä voi
 * testata Node.js:llä (ks. tests/engine.test.js).
 *
 * Hyökkäysmalli:
 *  1. Hyökkäys etenee skenaarion vaiheet järjestyksessä. Jokaisessa vaiheessa
 *     valitut kontrollit yrittävät pysäyttää sen.
 *  2. Jos hyökkäys pysähtyy vaiheeseen i, vahinkoa syntyy vain vähän
 *     (selvittely- ja puhdistuskulut kasvavat mitä pidemmälle päästiin).
 *  3. Jos kaikki vaiheet läpäistään, syntyy tietoturvaloukkaus. Havaitsevat
 *     kontrollit voivat puolittaa vahingon ja palauttavat kontrollit
 *     pienentävät sitä edelleen.
 *  4. Liian suuri käyttäjäkitka saa käyttäjät kiertämään kontrolleja, mikä
 *     heikentää kaikkien ennaltaehkäisevien kontrollien tehoa.
 */
(function (root) {
  const STAGE_DAMAGE = 0.05; // vahinko-osuus per läpäisty vaihe, jos hyökkäys pysäytetään
  const DETECTION_FACTOR = 0.5; // havaittu loukkaus aiheuttaa puolet vahingosta
  const FRICTION_PENALTY = 0.07; // tehon lasku per kitkapiste rajan yli
  const MIN_MULTIPLIER = 0.6;

  function toSet(selected) {
    return selected instanceof Set ? selected : new Set(selected);
  }

  function byId(controls) {
    const map = {};
    for (const c of controls) map[c.id] = c;
    return map;
  }

  function totalCost(selected, controls) {
    const map = byId(controls);
    let sum = 0;
    for (const id of toSet(selected)) sum += map[id] ? map[id].cost : 0;
    return sum;
  }

  function totalFriction(selected, controls) {
    const map = byId(controls);
    let sum = 0;
    for (const id of toSet(selected)) sum += map[id] ? map[id].friction : 0;
    return sum;
  }

  function effectivenessMultiplier(friction, limit) {
    if (friction <= limit) return 1;
    return Math.max(MIN_MULTIPLIER, 1 - FRICTION_PENALTY * (friction - limit));
  }

  // Yhdistetty todennäköisyys: 1 - Π(1 - p_i) valituista kontrolleista.
  function combine(effects, selected, multiplier) {
    const set = toSet(selected);
    const contributors = [];
    let miss = 1;
    for (const [id, eff] of Object.entries(effects || {})) {
      if (!set.has(id)) continue;
      const e = eff * multiplier;
      contributors.push({ id, effect: e });
      miss *= 1 - e;
    }
    return { p: 1 - miss, contributors };
  }

  function recoveryFactor(scenario, selected) {
    const set = toSet(selected);
    let factor = 1;
    const contributors = [];
    for (const [id, r] of Object.entries(scenario.recover || {})) {
      if (!set.has(id)) continue;
      contributors.push({ id, effect: r });
      factor *= 1 - r;
    }
    return { factor, contributors };
  }

  function context(selected, data) {
    const set = toSet(selected);
    const friction = totalFriction(set, data.controls);
    const multiplier = effectivenessMultiplier(friction, data.frictionLimit);
    return { set, friction, multiplier };
  }

  function grade(ratio) {
    if (ratio === 0) return { id: "blocked", label: "Torjuttu heti", emoji: "🏆" };
    if (ratio < 0.2) return { id: "minor", label: "Hallinnassa", emoji: "✅" };
    if (ratio < 0.5) return { id: "major", label: "Vakava tietoturvaloukkaus", emoji: "⚠️" };
    return { id: "critical", label: "Katastrofi", emoji: "🔥" };
  }

  /**
   * Pelaa yhden hyökkäyksen satunnaisesti. rng palauttaa luvun väliltä [0, 1).
   */
  function runAttack(scenario, selected, data, impactScale, rng) {
    const random = rng || Math.random;
    const scale = impactScale || 1;
    const impact = scenario.impact * scale;
    const { set, friction, multiplier } = context(selected, data);

    const stages = [];
    let blockedAt = -1;
    for (let i = 0; i < scenario.stages.length; i++) {
      const stage = scenario.stages[i];
      const { p, contributors } = combine(stage.prevent, set, multiplier);
      const roll = random();
      const blocked = roll < p;
      stages.push({ name: stage.name, text: stage.text, p, roll, blocked, contributors });
      if (blocked) {
        blockedAt = i;
        break;
      }
    }

    const breached = blockedAt === -1;
    let damage;
    let detection = null;
    let recovery = null;
    if (breached) {
      const d = combine(scenario.detect, set, 1);
      const roll = random();
      detection = { p: d.p, roll, detected: roll < d.p, contributors: d.contributors };
      recovery = recoveryFactor(scenario, set);
      damage = impact * (detection.detected ? DETECTION_FACTOR : 1) * recovery.factor;
    } else {
      damage = impact * STAGE_DAMAGE * blockedAt;
    }

    const ratio = impact > 0 ? damage / impact : 0;
    return {
      scenario,
      impact,
      stages,
      blockedAt,
      breached,
      detection,
      recovery,
      damage,
      ratio,
      score: Math.round(100 * (1 - ratio)),
      grade: grade(ratio),
      friction,
      multiplier
    };
  }

  /**
   * Odotettu vahinko analyyttisesti (ei satunnaisuutta).
   */
  function expectedLoss(scenario, selected, data, impactScale) {
    const impact = scenario.impact * (impactScale || 1);
    const { set, multiplier } = context(selected, data);

    let reach = 1; // todennäköisyys, että hyökkäys pääsee nykyiseen vaiheeseen
    let loss = 0;
    scenario.stages.forEach((stage, i) => {
      const { p } = combine(stage.prevent, set, multiplier);
      loss += reach * p * impact * STAGE_DAMAGE * i;
      reach *= 1 - p;
    });

    const pd = combine(scenario.detect, set, 1).p;
    const rf = recoveryFactor(scenario, set).factor;
    const breachLoss = impact * (pd * DETECTION_FACTOR + (1 - pd)) * rf;
    loss += reach * breachLoss;

    return { loss, breachProbability: reach, impact, ratio: impact > 0 ? loss / impact : 0 };
  }

  /**
   * Riskiprofiili kaikkia skenaarioita vastaan.
   */
  function riskProfile(selected, data, impactScale) {
    const rows = data.scenarios.map((s) => ({ scenario: s, ...expectedLoss(s, selected, data, impactScale) }));
    const totalLoss = rows.reduce((a, r) => a + r.loss, 0);
    const totalImpact = rows.reduce((a, r) => a + r.impact, 0);
    return { rows, totalLoss, totalImpact, resilience: totalImpact > 0 ? 1 - totalLoss / totalImpact : 1 };
  }

  /**
   * Kuinka paljon kunkin valitsematta jätetyn kontrollin lisääminen olisi
   * pienentänyt odotettua vahinkoa tässä skenaariossa.
   */
  function bestAdditions(scenario, selected, data, impactScale, budget) {
    const set = toSet(selected);
    const base = expectedLoss(scenario, set, data, impactScale).loss;
    const left = budget - totalCost(set, data.controls);
    return data.controls
      .filter((c) => !set.has(c.id))
      .map((c) => {
        const withC = new Set(set);
        withC.add(c.id);
        const loss = expectedLoss(scenario, withC, data, impactScale).loss;
        return { control: c, reduction: base - loss, affordable: c.cost <= left };
      })
      .filter((r) => r.reduction > 0.005)
      .sort((a, b) => b.reduction - a.reduction);
  }

  /**
   * Valitut kontrollit, joilla ei ollut mitään roolia tässä skenaariossa.
   */
  function unusedControls(scenario, selected, data) {
    const used = new Set();
    for (const st of scenario.stages) Object.keys(st.prevent || {}).forEach((id) => used.add(id));
    Object.keys(scenario.detect || {}).forEach((id) => used.add(id));
    Object.keys(scenario.recover || {}).forEach((id) => used.add(id));
    const map = byId(data.controls);
    return [...toSet(selected)].filter((id) => !used.has(id)).map((id) => map[id]);
  }

  const engine = {
    totalCost,
    totalFriction,
    effectivenessMultiplier,
    combine,
    runAttack,
    expectedLoss,
    riskProfile,
    bestAdditions,
    unusedControls,
    grade
  };

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  } else {
    root.GameEngine = engine;
  }
})(this);
