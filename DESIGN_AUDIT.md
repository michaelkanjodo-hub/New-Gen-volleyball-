# Gen Z Volleyball Malawi — redesign and implementation audit

**Date:** 2 November 2026

**Scope:** all 11 canonical pages, shared navigation/footer/components, responsive layouts, accessibility, content credibility, and existing browser-side functionality.

## 1. What the audit found

The original site had a clear community purpose, but the presentation and implementation did not consistently support it.

- **Generic visual language:** heavy green gradients, glass panels, glow, 3D tilt, a decorative ticker, and repeated card treatments made unrelated content look interchangeable.
- **Weak content hierarchy:** the homepage led with broad marketing copy rather than the next match and the actions players actually need.
- **Invented credibility:** stock community imagery, fabricated-looking statistics/testimonials, decorative map pins, and an unverified stock highlight reel were presented alongside real records.
- **Misleading feature claims:** donation controls implied processed payments and SMS confirmations; skill ratings could be mistaken for verified match statistics; coach tools were presented as if securely authenticated.
- **A real homepage runtime failure:** JavaScript wrote to a removed hero element and threw before later initialization could complete.
- **Inconsistent interaction/accessibility patterns:** incomplete labels, tab/menu state, dialog focus handling, mobile overflow in training content, and low-contrast secondary text.
- **Privacy risks:** public anonymous sync policies, a public medical storage bucket, and client-side-only staff gates were not suitable for real personal data.
- **Maintenance noise:** duplicate root-level CSS/JS variants, a single-file copy, and an unrelated patch file obscured the canonical app.

The redesign addresses these issues in the product itself rather than applying a new color palette over the same patterns.

## 2. Design direction

**Identity:** match-day utility for Malawi's under-25 volleyball community.

- Court green, warm paper, and restrained gold actions; no decorative gradients, glass, glow, or cursor tilt.
- Locally hosted Barlow Condensed for scoreboard-style headings and DM Sans for readable interface/body text, with licenses included.
- A fixture-led homepage, clear time-zone labelling (CAT), practical booking/registration paths, and honest empty states instead of invented community proof.
- Varied layouts by content type: fixture board, directory rows, training guides, forms, film room, results lists, and a staff workspace—not one repeated card grid.
- A local volleyball mark/favicon that works at small sizes; the brand name, mission, Malawi context, and useful existing data/integrations are retained.

## 3. Page-by-page implementation

| Page              | Important changes                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home              | Next-fixture/countdown board; real community film; working five-set scorekeeper; practice bookings; recent results; clearly labelled self-rating preview. Removed the missing-element crash and invented proof. |
| Matches           | Upcoming/live/results/booking views, native booking dialog, CAT validation, duplicate/past/scheduled-collision checks, confirmation and cancellation linked to fixtures.                                        |
| Teams             | Search/filterable directory, roster/schedule dialogs, empty/reset states, escaped imported text, registration deep link.                                                                                        |
| Rankings          | Explicit self-reported skill board, exact volleyball-position filters, account-linked updates, useful empty states, accessible table structure.                                                                 |
| Training          | Six practical skill guides, keyboard-accessible tabs, account-linked check-ins and history, highlight submission with safe provider parsing and image fallback.                                                 |
| Registration      | Player/team flows, exact age and guardian rules, local medical document handling, duplicate-email checks, file-size/type validation, clear success/error states.                                                |
| Live              | Honest off-air state, camera and external broadcast options, receive-only viewers, real manual WebRTC signalling, host-end cleanup, chat, fixtures, and shared film.                                            |
| Support           | Pledge presets/custom amount, preferred-method selection, optional monthly interest, unpaid/unverified status labels. No fake payment success or SMS claims.                                                    |
| Sign in / sign up | Local demonstration accounts, explicit demo coach seeding, return-to-task flow, generic login errors, salted PBKDF2 and legacy-hash upgrade.                                                                    |
| Locker            | Clearly labelled local staff workspace, role/password gate, strategy film, player feedback, and local registration/medical-status records. Not presented as secure backend authorization.                       |
| Data & sync       | Accurate local/sync status, single-source SQL, connection test before saving, public-key validation, secret-key rejection, and explicit privacy limitations.                                                    |

Shared work includes semantic landmarks, a skip link, visible focus, labelled controls, native dialogs with focus restoration, ARIA tab/menu state, live status regions, reduced-motion support, contained table/tab scrolling, mobile footer/touch refinements, and consistent busy/empty/error/success handling.

## 4. Functionality and data integrity

