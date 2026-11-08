(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => APP.escapeHtml(value);
  let nextId = null;
  let nextDate = null;
  const sorted = (list, direction = 1) =>
    [...list].sort((a, b) => direction * (new Date(a.date) - new Date(b.date)));
  function nextFixture() {
    const next = sorted(
      APP.data.matches.filter(
        (match) =>
          match.status === "scheduled" && new Date(match.date) > new Date(),
      ),
    )[0];
    const target = $("next-match");
    if (next?.id === nextId && next?.date === nextDate && next) {
      const count = APP.countdown(next.date);
      target
        .querySelectorAll("[data-count]")
        .forEach(
          (node) =>
            (node.textContent = String(count[node.dataset.count]).padStart(
              2,
              "0",
            )),
        );
      if (count.total === 0) {
        nextId = null;
        nextFixture();
      }
      return;
    }
    nextId = next?.id || null;
    nextDate = next?.date || null;
    if (!next) {
      $("next-status").textContent = "Fixtures";
      target.innerHTML =
        '<div class="fixture-board-empty"><h2>A new season.<br>An open court.</h2><p>Scheduled fixtures will appear here. Get your team ready for the next match.</p></div>';
      return;
    }
    $("next-status").textContent = "Scheduled";
    const count = APP.countdown(next.date);
    target.innerHTML = `<div class="fixture-match"><h2>${esc(next.homeTeam)}<span class="versus">versus</span>${esc(next.awayTeam)}</h2><p class="fixture-meta">${APP.fmtDate(next.date)} · ${APP.fmtTime(next.date)} CAT<br>${esc(next.venue || "Venue to be confirmed")}</p><div class="countdown" aria-label="Time until match">${[
      ["d", "Days"],
      ["h", "Hours"],
      ["m", "Mins"],
      ["s", "Secs"],
    ]
      .map(
        ([key, label]) =>
          `<div class="countdown-unit"><span class="num" data-count="${key}">${String(count[key]).padStart(2, "0")}</span><span class="lbl">${label}</span></div>`,
      )
      .join("")}</div></div>`;
  }
  function practice() {
    const bookings = sorted(
      APP.data.bookings.filter(
        (booking) =>
          booking.type === "practice" &&
          booking.status !== "cancelled" &&
          new Date(booking.date) > new Date(),
      ),
    ).slice(0, 4);
    $("practice-list").innerHTML = bookings.length
      ? bookings
          .map(
            (booking) =>
              `<article class="practice-row"><time datetime="${esc(booking.date)}">${APP.fmtDate(booking.date, { year: undefined })}<br>${APP.fmtTime(booking.date)}</time><div><h3>${esc(booking.venue)}</h3><p>${esc(booking.teamName)} · ${booking.status === "confirmed" ? "Confirmed by team" : "Awaiting team confirmation"}</p></div>${APP.status("Practice")}</article>`,
          )
          .join("")
      : APP.empty(
          "Make time for the next session.",
          "No practice sessions are booked yet. Choose a venue and put a session on the calendar.",
          "matches.html",
          "Plan a practice",
        );
    const results = sorted(
      APP.data.matches.filter(
        (match) => match.status === "completed" && match.score,
      ),
      -1,
    ).slice(0, 3);
    $("recent-results").innerHTML = results.length
      ? results
          .map(
            (match) =>
              `<article class="practice-row" style="grid-template-columns:1fr auto"><div><h3>${esc(match.homeTeam)} v ${esc(match.awayTeam)}</h3><p>${APP.fmtDate(match.date)} · ${esc(match.venue || "GZVM match")}</p></div><strong class="fixture-score">${Number(match.score.home)}–${Number(match.score.away)}</strong></article>`,
          )
          .join("")
      : APP.empty(
          "The results are still to come.",
          "Completed matches and set scores will be recorded here.",
          "matches.html",
          "View the match centre",
        );
  }
  function rankings() {
    const players = APP.data.players
      .map((player) => ({
        ...player,
        total: APP.skills.reduce(
          (sum, [key]) => sum + Number(player.stats?.[key] || 0),
          0,
        ),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    $("home-rankings").innerHTML = players.length
      ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Top five player self-ratings"><table><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Team</th><th scope="col">Position</th><th scope="col" class="num">Combined rating</th></tr></thead><tbody>${players.map((player, index) => `<tr><td><span class="rank">${String(index + 1).padStart(2, "0")}</span></td><th scope="row"><span class="person">${APP.avatar(player)}<strong>${esc(player.name)}</strong></span></th><td>${esc(player.team || "Free agent")}</td><td>${esc(player.position || "Not specified")}</td><td class="num"><strong>${player.total}</strong><span class="muted"> / 600</span></td></tr>`).join("")}</tbody></table></div>`
      : APP.empty(
          "A place for your name.",
          "Register as a player and add your first skill ratings. The board grows with the community—not with invented statistics.",
          "register.html",
          "Create your player profile",
        );
  }
  function film() {
    const rooms = window.LIVE?.getActiveRooms() || [];
    $("home-live-rooms").innerHTML = rooms
      .slice(0, 2)
      .map(
        (room) =>
          `<div class="room-strip-item"><div>${APP.status("Live", "live")}<h3>${esc(room.title)}</h3><p>Hosted by ${esc(room.host)}</p></div><a class="btn btn-secondary btn-sm" href="live.html?room=${encodeURIComponent(room.id)}">Watch ↗</a></div>`,
      )
      .join("");
    const highlights = APP.data.highlights.filter((item) =>
      APP.getHighlightVideo(item),
    );
    if (highlights.length) {
      $("home-film").className = "highlight-grid";
      $("home-film").style.gridTemplateColumns = "1fr";
      APP.renderHighlights($("home-film"), 1);
    }
  }

  const score = { home: 0, away: 0, sets: [] };
  const form = $("score-form");
  const setsWon = () => ({
    home: score.sets.filter((set) => set[0] > set[1]).length,
    away: score.sets.filter((set) => set[1] > set[0]).length,
  });
  const complete = () => Object.values(setsWon()).some((value) => value >= 3);
  function renderScore() {
    const won = setsWon();
    $("sp-home").textContent = score.home;
    $("sp-away").textContent = score.away;
    $("sp-home-name").textContent = form.elements.home.value.trim() || "Home";
    $("sp-away-name").textContent = form.elements.away.value.trim() || "Away";
    $("sp-set-label").textContent = complete()
      ? `Match complete · ${won.home}–${won.away} sets`
      : `Set ${score.sets.length + 1} · First to ${score.sets.length === 4 ? 15 : 25}`;
    $("sp-sets").innerHTML = score.sets.length
      ? score.sets
          .map(
            (set, index) =>
              `<span class="set-score">Set ${index + 1} <strong>${set[0]}–${set[1]}</strong></span>`,
          )
          .join("")
      : "No sets completed";
    $("sp-next-set").disabled = complete();
    form
      .querySelectorAll("[data-delta]")
      .forEach(
        (button) =>
          (button.disabled =
            complete() ||
            (button.dataset.delta === "-1" &&
              score[button.dataset.team] === 0)),
      );
  }
  form.querySelectorAll("[data-delta]").forEach((button) =>
    button.addEventListener("click", () => {
      if (complete()) return;
      score[button.dataset.team] = Math.max(
        0,
        score[button.dataset.team] + Number(button.dataset.delta),
      );
      APP.clearMessage(form);
      renderScore();
    }),
  );
  form
    .querySelectorAll(".scorepad-names input")
    .forEach((input) => input.addEventListener("input", renderScore));
  $("sp-next-set").addEventListener("click", () => {
    if (complete()) return;
    const target = score.sets.length === 4 ? 15 : 25;
    if (
      Math.max(score.home, score.away) < target ||
      Math.abs(score.home - score.away) < 2
    )
      return APP.formMessage(
        form,
        `A set needs at least ${target} points and a two-point lead. Keep playing, or correct the score.`,
      );
    score.sets.push([score.home, score.away]);
    score.home = 0;
    score.away = 0;
    APP.clearMessage(form);
    renderScore();
    if (complete())
      APP.formMessage(
        form,
        "Match complete. Check the team names and save the result.",
        "success",
      );
  });
  $("sp-reset").addEventListener("click", () => {
    if (
      (score.home || score.away || score.sets.length) &&
      !confirm("Reset this scorekeeper? Unsaved points and sets will be lost.")
    )
      return;
    score.home = 0;
    score.away = 0;
    score.sets = [];
    form.reset();
    APP.clearMessage(form);
    renderScore();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!APP.validate(form)) return;
    if (!complete())
      return APP.formMessage(
        form,
        "Finish the match first: the first team to win three sets wins this match.",
      );
    if (
      form.elements.home.value.trim().toLowerCase() ===
      form.elements.away.value.trim().toLowerCase()
    )
      return APP.formMessage(
        form,
        "Enter two different team names before saving.",
      );
    const won = setsWon();
    APP.data.matches.push({
      id: APP.uid(),
      homeTeam: form.elements.home.value.trim(),
      awayTeam: form.elements.away.value.trim(),
      date: new Date().toISOString(),
      venue: "",
      status: "completed",
      score: won,
      sets: score.sets.map((set) => [...set]),
      recordedBy: APP.currentUser()?.id,
    });
    if (!APP.save()) {
      APP.data.matches.pop();
      APP.formMessage(form, APP.storageError);
      return;
    }
    score.home = 0;
    score.away = 0;
    score.sets = [];
    form.reset();
    renderScore();
    APP.formMessage(
      form,
      "Result saved. Find the set-by-set score in Match centre → Results.",
      "success",
    );
    renderAll();
  });
  function renderAll() {
    nextFixture();
    practice();
    rankings();
    film();
  }
  renderAll();
  renderScore();
  setInterval(nextFixture, 1000);
  window.addEventListener("gzvm:refresh", renderAll);
  window.addEventListener("gzvm:local-change", () => {
    practice();
    rankings();
    film();
  });
  window.LIVE?.listenToRooms(film);
})();
