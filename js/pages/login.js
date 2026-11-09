(() => {
  const $ = (id) => document.getElementById(id);
  if (new URLSearchParams(location.search).get("mode") === "signup")
    APP.selectTab("au-signup");
  document.querySelectorAll("[data-switch]").forEach((button) =>
    button.addEventListener("click", () => {
      APP.selectTab(button.dataset.switch);
      document.querySelector(`[data-tab="${button.dataset.switch}"]`).focus();
    }),
  );
  document.querySelectorAll(".password-toggle").forEach((button) =>
    button.addEventListener("click", () => {
      const input = document.getElementById(
        button.getAttribute("aria-controls"),
      );
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
      button.setAttribute("aria-pressed", String(show));
    }),
  );
  for (const [id, action] of [
    ["login-form", "login"],
    ["signup-form", "register"],
  ]) {
    const form = $(id);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!APP.validate(form)) return;
      const button = form.querySelector("[type=submit]");
      APP.setBusy(
        button,
        true,
        action === "login" ? "Signing in…" : "Creating account…",
      );
      APP.clearMessage(form);
      try {
        const values = APP.formData(form, false);
        const user =
          action === "login"
            ? await APP.login(values.email.trim(), values.password)
            : await APP.register({
                ...values,
                name: values.name.trim(),
                email: values.email.trim(),
              });
        APP.formMessage(
          form,
          `Welcome, ${user.name}. Taking you back to the community…`,
          "success",
        );
        location.href = APP.returnPath();
      } catch (error) {
        APP.formMessage(form, error.message);
      } finally {
        APP.setBusy(button, false);
      }
    });
  }
  $("seed-coaches").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      let added = 0;
      for (const coach of [
        { name: "Coach Mary Banda", email: "coach.mary@genzvolleyball.mw" },
        { name: "Coach Joseph Phiri", email: "coach.joseph@genzvolleyball.mw" },
      ]) {
        if (APP.data.users.some((user) => user.email === coach.email)) continue;
        APP.data.users.push({
          id: APP.uid(),
          ...coach,
          role: "coach",
          passwordHash: await APP.hashPassword("coach123"),
          createdAt: new Date().toISOString(),
          demo: true,
        });
        added++;
      }
      if (!APP.save()) {
        APP.data.users = APP.data.users.filter((user) => !user.demo);
        throw new Error(APP.storageError);
      }
      $("seed-status").textContent = added
        ? `${added} demo coach accounts created in this browser.`
        : "The demo coach accounts already exist in this browser.";
    } catch (error) {
      $("seed-status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
