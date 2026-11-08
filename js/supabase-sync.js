/* Optional Supabase adapter. The existing project URL and local setup key are
   retained. Private account, contact, medical, and coaching fields never enter
   outgoing public sync rows. This is not a replacement for backend access rules. */
const SYNC = {
  client: null,
  ready: false,
  status: "local",
  message: "Saved on this device",
  config: { url: "https://ofvolzlpgfvhuluezrid.supabase.co", anonKey: "" },
  isConfigured() {
    return !!(this.config.url && this.getKey());
  },
  getKey() {
    if (this.config.anonKey) return this.config.anonKey;
    try {
      return localStorage.getItem("gzvm_anon_key") || "";
    } catch {
      return "";
    }
  },
  setStatus(status, message) {
    this.status = status;
    this.message = message;
    window.dispatchEvent(new CustomEvent("gzvm:sync-status"));
  },
  async loadClient() {
    if (window.supabase) return;
    if (this._loading) return this._loading;
    this._loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        reject(
          new Error(
            "The sync library took too long to load. Check your connection.",
          ),
        );
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(
          new Error(
            "The sync library could not load. Your local records are still available.",
          ),
        );
      };
      document.head.append(script);
    });
    try {
      await this._loading;
    } finally {
      this._loading = null;
    }
  },
  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._init();
    return this._initPromise;
  },
  async _init() {
    if (!this.isConfigured()) {
      this.setStatus(
        "local",
        "Saved on this device · cross-device sync is not configured",
      );
      return;
    }
    this.setStatus("connecting", "Connecting to the configured sync project…");
    try {
      await this.loadClient();
      this.client = window.supabase.createClient(
        this.config.url,
        this.getKey(),
      );
      await this.pullAll();
      this.ready = true;
      this.setStatus("connected", "Connected · public community records sync");
      this.channel = this.client
        .channel("gzvm-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "gzvm_sync" },
          (payload) => this.handleChange(payload),
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.setStatus(
              "error",
              "Connection interrupted · changes remain saved on this device",
            );
          }
          if (status === "SUBSCRIBED" && this.ready)
            this.setStatus(
              "connected",
              "Connected · public community records sync",
            );
        });
      window.dispatchEvent(new CustomEvent("gzvm:refresh"));
    } catch (error) {
      this.ready = false;
      this.setStatus(
        "error",
        error.message ||
          "Sync is unavailable. Your records remain on this device.",
      );
    }
  },
  publicEntity(type, item) {
    if (!item?.id) return null;
    if (type === "players") {
      const photo = item.photoConsent === false ? null : item.photo;
      return {
        id: item.id,
        name: item.name,
        team: item.team,
        position: item.position,
        jersey: item.jersey,
        photo,
        stats: item.stats || {},
        mvps: Number(item.mvps || 0),
      };
    }
    if (type === "teams")
      return {
        id: item.id,
        name: item.name,
        city: item.city,
        coach: item.coach,
        level: item.level,
        logo: item.logo,
        rosterSize: item.rosterSize,
      };
    if (type === "bookings")
      return {
        id: item.id,
        teamName: item.teamName,
        type: item.type,
        opponent: item.opponent,
        date: item.date,
        venue: item.venue,
        status: item.status,
      };
    if (type === "donations")
      return {
        id: item.id,
        name: item.name,
        amount: item.amount,
        message: item.message,
        recurring: item.recurring,
        date: item.date,
        status: item.status || "legacy",
        paymentStatus: item.paymentStatus || "unverified",
      };
    if (type === "streams")
      return {
        id: item.id,
        host: item.host,
        title: item.title,
        description: item.description,
        type: item.type,
        externalUrl: item.externalUrl,
        service: item.service,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        active: item.active,
        viewers: item.viewers,
      };
    if (["matches", "highlights", "chat"].includes(type)) return item;
    return null;
  },
  mergeRow(row) {
    if (!row || !row.entity_id) return false;
    const type =
      row.entity_type === "public_players"
        ? "players"
        : row.entity_type === "public_teams"
          ? "teams"
          : row.entity_type;
    if (
      ![
        "players",
        "teams",
        "bookings",
        "donations",
        "streams",
        "matches",
        "highlights",
        "chat",
      ].includes(type)
    )
      return false;
    const data = this.publicEntity(type, { ...row.data, id: row.entity_id });
    if (!data) return false;
    if (type === "streams") {
      LIVE.loadRooms();
      const index = LIVE.rooms.findIndex((room) => room.id === data.id);
      if (index >= 0) LIVE.rooms[index] = { ...LIVE.rooms[index], ...data };
      else LIVE.rooms.push(data);
      APP.data.streams = LIVE.rooms;
      try {
        localStorage.setItem("gzvm_rooms", JSON.stringify(LIVE.rooms));
      } catch {}
      LIVE.notifyRooms();
      return true;
    }
    const list = APP.data[type];
    const index = list.findIndex((item) => item.id === data.id);
    if (index >= 0) list[index] = { ...list[index], ...data };
    else list.push(data);
    return true;
  },
  async pullAll() {
    const { data, error } = await this.client.from("gzvm_sync").select("*");
    if (error) throw new Error(error.message);
    let changed = false;
    for (const row of data || []) changed = this.mergeRow(row) || changed;
    if (changed) {
      APP.persist();
      window.dispatchEvent(new CustomEvent("gzvm:refresh"));
    }
  },
  async push(entityType, entity) {
    const data = this.publicEntity(entityType, entity);
    if (!this.ready || !data) return;
    const type =
      entityType === "players"
        ? "public_players"
        : entityType === "teams"
          ? "public_teams"
          : entityType;
    const { error } = await this.client
      .from("gzvm_sync")
      .upsert(
        {
          entity_type: type,
          entity_id: data.id,
          data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entity_type,entity_id" },
      );
    if (error) throw new Error(error.message);
  },
  rows(data) {
    const rows = [];
    for (const [type, list] of Object.entries(data)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        const entity = this.publicEntity(type, item);
        if (entity)
          rows.push({
            entity_type:
              type === "players"
                ? "public_players"
                : type === "teams"
                  ? "public_teams"
                  : type,
            entity_id: entity.id,
            data: entity,
            updated_at: new Date().toISOString(),
          });
      }
    }
    return rows;
  },
  async pushAll(data) {
    if (!this.ready || this._pushing) return;
    this._pushing = true;
    try {
      const rows = this.rows(data);
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await this.client
          .from("gzvm_sync")
          .upsert(rows.slice(i, i + 100), {
            onConflict: "entity_type,entity_id",
          });
        if (error) throw new Error(error.message);
      }
      this.setStatus("connected", "Connected · public community records sync");
    } catch (error) {
      this.setStatus(
        "error",
        "Public sync could not save: " +
          error.message +
          " Your changes remain on this device.",
      );
    } finally {
      this._pushing = false;
    }
  },
  queuePush() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.pushAll(APP.data), 800);
  },
  async uploadFile(bucket, file, pathPrefix = "") {
    if (!this.ready || !file) return null;
    if (bucket !== "profiles") return null;
    try {
      const extension =
        { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
          file.type
        ] || "jpg";
      const path = `${pathPrefix}/${APP.uid()}.${extension}`;
      const { error } = await this.client.storage
        .from(bucket)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      return this.client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } catch {
      this.lastUploadError =
        "Image upload unavailable. A compressed copy will be saved on this device.";
      return null;
    }
  },
  handleChange(payload) {
    const row = payload.new;
    if (payload.eventType === "DELETE") {
      const old = payload.old;
      if (!old?.entity_id) return;
      const type =
        old.entity_type === "public_players"
          ? "players"
          : old.entity_type === "public_teams"
            ? "teams"
            : old.entity_type;
      if (Array.isArray(APP.data[type]))
        APP.data[type] = APP.data[type].filter(
          (item) => item.id !== old.entity_id,
        );
    } else if (!this.mergeRow(row)) return;
    APP.persist();
    window.dispatchEvent(
      new CustomEvent("gzvm:sync", {
        detail: { type: row?.entity_type, eventType: payload.eventType },
      }),
    );
    window.dispatchEvent(new CustomEvent("gzvm:refresh"));
  },
  async testKey(key) {
    const response = await fetch(
      `${this.config.url}/rest/v1/gzvm_sync?select=id&limit=1`,
      {
        headers: { apikey: key, Authorization: "Bearer " + key },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        response.status === 404
          ? "The sync table does not exist. Run the setup SQL first."
          : `Project returned HTTP ${response.status}. ${body.slice(0, 160)}`,
      );
    }
    return true;
  },
};
window.SYNC = SYNC;
