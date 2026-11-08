(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => APP.escapeHtml(value);
  const roles = ["coach", "captain", "admin"];
  const allowed = () => {
    const user = APP.currentUser();
    return user && roles.includes(user.role);
  };
  const unlocked = () => {
    try {
      return allowed() && sessionStorage.getItem("gzvm_locker") === "1";
    } catch {
      return false;
    }
  };
  function checkAccess() {
    const user = APP.currentUser();
    const open = unlocked();
    $("locker-gate").hidden = !!open;
    $("locker-content").hidden = !open;
    $("enter-locker").hidden = !allowed();
    $("gate-login").hidden = !!user;
    $("gate-home").hidden = !user;
    if (!user) {
      $("gate-title").textContent = "A space for your coaching team.";
      $("gate-description").textContent =
        "Sign in with a coach, captain, or administrator account to open the locker.";
    } else if (!allowed()) {
      $("gate-title").textContent = "This workspace is for team staff.";
      $("gate-description").textContent =
        `Your account is registered as a ${user.role}. Ask the site owner to assign a coaching or captain role if you need access.`;
    } else {
      $("gate-title").textContent = "Your game plan is behind the door.";
      $("gate-description").textContent =
        `Signed in as ${user.name}. Enter the coach password to open this local demonstration workspace.`;
    }
    if (open) {
      $("who-am-i").textContent = `${user.name} · ${user.role}`;
      render();
    }
  }
  function populatePlayers() {
    const options = APP.data.players
      .map(
        (player) =>
          `<option value="${esc(player.id)}">${esc(player.name)} · ${esc(player.team || "Free agent")}</option>`,
      )
      .join("");
    for (const id of ["fb-player", "tagged-players"]) {
      const select = $(id);
      const selected = Array.from(select.selectedOptions).map(
        (option) => option.value,
      );
      select.innerHTML =
        (id === "fb-player"
          ? '<option value="">Choose a player</option>'
          : "") + options;
      Array.from(select.options).forEach(
        (option) => (option.selected = selected.includes(option.value)),
      );
    }
  }
  function render() {
    if (!unlocked()) return;
    populatePlayers();
    $("strategy-list").innerHTML = APP.data.strategy.length
      ? [...APP.data.strategy]
          .reverse()
          .map(
            (item) =>
              `<article class="coach-note"><h3>${esc(item.title)}</h3><small>${esc(item.coach)} · ${APP.fmtDate(item.date)}</small><p>${esc(item.description || "No additional notes.")}</p>${APP.safeUrl(item.videoUrl) ? `<a class="text-link" href="${esc(APP.safeUrl(item.videoUrl))}" target="_blank" rel="noopener noreferrer">Watch strategy film ↗</a>` : ""}${item.taggedPlayers?.length ? `<p class="muted small">Players: ${item.taggedPlayers.map((id) => esc(APP.data.players.find((player) => player.id === id)?.name || "Former player")).join(", ")}</p>` : ""}</article>`,
          )
          .join("")
      : APP.empty(
          "Start with one piece of film.",
          "Share a video and tell your players what to look for. Your strategy notes will appear here.",
        );
    $("feedback-list").innerHTML = APP.data.feedback.length
      ? [...APP.data.feedback]
          .reverse()
          .map(
            (item) =>
              `<article class="coach-note"><div class="cluster" style="justify-content:space-between"><h3>${esc(APP.data.players.find((player) => player.id === item.playerId)?.name || "Former player")}</h3>${APP.status(`${Number(item.rating || 0)} / 5`)}</div>${item.videoTitle ? `<small>Re: ${esc(item.videoTitle)}</small>` : ""}<p>${esc(item.text)}</p><small>${APP.fmtDate(item.date)} · ${esc(item.coach)}</small></article>`,
          )
          .join("")
      : APP.empty(
          "Specific feedback goes a long way.",
          "Choose a player, describe what went well, and give them one useful next step.",
        );
    $("roster-content").innerHTML = APP.data.players.length
      ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Player registration roster"><table><thead><tr><th scope="col">Player</th><th scope="col">Team</th><th scope="col">Position</th><th scope="col">Age at registration</th><th scope="col">Waiver</th><th scope="col">Medical document</th></tr></thead><tbody>${APP.data.players.map((player) => `<tr><th scope="row">${esc(player.name)}</th><td>${esc(player.team || "Free agent")}</td><td>${esc(player.position || "—")}</td><td>${esc(player.age ?? "—")}</td><td>${player.waiver?.signed ? APP.status(player.waiver.guardian ? "Guardian signed" : "Signed") : APP.status("Missing", "pending")}</td><td>${player.medical?.url ? `<button class="btn btn-secondary btn-sm" data-medical="${esc(player.id)}">View document</button><small class="muted" style="display:block;margin-top:5px">${player.medical.storage === "device" ? "This device only" : "Earlier imported record"}</small>` : APP.status("Not on file", "pending")}</td></tr>`).join("")}</tbody></table></div>`
      : APP.empty(
          "No player registrations yet.",
          "Players appear here after completing the registration form.",
        );
    $("roster-content")
      .querySelectorAll("[data-medical]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          openMedical(button.dataset.medical),
        ),
      );
  }
  async function openMedical(id) {
    if (!unlocked()) return;
    const player = APP.data.players.find((item) => item.id === id);
    if (!player?.medical?.url) return;
    try {
      let url = player.medical.url;
      let temporary = false;
      if (url.startsWith("data:")) {
        const response = await fetch(url);
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        temporary = true;
      } else url = APP.safeUrl(url);
      if (!url) throw new Error("This document link is not valid.");
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = player.medical.name || "medical-document";
      link.click();
      if (temporary) setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      APP.toast(
        "The document could not be opened. It may no longer be available on this device.",
        "error",
      );
    }
  }
  $("enter-locker").addEventListener("click", () => {
    if (allowed()) {
      APP.clearMessage($("password-form"));
      APP.openDialog("password-modal");
    }
  });
  $("password-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!allowed()) return;
    if (event.currentTarget.elements.password.value !== "locker2026")
      return APP.formMessage(
        event.currentTarget,
        "That password is not correct. Please try again.",
      );
    sessionStorage.setItem("gzvm_locker", "1");
    APP.closeDialog("password-modal");
    event.currentTarget.reset();
    checkAccess();
  });
  $("lock-locker").addEventListener("click", () => {
    sessionStorage.removeItem("gzvm_locker");
    checkAccess();
    $("enter-locker").focus();
  });
  $("strategy-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!unlocked() || !APP.validate(form)) return;
    const values = APP.formData(form);
    const url = APP.safeUrl(values.videoUrl);
    if (!url) return APP.formMessage(form, "Enter a valid HTTP(S) video link.");
    const item = {
      id: APP.uid(),
      coach: APP.currentUser().name,
      title: values.title,
      description: values.description,
      videoUrl: url,
      taggedPlayers: Array.from(
        form.elements.taggedPlayers.selectedOptions,
      ).map((option) => option.value),
      date: new Date().toISOString(),
    };
    APP.data.strategy.push(item);
    if (!APP.save()) {
      APP.data.strategy.pop();
      APP.formMessage(form, APP.storageError);
      return;
    }
    form.reset();
    render();
    APP.formMessage(
      form,
      "Strategy film shared with the local coaching workspace.",
      "success",
    );
  });
  $("feedback-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!unlocked() || !APP.validate(form)) return;
    const values = APP.formData(form);
    if (!APP.data.players.some((player) => player.id === values.playerId))
      return APP.formMessage(form, "Choose a registered player.");
    const item = {
      id: APP.uid(),
      coach: APP.currentUser().name,
      playerId: values.playerId,
      videoTitle: values.videoTitle,
      text: values.text,
      rating: Number(values.rating),
      date: new Date().toISOString(),
    };
    APP.data.feedback.push(item);
    if (!APP.save()) {
      APP.data.feedback.pop();
      APP.formMessage(form, APP.storageError);
      return;
    }
    form.reset();
    render();
    APP.formMessage(form, "Feedback saved for this player.", "success");
  });
  checkAccess();
  window.addEventListener("gzvm:refresh", checkAccess);
})();
