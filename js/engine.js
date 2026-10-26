/*
 * Pelilogiikka. Puhtaita funktioita ilman DOM-riippuvuuksia, jotta niitä voi
 * testata Node.js:llä (ks. tests/engine.test.js).
 *
 * Hyökkäysmalli:
 *  1. Uhka arvotaan: ensin hyökkääjän taitotaso organisaation koon mukaan,
 *     sitten skenaario sen yleisyyden mukaan niistä, jotka sopivat tasolle.
 *  2. Hyökkäys etenee skenaarion vaiheet järjestyksessä. Jokaisessa vaiheessa
 *     valitut kontrollit yrittävät pysäyttää sen, ja hyökkääjä voi myös
 *     epäonnistua tai luovuttaa itsestään.
 *  3. Jos hyökkäys pysähtyy vaiheeseen i, vahinkoa syntyy vain vähän
 *     (selvittely- ja puhdistuskulut kasvavat mitä pidemmälle päästiin).
 *  4. Vaihe, jota kontrollit eivät pysäyttäneet, ei ole välttämättä
 *     menetetty: kontrollit rajaavat silti hyökkäyksen laajuutta.
 *  5. Jos kaikki vaiheet läpäistään, syntyy tietoturvaloukkaus, jonka
 *     vakavuus vaihtelee. Mitä nopeammin hyökkäys havaitaan, sitä pienempi
 *     vahinko, ja palauttavat kontrollit pienentävät sitä edelleen.
 *  6. Liian suuri käyttäjäkitka saa käyttäjät kiertämään kontrolleja, mikä
 *     heikentää kaikkien ennaltaehkäisevien kontrollien tehoa.
 */
