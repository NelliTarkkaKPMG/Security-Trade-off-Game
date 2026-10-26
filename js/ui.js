/* Käyttöliittymä: näkymien vaihto, kontrollien valinta ja tulosten esitys. */
(function () {
  const data = window.GameData;
  const engine = window.GameEngine;
  const controlMap = Object.fromEntries(data.controls.map((c) => [c.id, c]));
  const tierMap = Object.fromEntries(data.attackerTiers.map((t) => [t.id, t]));

  const state = {
    difficulty: null,
    selected: new Set(),
    result: null
  };

  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let revealTimers = [];

  const money = (k) =>
    k >= 1000
      ? (k / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 2 }) + " M€"
      : Math.round(k).toLocaleString("fi-FI") + " k€";
  const pct = (p) => Math.round(p * 100) + " %";

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function show(screen) {
    for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== "screen-" + screen;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }

  /* ---------- Aloitus ---------- */

  function renderDifficulties() {
    const list = $("difficulty-list");
    list.replaceChildren();
    for (const d of data.difficulties) {
      const btn = el("button", "difficulty");
      btn.type = "button";
      btn.append(
        el("span", "difficulty-icon", d.icon),
        el("strong", null, d.name),
        el("span", "difficulty-budget", "Budjetti " + money(d.budget)),
        el("span", "muted", d.desc),
        tierMix(d)
      );
      btn.addEventListener("click", () => startGame(d));
      list.append(btn);
    }
  }

  // Pieni pinottu palkki: millaiset hyökkääjät organisaatiota tyypillisesti uhkaavat.
  function tierMix(difficulty) {
    const wrap = el("span", "tier-mix");
    const bar = el("span", "tier-bar");
    const legend = el("span", "tier-legend");
    for (const [id, w] of Object.entries(difficulty.tierWeights)) {
      const seg = el("span", "tier-seg tier-" + id);
      seg.style.width = w * 100 + "%";
      bar.append(seg);
      legend.append(el("span", "tier-key tier-" + id, tierMap[id].name + " " + pct(w)));
    }
    wrap.append(el("span", "tier-mix-label", "Hyökkääjät:"), bar, legend);
    return wrap;
  }

  function startGame(difficulty) {
    state.difficulty = difficulty;
    state.selected = new Set();
    $("org-name").textContent = "· " + difficulty.name;
    renderControls();
    show("build");
  }

  /* ---------- Rakennus ---------- */

  function renderControls() {
    const grid = $("control-grid");
    grid.replaceChildren();
    for (const c of data.controls) {
      const card = el("button", "control-card");
      card.type = "button";
      card.dataset.id = c.id;

      const head = el("div", "control-head");
      head.append(el("span", "control-icon", c.icon), el("span", "tag tag-" + c.category, c.category));

      const meta = el("div", "control-meta");
      meta.append(el("span", "cost", money(c.cost)));
      const friction = el("span", "friction-dots");
      friction.title = "Käyttäjäkitka " + c.friction;
      friction.textContent = c.friction ? "😤".repeat(c.friction) : "Ei kitkaa";
      meta.append(friction);

      card.append(head, el("h3", null, c.name), el("p", "muted", c.desc), meta);
      card.addEventListener("click", () => toggleControl(c.id));
      grid.append(card);
    }
    updateBuild();
  }

  function toggleControl(id) {
    if (state.selected.has(id)) {
      state.selected.delete(id);
    } else {
      const left = state.difficulty.budget - engine.totalCost(state.selected, data.controls);
      if (controlMap[id].cost > left) return;
      state.selected.add(id);
    }
    updateBuild();
  }

  function updateBuild() {
    const budget = state.difficulty.budget;
    const spent = engine.totalCost(state.selected, data.controls);
    const left = budget - spent;
    const friction = engine.totalFriction(state.selected, data.controls);
    const mult = engine.effectivenessMultiplier(friction, data.frictionLimit);

    $("budget-left").textContent = money(left);
    $("budget-total").textContent = money(budget);
    $("budget-fill").style.width = Math.min(100, (spent / budget) * 100) + "%";

    const maxFriction = data.frictionLimit * 2;
    const frictionFill = $("friction-fill");
    frictionFill.style.width = Math.min(100, (friction / maxFriction) * 100) + "%";
    frictionFill.classList.toggle("over", friction > data.frictionLimit);
    $("friction-value").textContent = friction + " / " + data.frictionLimit;
    $("friction-note").textContent =
      mult < 1 ? "· käyttäjät kiertävät suojauksia, teho −" + pct(1 - mult) : "· käyttäjät sietävät tämän";

    for (const card of document.querySelectorAll(".control-card")) {
      const c = controlMap[card.dataset.id];
      const selected = state.selected.has(c.id);
      card.classList.toggle("selected", selected);
      card.classList.toggle("unaffordable", !selected && c.cost > left);
      card.setAttribute("aria-pressed", String(selected));
    }
  }

  /* ---------- Hyökkäys ---------- */

  function launchAttack() {
    if (state.selected.size === 0 && !confirm("Et valinnut yhtään kontrollia. Hyökätäänkö silti?")) return;
    const threat = engine.pickThreat(state.difficulty, data);
    state.result = engine.runAttack(threat.scenario, state.selected, data, {
      impactScale: state.difficulty.impactScale,
      tier: threat.tier
    });
    state.result.probability = threat.probability;
    renderAttack(state.result);
    show("attack");
  }

  function controlNames(contributors) {
    return contributors.map((c) => controlMap[c.id].short + " " + pct(c.effect)).join(", ");
  }

  function timelineItem(cls, title, text, detailText, outcome) {
    const li = el("li", "timeline-item " + cls);
    const body = el("div", "timeline-body");
    body.append(el("h4", null, title));
    if (text) body.append(el("p", "muted", text));
    if (detailText) body.append(el("p", "timeline-detail", detailText));
    if (outcome) body.append(el("p", "timeline-outcome", outcome));
    li.append(el("span", "timeline-dot"), body);
    return li;
  }

  function renderAttack(r) {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];

    $("attack-icon").textContent = r.scenario.icon;
    $("attack-title").textContent = r.scenario.name;
    $("attack-intro").textContent = r.scenario.intro;
    $("attack-tier").className = "tier-badge tier-" + r.tier.id;
    $("attack-tier").textContent = r.tier.icon + " Hyökkääjä: " + r.tier.name;
    $("attack-tier-desc").textContent =
      r.tier.desc + " Tällaisen hyökkäyksen osuus organisaatiosi uhista: " + pct(r.probability) + ".";
    const list = $("attack-timeline");
    list.replaceChildren();

    const items = r.stages.map((st, i) => {
      const defence = st.contributors.length
        ? "Puolustus: " + controlNames(st.contributors) + " → torjunnan todennäköisyys " + pct(st.p)
        : "Ei yhtään kontrollia tätä vaihetta vastaan.";
      const contained = st.contained >= 0.01;
      const outcome = st.blocked
        ? "🛑 Hyökkäys pysäytettiin!"
        : st.gaveUp
          ? "🏳️ " + (r.scenario.giveUpText || "Hyökkääjä epäonnistui omin avuin ja luovutti.")
          : contained
            ? "↘️ Hyökkääjä pääsi läpi, mutta kontrollit rajasivat sen ulottuvuutta −" + pct(st.contained) + "."
            : "➡️ Hyökkääjä pääsi läpi esteettä.";
      const cls = st.blocked ? "blocked" : st.gaveUp ? "gaveup" : contained ? "contained" : "passed";
      return timelineItem(cls, i + 1 + ". " + st.name, st.text, defence, outcome);
    });

    // Vaiheet, joihin hyökkäys ei koskaan edennyt
    for (let i = r.stages.length; i < r.scenario.stages.length; i++) {
      const st = r.scenario.stages[i];
      items.push(timelineItem("skipped", i + 1 + ". " + st.name, "Hyökkäys ei edennyt tähän vaiheeseen.", null, null));
    }

    if (r.breached) {
      const d = r.detection;
      items.push(
        timelineItem(
          d.detected ? "blocked" : "passed",
          "🔎 Havaitseminen",
          "Kuinka nopeasti hyökkäys huomataan?",
          d.contributors.length
            ? "Havainnointi: " + controlNames(d.contributors) + " → todennäköisyys " + pct(d.p)
            : "Ei havaitsevia kontrolleja.",
          (d.detected ? "✅ " : "❌ ") + d.text
        )
      );
      const rc = r.recovery;
      items.push(
        timelineItem(
          rc.contributors.length ? "blocked" : "passed",
          "🩺 Toipuminen",
          "Kuinka nopeasti toiminta saadaan takaisin?",
          rc.contributors.length
            ? "Toipuminen: " + controlNames(rc.contributors) + " → vahingot −" + pct(1 - rc.factor)
            : "Ei toipumista nopeuttavia kontrolleja.",
          null
        )
      );
    }

    const btnResults = $("btn-results");
    const btnSkip = $("btn-skip");
    btnResults.hidden = true;
    btnSkip.hidden = false;

    const finish = () => {
      revealTimers.forEach(clearTimeout);
      revealTimers = [];
      for (const li of list.children) li.classList.add("visible");
      btnSkip.hidden = true;
      btnResults.hidden = false;
      btnResults.focus();
    };

    items.forEach((li) => list.append(li));
    if (reducedMotion) {
      finish();
      return;
    }
    items.forEach((li, i) => revealTimers.push(setTimeout(() => li.classList.add("visible"), 300 + i * 1100)));
    revealTimers.push(setTimeout(finish, 300 + items.length * 1100));
    btnSkip.onclick = finish;
  }

  /* ---------- Tulokset ---------- */

  function renderResult(r) {
    const budget = state.difficulty.budget;

    $("result-hero").className = "panel result-hero grade-" + r.grade.id;
    $("result-emoji").textContent = r.grade.emoji;
    $("result-scenario").textContent = r.scenario.icon + " " + r.scenario.name + " · " + r.tier.icon + " " + r.tier.name;
    $("result-title").textContent = r.grade.label;
    $("result-score").textContent = r.score;

    let summary;
    if (r.gaveUp) {
      summary =
        (r.scenario.giveUpText ||
          "Hyökkääjä epäonnistui omin avuin vaiheessa " + (r.blockedAt + 1) + "/" + r.scenario.stages.length + ".") +
        " Tällä kertaa kävi tuuri – katso riskiprofiilista, kestäisikö kokoonpanosi seuraavan yrityksen.";
    } else if (!r.breached && r.blockedAt === 0) {
      summary = "Hyökkäys pysäytettiin jo ensimmäisessä vaiheessa. Erinomaista!";
    } else if (!r.breached) {
      summary =
        "Hyökkääjä eteni vaiheeseen " + (r.blockedAt + 1) + "/" + r.scenario.stages.length +
        ", mutta pysäytettiin ennen varsinaista vahinkoa.";
    } else {
      summary = "Hyökkääjä läpäisi kaikki puolustuslinjat";
      summary += r.scope < 0.95 ? ", mutta kontrollit rajasivat sen ulottuvuutta. " : ". ";
      summary += r.detection.text;
    }
    $("result-summary").textContent = summary;

    $("damage-fill").style.width = r.ratio * 100 + "%";
    renderGradeScale(r);
    $("damage-value").textContent = money(r.damage);
    $("damage-max").textContent = money(r.impact);

    const breakdown = $("damage-breakdown");
    breakdown.replaceChildren();
    // Vahinko vaihe vaiheelta: jokainen rivi näyttää kertoimen ja juoksevan summan.
    let running = r.impact;
    const step = (label, factor) => {
      running *= factor;
      breakdown.append(el("li", null, label + " −" + pct(1 - factor) + " → " + money(running)));
    };
    if (r.breached) {
      breakdown.append(el("li", null, "Pahimmillaan: " + money(r.impact)));
      step("Hyökkäys jäi tällä kertaa suppeammaksi:", r.severity);
      if (r.scope < 0.995) step("Kontrollit rajasivat leviämistä:", r.scope);
      step(r.detection.detected ? "Nopea havaitseminen:" : "Myöhäinen havaitseminen:", r.detection.factor);
      for (const c of r.recovery.contributors) step(controlMap[c.id].short + ":", 1 - c.effect);
    } else if (r.blockedAt > 0) {
      breakdown.append(
        el("li", null, "Selvittely- ja puhdistuskulut, kun hyökkääjä ehti vaiheeseen " + (r.blockedAt + 1) + ": " + money(r.damage))
      );
    } else {
      breakdown.append(el("li", null, "Ei vahinkoja."));
    }
    if (r.multiplier < 1) {
      breakdown.append(
        el("li", "warn", "😤 Liian suuri käyttäjäkitka heikensi kontrollien tehoa " + pct(1 - r.multiplier) + ".")
      );
    }

    renderReviewer(r, budget);
    renderLessons(r, budget);
    renderRiskProfile();

    const chosen = $("chosen-list");
    chosen.replaceChildren();
    if (state.selected.size === 0) chosen.append(el("span", "muted", "Ei valittuja kontrolleja."));
    for (const id of state.selected) {
      const c = controlMap[id];
      chosen.append(el("span", "chip", c.icon + " " + c.short + " · " + money(c.cost)));
    }
    const left = budget - engine.totalCost(state.selected, data.controls);
    if (left > 0) chosen.append(el("span", "chip chip-muted", "Käyttämättä " + money(left)));

    show("result");
  }

  // Viisiportainen asteikko, jolla merkki näyttää, mihin tulos osui.
  function renderGradeScale(r) {
    const scale = $("grade-scale");
    scale.replaceChildren();
    const levels = engine.GRADES.slice(1);
    const track = el("div", "grade-track");
    let min = 0;
    let position = 0;
    levels.forEach((g, i) => {
      const seg = el("div", "grade-seg grade-seg-" + g.id + (g.id === r.grade.id ? " active" : ""));
      seg.append(el("span", null, g.short));
      track.append(seg);
      if (r.ratio >= min && (r.ratio < g.max || i === levels.length - 1)) {
        position = (i + Math.min(1, (r.ratio - min) / (g.max - min))) / levels.length;
      }
      min = g.max;
    });
    const marker = el("div", "grade-marker");
    marker.style.left = position * 100 + "%";
    marker.title = pct(r.ratio) + " pahimmasta mahdollisesta";
    track.append(marker);
    scale.append(track);
  }

  function renderReviewer(r, budget) {
    const rev = window.GameReviewer;
    const panel = $("reviewer");
    if (!rev) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    const img = $("reviewer-img");
    const fallback = $("reviewer-fallback");
    fallback.textContent = rev.fallback;
    img.alt = rev.name;
    img.onload = () => {
      img.hidden = false;
      fallback.hidden = true;
    };
    img.onerror = () => {
      img.hidden = true;
      fallback.hidden = false;
    };
    if (img.getAttribute("src") !== rev.image) img.src = rev.image;

    const group = ["blocked", "minor"].includes(r.grade.id) ? "good" : r.grade.id === "moderate" ? "mid" : "bad";
    let quote = r.grade.id === "lucky" ? rev.lucky : rev.lines[r.scenario.id][group];
    if (group !== "good" && r.grade.id !== "lucky") {
      const best = engine.bestAdditions(
        r.scenario,
        state.selected,
        data,
        { impactScale: state.difficulty.impactScale, tier: r.tier },
        budget
      )[0];
      if (best) quote += " " + rev.tip.replace("{control}", best.control.short);
    }

    const stars = { blocked: 5, minor: 4, lucky: 4, moderate: 3, major: 2, critical: 1 }[r.grade.id];
    $("reviewer-title").textContent = rev.title;
    $("reviewer-stars").textContent = "★".repeat(stars) + "☆".repeat(5 - stars);
    $("reviewer-stars").setAttribute("aria-label", stars + " / 5 tähteä");
    $("reviewer-quote").textContent = "“" + quote + "”";
    $("reviewer-disclaimer").textContent = rev.disclaimer;
  }

  function renderLessons(r, budget) {
    const ul = $("lessons");
    ul.replaceChildren();

    const additions = engine.bestAdditions(
      r.scenario,
      state.selected,
      data,
      { impactScale: state.difficulty.impactScale, tier: r.tier },
      budget
    ).slice(0, 3);
    if (additions.length === 0) {
      ul.append(el("li", null, "Kokoonpanosi oli jo niin vahva, ettei yksittäinen lisäys olisi juuri auttanut tätä uhkaa vastaan."));
    }
    for (const a of additions) {
      const li = el("li");
      li.append(
        el("strong", null, a.control.icon + " " + a.control.name),
        document.createTextNode(
          " olisi pienentänyt odotettua vahinkoa " + money(a.reduction) + " (hinta " + money(a.control.cost) + ")"
        ),
        el("span", a.affordable ? "hint ok" : "hint", a.affordable ? " – budjetti olisi riittänyt!" : " – olisi vaatinut luopumista jostain muusta.")
      );
      ul.append(li);
    }

    const unused = engine.unusedControls(r.scenario, state.selected, data);
    if (unused.length) {
      ul.append(
        el(
          "li",
          "muted",
          "Näistä valinnoista ei ollut hyötyä tässä skenaariossa: " +
            unused.map((c) => c.short).join(", ") +
            ". Se ei tarkoita, että ne olisivat turhia – katso riskiprofiili alta."
        )
      );
    }
  }

  function renderRiskProfile() {
    const profile = engine.riskProfile(state.selected, data, state.difficulty);
    $("resilience-value").textContent = pct(profile.resilience);
    $("expected-loss").textContent = money(profile.expectedLoss);
    $("undefended-loss").textContent = money(profile.undefendedLoss);
    const wrap = $("risk-profile");
    wrap.replaceChildren();

    for (const row of profile.rows) {
      const item = el("div", "risk-row" + (row.scenario.id === state.result.scenario.id ? " current" : ""));
      const label = el("div", "risk-label", row.scenario.icon + " " + row.scenario.name);
      label.append(el("span", "risk-prob", pct(row.probability) + " uhista"));
      const bar = el("div", "risk-bar");
      const fill = el("div", "risk-fill");
      fill.style.width = Math.max(1, row.ratio * 100) + "%";
      fill.classList.add(row.ratio < 0.2 ? "low" : row.ratio < 0.5 ? "mid" : "high");
      bar.append(fill);
      const value = el("div", "risk-value", money(row.loss) + " / " + money(row.impact));
      value.title = "Läpimurron todennäköisyys " + pct(row.breachProbability);
      item.append(label, bar, value);
      wrap.append(item);
    }
  }

  /* ---------- Tapahtumat ---------- */

  $("btn-attack").addEventListener("click", launchAttack);
  $("btn-results").addEventListener("click", () => renderResult(state.result));
  $("btn-again").addEventListener("click", launchAttack);
  $("btn-edit").addEventListener("click", () => {
    updateBuild();
    show("build");
  });
  $("btn-restart").addEventListener("click", () => show("intro"));

  renderDifficulties();
  show("intro");
})();
