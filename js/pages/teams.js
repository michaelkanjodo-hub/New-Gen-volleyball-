(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => APP.escapeHtml(value);
  const crest = (team) => {
    const logo =
      APP.safeUrl(team.logo) ||
      (String(team.logo || "").startsWith("data:image/") ? team.logo : "");
    return logo
      ? `<img class="team-crest" src="${esc(logo)}" alt="" width="50" height="56" loading="lazy">`
      : `<span class="team-crest" aria-hidden="true">${esc(APP.initials(team.name))}</span>`;
  };
  function render() {
    const city = $("city-filter").value;
    const query = $("search").value.trim().toLowerCase();
    const cities = [
      ...new Set(APP.data.teams.map((team) => team.city).filter(Boolean)),
    ].sort();
    $("city-filter").innerHTML =
      '<option value="">All cities</option>' +
      cities
        .map(
          (item) =>
            `<option value="${esc(item)}"${item === city ? " selected" : ""}>${esc(item)}</option>`,
        )
        .join("");
    const teams = APP.data.teams
      .filter(
        (team) =>
          (!city || team.city === city) &&
          (!query ||
            `${team.name} ${team.coach}`.toLowerCase().includes(query)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    $("team-count").textContent =
      `${teams.length} ${teams.length === 1 ? "team" : "teams"}${city || query ? " found" : " registered"}`;
    $("clear-filters").hidden = !city && !query;
    $("teams-list").innerHTML = teams.length
      ? teams
          .map((team) => {
            const count = APP.data.players.filter(
              (player) => player.team === team.name,
            ).length;
            return `<article class="team-row">${crest(team)}<div><h3>${esc(team.name)}</h3><p>${esc(team.city || "City not specified")} · ${esc(team.level || "Community team")}</p></div><div class="team-coach"><p>Coach · ${esc(team.coach || "Not specified")}</p><p>${count} registered ${count === 1 ? "player" : "players"}</p></div><button class="btn btn-secondary btn-sm" data-team-id="${esc(team.id)}" aria-label="View ${esc(team.name)}">View team ↗</button></article>`;
          })
          .join("")
      : APP.data.teams.length
        ? APP.empty(
            "No teams match those filters.",
            "Try another city or a shorter team name. Use Clear filters to see the whole directory.",
          )
        : APP.empty(
            "Every team starts with a few players.",
            "Be the first to register your squad. Your team will appear here with its roster and upcoming sessions.",
            "register.html?type=team",
            "Register the first team",
          );
    $("teams-list")
      .querySelectorAll("[data-team-id]")
      .forEach((button) =>
        button.addEventListener("click", () => openTeam(button.dataset.teamId)),
      );
  }
  function openTeam(id) {
    const team = APP.data.teams.find((item) => item.id === id);
    if (!team) return;
    const players = APP.data.players.filter(
      (player) => player.team === team.name,
    );
    const bookings = APP.data.bookings
      .filter(
        (booking) =>
          booking.teamName === team.name &&
          booking.status !== "cancelled" &&
          new Date(booking.date) > new Date(),
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    $("team-modal-name").textContent = team.name;
    $("team-modal-body").innerHTML =
      `<dl class="team-detail-meta"><div><dt>City</dt><dd>${esc(team.city || "Not specified")}</dd></div><div><dt>Playing level</dt><dd>${esc(team.level || "Not specified")}</dd></div><div><dt>Head coach</dt><dd>${esc(team.coach || "Not specified")}</dd></div><div><dt>Registered players</dt><dd>${players.length}</dd></div></dl><h3>The roster</h3>${players.length ? `<ul class="roster-list">${players.map((player) => `<li>${APP.avatar(player)}<div><strong>${esc(player.name)}</strong><small>${esc(player.position || "Position not specified")}</small></div><span class="muted small">${player.jersey ? "#" + esc(player.jersey) : ""}</span></li>`).join("")}</ul>` : '<p class="muted small" style="margin-top:12px">No players have registered with this team yet.</p>'}<h3 style="margin-top:28px">Coming up</h3>${
        bookings.length
          ? `<ul class="schedule-list">${bookings
              .slice(0, 5)
              .map(
                (booking) =>
                  `<li><strong>${booking.type === "practice" ? "Practice" : "Match"} · ${esc(booking.venue)}</strong><small>${APP.fmtDate(booking.date)} · ${APP.fmtTime(booking.date)} CAT · ${esc(booking.status)}</small></li>`,
              )
              .join("")}</ul>`
          : '<p class="muted small" style="margin-top:12px">No upcoming sessions booked.</p>'
      }<a class="text-link" href="leaderboard.html?team=${encodeURIComponent(team.name)}" style="margin-top:24px">See the team’s skill ratings ↗</a>`;
    APP.openDialog("team-modal");
  }
  $("city-filter").addEventListener("change", render);
  $("search").addEventListener("input", render);
  $("clear-filters").addEventListener("click", () => {
    $("city-filter").value = "";
    $("search").value = "";
    render();
    $("search").focus();
  });
  render();
  window.addEventListener("gzvm:refresh", render);
})();
