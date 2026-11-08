/* Shared UI and the existing GZVM local data model. No build step required. */
const APP = {
  name: "Gen Z Volleyball Malawi",
  short: "GZVM",
  storageKey: "gzvm_data_v2",
  timeZone: "Africa/Blantyre",
  skills: [
    ["serve", "Serve"],
    ["spike", "Spike"],
    ["set", "Set"],
    ["block", "Block"],
    ["pass", "Pass"],
    ["dig", "Dig"],
  ],
  data: {
    users: [],
    players: [],
    teams: [],
    matches: [],
    bookings: [],
    highlights: [],
    donations: [],
    chat: [],
    feedback: [],
    strategy: [],
    notifications: [],
    streams: [],
    scorePad: { home: 0, away: 0, sets: [] },
  },

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      for (const key of Object.keys(this.data)) {
        if (Array.isArray(this.data[key]) && Array.isArray(parsed[key])) {
          this.data[key] = parsed[key].filter(
            (item) => item && typeof item === "object",
          );
        } else if (
          key === "scorePad" &&
          parsed[key] &&
          typeof parsed[key] === "object"
        ) {
          this.data[key] = { ...this.data[key], ...parsed[key] };
        }
      }
    } catch {
      this.storageError =
        "Saved data could not be read. This session still works, but existing records may be unavailable.";
    }
  },

  persist() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      this.storageError = null;
      return true;
    } catch {
      this.storageError =
        "Your browser could not save this change. Storage may be full or disabled. Please free space or enable site storage and try again.";
      return false;
    }
  },

  save() {
    const saved = this.persist();
    if (!saved) {
      this.toast(this.storageError, "error");
      return false;
    }
    if (window.SYNC?.ready) SYNC.queuePush();
    window.dispatchEvent(new CustomEvent("gzvm:local-change"));
    return true;
  },

  uid() {
    return (
      "id_" +
      (globalThis.crypto?.randomUUID?.() ||
        Date.now().toString(36) + Math.random().toString(36).slice(2))
    );
  },
  escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  },
  safeUrl(value) {
    try {
      const url = new URL(String(value));
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  },
  initials(name) {
    return String(name || "GZ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  },
  avatar(person, className = "") {
    const url =
      this.safeUrl(person.photo) ||
      (String(person.photo || "").startsWith("data:image/")
        ? person.photo
        : "");
    return url
      ? `<img class="avatar ${className}" src="${this.escapeHtml(url)}" alt="" width="36" height="36" loading="lazy" decoding="async">`
      : `<span class="avatar ${className}" aria-hidden="true">${this.escapeHtml(this.initials(person.name))}</span>`;
  },
  fmtDate(value, options = {}) {
    if (!value || Number.isNaN(new Date(value).getTime()))
      return "Date to be confirmed";
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: this.timeZone,
      ...options,
    });
  },
  fmtTime(value) {
    if (!value || Number.isNaN(new Date(value).getTime()))
      return "Time to be confirmed";
    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: this.timeZone,
    });
  },
  dateInput(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: this.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  },
  malawiDate(date, time) {
    return new Date(`${date}T${time}:00+02:00`);
  },
  ageOn(dob, today = this.dateInput()) {
    const [year, month, day] = String(dob).split("-").map(Number);
    const [ty, tm, td] = today.split("-").map(Number);
    return ty - year - (tm < month || (tm === month && td < day) ? 1 : 0);
  },
  countdown(target) {
    const diff = Math.max(0, new Date(target).getTime() - Date.now());
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor(diff / 3600000) % 24,
      m: Math.floor(diff / 60000) % 60,
      s: Math.floor(diff / 1000) % 60,
      total: diff,
    };
  },
  status(label, type = "") {
    return `<span class="status ${type ? "status-" + type : ""}">${this.escapeHtml(label)}</span>`;
  },
  empty(title, description, href = "", action = "") {
    return `<div class="empty-state"><h3>${this.escapeHtml(title)}</h3><p>${this.escapeHtml(description)}</p>${href ? `<a class="text-link" href="${this.escapeHtml(href)}">${this.escapeHtml(action)} <span aria-hidden="true">↗</span></a>` : ""}</div>`;
  },
  skillFields(stats = {}, prefix = "skill") {
    return this.skills
      .map(([key, label]) => {
        const value = Math.min(100, Math.max(0, Number(stats[key] ?? 50)));
        const id = `${prefix}-${key}`;
        return `<div class="skill-field"><label for="${id}">${label}<output for="${id}">${value}</output></label><input type="range" id="${id}" name="skill_${key}" min="0" max="100" step="1" value="${value}" aria-describedby="${id}-hint"><div class="range-hint" id="${id}-hint"><span>Developing</span><span>Confident</span></div></div>`;
      })
      .join("");
  },
  bindRanges(root = document) {
    root.querySelectorAll('input[type="range"]').forEach((input) => {
      const update = () => {
        const output = input.closest(".skill-field")?.querySelector("output");
        if (output) output.value = input.value;
      };
      input.addEventListener("input", update);
      update();
    });
  },

  // Existing demo hashes are accepted once, then upgraded after a successful login.
  legacyHash(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++)
      hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return "h_" + Math.abs(hash);
  },
  hash(value) {
    return this.legacyHash(value);
  },
  async hashPassword(
    password,
    salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join(""),
  ) {
    if (!crypto.subtle)
      throw new Error(
        "Account security requires HTTPS or localhost. Please open the secure version of this site.",
      );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt),
        iterations: 210000,
        hash: "SHA-256",
      },
      key,
      256,
    );
    return `pbkdf2$210000$${salt}$${Array.from(new Uint8Array(bits), (n) => n.toString(16).padStart(2, "0")).join("")}`;
  },
  currentUser() {
    try {
      return (
        this.data.users.find(
          (user) => user.id === sessionStorage.getItem("gzvm_user"),
        ) || null
      );
    } catch {
      return null;
    }
  },
  setSession(user) {
    try {
      sessionStorage.setItem("gzvm_user", user.id);
      sessionStorage.removeItem("gzvm_locker");
    } catch {
      throw new Error("Please enable session storage to sign in.");
    }
  },
  async login(email, password) {
    const user = this.data.users.find(
      (item) => String(item.email).toLowerCase() === email.trim().toLowerCase(),
    );
    if (!user) throw new Error("Email or password is incorrect.");
    const valid = user.passwordHash?.startsWith("pbkdf2$")
      ? user.passwordHash ===
        (await this.hashPassword(password, user.passwordHash.split("$")[2]))
      : user.passwordHash === this.legacyHash(password);
    if (!valid) throw new Error("Email or password is incorrect.");
    if (!user.passwordHash?.startsWith("pbkdf2$")) {
      const previousHash = user.passwordHash;
      user.passwordHash = await this.hashPassword(password);
      if (!this.save()) {
        user.passwordHash = previousHash;
        throw new Error(this.storageError);
      }
    }
    this.setSession(user);
    this.renderNavbar();
    return user;
  },
  async register({ name, email, password, role }) {
    if (password.length < 8)
      throw new Error("Use a password with at least 8 characters.");
    if (!["player", "coach", "captain", "fan"].includes(role))
      throw new Error("Choose a valid account role.");
    if (
      this.data.users.some(
        (user) =>
          String(user.email).toLowerCase() === email.trim().toLowerCase(),
      )
    )
      throw new Error("An account already uses this email. Please sign in.");
    const user = {
      id: this.uid(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      passwordHash: await this.hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(user);
    if (!this.save()) {
      this.data.users.pop();
      throw new Error(this.storageError);
    }
    this.setSession(user);
    this.renderNavbar();
    return user;
  },
  logout() {
    try {
      sessionStorage.removeItem("gzvm_user");
      sessionStorage.removeItem("gzvm_locker");
    } catch {}
    this.renderNavbar();
  },
  returnPath(fallback = "index.html") {
    const path = new URLSearchParams(location.search).get("returnTo");
    return path &&
      /^(index|training|live|teams|leaderboard|matches|register|donate|locker)\.html(?:[?#][^\s]*)?$/.test(
        path,
      )
      ? path
      : fallback;
  },
  withReturn(path) {
    return `${path}?returnTo=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`;
  },

  toast(message, type = "info") {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      stack.setAttribute("aria-atomic", "false");
      document.body.append(stack);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    stack.append(toast);
    setTimeout(() => toast.remove(), type === "error" ? 8000 : 5000);
  },
  formMessage(form, message, type = "error") {
    let target = form.querySelector(".form-status");
    if (!target) {
      target = document.createElement("div");
      target.className = "form-status";
      form.append(target);
    }
    target.className = `form-status notice ${type}`;
    target.setAttribute("role", type === "error" ? "alert" : "status");
    target.textContent = message;
    if (type === "error")
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },
  clearMessage(form) {
    const target = form.querySelector(".form-status");
    if (target) {
      target.textContent = "";
      target.className = "form-status";
    }
  },
  setBusy(button, busy, label = "Saving…") {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = label;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.disabled = false;
    }
  },
  formData(form, trim = true) {
    return Object.fromEntries(
      Array.from(new FormData(form).entries(), ([key, value]) => [
        key,
        typeof value === "string" && trim && !/password/i.test(key)
          ? value.trim()
          : value,
      ]),
    );
  },
  validate(form) {
    form
      .querySelectorAll(
        "input:not([type=file]):not([type=checkbox]):not([type=range])[required], textarea[required]",
      )
      .forEach((input) => {
        input.setCustomValidity(
          input.value && !input.value.trim()
            ? "Please enter a value, not only spaces."
            : "",
        );
      });
    return form.reportValidity();
  },
  bindForms(root = document) {
    root.querySelectorAll("form").forEach((form, index) => {
      form.querySelectorAll(".form-group").forEach((group, fieldIndex) => {
        const input = group.querySelector(
          "input:not([type=hidden]), select, textarea",
        );
        const label = group.querySelector("label:not(.file-drop)");
        if (
          !input ||
          !label ||
          group.querySelectorAll("input,select,textarea").length !== 1
        )
          return;
        if (!input.id)
          input.id = `${form.id || "form-" + index}-${input.name || "field-" + fieldIndex}`;
        label.htmlFor = input.id;
      });
      form.addEventListener(
        "invalid",
        (event) => {
          if (!(
            event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement ||
            event.target instanceof HTMLTextAreaElement
          ))
            return;
          event.target.setAttribute("aria-invalid", "true");
          const group = event.target.closest(".form-group,.checkbox-row");
          let error = group?.querySelector(".field-error");
          if (!error && group) {
            error = document.createElement("p");
            error.className = "field-error";
            error.id = `${event.target.id || "field"}-error`;
            group.append(error);
          }
          if (error) {
            error.textContent = event.target.validationMessage;
            event.target.setAttribute(
              "aria-describedby",
              [event.target.getAttribute("aria-describedby"), error.id]
                .filter(Boolean)
                .join(" "),
            );
          }
        },
        true,
      );
      form.addEventListener("input", (event) => {
        if (!event.target.setCustomValidity) return;
        if (event.target.type !== "file") event.target.setCustomValidity("");
        event.target.removeAttribute("aria-invalid");
        const error = event.target
          .closest(".form-group,.checkbox-row")
          ?.querySelector(".field-error");
        if (error) error.textContent = "";
      });
    });
  },
  bindFileFields(root = document) {
    root.querySelectorAll(".file-field").forEach((field) => {
      const input = field.querySelector("input[type=file]");
      const name = field.querySelector(".file-name");
      if (!input) return;
      const update = () => {
        const file = input.files[0];
        if (name)
          name.textContent = file
            ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
            : "No file selected";
      };
      input.addEventListener("change", update);
      field.addEventListener("dragover", (event) => {
        event.preventDefault();
        field.classList.add("drag");
      });
      field.addEventListener("dragleave", () => field.classList.remove("drag"));
      field.addEventListener("drop", (event) => {
        event.preventDefault();
        field.classList.remove("drag");
        if (!event.dataTransfer.files.length) return;
        const transfer = new DataTransfer();
        transfer.items.add(event.dataTransfer.files[0]);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  },
  async readImage(file, maxDimension = 640) {
    if (!file || !file.type.startsWith("image/"))
      throw new Error("Choose a JPG, PNG, or WebP image.");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Choose an image smaller than 5 MB.");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(
        1,
        maxDimension / Math.max(image.width, image.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.8);
    } catch {
      throw new Error(
        "This image could not be read. Please choose another image.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  initTabs(root = document) {
    root.querySelectorAll("[data-tabs]").forEach((tabs) => {
      if (tabs.dataset.initialized) return;
      tabs.dataset.initialized = "true";
      const buttons = Array.from(tabs.querySelectorAll("[data-tab]"));
      tabs.setAttribute("role", "tablist");
      const panels = buttons.map((button) =>
        root.getElementById
          ? root.getElementById(button.dataset.tab)
          : document.getElementById(button.dataset.tab),
      );
      const activate = (button, focus = false) => {
        buttons.forEach((item, index) => {
          const active = item === button;
          item.setAttribute("aria-selected", String(active));
          item.tabIndex = active ? 0 : -1;
          item.classList.toggle("active", active);
          if (panels[index]) {
            panels[index].hidden = !active;
            panels[index].classList.toggle("active", active);
          }
        });
        if (focus) button.focus();
        tabs.dispatchEvent(
          new CustomEvent("tabchange", { detail: button.dataset.tab }),
        );
      };
      buttons.forEach((button, index) => {
        if (!button.id)
          button.id = `tab-${tabs.dataset.tabs || "group"}-${index}`;
        const panel = panels[index];
        if (panel) {
          panel.setAttribute("role", "tabpanel");
          panel.setAttribute("aria-labelledby", button.id);
          panel.tabIndex = 0;
          button.setAttribute("aria-controls", panel.id);
          panel.hidden = button.getAttribute("aria-selected") !== "true";
        }
        button.setAttribute("role", "tab");
        button.addEventListener("click", () => activate(button));
        button.addEventListener("keydown", (event) => {
          let next;
          if (event.key === "ArrowRight" || event.key === "ArrowDown")
            next = (index + 1) % buttons.length;
          if (event.key === "ArrowLeft" || event.key === "ArrowUp")
            next = (index - 1 + buttons.length) % buttons.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = buttons.length - 1;
          if (next !== undefined) {
            event.preventDefault();
            activate(buttons[next], true);
          }
        });
      });
      const selected =
        buttons.find(
          (button) => button.getAttribute("aria-selected") === "true",
        ) || buttons[0];
      if (selected) activate(selected);
    });
  },
  selectTab(value) {
    document.querySelector(`[data-tab="${CSS.escape(value)}"]`)?.click();
  },
  openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog || dialog.open) return;
    dialog.showModal();
    document.body.style.overflow = "hidden";
  },
  closeDialog(id) {
    document.getElementById(id)?.close();
  },
  initDialogs() {
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog
        .querySelectorAll("[data-close]")
        .forEach((button) =>
          button.addEventListener("click", () => dialog.close()),
        );
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          dialog.close();
      });
      dialog.addEventListener("close", () => {
        if (!document.querySelector("dialog[open]"))
          document.body.style.overflow = "";
      });
    });
  },

  renderNavbar() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const user = this.currentUser();
    const current = location.pathname.split("/").pop() || "index.html";
    const links = [
      ["matches.html", "Matches"],
      ["teams.html", "Teams"],
      ["training.html", "Training"],
      ["live.html", "Live"],
      ["leaderboard.html", "Rankings"],
      ["donate.html", "Support"],
    ];
    const link = ([href, label]) =>
      `<li><a href="${href}"${current === href ? ' aria-current="page"' : ""}>${label}</a></li>`;
    nav.setAttribute("aria-label", "Main navigation");
    nav.innerHTML = `<div class="container nav-inner">
      <a class="brand" href="index.html" aria-label="Gen Z Volleyball Malawi home"><img src="assets/brand/mark.svg" width="43" height="43" alt=""><span class="brand-name">GEN Z VOLLEYBALL<small>MALAWI</small></span></a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="primary-links"><span>Menu</span><span class="menu-lines" aria-hidden="true"></span></button>
      <ul class="nav-links" id="primary-links">${links.map(link).join("")}
        <li class="nav-account"><a href="${user ? "locker.html" : "login.html"}"${current === (user ? "locker.html" : "login.html") ? ' aria-current="page"' : ""}>${user ? "My locker" : "Sign in"}</a></li>
        <li class="nav-register"><a href="register.html"${current === "register.html" ? ' aria-current="page"' : ""}>Join the league</a></li>
        ${user ? '<li><button class="btn btn-ghost btn-sm" id="logout-btn">Sign out</button></li>' : ""}
      </ul></div>`;
    const toggle = nav.querySelector(".nav-toggle");
    const menu = nav.querySelector(".nav-links");
    const close = () => {
      toggle.setAttribute("aria-expanded", "false");
      menu.classList.remove("open");
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("open", open);
    });
    nav.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.classList.contains("open")) {
        close();
        toggle.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!nav.contains(event.target)) close();
    });
    matchMedia("(min-width: 1001px)").addEventListener("change", (event) => {
      if (event.matches) close();
    });
    nav.querySelector("#logout-btn")?.addEventListener("click", () => {
      this.logout();
      location.href = "index.html";
    });
  },
  renderFooter() {
    const footer = document.querySelector(".footer");
    if (!footer) return;
    footer.innerHTML = `<div class="container"><div class="footer-grid">
      <div class="footer-about"><a class="brand" href="index.html"><img src="assets/brand/mark.svg" width="38" height="38" alt=""><span class="brand-name">GEN Z VOLLEYBALL<small>MALAWI</small></span></a><p>A home for the next generation of volleyball in Malawi. Built around players, teams, and the game.</p></div>
      <div><h2>Play & prepare</h2><ul><li><a href="register.html">Player registration</a></li><li><a href="register.html?type=team">Register a team</a></li><li><a href="training.html">Training drills</a></li><li><a href="matches.html">Matches & practice</a></li></ul></div>
      <div><h2>Follow the game</h2><ul><li><a href="live.html">Live & highlights</a></li><li><a href="teams.html">Team directory</a></li><li><a href="leaderboard.html">Player skill board</a></li><li><a href="donate.html">Support the community</a></li></ul></div>
      <div><h2>Your community</h2><ul><li><a href="login.html">Sign in / create account</a></li><li><a href="locker.html">Coach’s locker</a></li><li><a href="live.html#community-chat">Community chat</a></li><li><a href="sync-setup.html">Website data & sync</a></li></ul></div>
      </div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Gen Z Volleyball Malawi · Under-25 volleyball</span><div class="cluster"><span>Malawi time · CAT (UTC+2)</span><a href="#top">Back to top ↑</a></div></div></div>`;
  },

  initChat(container) {
    if (!container) return;
    container.innerHTML = `<div class="chat-header"><h3>Community chat</h3><span class="small muted" id="chat-identity"></span></div><div class="chat-body" role="log" aria-label="Community messages" aria-live="polite"></div><form class="chat-input"><label class="sr-only" for="chat-message">Your message</label><input class="form-control" id="chat-message" name="message" placeholder="Say hello to the community…" maxlength="300" required autocomplete="off"><button class="btn btn-primary btn-sm" type="submit">Send</button></form>`;
    const body = container.querySelector(".chat-body");
    const form = container.querySelector("form");
    const input = form.querySelector("input");
    const render = () => {
      const me = this.currentUser();
      container.querySelector("#chat-identity").textContent =
        me?.name || "Guest";
      body.innerHTML = this.data.chat.length
        ? this.data.chat
            .slice(-50)
            .map(
              (message) =>
                `<div class="chat-msg ${me && message.userId === me.id ? "me" : ""}"><div class="who">${this.escapeHtml(message.user)}</div><div>${this.escapeHtml(message.text)}</div></div>`,
            )
            .join("")
        : '<p class="chat-empty">No messages yet. Start the conversation.</p>';
      body.scrollTop = body.scrollHeight;
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const me = this.currentUser();
      let guest;
      try {
        guest =
          sessionStorage.getItem("gzvm_chat_guest") ||
          "Guest " + Math.floor(1000 + Math.random() * 9000);
        sessionStorage.setItem("gzvm_chat_guest", guest);
      } catch {
        guest = "Guest";
      }
      const before = this.data.chat;
      this.data.chat.push({
        id: this.uid(),
        userId: me?.id,
        user: me?.name || guest,
        text,
        time: Date.now(),
      });
      this.data.chat = this.data.chat.slice(-200);
      if (!this.save()) {
        this.data.chat = before;
        return;
      }
      input.value = "";
      render();
      input.focus();
    });
    window.addEventListener("gzvm:refresh", render);
    window.addEventListener("gzvm:local-change", render);
    render();
  },

  videoFromUrl(value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol)) return null;
      const host = url.hostname.replace(/^www\./, "");
      let id = "";
      if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0];
      if (host === "youtube.com" || host === "m.youtube.com")
        id =
          url.searchParams.get("v") ||
          url.pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)/)?.[1];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
        return {
          provider: "YouTube",
          videoId: id,
          embedUrl: `https://www.youtube.com/embed/${id}?rel=0`,
          thumbUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        };
      if (host === "vimeo.com" && /^\/\d+\/?$/.test(url.pathname))
        return {
          provider: "Vimeo",
          videoId: url.pathname.replace(/\//g, ""),
          embedUrl: `https://player.vimeo.com/video/${url.pathname.replace(/\//g, "")}`,
          thumbUrl: "",
        };
      return null;
    } catch {
      return null;
    }
  },
  getHighlightVideo(highlight) {
    return (
      this.videoFromUrl(highlight.videoUrl || "") ||
      (highlight.videoId && /^[a-zA-Z0-9_-]{11}$/.test(highlight.videoId)
        ? this.videoFromUrl(`https://youtu.be/${highlight.videoId}`)
        : null)
    );
  },
  renderHighlights(container, limit = Infinity) {
    if (!container) return;
    const highlights = this.data.highlights
      .filter((item) => this.getHighlightVideo(item))
      .slice(0, limit);
    if (!highlights.length) {
      container.innerHTML = this.empty(
        "The film room is ready.",
        "Community highlights will appear here when players share a video. Have a clip? Add it to your training notebook.",
        "training.html#film-room",
        "Share a highlight",
      );
      return;
    }
    container.innerHTML = highlights
      .map((item) => {
        const video = this.getHighlightVideo(item);
        return `<button class="highlight-card" data-highlight="${this.escapeHtml(item.id)}"><div class="highlight-thumb">${video.thumbUrl ? `<img src="${this.escapeHtml(video.thumbUrl)}" alt="" width="480" height="360" loading="lazy" decoding="async">` : ""}<span class="play-icon">Watch film ↗</span></div><h3>${this.escapeHtml(item.title)}</h3><p>${this.escapeHtml(item.player || "Community player")}${item.team ? " · " + this.escapeHtml(item.team) : ""}</p></button>`;
      })
      .join("");
    container
      .querySelectorAll("img")
      .forEach((image) =>
        image.addEventListener("error", () => image.remove()),
      );
    container.querySelectorAll("[data-highlight]").forEach((button) =>
      button.addEventListener("click", () => {
        location.href = `live.html?highlight=${encodeURIComponent(button.dataset.highlight)}`;
      }),
    );
  },

  async init() {
    if (this.__booted) return;
    this.__booted = true;
    if (!document.body.id) document.body.id = "top";
    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#main";
    skip.textContent = "Skip to content";
    document.body.prepend(skip);
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "main";
    this.renderNavbar();
    this.renderFooter();
    window.addEventListener("storage", (event) => {
      if (event.key !== this.storageKey) return;
      this.load();
      this.renderNavbar();
      window.dispatchEvent(new CustomEvent("gzvm:refresh"));
    });
    this.initTabs();
    this.initDialogs();
    this.bindForms();
    this.bindFileFields();
    this.bindRanges();
    if (this.storageError) this.toast(this.storageError, "error");
    if (window.LIVE) LIVE.init();
    if (window.SYNC) {
      await SYNC.init();
      this.renderNavbar();
      window.dispatchEvent(new CustomEvent("gzvm:refresh"));
    }
  },
};
APP.load();
window.APP = APP;
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", () => APP.init());
else APP.init();