- Preserved the static architecture, `gzvm_data_v2` storage model, existing entity shapes, optional Supabase project URL, public STUN configuration, and supported video providers.
- Added account-linked training history while retaining older unscoped entries as “Earlier device check-in.”
- Booking confirmation/cancellation now updates the linked fixture; bookings are team confirmations, not venue reservations.
- Added cross-tab storage refresh, chat rollback on save failure, stream-save rollback, ended-room precedence over stale remote rows, countdown expiry refresh, and duplicate-team score rejection.
- New public sync serialization excludes credentials, contacts, date of birth, emergency/medical details, account links, personal skill history, strategy notes, and coach feedback. Separate public player/team row types avoid overwriting legacy private rows with sanitized data.
- Medical documents stay on-device in the current flow. The SQL makes the medical bucket private, limits its file size/types, and removes the known legacy public medical policies. Existing projects still require a manual review of custom policies and previously uploaded data.
- Removed eight confirmed duplicate/legacy artifacts. No new runtime dependencies or build framework were introduced.

## 5. Verification performed

Test environment: local Python static server, headless Chromium through Playwright, reduced-motion browser contexts, and isolated test data. Date: 2 November 2026.

### Reproducible browser suites

- `tests/smoke.cjs`: **59 checks passed**.
- `tests/edge.cjs`: **16 checks passed**.
- Combined: **75 checks passed**, with no uncaught JavaScript errors.

Coverage includes navigation/menu/focus, account creation/login and password migration, guardian rules, team/player registration, private-field exclusion, filters, training tabs/history, highlights, booking confirmation/cancellation, volleyball scoring, unpaid pledges, chat, coach tools, setup validation, mobile dialogs, duplicate/past bookings, medical file limits, duplicate emails, simulated storage failure, embed-host validation, escaped imported text, and staff-role gating.

The broadcast test uses Chromium's synthetic camera but establishes a **real two-page WebRTC connection**, verifies received media tracks, and verifies host-end cleanup. External video requests are blocked in tests to avoid nondeterministic provider/network results; URL/embed validation is still exercised.

### Responsive, console, and accessibility crawl

- All 11 routes at **375, 430, 768, 1366, and 1440px**.
- **55 empty-state loads** and **55 populated signed-in loads**: zero uncaught page errors and zero horizontal page/element overflow in the checked layouts.
- Zero console errors in the 55 empty-state loads.
- **44 page-level axe scans** (375px and 1440px in both states) plus **3 mobile dialog scans**: zero violations in the scanned scope.
- Axe tags used: `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`.
- Issues found and fixed during iteration included training overflow, table-header/secondary-text contrast, invalid live labels/badges, ARIA state, mobile placeholders/footer/touch targets, and a broken local font filename. The final crawl above ran after those fixes.
- Screenshots were captured and visually reviewed at mobile and desktop sizes; final reports are stored in the workspace under `/home/user/qa-screenshots/`.

### Static checks

- `python3 tests/check-static.py`: 11 pages; local assets, anchors, unique IDs, one `h1`, and required landmarks present.
- `node --check`: all application JavaScript and browser test scripts pass.
- `git diff --check`: passes.
- Corrected DM Sans asset URL returns HTTP 200.

See `tests/README.md` for commands. The optional Playwright/axe tools are development-only and are not required to run the website.

## 6. Unresolved production requirements

These are deliberately not hidden behind polished UI:

1. **Authentication and authorization are not production-ready.** Local accounts, role checks, and the locker password are client-side demonstrations. The preserved `gzvm_sync` policies still allow anonymous read/write. Replace them with real authentication and owner-scoped server policies before handling real personal data.
2. **Legacy data needs review.** Sanitizing new writes does not clean previously uploaded sensitive rows or custom storage policies. The SQL was reviewed but not executed against a live database; live Supabase connectivity was not verified because no working public key was supplied.
3. **Medical handling is local-only.** There is no verified private cross-device medical upload/retention workflow. Do not treat browser storage as a secure medical records system.
4. **No payment processor is connected.** The support page records pledges and interest only; it does not charge money, issue receipts, send SMS confirmations, or create recurring payments.
5. **Broadcast delivery has real-world limits.** Camera streaming requires the host tab to remain open and manual signalling. Only public STUN is configured; restrictive networks may need TURN. External embeds depend on provider availability and permissions. Camera streams are not recorded.
6. **Browser storage is not a backup.** Records can be lost when site data is cleared, and storage quotas apply. Sync is a simple prototype, not a complete conflict-resolution/offline platform.
7. **Automated checks are not a complete accessibility or device certification.** Physical-device, assistive-technology, live-provider, and live-backend testing remain necessary.

## 7. Result

The site now has a coherent, content-led volleyball identity across every major page, with working core flows, honest feature boundaries, accessible shared components, responsive layouts, and reproducible checks. The remaining launch blockers are primarily backend security, private-data handling, payments, and real-network media/backend validation—not unfinished placeholder UI.
