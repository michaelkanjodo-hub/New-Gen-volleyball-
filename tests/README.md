# Browser and static checks

The website has no runtime package dependencies or build step. Playwright is an optional **development-only** test tool.

From the repository root, with Python 3 and Node.js available:

```bash
python3 tests/check-static.py

# Install the test runner without adding runtime dependencies.
npm install --no-save --package-lock=false playwright @axe-core/playwright
npx playwright install chromium

# In another terminal, serve the site:
python3 -m http.server 8000 --bind 127.0.0.1

# Run the isolated browser suite:
TEST_STATE_PATH=/tmp/gzvm-test-state.json node tests/smoke.cjs

# Reuse the isolated test state for mobile dialogs and edge cases:
TEST_STATE_PATH=/tmp/gzvm-test-state.json node tests/edge.cjs
```

The browser suite creates test-only accounts and records in a fresh browser context. It does not change an ordinary visitor's browser storage. It refuses to run against a non-local origin. External video/network requests are blocked; the WebRTC check uses Chromium's synthetic camera and a real second-tab peer connection, not a mocked connection result.

Optional environment variables:

- `BASE_URL`: a local server URL, default `http://127.0.0.1:8000/`.
- `CHROMIUM_EXECUTABLE_PATH`: an existing Chromium binary if you do not use Playwright's downloaded browser.

The core suite covers navigation, account creation/login, guardian consent, team/player registration, search and filters, training history, highlights, booking confirmation/cancellation, volleyball scoring, pledges, chat, coach tools, setup validation, and camera/external broadcast controls. The edge suite adds mobile dialog accessibility, duplicate/past booking rejection, medical file limits, guardian rules, duplicate emails, simulated storage failure, embed-host validation, escaped imported text, legacy password migration, and staff-role gating.

Automated accessibility and layout checks performed for this redesign are recorded in `../DESIGN_AUDIT.md`. They are not a substitute for testing with real assistive technology, physical mobile devices, live Supabase credentials, or production network conditions.
