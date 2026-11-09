/* GZVM live tools. External embeds plus real, manually signalled WebRTC.
   Keep this tab open while broadcasting. No streaming server is implied. */
const LIVE = {
  state: "idle",
  localStream: null,
  remoteStream: null,
  currentRoom: null,
  peers: new Map(),
  pendingOffers: new Map(),
  rooms: [],
  roomListeners: new Set(),
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
  signaling: { pendingOffer: null, pendingAnswer: null },
  init() {
    this.loadRooms();
    window.addEventListener("storage", (event) => {
      if (event.key === "gzvm_rooms") {
        this.loadRooms();
        this.notifyRooms();
      }
    });
    window.addEventListener("pagehide", () => {
      if (this.currentRoom) this.endRoom(this.currentRoom.id);
      this.cleanup();
    });
    this.updateDock();
  },
  encodeSignal(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  },
  decodeSignal(code) {
    if (!code || code.length > 1000000)
      throw new Error("This connection code is empty or too large.");
    try {
      const binary = atob(code.trim());
      const value = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(binary, (char) => char.charCodeAt(0)),
        ),
      );
      if (!value || typeof value !== "object") throw new Error();
      return value;
    } catch {
      throw new Error(
        "This connection code is not valid. Copy the complete code and try again.",
      );
    }
  },
  loadRooms() {
    let local = [];
    try {
      const parsed = JSON.parse(localStorage.getItem("gzvm_rooms") || "[]");
      if (Array.isArray(parsed)) local = parsed;
    } catch {}
    const remote = Array.isArray(window.APP?.data?.streams)
      ? APP.data.streams
      : [];
    const byId = new Map();
    for (const room of [...local, ...remote]) {
      if (!room?.id) continue;
      const previous = byId.get(room.id);
      if (previous?.endedAt && !room.endedAt) continue;
      byId.set(room.id, room);
    }
    this.rooms = [...byId.values()];
    if (
      this.state === "viewing" &&
      this.viewingRoomId &&
      this.rooms.some((room) => room.id === this.viewingRoomId && !room.active)
    ) {
      this.cleanup();
      this.state = "idle";
      this.viewingRoomId = null;
      this.updateDock();
      window.dispatchEvent(new CustomEvent("gzvm:stream-ended"));
    }
  },
  saveRooms() {
    try {
      localStorage.setItem("gzvm_rooms", JSON.stringify(this.rooms));
    } catch {
      APP.toast("Room changes could not be saved in this browser.", "error");
      return false;
    }
    if (window.APP) {
      APP.data.streams = this.rooms;
      APP.save();
    }
    this.notifyRooms();
    return true;
  },
  createRoom(hostName, title, description = "", type = "p2p") {
    const room = {
      id: "room_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      host: hostName,
      hostId: APP.currentUser()?.id,
      title,
      description,
      type,
      externalUrl: null,
      startedAt: new Date().toISOString(),
      viewers: 0,
      active: true,
    };
    this.rooms.push(room);
    if (!this.saveRooms()) {
      this.rooms.pop();
      throw new Error(
        "The stream room could not be saved. Please enable browser storage and try again.",
      );
    }
    return room;
  },
  endRoom(id) {
    const room = this.rooms.find((item) => item.id === id);
    if (room) {
      room.active = false;
      room.endedAt = new Date().toISOString();
      this.saveRooms();
    }
  },
  removeRoom(id) {
    this.rooms = this.rooms.filter((room) => room.id !== id);
    this.saveRooms();
  },
  getActiveRooms() {
    return this.rooms.filter((room) => room.active);
  },
  notifyRooms() {
    this.roomListeners.forEach((callback) => callback());
    window.dispatchEvent(new CustomEvent("gzvm:rooms"));
  },
  listenToRooms(callback) {
    this.roomListeners.add(callback);
    return () => this.roomListeners.delete(callback);
  },
  async getCamera(optional = false) {
    if (this.localStream) return this.localStream;
    if (!navigator.mediaDevices?.getUserMedia) {
      if (optional) return null;
      throw new Error("Camera access needs HTTPS and a supported browser.");
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      return this.localStream;
    } catch (error) {
      if (optional) return null;
      throw new Error(
        error.name === "NotAllowedError"
          ? "Camera or microphone permission was denied. Allow access in your browser settings and try again."
          : "Camera unavailable: " + error.message,
      );
    }
  },
  stopCamera() {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.pendingOffers.clear();
    this.viewerPeer?.close();
    this.viewerPeer = null;
    this.remoteStream = null;
    this.signaling = { pendingOffer: null, pendingAnswer: null };
  },
  newPeer() {
    if (!window.RTCPeerConnection)
      throw new Error(
        "This browser does not support WebRTC. Try a current browser or an external streaming service.",
      );
    return new RTCPeerConnection(this.config);
  },
  async gatherIce(peer) {
    if (peer.iceGatheringState === "complete") return;
    await new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        peer.removeEventListener("icegatheringstatechange", check);
        resolve();
      };
      const check = () => {
        if (peer.iceGatheringState === "complete") finish();
      };
      const timer = setTimeout(finish, 8000);
      peer.addEventListener("icegatheringstatechange", check);
    });
  },
  async createOffer(roomId) {
    const stream = await this.getCamera();
    const peer = this.newPeer();
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.addEventListener("connectionstatechange", () => {
      if (this.currentRoom) {
        this.currentRoom.viewers = [...this.peers.values()].filter(
          (connection) => connection.connectionState === "connected",
        ).length;
        this.saveRooms();
      }
      this.updateDock();
    });
    try {
      await peer.setLocalDescription(await peer.createOffer());
      await this.gatherIce(peer);
      const offerId = APP.uid();
      this.pendingOffers.set(offerId, peer);
      this.signaling.pendingOffer = { roomId, pc: peer };
      return this.encodeSignal({
        version: 1,
        offerId,
        roomId,
        description: peer.localDescription,
      });
    } catch (error) {
      peer.close();
      throw error;
    }
  },
  async acceptOffer(code) {
    const signal = this.decodeSignal(code);
    const offer = signal.description || signal;
    if (offer.type !== "offer" || typeof offer.sdp !== "string")
      throw new Error(
        "Paste the broadcaster’s offer code, not an answer code.",
      );
    this.viewerPeer?.close();
    const peer = this.newPeer();
    this.viewerPeer = peer;
    if (this.localStream)
      this.localStream
        .getTracks()
        .forEach((track) => peer.addTrack(track, this.localStream));
    peer.addEventListener("track", (event) => {
      this.remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (!event.streams[0]) this.remoteStream.addTrack(event.track);
      window.dispatchEvent(new CustomEvent("gzvm:remote-stream"));
    });
    peer.addEventListener("connectionstatechange", () => {
      window.dispatchEvent(
        new CustomEvent("gzvm:connection", { detail: peer.connectionState }),
      );
      this.updateDock();
    });
    try {
      await peer.setRemoteDescription(offer);
      await peer.setLocalDescription(await peer.createAnswer());
      await this.gatherIce(peer);
      const answerCode = this.encodeSignal({
        version: 1,
        offerId: signal.offerId,
        description: peer.localDescription,
      });
      this.signaling.pendingAnswer = { pc: peer, answerCode };
      this.viewingRoomId = signal.roomId;
      this.state = "viewing";
      this.updateDock();
      return answerCode;
    } catch (error) {
      peer.close();
      this.viewerPeer = null;
      throw error;
    }
  },
  async completeConnection(code) {
    const signal = this.decodeSignal(code);
    const answer = signal.description || signal;
    if (answer.type !== "answer" || typeof answer.sdp !== "string")
      throw new Error("Paste the viewer’s answer code, not an offer code.");
    const peer = signal.offerId
      ? this.pendingOffers.get(signal.offerId)
      : this.signaling.pendingOffer?.pc;
    if (!peer)
      throw new Error(
        "This offer is no longer available. Create a new share code for the viewer.",
      );
    await peer.setRemoteDescription(answer);
    this.peers.set(signal.offerId || APP.uid(), peer);
    this.pendingOffers.delete(signal.offerId);
    return peer;
  },
  attachVideo(video, remote = false) {
    if (!video) return;
    video.srcObject = remote ? this.remoteStream : this.localStream;
    video.play().catch(() => {});
  },

  openStreamModal(mode) {
    document.getElementById("stream-modal")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "stream-modal";
    dialog.className = "modal-wide";
    dialog.setAttribute("aria-labelledby", "stream-modal-title");
    dialog.innerHTML = `<div class="modal-header"><h2 id="stream-modal-title">Bring the game live.</h2><button class="modal-close" data-close aria-label="Close live stream tools">✕</button></div><div class="modal-body">
      <p class="muted small">Use a camera with manual connection codes, or embed a broadcast from a streaming service. Keep this tab open while streaming.</p>
      <div class="button-row stream-mode" role="group" aria-label="Streaming method" style="margin-top:20px"><button class="btn btn-secondary btn-sm" data-mode="p2p" aria-pressed="false">Camera / WebRTC</button><button class="btn btn-secondary btn-sm" data-mode="external" aria-pressed="false">YouTube, Twitch & more</button></div>
      <section id="p2p-panel" hidden><div class="notice">Camera streaming uses a direct connection. Share an offer with each viewer, then have them send an answer back. Some networks need a TURN relay, which is not configured here.</div>
        <div class="grid-2"><div class="stream-section"><h4>Broadcast your camera</h4><ol class="stream-instructions"><li>Add a title and start your camera.</li><li>Create a share code and send it to a viewer.</li><li>Paste their answer below and connect.</li></ol>
          <div class="form-group"><label for="camera-title">Broadcast title</label><input id="camera-title" class="form-control" maxlength="120" value="${APP.escapeHtml((APP.currentUser()?.name || "Community") + " — Live practice")}"></div>
          <div class="button-row"><button class="btn btn-primary btn-sm" id="start-camera">Start camera</button><button class="btn btn-secondary btn-sm" id="create-offer" hidden>Create share code</button></div><video id="local-preview" class="video-preview" autoplay muted playsinline hidden aria-label="Your camera preview"></video>
          <div id="offer-code-wrap" class="form-group" style="margin-top:20px" hidden><label for="offer-code">Send this offer to your viewer</label><textarea id="offer-code" class="code-block" readonly></textarea><button class="btn btn-ghost btn-sm" id="copy-offer">Copy offer</button></div>
          <div class="form-group" style="margin-top:18px"><label for="answer-input">Paste the viewer’s answer</label><textarea id="answer-input" class="code-block" placeholder="Viewer answer code"></textarea><button class="btn btn-secondary btn-sm" id="connect-viewer">Connect viewer</button></div>
        </div><div class="stream-section"><h4>Watch a camera broadcast</h4><ol class="stream-instructions"><li>Paste the broadcaster’s offer code.</li><li>Generate an answer. Your camera is not required.</li><li>Send the answer back and wait for the host to connect.</li></ol>
          <div class="form-group"><label for="offer-input">Broadcaster’s offer code</label><textarea id="offer-input" class="code-block" placeholder="Paste offer code"></textarea></div><button class="btn btn-primary btn-sm" id="accept-offer">Generate answer code</button>
          <div id="answer-code-wrap" class="form-group" style="margin-top:18px" hidden><label for="answer-code">Send this answer back to the host</label><textarea id="answer-code" class="code-block" readonly></textarea><button class="btn btn-ghost btn-sm" id="copy-answer">Copy answer</button></div>
          <div id="remote-video-wrap" style="margin-top:20px" hidden><h4>Broadcast preview</h4><video id="remote-video" class="video-preview" autoplay playsinline controls aria-label="Live broadcast"></video><p class="form-hint">If playback does not start, press Play on the video.</p></div>
        </div></div><div class="notice form-status" id="stream-feedback" role="status" hidden></div><button class="btn btn-secondary btn-sm" id="end-broadcast" style="margin-top:20px" hidden>End broadcast</button>
      </section>
      <section id="external-panel" hidden><div class="stream-section"><h3>Use your streaming service</h3><p class="muted small" style="margin:12px 0 22px">Start broadcasting on your service, then share its public watch link here. This does not start the upstream broadcast for you.</p><form id="external-form"><div class="form-group"><label for="ext-title">Broadcast title</label><input class="form-control" id="ext-title" maxlength="120" required placeholder="Home team vs Away team"></div><div class="form-group"><label for="ext-service">Streaming service</label><select class="form-control" id="ext-service"><option>YouTube Live</option><option>Twitch</option><option>Vimeo</option><option>Facebook Live</option></select></div><div class="form-group"><label for="ext-url">Public watch link</label><input class="form-control" id="ext-url" type="url" required placeholder="https://www.youtube.com/watch?v=…"><small class="form-hint">YouTube, Twitch, Vimeo, and Facebook watch links are supported. RTMP keys and direct HLS playlists are not supported.</small></div><button class="btn btn-primary" type="submit">Publish stream link</button><div class="form-status" role="status"></div></form></div></section>
      <section class="stream-section"><h3 style="margin-bottom:12px">Active stream rooms</h3><div id="active-rooms"></div><p id="no-rooms" class="muted small">No active streams right now.</p></section>
    </div>`;
    document.body.append(dialog);
    const $ = (id) => dialog.querySelector("#" + id);
    const feedback = (message, type = "info") => {
      const node = $("stream-feedback");
      node.hidden = false;
      node.className = `notice form-status ${type}`;
      node.textContent = message;
    };
    const choose = (selected) => {
      $("p2p-panel").hidden = selected !== "p2p";
      $("external-panel").hidden = selected !== "external";
      dialog
        .querySelectorAll("[data-mode]")
        .forEach((button) =>
          button.setAttribute(
            "aria-pressed",
            String(button.dataset.mode === selected),
          ),
        );
    };
    dialog
      .querySelectorAll("[data-mode]")
      .forEach((button) =>
        button.addEventListener("click", () => choose(button.dataset.mode)),
      );
    dialog
      .querySelector("[data-close]")
      .addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      dialog.remove();
      this.updateDock();
    });
    const busy = async (button, label, action) => {
      const old = button.textContent;
      button.disabled = true;
      button.textContent = label;
      try {
        await action();
      } catch (error) {
        feedback(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = old;
      }
    };
    $("start-camera").addEventListener("click", () =>
      busy($("start-camera"), "Requesting camera…", async () => {
        await this.getCamera();
        $("local-preview").hidden = false;
        this.attachVideo($("local-preview"));
        $("create-offer").hidden = false;
        $("start-camera").hidden = true;
        feedback(
          "Camera ready. Create an offer for your first viewer.",
          "success",
        );
      }),
    );
    $("create-offer").addEventListener("click", () =>
      busy($("create-offer"), "Gathering connection…", async () => {
        const title = $("camera-title").value.trim();
        if (!title) throw new Error("Give your broadcast a title first.");
        if (!this.currentRoom) {
          this.currentRoom = this.createRoom(
            APP.currentUser()?.name || "Community broadcaster",
            title,
            "",
            "p2p",
          );
          this.state = "broadcasting";
        }
        const code = await this.createOffer(this.currentRoom.id);
        $("offer-code").value = code;
        $("offer-code-wrap").hidden = false;
        $("end-broadcast").hidden = false;
        this.renderActiveRooms();
        this.updateDock();
        feedback(
          "Offer ready. Send it to your viewer, then paste their answer above.",
          "success",
        );
      }),
    );
    $("connect-viewer").addEventListener("click", () =>
      busy($("connect-viewer"), "Connecting…", async () => {
        await this.completeConnection($("answer-input").value.trim());
        $("answer-input").value = "";
        feedback(
          "Answer accepted. Waiting for the peer connection; connection status appears in the stream controls.",
          "success",
        );
      }),
    );
    $("accept-offer").addEventListener("click", () =>
      busy($("accept-offer"), "Preparing answer…", async () => {
        const code = await this.acceptOffer($("offer-input").value.trim());
        $("answer-code").value = code;
        $("answer-code-wrap").hidden = false;
        feedback(
          "Answer ready. Send it to the broadcaster. You are connected only after the broadcaster accepts it.",
          "success",
        );
        this.updateDock();
      }),
    );
    $("copy-offer").addEventListener("click", () =>
      this.copy($("offer-code").value, "Offer copied."),
    );
    $("copy-answer").addEventListener("click", () =>
      this.copy($("answer-code").value, "Answer copied."),
    );
    $("end-broadcast").addEventListener("click", () => {
      this.endBroadcast();
      dialog.close();
    });
    $("external-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const title = $("ext-title").value.trim();
      const url = $("ext-url").value.trim();
      const embed = this.toEmbedUrl(url);
      if (!title || !embed) {
        APP.formMessage(
          form,
          "Enter a title and a supported public watch link. Do not paste a private RTMP key.",
        );
        return;
      }
      try {
        if (this.currentRoom) this.endRoom(this.currentRoom.id);
        this.currentRoom = this.createRoom(
          APP.currentUser()?.name || "Community broadcaster",
          title,
          "",
          "external",
        );
        this.currentRoom.externalUrl = url;
        this.currentRoom.service = $("ext-service").value;
        if (!this.saveRooms())
          throw new Error(
            "The stream room could not be saved. Please enable browser storage.",
          );
        this.state = "broadcasting";
        this.updateDock();
        dialog.close();
        window.dispatchEvent(
          new CustomEvent("gzvm:open-external", { detail: this.currentRoom }),
        );
        APP.toast(
          "Stream link published. Your streaming service must already be broadcasting.",
          "success",
        );
      } catch (error) {
        if (this.currentRoom) {
          this.rooms = this.rooms.filter(
            (room) => room.id !== this.currentRoom.id,
          );
          this.currentRoom = null;
        }
        APP.formMessage(form, error.message);
      }
    });
    const connectionListener = (event) => {
      if (dialog.isConnected)
        feedback(
          `Connection: ${event.detail}.` +
            (event.detail === "failed"
              ? " This network may require a TURN relay."
              : ""),
          event.detail === "failed" ? "error" : "success",
        );
    };
    const remoteListener = () => {
      if (!dialog.isConnected) return;
      $("remote-video-wrap").hidden = false;
      this.attachVideo($("remote-video"), true);
    };
    window.addEventListener("gzvm:connection", connectionListener);
    window.addEventListener("gzvm:remote-stream", remoteListener);
    dialog.addEventListener("close", () => {
      window.removeEventListener("gzvm:connection", connectionListener);
      window.removeEventListener("gzvm:remote-stream", remoteListener);
    });
    if (this.localStream) {
      $("local-preview").hidden = false;
      this.attachVideo($("local-preview"));
      $("start-camera").hidden = true;
      $("create-offer").hidden = false;
    }
    if (this.currentRoom) {
      $("end-broadcast").hidden = false;
      $("camera-title").value = this.currentRoom.title;
    }
    if (this.remoteStream) {
      $("remote-video-wrap").hidden = false;
      this.attachVideo($("remote-video"), true);
    }
    this.renderActiveRooms();
    APP.bindForms(dialog);
    APP.initDialogs();
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (mode) choose(mode);
    else if (this.state === "viewing" || this.localStream) choose("p2p");
  },
  async copy(text, message = "Copied to clipboard.") {
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(text);
      APP.toast(message, "success");
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.cssText = "position:fixed;left:-9999px";
      (document.querySelector("dialog[open]") || document.body).append(area);
      area.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch {}
      area.remove();
      APP.toast(
        copied
          ? message
          : "Clipboard unavailable. Select the code and copy it manually.",
        copied ? "success" : "warning",
      );
      return copied;
    }
  },
  updateDock() {
    let dock = document.getElementById("stream-session-dock");
    if (this.state === "idle") {
      dock?.remove();
      return;
    }
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "stream-session-dock";
      dock.className = "notice";
      dock.style.cssText =
        "position:fixed;bottom:16px;left:16px;z-index:90;max-width:calc(100% - 32px);box-shadow:0 4px 20px #173c2e22";
      document.body.append(dock);
    }
    const hosting = this.state === "broadcasting";
    const connected = hosting
      ? [...this.peers.values()].filter(
          (peer) => peer.connectionState === "connected",
        ).length
      : this.viewerPeer?.connectionState;
    dock.innerHTML = `<strong>${hosting ? "Broadcast session" : "Viewer session"}</strong><span style="display:block;font-size:11px">${hosting ? `${connected} connected viewers` : `Connection: ${connected || "waiting for host"}`}</span><div class="button-row" style="margin-top:8px"><button class="btn btn-secondary btn-sm" data-session-open>Open controls</button><button class="btn btn-ghost btn-sm" data-session-end>${hosting ? "End broadcast" : "Leave stream"}</button></div>`;
    dock
      .querySelector("[data-session-open]")
      .addEventListener("click", () =>
        this.openStreamModal(
          this.currentRoom?.type === "external" ? "external" : "p2p",
        ),
      );
    dock
      .querySelector("[data-session-end]")
      .addEventListener("click", () => this.endBroadcast());
  },
  endBroadcast() {
    if (this.currentRoom) {
      this.endRoom(this.currentRoom.id);
      this.currentRoom = null;
    }
    this.cleanup();
    this.state = "idle";
    this.viewingRoomId = null;
    this.updateDock();
    window.dispatchEvent(new CustomEvent("gzvm:stream-ended"));
    APP.toast("Stream session ended.");
  },
  cleanup() {
    this.stopCamera();
  },
  renderActiveRooms() {
    const wrap = document.getElementById("active-rooms");
    if (!wrap) return;
    const rooms = this.getActiveRooms();
    document.getElementById("no-rooms").hidden = !!rooms.length;
    wrap.innerHTML = rooms
      .map(
        (room) =>
          `<article class="active-room"><h4>${APP.escapeHtml(room.title)}</h4><p>${APP.escapeHtml(room.host)} · ${APP.escapeHtml(room.type === "external" ? room.service || "External service" : "Camera / WebRTC")} · ${APP.fmtTime(room.startedAt)} CAT</p><div class="button-row" style="margin-top:12px"><a class="btn btn-secondary btn-sm" href="live.html?room=${encodeURIComponent(room.id)}">Open room ↗</a><button class="btn btn-ghost btn-sm" data-copy-room="${APP.escapeHtml(room.id)}">Copy room link</button>${this.currentRoom?.id === room.id ? '<button class="btn btn-ghost btn-sm" data-end-room>End session</button>' : ""}</div></article>`,
      )
      .join("");
    wrap
      .querySelectorAll("[data-copy-room]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          this.copy(
            new URL(
              `live.html?room=${encodeURIComponent(button.dataset.copyRoom)}`,
              location.href,
            ).href,
            "Room link copied. Camera viewers still need an offer code.",
          ),
        ),
      );
    wrap
      .querySelector("[data-end-room]")
      ?.addEventListener("click", () => this.endBroadcast());
  },
  toEmbedUrl(value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol)) return null;
      const host = url.hostname.replace(/^www\./, "");
      const youtubeId =
        host === "youtu.be"
          ? url.pathname.split("/").filter(Boolean)[0]
          : ["youtube.com", "m.youtube.com"].includes(host)
            ? url.searchParams.get("v") ||
              url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/)?.[1]
            : null;
      if (youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId))
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`;
      if (host === "twitch.tv" || host.endsWith(".twitch.tv")) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] === "videos" && /^\d+$/.test(parts[1]))
          return `https://player.twitch.tv/?video=v${parts[1]}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`;
        if (parts[0] && /^[a-zA-Z0-9_]+$/.test(parts[0]))
          return `https://player.twitch.tv/?channel=${parts[0]}&parent=${encodeURIComponent(location.hostname)}&autoplay=true`;
      }
      if (host === "vimeo.com" && /^\/\d+\/?$/.test(url.pathname))
        return `https://player.vimeo.com/video/${url.pathname.replace(/\//g, "")}?autoplay=1`;
      if (["facebook.com", "fb.watch", "m.facebook.com"].includes(host))
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&autoplay=true`;
      return null;
    } catch {
      return null;
    }
  },
};
window.LIVE = LIVE;
