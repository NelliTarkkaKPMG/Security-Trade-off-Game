/* Käyttöliittymä: näkymien vaihto, kontrollien valinta ja tulosten esitys. */
(function () {
  const data = window.GameData;
  const engine = window.GameEngine;
  const controlMap = Object.fromEntries(data.controls.map((c) => [c.id, c]));

  const state = {
    difficulty: null,
    selected: new Set(), // ostetut kontrollit (ei sisällä jo omistettuja)
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
  const names = (ids) => ids.map((id) => controlMap[id].short).join(", ");
  const pips = (n) => "●".repeat(n) + "○".repeat(3 - n);

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

  const owned = () => state.difficulty.owned;
  // Kaikki voimassa olevat kontrollit: jo omistetut + ostetut.
  const active = () => new Set([...owned(), ...state.selected]);
  const budgetLeft = () => state.difficulty.budget - engine.totalCost(state.selected, data.controls);

  /* ---------- Aloitus ---------- */

  function renderDifficulties() {
    const list = $("difficulty-list");
    list.replaceChildren();
    for (const d of data.difficulties) {
      const topThreats = engine
        .riskProfile(d.owned, data, d)
        .rows.slice(0, 3)
        .map((r) => r.scenario.name)
        .join(", ");

      const facts = el("dl", "facts");
      for (const [term, value] of [
        ["Jo käytössä", names(d.owned)],
        ["Yleisimmät uhat", topThreats],
        ["Sääntely", d.regulation]
      ]) {
        const row = el("div");
        row.append(el("dt", null, term), el("dd", null, value));
        facts.append(row);
      }

      const btn = el("button", "difficulty");
      btn.type = "button";
      btn.append(
        el("strong", null, d.name),
        el("span", "difficulty-sector", d.sector),
        el("span", "difficulty-desc", d.desc),
        facts,
        el("span", "difficulty-budget", "Lisäbudjetti " + money(d.budget))
      );
      btn.addEventListener("click", () => startGame(d));
      list.append(btn);
    }
  }

  function startGame(difficulty) {
    state.difficulty = difficulty;
    state.selected = new Set();
    $("org-name").textContent = difficulty.name + " · " + difficulty.sector;
    renderControls();
    show("build");
  }

  /* ---------- Rakennus ---------- */

  function renderControls() {
    const grid = $("control-grid");
    grid.replaceChildren();
    const d = state.difficulty;
    // Jo omistetut kontrollit näytetään ensin.
    const ordered = [...data.controls].sort((a, b) => d.owned.includes(b.id) - d.owned.includes(a.id));
    for (const c of ordered) {
      const isOwned = d.owned.includes(c.id);
      const row = el("button", "control-row" + (isOwned ? " owned" : ""));
      row.type = "button";
      row.dataset.id = c.id;
      if (isOwned) row.disabled = true;

      const name = el("div", "control-name", c.name);
      if (d.required.includes(c.id)) {
        const law = el("span", "law-mark", "§");
        law.title = d.regulation + " edellyttää tätä";
        name.append(law);
      }
      name.append(el("span", "pips inline", pips(c.friction)));
      const text = el("div");
      text.append(name, el("div", "control-desc", c.desc));

      const friction = el("span", "pips", pips(c.friction));
      friction.title = "Hankaloittaa työtä: " + c.friction + "/3";

      row.append(
        el("span", "box", isOwned ? "✓" : ""),
        text,
        el("span", "control-cat", c.category),
        friction,
        el("span", "control-price", isOwned ? "Käytössä" : money(c.cost))
      );
      if (!isOwned) row.addEventListener("click", () => toggleControl(c.id));
      grid.append(row);
    }
    updateBuild();
  }

  function toggleControl(id) {
    if (state.selected.has(id)) {
      state.selected.delete(id);
    } else {
      if (controlMap[id].cost > budgetLeft()) return;
      state.selected.add(id);
    }
    updateBuild();
  }

  function updateBuild() {
    const budget = state.difficulty.budget;
    const left = budgetLeft();
    const friction = engine.totalFriction(active(), data.controls);
    const mult = engine.effectivenessMultiplier(friction, data.frictionLimit);

    $("budget-left").textContent = money(left);
    $("budget-total").textContent = money(budget);
    $("budget-fill").style.width = Math.min(100, ((budget - left) / budget) * 100) + "%";

    const frictionFill = $("friction-fill");
    frictionFill.style.width = Math.min(100, (friction / (data.frictionLimit * 2)) * 100) + "%";
    frictionFill.classList.toggle("over", friction > data.frictionLimit);
    $("friction-value").textContent = friction + " / " + data.frictionLimit;
    $("friction-note").textContent = mult < 1 ? "liikaa – ihmiset alkavat kiertää suojauksia" : "";

    for (const row of document.querySelectorAll(".control-row:not(.owned)")) {
      const c = controlMap[row.dataset.id];
      const selected = state.selected.has(c.id);
      row.classList.toggle("selected", selected);
      row.classList.toggle("unaffordable", !selected && c.cost > left);
      row.setAttribute("aria-pressed", String(selected));
      row.querySelector(".box").textContent = selected ? "✓" : "";
    }
  }

  /* ---------- Hyökkäys ---------- */

  function launchAttack() {
    if (state.selected.size === 0 && !confirm("Et valinnut yhtään uutta suojausta. Hyökätäänkö silti?")) return;
    const threat = engine.pickThreat(state.difficulty, data);
    state.result = engine.runAttack(threat.scenario, active(), data, {
      impactScale: state.difficulty.impactScale,
      tier: threat.tier
    });
    renderAttack(state.result);
    show("attack");
  }

  function timelineItem(cls, status, title, text, detailText, outcome) {
    const li = el("li", "timeline-item " + cls);
    const body = el("div", "timeline-body");
    body.append(el("h3", null, title));
    if (text) body.append(el("p", "timeline-text", text));
    if (detailText) body.append(el("p", "timeline-detail", detailText));
    if (outcome) body.append(el("p", "timeline-outcome", outcome));
    li.append(el("span", "status", status), body);
    return li;
  }

  function defenceText(contributors, p, label, none = "Ei suojausta tässä vaiheessa.") {
    if (!contributors.length) return none;
    return label + ": " + names(contributors.map((c) => c.id)) + " (" + pct(p) + ")";
  }

  function renderAttack(r) {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];

    $("attack-title").textContent = r.scenario.name;
    $("attack-intro").textContent = r.scenario.intro;
    const tier = $("attack-tier");
    tier.replaceChildren(el("strong", null, "Hyökkääjä: " + r.tier.name + ". "), document.createTextNode(r.tier.desc));
    const list = $("attack-timeline");
    list.replaceChildren();

    const items = r.stages.map((st, i) => {
      const contained = st.contained >= 0.01;
      const outcome = st.gaveUp
        ? r.scenario.giveUpText || "Hyökkääjä epäonnistui ja luovutti."
        : contained
          ? "Suojaukset eivät pysäyttäneet, mutta rajasivat vahinkoa."
          : null;
      const [cls, status] = st.blocked
        ? ["blocked", "PYSÄYTETTY"]
        : st.gaveUp
          ? ["gaveup", "LUOVUTTI"]
          : contained
            ? ["contained", "RAJATTU"]
            : ["passed", "LÄPI"];
      return timelineItem(cls, status, i + 1 + ". " + st.name, st.text, defenceText(st.contributors, st.p, "Suojana"), outcome);
    });

    // Vaiheet, joihin hyökkäys ei koskaan edennyt
    for (let i = r.stages.length; i < r.scenario.stages.length; i++) {
      items.push(timelineItem("skipped", "—", i + 1 + ". " + r.scenario.stages[i].name, "Hyökkäys ei edennyt tänne.", null, null));
    }

    if (r.breached) {
      const d = r.detection;
      items.push(
        timelineItem(
          d.detected ? "blocked" : "passed",
          d.detected ? "AJOISSA" : "MYÖHÄSSÄ",
          "Havaitseminen",
          d.text,
          defenceText(d.contributors, d.p, "Havaitsijana", "Kukaan ei ollut valvomassa."),
          null
        )
      );
      const rc = r.recovery;
      items.push(
        timelineItem(
          rc.contributors.length ? "blocked" : "passed",
          rc.contributors.length ? "−" + pct(1 - rc.factor) : "EI APUA",
          "Toipuminen",
          null,
          rc.contributors.length
            ? "Apuna: " + names(rc.contributors.map((c) => c.id)) + " – vahingot −" + pct(1 - rc.factor)
            : "Ei varmuuskopioita tai suunnitelmaa, joista olisi apua.",
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
    items.forEach((li, i) => revealTimers.push(setTimeout(() => li.classList.add("visible"), 300 + i * 1000)));
    revealTimers.push(setTimeout(finish, 300 + items.length * 1000));
    btnSkip.onclick = finish;
  }

  /* ---------- Tulokset ---------- */

  function renderResult(r) {
    $("result-hero").className = "verdict grade-" + r.grade.id;
    $("result-scenario").textContent = r.scenario.name + ", " + r.tier.adjective + " hyökkääjä";
    $("result-title").textContent = r.grade.label;
    $("result-score").textContent = r.score;

    let summary;
    if (r.gaveUp) {
      summary = (r.scenario.giveUpText || "Hyökkääjä epäonnistui omin avuin.") + " Tällä kertaa kävi tuuri.";
    } else if (!r.breached && r.blockedAt === 0) {
      summary = "Hyökkäys pysäytettiin heti alussa.";
    } else if (!r.breached) {
      summary = "Hyökkääjä pääsi vaiheeseen " + (r.blockedAt + 1) + "/" + r.scenario.stages.length + ", mutta pysäytettiin ennen varsinaista vahinkoa.";
    } else {
      summary = r.detection.text;
    }
    $("result-summary").textContent = summary;
    renderGradeScale(r);

    $("damage-fill").style.width = r.ratio * 100 + "%";
    $("damage-value").textContent = money(r.damage);
    $("damage-max").textContent = money(r.impact);
    renderBreakdown(r);
    renderLessons(r);
    $("discuss").textContent = r.scenario.discuss;
    renderRisk();
    show("result");
  }

  function renderBreakdown(r) {
    const ul = $("damage-breakdown");
    ul.replaceChildren();
    if (r.breached) {
      // Mikä pienensi vahinkoa pahimmasta mahdollisesta.
      const reductions = [];
      if (r.scope < 0.995) reductions.push(["Suojaukset rajasivat leviämistä", r.scope]);
      reductions.push([r.detection.detected ? "Nopea havaitseminen" : "Myöhäinen havaitseminen", r.detection.factor]);
      for (const c of r.recovery.contributors) reductions.push([controlMap[c.id].short, 1 - c.effect]);
      for (const [label, factor] of reductions) {
        if (factor < 0.995) ul.append(el("li", null, label + ": −" + pct(1 - factor)));
      }
    } else if (r.blockedAt > 0) {
      ul.append(el("li", null, "Selvittely- ja puhdistuskulut."));
    } else {
      ul.append(el("li", null, "Ei vahinkoja."));
    }
    if (r.multiplier < 1) {
      ul.append(el("li", "warn", "Liian monta hankaloittavaa suojausta: ihmiset kiersivät niitä, teho −" + pct(1 - r.multiplier) + "."));
    }
  }

  // Asteikko, jolla merkki näyttää, mihin tulos osui.
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
    track.append(marker);
    scale.append(track);
  }

  function renderLessons(r) {
    const ul = $("lessons");
    ul.replaceChildren();
    const additions = engine
      .bestAdditions(r.scenario, active(), data, { impactScale: state.difficulty.impactScale, tier: r.tier }, budgetLeft())
      .slice(0, 2);
    if (additions.length === 0) {
      ul.append(el("li", null, "Kokoonpanosi on jo vahva tätä uhkaa vastaan."));
    }
    for (const a of additions) {
      const li = el("li");
      li.append(
        el("strong", null, a.control.name),
        document.createTextNode(" · " + money(a.control.cost)),
        el("span", a.affordable ? "hint ok" : "hint", a.affordable ? " – budjetti olisi riittänyt." : " – olisi vaatinut luopumista jostain muusta.")
      );
      ul.append(li);
    }
  }

  function renderRisk() {
    const d = state.difficulty;
    const profile = engine.riskProfile(active(), data, d);
    $("risk-before").textContent = money(profile.undefendedLoss);
    $("risk-after").textContent = money(profile.expectedLoss);
    $("risk-change").textContent =
      profile.undefendedLoss > 0 ? "−" + pct(1 - profile.expectedLoss / profile.undefendedLoss) : "";

    const wrap = $("risk-profile");
    wrap.replaceChildren();
    for (const row of profile.rows.slice(0, 5)) {
      const item = el("div", "risk-row" + (row.scenario.id === state.result.scenario.id ? " current" : ""));
      const label = el("div", "risk-label", row.scenario.name);
      label.append(el("span", "risk-prob", pct(row.probability) + " hyökkäyksistä"));
      const bar = el("div", "risk-bar");
      const fill = el("div", "risk-fill");
      fill.style.width = Math.max(1, row.ratio * 100) + "%";
      fill.classList.add(row.ratio < 0.2 ? "low" : row.ratio < 0.5 ? "mid" : "high");
      bar.append(fill);
      item.append(label, bar, el("div", "risk-value", "läpi " + pct(row.breachProbability)));
      wrap.append(item);
    }

    const missing = d.required.filter((id) => !active().has(id));
    const note = $("required-note");
    note.hidden = missing.length === 0;
    note.textContent = missing.length ? d.regulation + " edellyttää myös: " + names(missing) + "." : "";
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
