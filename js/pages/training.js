(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("progress-form");
  const user = APP.currentUser();
  function myPlayer() {
    if (!user) return null;
    return (
      APP.data.players.find((player) => player.userId === user.id) ||
      APP.data.players.find(
        (player) => player.email?.toLowerCase() === user.email.toLowerCase(),
      )
    );
  }
  function history() {
    return (APP.data.scorePad.history || []).filter(
      (entry) => user && (entry.userId === user.id || !entry.userId),
    );
  }
  function renderHistory() {
    const entries = history().slice().reverse();
    $("last-checkin").textContent = entries[0]
      ? `Last check-in · ${APP.fmtDate(entries[0].date)}`
      : "Your first check-in";
    $("progress-history").innerHTML = entries.length
      ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Skill check-in history"><table><thead><tr><th scope="col">Date</th><th scope="col" class="num">Average / 100</th><th scope="col">Highest rating</th><th scope="col">Next focus</th></tr></thead><tbody>${entries
          .slice(0, 24)
          .map((entry) => {
            const ratings = APP.skills.map(([key, label]) => ({
              label,
              value: Number(entry.stats?.[key] || 0),
            }));
            const high = [...ratings].sort((a, b) => b.value - a.value)[0];
            const low = [...ratings].sort((a, b) => a.value - b.value)[0];
            return `<tr><td>${APP.fmtDate(entry.date)}${!entry.userId ? '<small class="muted" style="display:block">Earlier device check-in</small>' : ""}</td><td class="num">${Number(entry.avg || 0)}</td><td>${high.label} · ${high.value}</td><td>${low.label} · ${low.value}</td></tr>`;
          })
          .join(
            "",
          )}</tbody></table></div><p class="table-note">Showing the latest 24 check-ins. Entries without an account are legacy records stored on this device.</p>`
      : APP.empty(
          "Your starting point goes here.",
          "Save your first check-in. Come back after a week of practice and record another.",
        );
  }
  if (user) {
    $("progress-login").hidden = true;
    form.hidden = false;
    $("film-login").hidden = true;
    $("highlight-form").hidden = false;
    const latest = history().slice(-1)[0];
    $("progress-skills").innerHTML = APP.skillFields(
      myPlayer()?.stats || latest?.stats || {},
      "progress",
    );
    APP.bindRanges(form);
    renderHistory();
    if (!myPlayer())
      $("progress-description").textContent =
        "Your check-ins will be saved to your account. Complete player registration to appear on the community skill board.";
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!APP.currentUser()) {
      location.href = APP.withReturn("login.html");
      return;
    }
    const stats = Object.fromEntries(
      APP.skills.map(([key]) => [
        key,
        Number(form.elements[`skill_${key}`].value),
      ]),
    );
    const entry = {
      date: new Date().toISOString(),
      userId: user.id,
      avg: Math.round(Object.values(stats).reduce((a, b) => a + b, 0) / 6),
      stats,
    };
    const player = myPlayer();
    const oldStats = player?.stats;
    APP.data.scorePad.history ||= [];
    APP.data.scorePad.history.push(entry);
    if (player) {
      player.stats = stats;
      player.userId = user.id;
    }
    if (!APP.save()) {
      APP.data.scorePad.history.pop();
      if (player) player.stats = oldStats;
      APP.formMessage(form, APP.storageError);
      return;
    }
    APP.formMessage(
      form,
      player
        ? "Check-in saved. Your player profile and skill board have been updated."
        : "Check-in saved to your account. Register as a player to appear on the skill board.",
      "success",
    );
    renderHistory();
  });
  $("highlight-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const highlightForm = event.currentTarget;
    if (!APP.validate(highlightForm)) return;
    const values = APP.formData(highlightForm);
    const video = APP.videoFromUrl(values.videoUrl);
    if (!video)
      return APP.formMessage(
        highlightForm,
        "Use a valid YouTube or Vimeo watch link. Other video URLs are not supported.",
      );
    const me = APP.currentUser();
    if (!me)
      return APP.formMessage(
        highlightForm,
        "Please sign in before sharing a clip.",
      );
    const player = myPlayer();
    const highlight = {
      id: APP.uid(),
      title: values.title,
      player: player?.name || me.name,
      team: player?.team || "",
      userId: me.id,
      date: new Date().toISOString(),
      videoUrl: values.videoUrl,
      videoId: video.provider === "YouTube" ? video.videoId : undefined,
    };
    APP.data.highlights.push(highlight);
    if (!APP.save()) {
      APP.data.highlights.pop();
      APP.formMessage(highlightForm, APP.storageError);
      return;
    }
    highlightForm.reset();
    APP.formMessage(
      highlightForm,
      "Highlight shared. It is now available in the live page film room.",
      "success",
    );
    APP.renderHighlights($("training-highlights"), 3);
  });
  APP.renderHighlights($("training-highlights"), 3);
  window.addEventListener("gzvm:refresh", () => {
    APP.renderHighlights($("training-highlights"), 3);
    if (user) renderHistory();
  });
})();
