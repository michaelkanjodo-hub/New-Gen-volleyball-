# Gen Z Volleyball Malawi

A static, multi-page community website for under-25 volleyball in Malawi. The interface uses a match-day identity: court green, warm paper, scoreboard typography, and purposeful gold actions.

## Run locally

There is no build step and no runtime package installation.

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Open **http://localhost:8000**. Use HTTPS when deployed; camera access and Web Crypto require a secure context (localhost is allowed for development).

## Pages

| Page               | Purpose                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `index.html`       | Next fixture, community film, five-set scorekeeper, practice bookings, recent results, and skill-board preview |
| `matches.html`     | Upcoming/live/completed fixtures, team bookings, confirmation and cancellation                                 |
| `teams.html`       | Searchable team directory, rosters, and upcoming sessions                                                      |
| `leaderboard.html` | Filterable **self-reported skill ratings**, not verified match statistics                                      |
| `training.html`    | Six skill guides, account-linked check-ins, and community highlight links                                      |
| `register.html`    | Player registration, guardian consent, medical document, team registration                                     |
| `live.html`        | Camera/external broadcasts, fixtures, community chat, and shared film                                          |
| `donate.html`      | Clearly labelled **pledges**, not payment processing                                                           |
| `login.html`       | Local demonstration accounts and explicit coach demo setup                                                     |
| `locker.html`      | Local coach/captain workspace for strategy, feedback, and registration records                                 |
| `sync-setup.html`  | Owner-facing explanation and optional Supabase configuration                                                   |

## Architecture

- Vanilla HTML, CSS, and JavaScript; no framework or bundler.
- `css/styles.css`: shared design tokens, components, content layouts, and responsive rules.
- `js/app.js`: storage compatibility, shared navigation/footer, accessible tabs/dialogs, form helpers, account helpers, and common rendering.
- `js/pages/`: one small controller per page.
- `js/livestream.js`: external provider embeds and manually signalled WebRTC.
- `js/supabase-sync.js`: optional public-record sync adapter.
- `assets/fonts/`: self-hosted DM Sans and Barlow Condensed, with their licenses.
- `assets/brand/mark.svg`: local volleyball mark and favicon.

The original `gzvm_data_v2` storage key and existing entity shapes are retained. A `streams` collection connects the room catalog to optional sync. Existing unscoped training history remains visible as “Earlier device check-in”; new entries are linked to an account.

## Data and privacy

Without Supabase, records stay in the current browser. Clearing site storage removes them. Local storage is not a database backup.

New public sync writes exclude account credentials, email/phone, date of birth, emergency/medical details, personal training history, strategy notes, and coach feedback. Public player profiles and teams use separate `public_players` / `public_teams` row types so the adapter does not overwrite older private fields with sanitized records. Legacy rows are still read through a public-field whitelist.

**The existing Supabase SQL remains a permissive prototype.** It is not production authorization. Review and protect any previously uploaded sensitive data before a public launch. The frontend's role checks and locker password are not security boundaries. Medical documents in the redesigned registration flow stay on the current device; no private cross-device medical upload flow is claimed.

Accounts are local demonstrations. New passwords use salted PBKDF2; older demo hashes are upgraded after a successful sign-in. Use unique demo passwords. Administrator roles cannot be self-selected during signup. Replace local accounts with a real authenticated backend before handling real personal data.

## Optional public-record sync

1. Review `supabase-setup.sql` and the privacy warning above.
2. Run the SQL in the existing Supabase project only if this prototype behavior is intended.
3. Open `sync-setup.html`, enter the **public anon/publishable key**, test the connection, and save.
4. Never enter a service-role or secret key in the browser.

The existing project URL is preserved. No working anon key was supplied in the checkout, so live Supabase connectivity was not verified during the redesign.

Public profiles, teams, fixtures, bookings, highlights, chat, support records, and stream rooms can sync. Private fields and coaching records remain local. A booking confirmation is a team confirmation, **not a venue reservation**.

## Broadcasts

- External streams accept public YouTube, Twitch, Vimeo, and Facebook watch links. The upstream broadcast must already be running on that service.
- Camera streaming uses real WebRTC with manual offer/answer exchange. The viewer does not need to share a camera.
- Keep the broadcasting tab open. The site does not record camera streams.
- Only public STUN servers are configured. Some mobile/NAT networks need a TURN relay for a successful connection.
- Provider availability, embedding permissions, and cross-network media delivery still require real-world testing.

## Support records

The donation page records pledges and preferred contribution methods. It does **not** charge money, issue payment receipts, send confirmation SMS messages, or schedule recurring payments. Earlier support records are shown as unverified rather than counted as confirmed payments.

## Quality checks

See `tests/README.md` for the dependency-free static check and optional Playwright suite. See `DESIGN_AUDIT.md` for the audit, design decisions, test coverage, and unresolved production requirements.
