(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => APP.escapeHtml(value);
  let position = "all";
  $("search").value = new URLSearchParams(location.search).get("team") || "";
  function render() {
    const query = $("search").value.trim().toLowerCase();
    const sort = $("sort-by").value;
    const players = APP.data.players
      .map((player) => ({
        ...player,
        stats: player.stats || {},
        total: APP.skills.reduce(
          (sum, [key]) => sum + Number(player.stats?.[key] || 0),
          0,
        ),
      }))
      .filter(
        (player) =>
          (position === "all" ||
            String(player.position || "")
              .toLowerCase()
              .includes(position.toLowerCase())) &&
          (!query ||
            `${player.name} ${player.team || ""}`
              .toLowerCase()
              .includes(query)),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "total"
            ? b.total - a.total
            : sort === "mvps"
              ? Number(b.mvps || 0) - Number(a.mvps || 0)
              : Number(b.stats[sort] || 0) - Number(a.stats[sort] || 0),
      );
    $("player-count").textContent =
      `${players.length} ${players.length === 1 ? "player" : "players"}`;
    $("clear-filters").hidden =
      !query && position === "all" && sort === "total";
    const lead = players[0];
    $("leader-summary").innerHTML =
      lead && sort !== "name"
        ? `<div class="leader-summary"><span class="rank" aria-hidden="true">01</span><div><h3>${esc(lead.name)}</h3><p>${esc(lead.team || "Free agent")} · ${esc(lead.position || "Position not specified")}</p></div><div class="leader-value"><strong>${sort === "total" ? lead.total : Number(sort === "mvps" ? lead.mvps || 0 : lead.stats[sort] || 0)}</strong><small>${sort === "total" ? "Combined rating / 600" : sort === "mvps" ? "Recorded MVP awards" : esc(sort) + " self-rating"}</small></div></div>`
        : "";
    $("leaderboard-content").innerHTML = players.length
      ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Player skill ratings, scroll horizontally for all skills"><table><caption>Self-rated skills · 0–100 per skill</caption><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Team</th><th scope="col">Position</th>${APP.skills.map(([, label]) => `<th scope="col" class="num">${label}</th>`).join("")}<th scope="col" class="num">Total / 600</th><th scope="col" class="num">MVPs</th></tr></thead><tbody>${players.map((player, index) => `<tr><td><span class="rank">${String(index + 1).padStart(2, "0")}</span></td><th scope="row"><span class="person">${APP.avatar(player)}<strong>${esc(player.name)}</strong></span></th><td>${esc(player.team || "Free agent")}</td><td>${esc(player.position || "—")}</td>${APP.skills.map(([key]) => `<td class="num">${Number(player.stats[key] || 0)}</td>`).join("")}<td class="num"><strong>${player.total}</strong></td><td class="num">${Number(player.mvps || 0)}</td></tr>`).join("")}</tbody></table></div>`
      : APP.data.players.length
        ? APP.empty(
            "No players match your search.",
            "Try a different position, name, or team. Clear the filters to return to the whole board.",
          )
        : APP.empty(
            "The board starts with your first check-in.",
            "Register a player profile and set your initial skill ratings. No sample players or made-up rankings are added.",
            "register.html",
            "Register as a player",
          );
  }
  document.querySelectorAll("[data-position]").forEach((button) =>
    button.addEventListener("click", () => {
      position = button.dataset.position;
      document
        .querySelectorAll("[data-position]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      render();
    }),
  );
  $("sort-by").addEventListener("change", render);
  $("search").addEventListener("input", render);
  $("clear-filters").addEventListener("click", () => {
    position = "all";
    $("search").value = "";
    $("sort-by").value = "total";
    document.querySelector('[data-position="all"]').click();
    $("search").focus();
  });
  render();
  window.addEventListener("gzvm:refresh", render);
})();
