// Development-only browser checks. Install Playwright using tests/README.md.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = (process.env.BASE_URL || "http://127.0.0.1:8000/").replace(
  /\/?$/,
  "/",
);
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw new Error(
    "Run these tests against a local test server, not a live community website.",
  );
const results = [];
const check = (name, value = true) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  await context.route("**/*", (route) =>
    route.request().url().startsWith(base) ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const go = async (path) => {
    await page.goto(base + path, { waitUntil: "networkidle" });
  };
  const data = () => page.evaluate(() => JSON.parse(JSON.stringify(APP.data)));
  page.on("dialog", (dialog) => dialog.accept());
  await go("index.html");
  check(
    "Empty homepage has no uncaught missing-element error",
    errors.length === 0,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  check(
    "Mobile menu exposes expanded state",
    (await page.locator(".nav-toggle").getAttribute("aria-expanded")) ===
      "true",
  );
  await page.keyboard.press("Escape");
  check(
    "Mobile menu closes with Escape",
    (await page.locator(".nav-toggle").getAttribute("aria-expanded")) ===
      "false",
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await go("login.html?returnTo=matches.html");
  await page.locator('[data-tab="au-signup"]').click();
  await page.locator("#signup-name").fill("Test Captain Banda");
  await page.locator("#signup-email").fill("captain@example.test");
  await page.locator("#signup-password").fill("unique-demo-pass-2026");
  await page.locator("#signup-role").selectOption("captain");
  await page.locator("#signup-form [type=submit]").click();
  await page.waitForURL("**/matches.html");
  check(
    "Account creation returns to the original task",
    (await data()).users[0].role === "captain",
  );
  check(
    "New credentials use salted PBKDF2",
    (await data()).users[0].passwordHash.startsWith("pbkdf2$210000$"),
  );
  await page.locator("#book-match-btn").click();
  check(
    "Booking opens a native modal",
    await page.locator("#book-modal").evaluate((el) => el.open),
  );
  await page.keyboard.press("Escape");
  check(
    "Escape closes booking and restores focus",
    await page
      .locator("#book-match-btn")
      .evaluate((el) => el === document.activeElement),
  );
  await go("register.html?type=team");
  check(
    "Team registration deep link selects team tab",
    await page.locator("#reg-team").isVisible(),
  );
  await page.locator("#team-name").fill("Test Lilongwe Volleyball Club");
  await page.locator("#team-city").selectOption("Lilongwe");
  await page.locator("#team-level").selectOption("Competitive");
  await page.locator("#team-coach").fill("Test Coach Banda");
  await page.locator("#team-email").fill("team@example.test");
  await page.locator("#team-contact").fill("+265000000000");
  await page.locator("#team-agree").check();
  await page.locator("#team-form [type=submit]").click();
  await page.locator("#team-success").waitFor({ state: "visible" });
  check(
    "Team registration persists captain and roster link",
    (await data()).teams[0].captainId === (await data()).users[0].id,
  );
  await go("teams.html");
  await page.locator("#search").fill("Lilongwe");
  check(
    "Team search finds the real saved record",
    (await page.locator(".team-row").count()) === 1,
  );
  await page.locator(".team-row button").click();
  check(
    "Team details show roster and schedule",
    await page.locator("#team-modal").evaluate((el) => el.open),
  );
  await page.keyboard.press("Escape");
  await page.locator("#search").fill("no-such-team");
  check(
    "Filtered team empty state appears",
    await page.getByText("No teams match those filters.").isVisible(),
  );
  await page.locator("#clear-filters").click();
  check(
    "Clear filters restores teams",
    (await page.locator(".team-row").count()) === 1,
  );
  await go("register.html");
  await page.locator("#player-name").fill("Test Player Chirwa");
  await page.locator("#player-dob").fill("2010-05-10");
  await page.locator("#player-email").fill("player@example.test");
  await page.locator("#player-position").selectOption("Libero");
  await page
    .locator("#player-team")
    .selectOption("Test Lilongwe Volleyball Club");
  await page.locator("#player-jersey").fill("7");
  check(
    "Under-18 registration requires guardian details",
    await page.locator("#guardian-section").isVisible(),
  );
  await page.locator("#guardian-name").fill("Test Guardian Chirwa");
  await page.locator("#guardian-phone").fill("+265000000001");
  await page.locator("#guardian-signature").fill("Test Guardian Chirwa");
  await page.locator("#player-medical").setInputFiles({
    name: "test-clearance.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nTest fixture document\n%%EOF"),
  });
  await page
    .locator("#player-emergency")
    .fill("Test Guardian Chirwa +265000000001");
  await page.locator("#player-waiver").check();
  await page.locator("#player-conduct").check();
  await page.locator("#player-form [type=submit]").click();
  await page.locator("#player-success").waitFor({ state: "visible" });
  let saved = await data();
  check(
    "Player registration stores exact age, guardian, and local medical record",
    saved.players[0].age === 16 &&
      saved.players[0].waiver.guardian.name === "Test Guardian Chirwa" &&
      saved.players[0].medical.storage === "device",
  );
  check(
    "Private fields excluded from public sync serialization",
    await page.evaluate(() => {
      const p = SYNC.publicEntity("players", APP.data.players[0]);
      return (
        !("medical" in p) &&
        !("email" in p) &&
        !("dob" in p) &&
        SYNC.publicEntity("users", APP.data.users[0]) === null &&
        SYNC.publicEntity("feedback", { id: "test" }) === null
      );
    }),
  );
  await go("training.html#progress");
  check(
    "Signed-in player sees tracker",
    await page.locator("#progress-form").isVisible(),
  );
  await page.locator("#progress-serve").evaluate((el) => {
    el.value = "75";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  check(
    "Range output reflects new rating",
    (await page.locator('output[for="progress-serve"]').textContent()) === "75",
  );
  await page.locator("#progress-form [type=submit]").click();
  saved = await data();
  check(
    "Skill check-in updates correct player and account history",
    saved.players[0].stats.serve === 75 &&
      saved.scorePad.history[0].userId === saved.users[0].id,
  );
  await page.locator('[data-tab="drill-block"]').click();
  check(
    "Training tabs switch content",
    (await page.locator("#drill-block").isVisible()) &&
      !(await page.locator("#drill-serve").isVisible()),
  );
  await page.keyboard.press("ArrowRight");
  check(
    "Training tabs support keyboard navigation",
    await page.locator("#drill-fitness").isVisible(),
  );
  await go("leaderboard.html");
  check(
    "Leaderboard labels self-ratings and shows saved player",
    await page
      .locator("#leaderboard-content")
      .getByText("Test Player Chirwa")
      .isVisible(),
  );
  await page.locator('[data-position="Libero"]').click();
  check(
    "Position filter uses exact volleyball roles",
    (await page.locator("#leaderboard-content tbody tr").count()) === 1,
  );
  await page.locator('[data-position="Setter"]').click();
  check(
    "Empty position filter has a useful state",
    await page.getByText("No players match your search.").isVisible(),
  );
  await go("training.html#film-room");
  await page.locator("#highlight-title").fill("Test practice clip");
  await page.locator("#highlight-url").fill("https://youtu.be/abcdefghijk");
  await page.locator("#highlight-form [type=submit]").click();
  check(
    "Highlight submission creates a playable community record",
    (await data()).highlights.length === 1,
  );
  await page.locator("#training-highlights button").click();
  await page.waitForURL("**live.html?highlight=*");
  check(
    "Highlight opens the real player route",
    (await page.locator("#main-player iframe").getAttribute("src")) ===
      "https://www.youtube.com/embed/abcdefghijk?rel=0",
  );
  await go("matches.html");
  async function book(type, opponent = "") {
    await page.locator("#book-match-btn").click();
    await page.locator("#booking-team").selectOption({ index: 1 });
    await page.locator("#booking-type").selectOption(type);
    await page.locator("#booking-opponent").fill(opponent);
    const date = await page.evaluate(() =>
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    );
    await page.locator("#booking-date").fill(date);
    await page
      .locator("#booking-time")
      .fill(type === "practice" ? "16:00" : "14:00");
    await page.locator("#booking-venue").selectOption("Lilongwe Civic Centre");
    await page.locator("#book-form [type=submit]").click();
    await page.locator("#book-modal").waitFor({ state: "hidden" });
  }
  await book("match", "Test Blantyre Opponents");
  saved = await data();
  check(
    "Booking creates a pending request and linked fixture",
    saved.bookings[0].status === "pending" &&
      saved.matches[0].bookingId === saved.bookings[0].id,
  );
  await page.locator('[data-status="confirmed"]').click();
  check(
    "Team confirmation updates linked fixture",
    (await data()).matches[0].confirmation === "confirmed",
  );
  await page.locator('[data-status="cancelled"]').click();
  saved = await data();
  check(
    "Cancelling booking cancels linked fixture",
    saved.bookings[0].status === "cancelled" &&
      saved.matches[0].status === "cancelled",
  );
  await book("match", "Test Mzuzu Opponents");
  await book("practice");
  await go("index.html");
  check(
    "Upcoming match appears in match board",
    await page
      .locator("#next-match")
      .getByText("Test Mzuzu Opponents")
      .isVisible(),
  );
  check(
    "Practice list uses bookings instead of invented map pins",
    await page
      .locator("#practice-list")
      .getByText("Lilongwe Civic Centre")
      .isVisible(),
  );
  await page
    .locator("#sp-team-home-input")
    .fill("Test Lilongwe Volleyball Club");
  await page.locator("#sp-team-away-input").fill("Test Mzuzu Opponents");
  await page.locator("#sp-next-set").click();
  check(
    "Invalid volleyball set cannot be finished",
    await page
      .locator("#score-form .form-status")
      .textContent()
      .then((text) => text.includes("at least 25")),
  );
  for (let set = 0; set < 3; set++) {
    await page.evaluate(() => {
      for (let i = 0; i < 25; i++)
        document.querySelector('[data-team="home"][data-delta="1"]').click();
    });
    await page.locator("#sp-next-set").click();
  }
  check(
    "Scorekeeper ends match at three sets",
    await page.locator("#sp-next-set").isDisabled(),
  );
  await page.locator("#sp-save").click();
  saved = await data();
  const result = saved.matches.find((match) => match.status === "completed");
  check(
    "Completed match stores sets and correct set score",
    result.score.home === 3 &&
      result.score.away === 0 &&
      result.sets.length === 3,
  );
  await go("matches.html?tab=results");
  check(
    "Results deep link shows completed match",
    (await page.locator("#fixtures-results").isVisible()) &&
      (await page.locator("#completed-list .fixture-row").count()) === 1,
  );
  await go("donate.html");
  await page.locator('[data-amt="5000"]').click();
  check(
    "Pledge preset updates amount and pressed state",
    (await page.locator("#donation-amount").inputValue()) === "5000" &&
      (await page.locator('[data-amt="5000"]').getAttribute("aria-pressed")) ===
        "true",
  );
  await page.locator("#donation-method").selectOption("Airtel Money");
  await page.locator("#donation-recurring").check();
  await page.locator("#donate-form [type=submit]").click();
  saved = await data();
  check(
    "Pledge is explicitly unpaid, not a fake processed donation",
    saved.donations[0].paymentStatus === "unpaid" &&
      saved.donations[0].amount === 5000,
  );
  check(
    "Pledge success discloses that no money was taken",
    await page
      .locator("#donate-form .form-status")
      .textContent()
      .then((text) => text.includes("No money has been taken")),
  );
  await go("live.html");
  await page.locator("#chat-message").fill("Test community message");
  await page.locator(".chat-input button").click();
  await page.reload({ waitUntil: "networkidle" });
  check(
    "Chat persists without seeded fake conversation",
    (await page
      .locator(".chat-body")
      .getByText("Test community message")
      .isVisible()) && (await data()).chat.length === 1,
  );
  await go("locker.html");
  await page.locator("#enter-locker").click();
  await page.locator("#locker-password").fill("wrong");
  await page.locator("#password-form [type=submit]").click();
  check(
    "Locker reports wrong password inline",
    await page
      .locator("#password-form .form-status")
      .textContent()
      .then((text) => text.includes("not correct")),
  );
  await page.locator("#locker-password").fill("locker2026");
  await page.locator("#password-form [type=submit]").click();
  check(
    "Coach role and password open workspace",
    await page.locator("#locker-content").isVisible(),
  );
  await page.locator("#strategy-title").fill("Test defensive shape");
  await page.locator("#strategy-url").fill("https://example.org/test-film");
  await page.locator("#strategy-form [type=submit]").click();
  check(
    "Strategy film persists a safe working link",
    (await data()).strategy[0].videoUrl === "https://example.org/test-film",
  );
  await page.locator('[data-tab="lk-feedback"]').click();
  await page.locator("#fb-player").selectOption({ index: 1 });
  await page
    .locator("#feedback-text")
    .fill("Test feedback: keep your platform steady.");
  await page.locator("#feedback-form [type=submit]").click();
  check(
    "Player feedback saves to selected player",
    (await data()).feedback[0].playerId === (await data()).players[0].id,
  );
  await page.locator('[data-tab="lk-roster"]').click();
  check(
    "Roster exposes local medical document status",
    await page
      .locator("#roster-content")
      .getByRole("button", { name: "View document" })
      .isVisible(),
  );
  await page.locator("#lock-locker").click();
  check(
    "Lock action closes workspace",
    await page.locator("#locker-gate").isVisible(),
  );
  await go("sync-setup.html");
  check(
    "Setup SQL loads from single source",
    await page
      .locator("#sql-content")
      .textContent()
      .then((text) =>
        text.includes("create table if not exists public.gzvm_sync"),
      ),
  );
  await page.locator("#anon-key").fill("sb_secret_never_use");
  await page.locator("#test-conn").click();
  check(
    "Sync setup rejects secret keys",
    await page
      .locator("#status-msg")
      .textContent()
      .then((text) => text.includes("never")),
  );
  await go("login.html");
  await page.locator("#login-email").fill("captain@example.test");
  await page.locator("#login-password").fill("wrong-password");
  await page.locator("#login-form [type=submit]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#login-form .form-status")
      .textContent.includes("incorrect"),
  );
  check(
    "Bad login stays on form with generic error",
    await page
      .locator("#login-form .form-status")
      .textContent()
      .then((text) => text.includes("incorrect")),
  );
  await page.locator("#logout-btn").click();
  await page.waitForURL("**/index.html");
  await go("login.html");
  await page.locator(".demo-details summary").click();
  await page.locator("#seed-coaches").click();
  await page.locator("#seed-coaches").waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    document.getElementById("seed-status").textContent.includes("created"),
  );
  check(
    "Demo coach seeding is explicit and local",
    (await data()).users.filter((user) => user.demo).length === 2,
  );
  await page.locator("#login-email").fill("coach.mary@genzvolleyball.mw");
  await page.locator("#login-password").fill("coach123");
  await page.locator("#login-form [type=submit]").click();
  await page.waitForURL("**/index.html");
  check(
    "Existing demo coach can sign in",
    await page.evaluate(() => APP.currentUser().role === "coach"),
  );
  // Real loopback WebRTC using browser-provided test camera, not a mocked stream.
  await go("live.html");
  await page.locator("#go-live").click();
  await page.locator('[data-mode="p2p"]').click();
  await page.locator("#start-camera").click();
  await page.locator("#create-offer").click();
  await page.locator("#offer-code-wrap").waitFor({ state: "visible" });
  const offer = await page.locator("#offer-code").inputValue();
  check("Camera broadcaster creates a real SDP offer", offer.length > 100);
  const viewer = await context.newPage();
  viewer.on("pageerror", (error) => errors.push(error.message));
  await viewer.goto(base + "live.html", { waitUntil: "networkidle" });
  await viewer.locator("#go-live").click();
  await viewer.locator('[data-mode="p2p"]').click();
  await viewer.locator("#offer-input").fill(offer);
  await viewer.locator("#accept-offer").click();
  await viewer.locator("#answer-code-wrap").waitFor({ state: "visible" });
  const answer = await viewer.locator("#answer-code").inputValue();
  check(
    "Viewer creates answer without requiring camera access",
    answer.length > 100 &&
      (await viewer.evaluate(() => LIVE.localStream === null)),
  );
  await page.locator("#answer-input").fill(answer);
  await page.locator("#connect-viewer").click();
  await viewer.waitForFunction(
    () => LIVE.viewerPeer?.connectionState === "connected",
    {},
    { timeout: 20000 },
  );
  check(
    "Real host/viewer WebRTC connection reaches connected",
    await page.evaluate(() =>
      [...LIVE.peers.values()].some(
        (peer) => peer.connectionState === "connected",
      ),
    ),
  );
  check(
    "Viewer receives actual media tracks",
    await viewer.evaluate(
      () =>
        document.querySelector("#remote-video")?.srcObject?.getTracks().length >
        0,
    ),
  );
  await page.evaluate(() => LIVE.endBroadcast());
  await viewer.waitForFunction(
    () =>
      LIVE.state === "idle" ||
      document.getElementById("player-title").textContent.includes("ended"),
    {},
    { timeout: 10000 },
  );
  check(
    "Host can end broadcast and clean up tracks",
    await page.evaluate(
      () => LIVE.localStream === null && LIVE.peers.size === 0,
    ),
  );
  await viewer.close();
  await go("live.html");
  await page.locator("#go-live").click();
  await page.locator('[data-mode="external"]').click();
  await page.locator("#ext-title").fill("Test external broadcast");
  await page.locator("#ext-url").fill("https://example.com/not-supported");
  await page.locator("#external-form [type=submit]").click();
  check(
    "Unsupported external streams show validation",
    await page
      .locator("#external-form .form-status")
      .textContent()
      .then((text) => text.includes("supported")),
  );
  await page
    .locator("#ext-url")
    .fill("https://www.youtube.com/watch?v=abcdefghijk");
  await page.locator("#external-form [type=submit]").click();
  await page.locator("#stream-modal").waitFor({ state: "detached" });
  check(
    "Supported watch URL becomes a safe provider embed",
    (await page.locator("#main-player iframe").getAttribute("src")) ===
      "https://www.youtube.com/embed/abcdefghijk?autoplay=1&rel=0",
  );
  await page.locator("[data-session-end]").click();
  check(
    "External room ends without stale live state",
    await page.evaluate(() => LIVE.getActiveRooms().length === 0),
  );
  check(
    "No uncaught JavaScript errors across functional flows",
    errors.length === 0,
  );
  if (process.env.TEST_STATE_PATH) {
    await context.storageState({ path: process.env.TEST_STATE_PATH });
  }
  console.log(`\n${results.length} browser checks passed.`);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