(function (root) {
  const STAGE_DAMAGE = 0.05; // vahinko-osuus per läpäisty vaihe, jos hyökkäys pysäytetään
  const CONTAINMENT = 0.5; // läpäisty vaihe: kontrollit rajaavat laajuutta osuudella CONTAINMENT * p
  const SEVERITY_MIN = 0.5; // satunnainen vakavuus väliltä [SEVERITY_MIN, 1]
  const SEVERITY_MEAN = (SEVERITY_MIN + 1) / 2;
  // Havaitsemisen nopeus: havaittu loukkaus 0.3–0.7 vahingosta, havaitsematon 0.85–1.
  const DETECTED = { min: 0.3, max: 0.7 };
  const UNDETECTED = { min: 0.85, max: 1 };
  const mean = (r) => (r.min + r.max) / 2;
  const lerp = (r, u) => r.min + (r.max - r.min) * u;
  const FRICTION_PENALTY = 0.07; // tehon lasku per kitkapiste rajan yli
  const MIN_MULTIPLIER = 0.6;

  // Neutraali hyökkääjä, jota käytetään, jos tasoa ei anneta.
  const NEUTRAL_TIER = { id: "neutral", strength: 1, giveUp: 0, impactScale: 1 };

  function toSet(selected) {
    return selected instanceof Set ? selected : new Set(selected);
  }

  function byId(list) {
    const map = {};
    for (const item of list) map[item.id] = item;
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

  // Hyökkääjän taito muuttaa kontrollin tehoa: 1 - (1 - e)^(1 / strength).
  function againstAttacker(effect, strength) {
    return 1 - Math.pow(1 - effect, 1 / strength);
  }

  // Yhdistetty todennäköisyys: 1 - Π(1 - p_i) valituista kontrolleista.
  function combine(effects, selected, multiplier, strength) {
    const set = toSet(selected);
    const s = strength || 1;
    const contributors = [];
    let miss = 1;
    for (const [id, eff] of Object.entries(effects || {})) {
      if (!set.has(id)) continue;
      const e = againstAttacker(eff * multiplier, s);
      contributors.push({ id, effect: e });
      miss *= 1 - e;
    }
    return { p: 1 - miss, contributors };
  }

  // Hyökkääjän luovuttamisen todennäköisyys per vaihe: tason ja skenaarion suurempi.
  function giveUpChance(scenario, tier) {
    return Math.max(tier.giveUp, scenario.giveUp || 0);
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

  function options(opts) {
    const o = opts || {};
    return { impactScale: o.impactScale || 1, tier: o.tier || NEUTRAL_TIER, rng: o.rng || Math.random };
  }

  // Lopputuloksen asteikko. max = vahinko-osuuden yläraja kullekin tasolle.
  const GRADES = [
    { id: "blocked", max: 0, label: "Torjuttu", emoji: "🏆" },
    { id: "minor", max: 0.1, label: "Pieni häiriö", short: "Pieni", emoji: "✅" },
    { id: "moderate", max: 0.25, label: "Hallittu tietoturvaloukkaus", short: "Hallittu", emoji: "🟡" },
    { id: "major", max: 0.5, label: "Vakava tietoturvaloukkaus", short: "Vakava", emoji: "⚠️" },
    { id: "critical", max: 1, label: "Katastrofi", short: "Katastrofi", emoji: "🔥" }
  ];

  function grade(ratio) {
    if (ratio === 0) return GRADES[0];
    return GRADES.find((g, i) => i > 0 && ratio < g.max) || GRADES[GRADES.length - 1];
  }

  // Havaitsemisaika tarinaa varten: nopea havainto tunneissa, hidas päivissä.
  function detectionTime(detected, u) {
    if (detected) {
      const hours = Math.max(1, Math.round(1 + u * 47));
      return hours + " tunnissa";
    }
    return Math.round(7 + u * 53) + " päivän kuluttua";
  }

  /**
   * Kaikki organisaatiolle mahdolliset uhat (skenaario + hyökkääjätaso)
   * todennäköisyyksineen. Todennäköisyydet summautuvat yhteen.
   */
  function threatDistribution(difficulty, data) {
    const tierMap = byId(data.attackerTiers);
    const threats = [];
    for (const [tierId, tierWeight] of Object.entries(difficulty.tierWeights)) {
      const pool = data.scenarios.filter((s) => s.tiers.includes(tierId));
      const total = pool.reduce((a, s) => a + s.likelihood, 0);
      for (const s of pool) {
        threats.push({ scenario: s, tier: tierMap[tierId], probability: (tierWeight * s.likelihood) / total });
      }
    }
    const sum = threats.reduce((a, t) => a + t.probability, 0);
    threats.forEach((t) => (t.probability /= sum));
    return threats;
  }

  function pickThreat(difficulty, data, rng) {
    const threats = threatDistribution(difficulty, data);
    let roll = (rng || Math.random)();
    for (const t of threats) {
      if (roll < t.probability) return t;
      roll -= t.probability;
    }
    return threats[threats.length - 1];
  }

  /**
   * Pelaa yhden hyökkäyksen satunnaisesti.
   * opts: { impactScale, tier, rng }  – rng palauttaa luvun väliltä [0, 1).
   */
  function runAttack(scenario, selected, data, opts) {
    const { impactScale, tier, rng } = options(opts);
    const impact = scenario.impact * impactScale * tier.impactScale;
    const { set, friction, multiplier } = context(selected, data);

    const giveUp = giveUpChance(scenario, tier);
    const stages = [];
    let blockedAt = -1;
    let scope = 1; // kuinka laajalle hyökkäys pääsi (1 = koko ympäristö)
    for (let i = 0; i < scenario.stages.length; i++) {
      const stage = scenario.stages[i];
      const { p, contributors } = combine(stage.prevent, set, multiplier, tier.strength);
      const pStop = 1 - (1 - p) * (1 - giveUp);
      const roll = rng();
      const blocked = roll < p; // puolustus pysäytti
      const gaveUp = !blocked && roll < pStop; // hyökkääjä epäonnistui itse
      // Läpäisty vaihe: kontrollit eivät pysäyttäneet, mutta rajasivat laajuutta.
      const contained = blocked || gaveUp ? 0 : CONTAINMENT * p;
      scope *= 1 - contained;
      stages.push({ name: stage.name, text: stage.text, p, pStop, roll, blocked, gaveUp, contained, contributors });
      if (blocked || gaveUp) {
        blockedAt = i;
        break;
      }
    }

    const breached = blockedAt === -1;
    const severity = SEVERITY_MIN + (1 - SEVERITY_MIN) * rng();
    let damage;
    let detection = null;
    let recovery = null;
    if (breached) {
      const d = combine(scenario.detect, set, 1, tier.strength);
      const roll = rng();
      const detected = roll < d.p;
      const u = rng();
      const factor = lerp(detected ? DETECTED : UNDETECTED, u);
      detection = { p: d.p, roll, detected, factor, time: detectionTime(detected, u), contributors: d.contributors };
      recovery = recoveryFactor(scenario, set);
      damage = impact * severity * scope * factor * recovery.factor;
    } else {
      damage = impact * severity * STAGE_DAMAGE * blockedAt;
    }

    const ratio = impact > 0 ? damage / impact : 0;
    return {
      scenario,
      tier,
      impact,
      stages,
      blockedAt,
      breached,
      gaveUp: !breached && stages[blockedAt].gaveUp,
      severity,
      scope,
      detection,
      recovery,
      damage,
      ratio,
      score: Math.round(100 * (1 - ratio)),
      grade: !breached && stages[blockedAt].gaveUp && ratio < GRADES[1].max
        ? { id: "lucky", label: "Hyökkäys epäonnistui", emoji: "🍀" }
        : grade(ratio),
      friction,
      multiplier
    };
  }

  /**
   * Odotettu vahinko analyyttisesti (ei satunnaisuutta).
   */
  function expectedLoss(scenario, selected, data, opts) {
    const { impactScale, tier } = options(opts);
    const impact = scenario.impact * impactScale * tier.impactScale;
    const { set, multiplier } = context(selected, data);

    const giveUp = giveUpChance(scenario, tier);
    let reach = 1; // todennäköisyys, että hyökkäys pääsee nykyiseen vaiheeseen
    let scope = 1;
    let loss = 0;
    scenario.stages.forEach((stage, i) => {
      const { p } = combine(stage.prevent, set, multiplier, tier.strength);
      const pStop = 1 - (1 - p) * (1 - giveUp);
      loss += reach * pStop * impact * SEVERITY_MEAN * STAGE_DAMAGE * i;
      reach *= 1 - pStop;
      scope *= 1 - CONTAINMENT * p;
    });

    const pd = combine(scenario.detect, set, 1, tier.strength).p;
    const rf = recoveryFactor(scenario, set).factor;
    const detectFactor = pd * mean(DETECTED) + (1 - pd) * mean(UNDETECTED);
    loss += reach * impact * SEVERITY_MEAN * scope * detectFactor * rf;

    return { loss, breachProbability: reach, impact, ratio: impact > 0 ? loss / impact : 0 };
  }

  /**
   * Riskiprofiili organisaation todellista uhkakuvaa vastaan: jokaiselle
   * skenaariolle sen todennäköisyys ja odotettu vahinko (painotettuna
   * hyökkääjätasojen todennäköisyyksillä).
   */
  function riskProfile(selected, data, difficulty) {
    const threats = threatDistribution(difficulty, data);
    const rowsById = {};
    let expected = 0;
    let worst = 0;
    let undefended = 0;
    for (const t of threats) {
      const opts = { impactScale: difficulty.impactScale, tier: t.tier };
      const e = expectedLoss(t.scenario, selected, data, opts);
      const none = expectedLoss(t.scenario, [], data, opts);
      const row = (rowsById[t.scenario.id] ||= { scenario: t.scenario, probability: 0, loss: 0, impact: 0, breach: 0 });
      row.probability += t.probability;
      row.loss += t.probability * e.loss;
      row.impact += t.probability * e.impact;
      row.breach += t.probability * e.breachProbability;
      expected += t.probability * e.loss;
      worst += t.probability * e.impact;
      undefended += t.probability * none.loss;
    }
    const rows = Object.values(rowsById)
      .map((r) => ({
        scenario: r.scenario,
        probability: r.probability,
        loss: r.loss / r.probability,
        impact: r.impact / r.probability,
        breachProbability: r.breach / r.probability,
        ratio: r.impact > 0 ? r.loss / r.impact : 0
      }))
      .sort((a, b) => b.probability - a.probability);
    return {
      rows,
      expectedLoss: expected,
      undefendedLoss: undefended,
      worstCase: worst,
      resilience: worst > 0 ? 1 - expected / worst : 1
    };
  }

  /**
   * Kuinka paljon kunkin valitsematta jätetyn kontrollin lisääminen olisi
   * pienentänyt odotettua vahinkoa tätä uhkaa vastaan.
   */
  function bestAdditions(scenario, selected, data, opts, budget) {
    const set = toSet(selected);
    const base = expectedLoss(scenario, set, data, opts).loss;
    const left = budget - totalCost(set, data.controls);
    return data.controls
      .filter((c) => !set.has(c.id))
      .map((c) => {
        const withC = new Set(set);
        withC.add(c.id);
        const loss = expectedLoss(scenario, withC, data, opts).loss;
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
    againstAttacker,
    combine,
    threatDistribution,
    pickThreat,
    runAttack,
    expectedLoss,
    riskProfile,
    bestAdditions,
    unusedControls,
    grade,
    GRADES
  };

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  } else {
    root.GameEngine = engine;
  }
})(this);
