(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => APP.escapeHtml(value);
  const form = $("book-form");
  const sort = (list) =>
    [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
  const myTeams = () => {
    const user = APP.currentUser();
    return user
      ? APP.data.teams.filter(
          (team) =>
            team.captainId === user.id ||
            (team.members || []).includes(user.id),
        )
      : [];
  };
  function loadTeamOptions() {
    const selected = form.elements.teamId.value;
    const teams = myTeams();
    form.elements.teamId.innerHTML =
      `<option value="">${teams.length ? "Select your team" : "No teams linked to your account"}</option>` +
      teams
        .map(
          (team) =>
            `<option value="${esc(team.id)}">${esc(team.name)} · ${esc(team.city)}</option>`,
        )
        .join("");
    if (teams.some((team) => team.id === selected))
      form.elements.teamId.value = selected;
  }
  function fixtureRow(match) {
    const done = match.status === "completed" && match.score;
    const state =
      match.status === "live"
        ? APP.status("Live", "live")
        : done
          ? APP.status("Final")
          : match.status === "cancelled"
            ? APP.status("Cancelled", "neutral")
            : APP.status(
                match.confirmation === "pending"
                  ? "Awaiting confirmation"
                  : "Scheduled",
                match.confirmation === "pending" ? "pending" : "",
              );
    return `<article class="fixture-row"><time class="fixture-date" ${match.date ? `datetime="${esc(match.date)}"` : ""}><strong>${APP.fmtDate(match.date, { year: undefined })}</strong><span>${APP.fmtTime(match.date)} CAT</span></time><div><div class="fixture-teams">${esc(match.homeTeam || "TBD")}<span class="vs">v</span>${esc(match.awayTeam || "TBD")}</div><p class="venue">${esc(match.venue || "Venue to be confirmed")}</p>${done && match.sets?.length ? `<p class="venue">Sets: ${match.sets.map((set) => `${Number(set[0])}–${Number(set[1])}`).join(" / ")}</p>` : ""}</div>${state}${done ? `<div class="fixture-score" aria-label="Sets won">${Number(match.score.home)}–${Number(match.score.away)}</div>` : ""}</article>`;
  }
  function render() {
    const upcoming = sort(
      APP.data.matches.filter((match) => match.status === "scheduled"),
    );
    const live = sort(
      APP.data.matches.filter((match) => match.status === "live"),
    );
    const results = sort(
      APP.data.matches.filter((match) => match.status === "completed"),
    ).reverse();
    $("upcoming-list").innerHTML = upcoming.length
      ? `<div class="fixture-list">${upcoming.map(fixtureRow).join("")}</div>`
      : APP.empty(
          "The next fixture is yours to make.",
          "No upcoming matches yet. Register your team, choose a venue, and book a match.",
          "register.html?type=team",
          "Get your team ready",
        );
    $("live-list").innerHTML = live.length
      ? `<div class="fixture-list">${live.map(fixtureRow).join("")}</div>`
      : APP.empty(
          "No match is marked live.",
          "When a match is in progress, it will appear here. You can still visit the live page to connect with the community.",
        );
    $("completed-list").innerHTML = results.length
      ? `<div class="fixture-list">${results.map(fixtureRow).join("")}</div>`
      : APP.empty(
          "No final scores yet.",
          "Completed matches and their set-by-set results will appear here. Use the homepage scorekeeper to record a match.",
        );
    const user = APP.currentUser();
    const teamIds = myTeams().map((team) => team.id);
    const bookings = sort(
      APP.data.bookings.filter(
        (booking) =>
          user &&
          (booking.createdBy === user.id || teamIds.includes(booking.teamId)),
      ),
    ).reverse();
    $("bookings-list").innerHTML = bookings.length
      ? bookings
          .map(
            (booking) =>
              `<article class="booking-row"><div class="booking-row-head"><span class="small muted">${booking.type === "practice" ? "Practice / scrimmage" : "Match booking"}</span>${APP.status(booking.status === "confirmed" ? "Confirmed by team" : booking.status === "cancelled" ? "Cancelled" : "Pending", booking.status === "confirmed" ? "" : booking.status === "cancelled" ? "neutral" : "pending")}</div><h3>${esc(booking.teamName)}${booking.opponent && booking.opponent !== "TBD" ? ` v ${esc(booking.opponent)}` : " · Open session"}</h3><p>${APP.fmtDate(booking.date)} · ${APP.fmtTime(booking.date)} CAT · ${esc(booking.venue)}</p>${booking.notes ? `<p>${esc(booking.notes)}</p>` : ""}${booking.status !== "cancelled" ? `<div class="button-row">${booking.status !== "confirmed" ? `<button class="btn btn-secondary btn-sm" data-booking="${esc(booking.id)}" data-status="confirmed">Mark team confirmed</button>` : ""}<button class="btn btn-ghost btn-sm" data-booking="${esc(booking.id)}" data-status="cancelled">Cancel booking</button></div>` : ""}</article>`,
          )
          .join("")
      : user
        ? APP.empty(
            "No bookings for your teams.",
            "Use “Book a match or practice” above to add your first session.",
          )
        : APP.empty(
            "Your team’s plans, in one place.",
            "Sign in to see bookings for teams you belong to.",
            APP.withReturn("login.html"),
            "Sign in to view bookings",
          );
    $("bookings-list")
      .querySelectorAll("[data-booking]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          updateBooking(button.dataset.booking, button.dataset.status),
        ),
      );
  }
  function updateBooking(id, status) {
    const booking = APP.data.bookings.find((item) => item.id === id);
    const user = APP.currentUser();
    if (
      !booking ||
      !user ||
      (booking.createdBy !== user.id &&
        !myTeams().some((team) => team.id === booking.teamId))
    )
      return APP.toast(
        "You can only manage your own team’s bookings.",
        "error",
      );
    if (
      status === "cancelled" &&
      !confirm(
        "Cancel this booking? Its linked fixture will also be cancelled.",
      )
    )
      return;
    const previous = booking.status;
    const linked = APP.data.matches.filter((match) => match.bookingId === id);
    const oldStatuses = linked.map((match) => ({
      match,
      status: match.status,
      confirmation: match.confirmation,
    }));
    booking.status = status;
    linked.forEach((match) => {
      if (status === "cancelled") match.status = "cancelled";
      else match.confirmation = "confirmed";
    });
    if (!APP.save()) {
      booking.status = previous;
      oldStatuses.forEach((item) => {
        item.match.status = item.status;
        item.match.confirmation = item.confirmation;
      });
      return;
    }
    APP.toast(
      status === "cancelled"
        ? "Booking cancelled."
        : "Your team has confirmed this booking. Venue access must still be arranged separately.",
      "success",
    );
    render();
  }
  $("book-match-btn").addEventListener("click", () => {
    if (!APP.currentUser()) {
      location.href = APP.withReturn("login.html");
      return;
    }
    loadTeamOptions();
    APP.clearMessage(form);
    APP.openDialog("book-modal");
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!APP.validate(form)) return;
    const user = APP.currentUser();
    const values = APP.formData(form);
    const team = myTeams().find((item) => item.id === values.teamId);
    if (!user || !team)
      return APP.formMessage(
        form,
        "Choose a team linked to your account, or register a team first.",
      );
    const date = APP.malawiDate(values.date, values.time);
    if (!Number.isFinite(date.getTime()) || date <= new Date())
      return APP.formMessage(
        form,
        "Choose a date and time in the future. Malawi time is UTC+2.",
      );
    const collision =
      APP.data.bookings.some(
        (booking) =>
          booking.status !== "cancelled" &&
          booking.venue === values.venue &&
          new Date(booking.date).getTime() === date.getTime(),
      ) ||
      APP.data.matches.some(
        (match) =>
          match.status === "scheduled" &&
          match.venue === values.venue &&
          new Date(match.date).getTime() === date.getTime(),
      );
    if (collision)
      return APP.formMessage(
        form,
        "There is already a booking at this venue and time. Choose another slot.",
      );
    const booking = {
      id: APP.uid(),
      teamId: team.id,
      teamName: team.name,
      type: values.type,
      opponent: values.opponent || "TBD",
      date: date.toISOString(),
      venue: values.venue,
      notes: values.notes,
      status: "pending",
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    APP.data.bookings.push(booking);
    let match;
    if (booking.type === "match" && booking.opponent !== "TBD") {
      match = {
        id: APP.uid(),
        homeTeam: team.name,
        awayTeam: booking.opponent,
        date: booking.date,
        venue: booking.venue,
        status: "scheduled",
        confirmation: "pending",
        score: null,
        bookingId: booking.id,
      };
      APP.data.matches.push(match);
    }
    if (!APP.save()) {
      APP.data.bookings.pop();
      if (match) APP.data.matches.pop();
      APP.formMessage(form, APP.storageError);
      return;
    }
    APP.closeDialog("book-modal");
    form.reset();
    $("booking-date").min = APP.dateInput();
    render();
    APP.selectTab("fixtures-bookings");
    APP.toast(
      "Booking saved as pending. Confirm it when your team is ready.",
      "success",
    );
  });
  $("booking-date").min = APP.dateInput();
  const requested = new URLSearchParams(location.search).get("tab");
  if (requested === "results") APP.selectTab("fixtures-results");
  render();
  window.addEventListener("gzvm:refresh", render);
})();
