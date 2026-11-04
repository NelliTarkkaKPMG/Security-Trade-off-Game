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
      : Math.round(k).toLocaleString("fi-FI") + "\u00a0k€";
  const pct = (p) => Math.round(p * 100) + "\u00a0%";
  // Kaksoispisteen jälkeinen luettelo pienellä alkukirjaimella; lyhenteet (MFA, EDR, DDoS-suojaus) ennallaan.
  const lowerFirst = (word) => (/^[A-ZÅÄÖ][a-zåäö]/.test(word) ? word[0].toLowerCase() + word.slice(1) : word);
  const nameList = (ids) => ids.map((id) => lowerFirst(controlMap[id].short)).join(", ");

  // Pelin oma SVG-kuvake (js/icons.js). Sisältö on staattista, omaa koodia.
  function icon(name, cls) {
    const span = el("span", "icon" + (cls ? " " + cls : ""));
    span.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + window.GameIcons[name] + "</svg>";
    return span;
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // Kasvattaa palkin nollasta, kun näkymä on piirretty.
  function animateWidth(elm, width) {
    elm.style.width = "0%";
    if (reducedMotion) {
      elm.style.width = width;
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => (elm.style.width = width)));
  }

  // Laskee luvun nollasta tavoitteeseen.
  function countUp(elm, to) {
    if (reducedMotion) {
      elm.textContent = to;
      return;
    }
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / 900);
      elm.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    elm.textContent = "0";
    requestAnimationFrame(step);
  }

  // Käynnistää CSS-animaation uudelleen samalle elementille.
  function replay(elm, cls) {
    elm.classList.remove(cls);
    void elm.offsetWidth;
    elm.classList.add(cls);
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

      const btn = el("button", "difficulty");
      btn.type = "button";
      btn.append(
        icon("c-" + d.id, "difficulty-icon"),
        el("strong", null, d.name),
        el("span", "muted small", d.sector),
        el("span", "difficulty-desc", d.desc),
        el("span", "difficulty-row", "Jo käytössä: " + nameList(d.owned)),
        el("span", "difficulty-row", "Yleisimmät uhat: " + topThreats.split(", ").map(lowerFirst).join(", ")),
        el("span", "difficulty-budget", "Lisäbudjetti " + money(d.budget) + " · " + d.regulation)
      );
      btn.addEventListener("click", () => startGame(d));
      list.append(btn);
    }
  }

  function startGame(difficulty) {
    state.difficulty = difficulty;
    state.selected = new Set();
    $("org-name").textContent = difficulty.name;
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
      const card = el("button", "control-card" + (isOwned ? " owned" : ""));
      card.type = "button";
      card.dataset.id = c.id;
      if (isOwned) card.disabled = true;

      const head = el("div", "control-head");
      head.append(icon(c.id, "control-icon"), el("span", "tag tag-" + c.category, c.category));

      const badges = el("div", "control-badges");
      if (isOwned) badges.append(el("span", "badge badge-owned", "Jo käytössä"));
      if (d.required.includes(c.id)) {
        const b = el("span", "badge badge-required", "Laki edellyttää");
        b.title = d.regulation + " edellyttää tätä";
        badges.append(b);
      }

      const meta = el("div", "control-meta");
      meta.append(el("span", "cost", isOwned ? "" : money(c.cost)));
      const friction = el("span", "friction-dots");
      friction.title = "Hankaloittaa työntekoa: " + c.friction;
      friction.textContent = "●".repeat(c.friction) + "○".repeat(3 - c.friction);
      meta.append(friction);

      card.append(head, el("h3", null, c.name), badges, el("p", "muted", c.desc), meta);
      if (!isOwned) card.addEventListener("click", () => toggleControl(c.id));
      grid.append(card);
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

    const budgetEl = $("budget-left");
    if (budgetEl.textContent !== money(left)) {
      budgetEl.textContent = money(left);
      replay(budgetEl, "bump");
    }
    $("budget-total").textContent = money(budget);
    $("budget-fill").style.width = Math.min(100, ((budget - left) / budget) * 100) + "%";

    const frictionFill = $("friction-fill");
    frictionFill.style.width = Math.min(100, (friction / (data.frictionLimit * 2)) * 100) + "%";
    frictionFill.classList.toggle("over", friction > data.frictionLimit);
    $("friction-value").textContent = friction + " / " + data.frictionLimit;
    $("friction-note").textContent =
      mult < 1 ? "· liikaa kerralla: ihmiset kiertävät suojauksia" : "· ihmiset sietävät tämän";

    for (const card of document.querySelectorAll(".control-card:not(.owned)")) {
      const c = controlMap[card.dataset.id];
      const selected = state.selected.has(c.id);
      card.classList.toggle("selected", selected);
      card.classList.toggle("unaffordable", !selected && c.cost > left);
      card.setAttribute("aria-pressed", String(selected));
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

  function defenceText(contributors, p, label, none = "Ei suojausta tässä vaiheessa.") {
    if (!contributors.length) return none;
    return label + ": " + nameList(contributors.map((c) => c.id)) + " (" + pct(p) + ")";
  }

  function renderAttack(r) {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];

    $("attack-icon").replaceChildren(icon("s-" + r.scenario.id));
    $("attack-title").textContent = r.scenario.name;
    $("attack-intro").textContent = r.scenario.intro;
    $("attack-tier").className = "tier-badge tier-" + r.tier.id;
    $("attack-tier").textContent = "Hyökkääjä: " + r.tier.name.toLowerCase();
    $("attack-tier").title = r.tier.desc;
    const list = $("attack-timeline");
    list.replaceChildren();

    const items = r.stages.map((st, i) => {
      const contained = st.contained >= 0.01;
      const outcome = st.blocked
        ? "Pysäytetty."
        : st.gaveUp
          ? r.scenario.giveUpText || "Hyökkääjä epäonnistui ja luovutti."
          : contained
            ? "Pääsi läpi, mutta suojaukset rajasivat vahinkoa."
            : "Pääsi läpi.";
      const cls = st.blocked ? "blocked" : st.gaveUp ? "gaveup" : contained ? "contained" : "passed";
      return timelineItem(cls, i + 1 + ". " + st.name, st.text, defenceText(st.contributors, st.p, "Suojana"), outcome);
    });

    // Vaiheet, joihin hyökkäys ei koskaan edennyt
    for (let i = r.stages.length; i < r.scenario.stages.length; i++) {
      items.push(timelineItem("skipped", i + 1 + ". " + r.scenario.stages[i].name, "Hyökkäys ei edennyt tänne.", null, null));
    }

    if (r.breached) {
      const d = r.detection;
      items.push(
        timelineItem(d.detected ? "blocked" : "passed", "Havaitseminen", null, defenceText(d.contributors, d.p, "Havaitsijana", "Kukaan ei ollut valvomassa."), d.text)
      );
      const rc = r.recovery;
      items.push(
        timelineItem(
          rc.contributors.length ? "blocked" : "passed",
          "Toipuminen",
          null,
          rc.contributors.length
            ? "Apuna: " + nameList(rc.contributors.map((c) => c.id)) + " – vahingot −" + pct(1 - rc.factor)
            : "Ei varmuuskopioita tai suunnitelmaa, joista olisi apua.",
          null
        )
      );
    }

    const btnResults = $("btn-results");
    const btnSkip = $("btn-skip");
    btnResults.hidden = true;
    btnSkip.hidden = false;

    items.forEach((li) => list.append(li));

    // Hyökkäyksen reitti: solmu jokaiselle vaiheelle, pulssi etenee solmusta toiseen.
    const path = $("attack-path");
    path.replaceChildren();
    const track = el("div", "path-track");
    const fill = el("div", "path-fill");
    const pulse = el("div", "path-pulse");
    track.append(fill, pulse);
    path.append(track);
    const pos = (i) => (items.length === 1 ? 50 : (i / (items.length - 1)) * 100);
    const nodes = items.map((li, i) => {
      const node = el("div", "path-node " + li.className.replace("timeline-item ", ""));
      node.style.left = pos(i) + "%";
      const label = li.querySelector("h4").textContent.replace(/^\d+\.\s*/, "");
      node.append(el("span", "path-dot"), el("span", "path-label", label));
      track.append(node);
      return node;
    });

    const isSkipped = (i) => items[i].classList.contains("skipped");
    const reveal = (i, animate) => {
      items[i].classList.add("visible");
      nodes[i].classList.add("on");
      if (isSkipped(i)) return; // hyökkääjä ei koskaan päässyt tänne
      fill.style.width = pos(i) + "%";
      pulse.style.left = pos(i) + "%";
      if (animate && items[i].classList.contains("passed")) replay(items[i], "hit");
      // Pysäytetty: pulssi sammuu ja saavuttamattomat vaiheet näytetään heti.
      if (items[i].classList.contains("blocked") || items[i].classList.contains("gaveup")) {
        if (i < r.stages.length) {
          pulse.classList.add("stopped");
          items.forEach((_, j) => isSkipped(j) && reveal(j, false));
        }
      }
    };

    const finish = () => {
      revealTimers.forEach(clearTimeout);
      revealTimers = [];
      items.forEach((_, i) => reveal(i, false));
      btnSkip.hidden = true;
      btnResults.hidden = false;
      btnResults.focus();
    };

    if (reducedMotion) {
      finish();
      return;
    }
    replay($("alarm"), "go");
    const sequence = items.map((_, i) => i).filter((i) => !isSkipped(i));
    sequence.forEach((i, n) => revealTimers.push(setTimeout(() => reveal(i, true), 900 + n * 1100)));
    revealTimers.push(setTimeout(finish, 900 + sequence.length * 1100));
    btnSkip.onclick = finish;
  }

  /* ---------- Tulokset ---------- */

  function renderResult(r) {
    $("result-hero").className = "panel result-hero grade-" + r.grade.id;
    $("result-scenario").textContent = r.scenario.name + ", " + r.tier.adjective + " hyökkääjä";
    $("result-title").textContent = r.grade.label;
    countUp($("result-score"), r.score);
    const gauge = $("gauge-fill");
    const circumference = 2 * Math.PI * 52;
    gauge.style.strokeDasharray = circumference;
    gauge.style.strokeDashoffset = circumference;
    const target = circumference * (1 - r.score / 100);
    if (reducedMotion) gauge.style.strokeDashoffset = target;
    else requestAnimationFrame(() => requestAnimationFrame(() => (gauge.style.strokeDashoffset = target)));

    let summary;
    if (r.gaveUp) {
      summary = (r.scenario.giveUpText || "Hyökkääjä epäonnistui ja luovutti.") + " Tällä kertaa kävi tuuri.";
    } else if (!r.breached && r.blockedAt === 0) {
      summary = "Hyökkäys pysäytettiin heti alussa.";
    } else if (!r.breached) {
      summary = "Hyökkääjä eteni vaiheeseen " + (r.blockedAt + 1) + "/" + r.scenario.stages.length + ", mutta se pysäytettiin ennen varsinaista vahinkoa.";
    } else {
      summary = r.detection.text;
    }
    $("result-summary").textContent = summary;
    renderGradeScale(r);

    animateWidth($("damage-fill"), r.ratio * 100 + "%");
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
        icon(a.control.id, "inline"),
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
    const reduction = profile.undefendedLoss > 0 ? 1 - profile.expectedLoss / profile.undefendedLoss : 0;
    $("risk-change").textContent = Math.round(reduction * 100) > 0 ? "−" + pct(reduction) : "";

    const wrap = $("risk-profile");
    wrap.replaceChildren();
    for (const row of profile.rows.slice(0, 5)) {
      const item = el("div", "risk-row" + (row.scenario.id === state.result.scenario.id ? " current" : ""));
      const label = el("div", "risk-label");
      label.append(icon("s-" + row.scenario.id, "inline"), document.createTextNode(row.scenario.name));
      label.append(el("span", "risk-prob", pct(row.probability) + " hyökkäyksistä"));
      const bar = el("div", "risk-bar");
      const fill = el("div", "risk-fill");
      animateWidth(fill, Math.max(1, row.ratio * 100) + "%");
      fill.classList.add(row.ratio < 0.2 ? "low" : row.ratio < 0.5 ? "mid" : "high");
      bar.append(fill);
      item.append(label, bar, el("div", "risk-value", "läpi " + pct(row.breachProbability)));
      wrap.append(item);
    }

    const missing = d.required.filter((id) => !active().has(id));
    const note = $("required-note");
    note.hidden = missing.length === 0;
    note.textContent = missing.length ? d.regulation + " edellyttää myös: " + nameList(missing) + "." : "";
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

  // Uhkatutka: jokainen skenaario on piste tutkassa, yleisimmät lähimpänä keskustaa.
  // Piste välähtää, kun pyörivä säde osuu siihen (viive = kulma / kierros).
  function renderRadar() {
    const wrap = $("radar-blips");
    const sweepSeconds = 6;
    const max = Math.max(...data.scenarios.map((sc) => sc.likelihood));
    data.scenarios.forEach((sc, i) => {
      const angle = (i / data.scenarios.length) * 360 + 12;
      const radius = 42 - (sc.likelihood / max) * 20;
      const rad = ((angle - 90) * Math.PI) / 180;
      const blip = icon("s-" + sc.id, "blip");
      blip.style.left = 50 + radius * Math.cos(rad) + "%";
      blip.style.top = 50 + radius * Math.sin(rad) + "%";
      blip.style.animationDelay = (angle / 360) * sweepSeconds + "s";
      blip.title = sc.name;
      wrap.append(blip);
    });
  }

  renderRadar();
  renderDifficulties();
  show("intro");
})();
