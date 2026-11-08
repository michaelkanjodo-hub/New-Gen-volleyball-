(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => APP.escapeHtml(value);
  let selectedRoom = null;
  let routeResolved = false;
  LIVE.loadRooms();
  function resetPlayer() {
    $("main-player")
      .querySelectorAll("iframe,video")
      .forEach((node) => {
        if (node.tagName === "VIDEO") node.srcObject = null;
        node.remove();
      });
    $("player-placeholder").hidden = false;
    $("player-action").hidden = false;
    $("player-action").textContent = "Explore broadcast options ↗";
  }
  function emptyPlayer(
    title = "No broadcast is live yet.",
    description = "When a community stream starts, it will appear here. Share a stream link or watch a player-shared highlight below.",
  ) {
    resetPlayer();
    $("player-eyebrow").textContent = "The broadcast court";
    $("player-title").textContent = title;
    $("player-description").textContent = description;
    $("caption-title").textContent = "Ready when the court is.";
    $("caption-meta").textContent = "Community broadcasts and shared film";
    $("stream-badge").textContent = "Off air";
    $("stream-badge").className = "status status-neutral";
  }
  function frame(url, title) {
    resetPlayer();
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = title;
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    $("main-player").append(iframe);
    $("player-placeholder").hidden = true;
  }
  function playVideo(video, title, meta = "Community film") {
    selectedRoom = null;
    frame(video.embedUrl, title);
    $("caption-title").textContent = title;
    $("caption-meta").textContent = meta;
    $("stream-badge").textContent = "Playing";
    $("stream-badge").className = "status";
    $("live-match-info").hidden = true;
  }
  function playExternal(room) {
    const embed = LIVE.toEmbedUrl(room.externalUrl);
    if (!embed) {
      emptyPlayer(
        "This stream link cannot be embedded.",
        "Ask the host for a supported YouTube, Twitch, Vimeo, or Facebook watch link.",
      );
      return;
    }
    selectedRoom = room.id;
    frame(embed, room.title);
    $("caption-title").textContent = room.title;
    $("caption-meta").textContent =
      `${room.host} · ${room.service || "External broadcast"}`;
    $("stream-badge").textContent = room.active ? "Live" : "Stream link";
    $("stream-badge").className = room.active
      ? "status status-live"
      : "status status-neutral";
    $("live-match-info").hidden = true;
  }
  function showLiveMatch(match) {
    emptyPlayer(
      `${match.homeTeam} v ${match.awayTeam}`,
      "This fixture is marked live, but no broadcast is connected yet. Check the active rooms or ask the host for a stream link.",
    );
    $("stream-badge").textContent = "Match live";
    $("stream-badge").className = "status status-live";
    $("caption-title").textContent = match.venue || "Match in progress";
    $("caption-meta").textContent =
      "Live fixture · broadcast availability varies";
    $("live-match-info").hidden = false;
    $("live-match-info").textContent = match.score
      ? `Recorded score: ${Number(match.score.home)}–${Number(match.score.away)}. Individual player statistics are not connected.`
      : "The match is in progress. A live score feed is not connected to this fixture.";
  }
  function p2pRoom(room) {
    emptyPlayer(
      room.title,
      `Hosted by ${room.host}. This camera broadcast needs the host’s offer code. Open the viewer controls, generate an answer, and send it back to the host.`,
    );
    $("player-action").textContent = "Connect with a code ↗";
    $("player-action").dataset.room = room.id;
    $("caption-title").textContent = room.title;
    $("caption-meta").textContent =
      "Direct camera broadcast · manual connection";
    $("stream-badge").textContent = "Camera room";
    $("stream-badge").className = "status";
    selectedRoom = room.id;
  }
  function renderRooms() {
    const rooms = LIVE.getActiveRooms();
    $("live-rooms-strip").innerHTML = rooms
      .map(
        (room) =>
          `<article class="room-strip-item"><div>${APP.status("Live", "live")}<h3 style="margin-top:6px">${esc(room.title)}</h3><p>${esc(room.host)} · ${esc(room.type === "external" ? room.service || "External service" : "Camera / WebRTC")}</p></div><button class="btn btn-secondary btn-sm" data-room="${esc(room.id)}">Open room ↗</button></article>`,
      )
      .join("");
    $("live-rooms-strip")
      .querySelectorAll("[data-room]")
      .forEach((button) =>
        button.addEventListener("click", () => openRoom(button.dataset.room)),
      );
    if (selectedRoom) {
      const room = LIVE.rooms.find((item) => item.id === selectedRoom);
      if (room && !room.active && room.type !== "external") {
        emptyPlayer(
          "This broadcast has ended.",
          "The host has closed the camera room. Look for another active stream or watch shared film below.",
        );
        selectedRoom = null;
      }
    }
  }
  function renderSchedule() {
    const matches = APP.data.matches
      .filter(
        (match) => match.status === "scheduled" || match.status === "live",
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
    $("live-schedule").innerHTML = matches.length
      ? `<ul class="schedule-list">${matches.map((match) => `<li><strong>${esc(match.homeTeam)} v ${esc(match.awayTeam)}</strong><small>${APP.fmtDate(match.date)} · ${APP.fmtTime(match.date)} CAT</small><small>${esc(match.venue || "Venue to be confirmed")} · ${esc(match.status)}</small></li>`).join("")}</ul>`
      : '<p>No fixtures scheduled. <a href="matches.html">Plan the next match</a>.</p>';
    const past = LIVE.rooms
      .filter(
        (room) => room.type === "external" && !room.active && room.externalUrl,
      )
      .slice(-4)
      .reverse();
    $("past-broadcasts").innerHTML = past.length
      ? `<ul class="schedule-list">${past.map((room) => `<li><button class="btn btn-ghost btn-sm" data-replay="${esc(room.id)}" style="padding-left:0;text-align:left">${esc(room.title)} ↗</button><small>${esc(room.host)} · ${APP.fmtDate(room.endedAt || room.startedAt)}</small></li>`).join("")}</ul>`
      : "<p>No external stream links have been shared yet.</p>";
    $("past-broadcasts")
      .querySelectorAll("[data-replay]")
      .forEach((button) =>
        button.addEventListener("click", () => {
          const room = LIVE.rooms.find(
            (item) => item.id === button.dataset.replay,
          );
          if (room) {
            playExternal(room);
            $("main-player").scrollIntoView({
              block: "center",
              behavior: "smooth",
            });
          }
        }),
      );
  }
  function openRoom(id) {
    const room = LIVE.rooms.find((item) => item.id === id);
    if (!room) return;
    room.type === "external"
      ? playExternal(room)
      : room.active
        ? p2pRoom(room)
        : emptyPlayer(
            "This camera session has ended.",
            "Direct camera streams are not recorded. Ask the host to start a new room.",
          );
  }
  function resolveRoute() {
    if (routeResolved) return;
    const params = new URLSearchParams(location.search);
    const roomId = params.get("room");
    const highlightId = params.get("highlight");
    const videoId = params.get("v");
    if (roomId) {
      const room = LIVE.rooms.find((item) => item.id === roomId);
      if (room) {
        openRoom(room.id);
        routeResolved = true;
      } else
        emptyPlayer(
          "This room is not available.",
          "The link may be out of date, or the room may not have synced to this browser. Check the active broadcasts below.",
        );
    } else if (highlightId || videoId) {
      const highlight = APP.data.highlights.find(
        (item) => item.id === highlightId || item.videoId === videoId,
      );
      const video = highlight && APP.getHighlightVideo(highlight);
      if (video) {
        playVideo(video, highlight.title, highlight.player || "Community film");
        routeResolved = true;
      } else
        emptyPlayer(
          "This clip is not available.",
          "It may have been removed or may not have synced. Choose another community highlight below.",
        );
    } else {
      const live = APP.data.matches.find((match) => match.status === "live");
      if (live) showLiveMatch(live);
      else emptyPlayer();
      routeResolved = true;
    }
  }
  $("go-live").addEventListener("click", () => LIVE.openStreamModal());
  $("player-action").addEventListener("click", () => {
    const joining = $("player-action").dataset.room;
    if (joining) {
      delete $("player-action").dataset.room;
      LIVE.openStreamModal("p2p");
      document.getElementById("offer-input")?.focus();
    } else LIVE.openStreamModal();
  });
  window.addEventListener("gzvm:open-external", (event) =>
    playExternal(event.detail),
  );
  window.addEventListener("gzvm:remote-stream", () => {
    resetPlayer();
    const video = document.createElement("video");
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("aria-label", "Connected camera broadcast");
    $("main-player").append(video);
    $("player-placeholder").hidden = true;
    LIVE.attachVideo(video, true);
    $("caption-title").textContent = "Camera broadcast connected";
    $("caption-meta").textContent = "Direct WebRTC stream";
    $("stream-badge").textContent = "Connected";
    $("stream-badge").className = "status status-live";
  });
  window.addEventListener("gzvm:stream-ended", () => {
    selectedRoom = null;
    routeResolved = false;
    emptyPlayer();
  });
  function refresh() {
    renderRooms();
    renderSchedule();
    APP.renderHighlights($("highlights-grid"));
    resolveRoute();
  }
  APP.initChat($("community-chat"));
  LIVE.listenToRooms(renderRooms);
  window.addEventListener("gzvm:rooms", renderRooms);
  window.addEventListener("gzvm:refresh", refresh);
  renderRooms();
  renderSchedule();
  APP.renderHighlights($("highlights-grid"));
  resolveRoute();
})();
