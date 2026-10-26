/* Käyttöliittymä: näkymien vaihto, kontrollien valinta ja tulosten esitys. */
(function () {
  const data = window.GameData;
  const engine = window.GameEngine;
  const controlMap = Object.fromEntries(data.controls.map((c) => [c.id, c]));

  const state = {
    difficulty: null,
    selected: new Set(),
    lastScenarioId: null,
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
        el("span", "muted", d.desc)
      );
      btn.addEventListener("click", () => startGame(d));
      list.append(btn);
    }
  }

  function startGame(difficulty) {
    state.difficulty = difficulty;
    state.selected = new Set();
    state.lastScenarioId = null;
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

  function pickScenario() {
    const pool = data.scenarios.filter((s) => s.id !== state.lastScenarioId);
    const s = pool[Math.floor(Math.random() * pool.length)];
    state.lastScenarioId = s.id;
    return s;
  }

  function launchAttack() {
    if (state.selected.size === 0 && !confirm("Et valinnut yhtään kontrollia. Hyökätäänkö silti?")) return;
    const scenario = pickScenario();
    state.result = engine.runAttack(scenario, state.selected, data, state.difficulty.impactScale);
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
    const list = $("attack-timeline");
    list.replaceChildren();

    const items = r.stages.map((st, i) => {
      const defence = st.contributors.length
        ? "Puolustus: " + controlNames(st.contributors) + " → torjunnan todennäköisyys " + pct(st.p)
        : "Ei yhtään kontrollia tätä vaihetta vastaan.";
      const outcome = st.blocked ? "🛑 Hyökkäys pysäytettiin!" : "➡️ Hyökkääjä pääsi läpi.";
      return timelineItem(st.blocked ? "blocked" : "passed", i + 1 + ". " + st.name, st.text, defence, outcome);
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
          "Huomataanko hyökkäys ajoissa?",
          d.contributors.length
            ? "Havainnointi: " + controlNames(d.contributors) + " → todennäköisyys " + pct(d.p)
            : "Ei havaitsevia kontrolleja.",
          d.detected ? "✅ Hyökkäys havaittiin – vahingot puolittuvat." : "❌ Hyökkäys huomattiin vasta liian myöhään."
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
    const scale = state.difficulty.impactScale;
    const budget = state.difficulty.budget;

    $("result-hero").className = "panel result-hero grade-" + r.grade.id;
    $("result-emoji").textContent = r.grade.emoji;
    $("result-scenario").textContent = r.scenario.icon + " " + r.scenario.name;
    $("result-title").textContent = r.grade.label;
    $("result-score").textContent = r.score;

    let summary;
    if (!r.breached && r.blockedAt === 0) {
      summary = "Hyökkäys pysäytettiin jo ensimmäisessä vaiheessa. Erinomaista!";
    } else if (!r.breached) {
      summary =
        "Hyökkääjä eteni vaiheeseen " + (r.blockedAt + 1) + "/" + r.scenario.stages.length +
        ", mutta pysäytettiin ennen varsinaista vahinkoa.";
    } else {
      summary = "Hyökkääjä läpäisi kaikki puolustuslinjat. ";
      summary += r.detection.detected ? "Onneksi hyökkäys havaittiin ajoissa." : "Hyökkäys huomattiin vasta liian myöhään.";
    }
    $("result-summary").textContent = summary;

    $("damage-fill").style.width = r.ratio * 100 + "%";
    $("damage-value").textContent = money(r.damage);
    $("damage-max").textContent = money(r.impact);

    const breakdown = $("damage-breakdown");
    breakdown.replaceChildren();
    if (r.breached) {
      breakdown.append(el("li", null, "Täysi tietoturvaloukkaus: " + money(r.impact)));
      if (r.detection.detected) breakdown.append(el("li", null, "Havaittiin ajoissa: −50 %"));
      for (const c of r.recovery.contributors) {
        breakdown.append(el("li", null, controlMap[c.id].short + ": −" + pct(c.effect)));
      }
    } else if (r.blockedAt > 0) {
      breakdown.append(el("li", null, "Selvittely- ja puhdistuskulut, kun hyökkääjä ehti vaiheeseen " + (r.blockedAt + 1)));
    } else {
      breakdown.append(el("li", null, "Ei vahinkoja."));
    }
    if (r.multiplier < 1) {
      breakdown.append(
        el("li", "warn", "😤 Liian suuri käyttäjäkitka heikensi kontrollien tehoa " + pct(1 - r.multiplier) + ".")
      );
    }

    renderLessons(r, scale, budget);
    renderRiskProfile(scale);

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

  function renderLessons(r, scale, budget) {
    const ul = $("lessons");
    ul.replaceChildren();

    const additions = engine.bestAdditions(r.scenario, state.selected, data, scale, budget).slice(0, 3);
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

  function renderRiskProfile(scale) {
    const profile = engine.riskProfile(state.selected, data, scale);
    $("resilience-value").textContent = pct(profile.resilience);
    const wrap = $("risk-profile");
    wrap.replaceChildren();

    for (const row of profile.rows) {
      const item = el("div", "risk-row" + (row.scenario.id === state.result.scenario.id ? " current" : ""));
      const label = el("div", "risk-label", row.scenario.icon + " " + row.scenario.name);
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
