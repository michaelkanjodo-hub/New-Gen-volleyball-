(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("sync-form");
  let testedKey = "";
  let sql = "";
  const status = (message, type = "info") => {
    $("status-msg").className = `form-status notice ${type}`;
    $("status-msg").textContent = message;
  };
  const updateStatus = () => {
    $("sync-status").textContent = SYNC.message;
    $("sync-status").classList.toggle("connected", SYNC.status === "connected");
  };
  try {
    $("anon-key").value = localStorage.getItem("gzvm_anon_key") || "";
  } catch {}
  fetch("supabase-setup.sql")
    .then((response) => {
      if (!response.ok) throw new Error();
      return response.text();
    })
    .then((text) => {
      sql = text;
      $("sql-content").textContent = text;
      $("copy-sql").disabled = false;
    })
    .catch(() => {
      $("sql-content").textContent =
        "The SQL file could not load. Open supabase-setup.sql in the project folder.";
    });
  $("copy-sql").addEventListener("click", async () => {
    if (window.LIVE) await LIVE.copy(sql, "Setup SQL copied.");
    else {
      try {
        await navigator.clipboard.writeText(sql);
        status("SQL copied.", "success");
      } catch {
        status("Select the SQL below and copy it manually.", "warning");
      }
    }
  });
  $("anon-key").addEventListener("input", () => {
    testedKey = "";
    $("save-key").disabled = true;
  });
  $("test-conn").addEventListener("click", async () => {
    const key = $("anon-key").value.trim();
    if (!key) return status("Paste the public anon key first.", "error");
    if (
      key.startsWith("sb_secret_") ||
      (key.split(".").length !== 3 && !key.startsWith("sb_publishable_"))
    )
      return status(
        "Use a public anon or publishable key, never a service-role or secret key.",
        "error",
      );
    const button = $("test-conn");
    APP.setBusy(button, true, "Testing connection…");
    $("save-key").disabled = true;
    try {
      await SYNC.testKey(key);
      testedKey = key;
      $("save-key").disabled = false;
      status(
        "Connection successful. Save to enable public community sync on this browser.",
        "success",
      );
    } catch (error) {
      status(
        error.name === "TimeoutError"
          ? "The connection timed out. Check your network and try again."
          : error.message,
        "error",
      );
    } finally {
      APP.setBusy(button, false);
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const key = $("anon-key").value.trim();
    if (!testedKey || key !== testedKey)
      return status("Test this exact key before saving.", "error");
    try {
      localStorage.setItem("gzvm_anon_key", key);
      status("Saved. Reloading to connect…", "success");
      setTimeout(() => (location.href = "index.html"), 700);
    } catch {
      status("Browser storage is unavailable. The key was not saved.", "error");
    }
  });
  $("disconnect-sync").addEventListener("click", () => {
    if (
      !confirm(
        "Disconnect cross-device sync on this browser? Your local records will remain.",
      )
    )
      return;
    try {
      localStorage.removeItem("gzvm_anon_key");
      location.reload();
    } catch {
      status("Could not update browser storage.", "error");
    }
  });
  updateStatus();
  window.addEventListener("gzvm:sync-status", updateStatus);
})();
