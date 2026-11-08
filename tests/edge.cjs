// Development-only edge checks. Run smoke.cjs with TEST_STATE_PATH first.
const { chromium } = require("playwright");
const Axe = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = (process.env.BASE_URL || "http://127.0.0.1:8000/").replace(
  /\/?$/,
  "/",
);
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname)) {
  throw new Error(
    "Run these tests against a local test server, not a live community website.",
  );
}
if (!process.env.TEST_STATE_PATH) {
  throw new Error(
    "Set TEST_STATE_PATH to the state exported by tests/smoke.cjs.",
  );
}
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS", name);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  });
  const state = JSON.parse(
    fs.readFileSync(process.env.TEST_STATE_PATH, "utf8"),
  );
  const saved = JSON.parse(
    state.origins[0].localStorage.find((item) => item.name === "gzvm_data_v2")
      .value,
  );
  const captain = saved.users.find(
    (user) => user.email === "captain@example.test",
  );
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    storageState: state,
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    (id) =>
      sessionStorage.getItem("gzvm_user") ||
      sessionStorage.setItem("gzvm_user", id),
    captain.id,
  );
  await context.route("**/*", (route) =>
    route.request().url().startsWith(base) ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const go = (path) => page.goto(base + path, { waitUntil: "networkidle" });
  await go("matches.html");
  await page.locator("#book-match-btn").click();
  const bookingBounds = await page.locator("#book-modal").boundingBox();
  check(
    "Booking dialog fits a 375px viewport",
    bookingBounds.x >= 0 && bookingBounds.x + bookingBounds.width <= 375,
  );
  let axe = await new Axe({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  check(
    "Mobile booking dialog has no scanned WCAG A/AA violations",
    axe.violations.length === 0,
  );
  if (axe.violations.length)
    console.log(
      JSON.stringify(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    );
  const prior = await page.evaluate(() => APP.data.bookings.length);
  const existing = await page.evaluate(() =>
    APP.data.bookings.find((item) => item.status !== "cancelled"),
  );
  await page.locator("#booking-team").selectOption(existing.teamId);
  await page
    .locator("#booking-date")
    .fill(await page.evaluate((value) => APP.dateInput(value), existing.date));
  await page
    .locator("#booking-time")
    .fill(
      await page.evaluate(
        (value) =>
          new Date(value).toLocaleTimeString("en-GB", {
            timeZone: "Africa/Blantyre",
            hour: "2-digit",
            minute: "2-digit",
          }),
        existing.date,
      ),
    );
  await page.locator("#booking-venue").selectOption(existing.venue);
  await page.locator("#book-form [type=submit]").click();
  check(
    "Duplicate venue/time booking is rejected",
    (await page
      .locator("#book-form .form-status")
      .textContent()
      .then((text) => text.includes("already a booking"))) &&
      (await page.evaluate(() => APP.data.bookings.length)) === prior,
  );
  await page.locator("#booking-date").evaluate((el) => (el.min = ""));
  await page.locator("#booking-date").fill("2020-01-01");
  await page.locator("#book-form [type=submit]").click();
  check(
    "Past booking is rejected in CAT",
    await page
      .locator("#book-form .form-status")
      .textContent()
      .then((text) => text.includes("future")),
  );
  await page.keyboard.press("Escape");
  await go("teams.html");
  await page.locator(".team-row button").click();
  axe = await new Axe({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  check(
    "Mobile team dialog has no scanned WCAG A/AA violations",
    axe.violations.length === 0,
  );
  await page.keyboard.press("Escape");
  await go("register.html");
  await page.locator("#player-name").fill("Test Invalid File");
  await page.locator("#player-dob").fill("2002-01-01");
  await page.locator("#player-email").fill("invalid-file@example.test");
  await page.locator("#player-position").selectOption("Setter");
  await page
    .locator("#player-medical")
    .setInputFiles({
      name: "too-large.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    });
  await page.locator("#player-emergency").fill("Test Contact +265000000000");
  await page.locator("#player-waiver").check();
  await page.locator("#player-conduct").check();
  await page.locator("#player-form [type=submit]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#player-form .form-status")
      .textContent.includes("2 MB"),
  );
  check(
    "Oversized medical document is rejected before saving",
    (await page
      .locator("#player-form .form-status")
      .textContent()
      .then((text) => text.includes("2 MB"))) &&
      (await page.evaluate(
        () =>
          !APP.data.players.some(
            (player) => player.email === "invalid-file@example.test",
          ),
      )),
  );
  check(
    "Adult registration does not require guardian fields",
    !(await page.locator("#guardian-section").isVisible()),
  );
  await page.locator("#player-email").fill("player@example.test");
  await page
    .locator("#player-medical")
    .setInputFiles({
      name: "test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });
  await page.locator("#player-form [type=submit]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#player-form .form-status")
      .textContent.includes("already registered"),
  );
  check(
    "Duplicate player email is rejected",
    await page
      .locator("#player-form .form-status")
      .textContent()
      .then((text) => text.includes("already registered")),
  );
  await go("donate.html");
  await page.locator("#donation-amount").fill("1000");
  await page.locator("#donation-method").selectOption("Airtel Money");
  const before = await page.evaluate(() => APP.data.donations.length);
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "gzvm_data_v2")
        throw new DOMException("Full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    };
  });
  await page.locator("#donate-form [type=submit]").click();
  check(
    "Storage failure does not create a false successful pledge",
    (await page.evaluate(() => APP.data.donations.length)) === before &&
      (await page
        .locator("#donate-form .form-status")
        .textContent()
        .then((text) => text.includes("could not save"))),
  );
  await page.evaluate(
    () => (Storage.prototype.setItem = window.originalSetItem),
  );
  await go("live.html");
  await page.locator("#go-live").click();
  await page.locator('[data-mode="external"]').click();
  axe = await new Axe({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  check(
    "Mobile broadcast dialog has no scanned WCAG A/AA violations",
    axe.violations.length === 0,
  );
  if (axe.violations.length)
    console.log(
      JSON.stringify(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    );
  await page.keyboard.press("Escape");
  check(
    "Embed converter rejects script and lookalike hosts",
    await page.evaluate(
      () =>
        LIVE.toEmbedUrl("javascript:alert(1)") === null &&
        LIVE.toEmbedUrl("https://youtube.com.evil.test/watch?v=abcdefghijk") ===
          null,
    ),
  );
  check(
    "Twitch video links retain video identity",
    await page.evaluate(() =>
      LIVE.toEmbedUrl("https://www.twitch.tv/videos/123456").includes(
        "video=v123456",
      ),
    ),
  );
  await page.evaluate(() => {
    APP.data.teams.push({
      id: "xss-test",
      name: '<img src=x onerror="window.__xss=1">',
      city: "Test",
      coach: "<script>alert(1)</script>",
    });
    APP.save();
  });
  await go("teams.html");
  check(
    "Imported team text is escaped, not executed",
    await page.evaluate(
      () =>
        !window.__xss &&
        document.querySelectorAll('.team-row img[src="x"]').length === 0,
    ),
  );
  await page.evaluate(() => {
    const id = APP.uid();
    APP.data.users.push({
      id,
      name: "Legacy Coach",
      email: "legacy@example.test",
      role: "coach",
      passwordHash: APP.hash("legacy123"),
    });
    APP.save();
    sessionStorage.setItem("gzvm_user", id);
  });
  await go("login.html");
  await page.locator("#login-email").fill("legacy@example.test");
  await page.locator("#login-password").fill("legacy123");
  await page.locator("#login-form [type=submit]").click();
  await page.waitForURL("**/index.html");
  check(
    "Legacy demo password migrates after successful login",
    await page.evaluate(() =>
      APP.data.users
        .find((user) => user.email === "legacy@example.test")
        .passwordHash.startsWith("pbkdf2$"),
    ),
  );
  await page.evaluate(async () => {
    const user = await APP.register({
      name: "Test Fan",
      email: "fan@example.test",
      password: "fan-demo-password",
      role: "fan",
    });
    APP.setSession(user);
  });
  await go("locker.html");
  check(
    "Fan role cannot open staff workspace",
    (await page
      .locator("#gate-title")
      .textContent()
      .then((text) => text.includes("team staff"))) &&
      !(await page.locator("#enter-locker").isVisible()),
  );
  check("No uncaught errors in edge cases", errors.length === 0);
  console.log(`\n${checks.length} edge checks passed.`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
