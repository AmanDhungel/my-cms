# EMS mobile app — discovery spec

A spec for a React Native (Expo, run in **Expo Go**) app that does what the EMS web app does, talking
to the **live** backend `https://my-cms-ebon.vercel.app`. Written from the code on branch
`feature/cdn-storage` (commit `ecfe813`) plus unauthenticated GET probes of the live site on
2026-09-27. No app code was changed; every claim cites `file:line`.

## Files

| File | What it answers |
|---|---|
| [`api.md`](./api.md) | Every endpoint: URL, auth + guard, body (from Zod), response (from DTOs), every error status, rate limit, delete rule, side effects, example; endpoint → web screen table |
| [`openapi.json`](./openapi.json) | Machine-readable OpenAPI 3.1 of the same, generated from the Zod schemas |
| [`tools/generate-openapi.mjs`](./tools/generate-openapi.mjs) | The generator (+ [`tools/ts-alias-loader.mjs`](./tools/ts-alias-loader.mjs)); no new dependency |
| [`screens.md`](./screens.md) | Every web page per role: guard, data source (API or GAP), actions → endpoints, validation, states and exact copy, device features, KEEP / SIMPLIFY / WEB-ONLY |
| [`navigation.md`](./navigation.md) | Expo Router tree per role, tabs, modals, web → mobile route map, deep links, notification `href` mapping |
| [`design-system.md`](./design-system.md) | Colour tokens (hex), fonts + expo-font loading, type scale, tracking, spacing, radii, borders, shadows, component specs, status → colour, icons, ready-to-paste `theme.ts` |
| [`backend-gaps.md`](./backend-gaps.md) | What the server must add first: token auth, CSRF for Bearer, missing GET endpoints, uploads from RN, rate-limit keys, sync + push, env |
| [`stack.md`](./stack.md) | Libraries that run in Expo Go, schema sharing, styling choice (StyleSheet + theme), what needs a development build |

Regenerate the OpenAPI file after changing a schema or route:

```bash
node --experimental-strip-types --no-warnings docs/mobile/tools/generate-openapi.mjs
```

## Counts

| | Count | Source |
|---|---|---|
| API route files | **65** (57 before `feature/mobile-api`) | `src/app/api/**/route.ts` |
| Callable operations | **102** (97 app + 5 Auth.js), on 69 paths | `api.md`, `openapi.json` `info.x-counts` |
| JSON schemas in `openapi.json` | 148 (0 conversion failures) | generator output |
| Web pages | **43** `page.tsx` (45 page × role variants) | `screens.md` |
| Recommendation | KEEP 24 · SIMPLIFY 14 · WEB-ONLY 7 | `screens.md` §9 |
| App screens | 40 screens + 16 modal sheets | `navigation.md` §1 |
| Page GAPs (server-loaded, no API) | **12** | `screens.md` §8 |
| Backend changes proposed | **24** (7 blockers) | `backend-gaps.md` |

## What the live probes showed (GET only)

- `GET /api/auth/csrf` → 200, sets `__Host-authjs.csrf-token` and `__Secure-authjs.callback-url`
  (`HttpOnly; Secure; SameSite=Lax`); `GET /api/auth/session` → `null`; `GET /api/auth/providers` →
  credentials only, absolute URLs on `my-cms-ebon.vercel.app`.
- `GET /api/tickets`, `GET /api/notifications?count=1` → 401 `{"error":"Sign in to continue"}`.
- `GET /api/uploads` → 405 (`Allow: POST, DELETE`); `GET /api/business` → 405 (no GET exists).
- `GET /api/invites/<bogus>` → 404 *"That invite link is no longer valid"*; `GET /api/quote/<bogus>` →
  404 *"This link is no longer good"*; `GET /api/sync` → 404 (no sync endpoint).
- `GET /dashboard` → 307 to `/login?callbackUrl=…`.
- The page CSP lists S3 bucket origins and **no CDN origin** → production serves pictures straight
  from S3 today (`AWS_PUBLIC_BASE_URL` apparently unset there; `src/proxy.ts:54-76`).

## Backend status

Branch `feature/mobile-api` implements the token auth, the Bearer CSRF rule, the missing read
endpoints and chunked uploads — see `api.md` §19 and the status box at the top of `backend-gaps.md`.
Still open: `/api/sync`, push notifications.

## Top backend blockers (details in `backend-gaps.md`) — as found before `feature/mobile-api`

1. **No token auth** — cookie-only Auth.js sessions; add `/api/mobile/auth/{login,refresh,logout}` with
   opaque tokens in `expo-secure-store`, and make `requireUser` accept `Authorization: Bearer`
   (single change point, `src/lib/auth/guards.ts:27-76`).
2. **CSRF check 403s every native mutation** (`src/proxy.ts:127-153`, `src/app/api/uploads/route.ts:54,149`)
   — skip it only for Bearer-authenticated requests.
3. **No `GET /api/me`** — role, workspace time zone, office, shift, logo are all server-loaded into
   pages (`src/app/dashboard/layout.tsx:32-58`); plus 7 more read endpoints for parity.
4. *(Done on `feature/mobile-api` — counted read, no 411.)* **Uploads required `Content-Length`** or 411 (`src/lib/storage/http.ts:30-45`) — RN multipart may be
   chunked on Android; upload from disk with `expo-file-system` and add a counted-read fallback.
5. **`mutation` rate limit falls back to IP** without a cookie (`src/proxy.ts:107-114`) — every app user
   behind one carrier NAT would share 300 writes / 10 min; key it by the Bearer token.

## Build plan

**Phase 0 — backend prerequisites** (web keeps working; all additive)
`MobileSession` model · `/api/mobile/auth/login|refresh|logout` · Bearer in `requireUser` · CSRF bypass
for Bearer · `GET /api/me` · `mutation` limit keyed by Bearer · upload length test on Android + iOS
(and the counted-read fallback if needed). Test on a preview deployment against a `*_test` database
(`next.config.ts:11-21` refuses test super admins on a non-test DB).

**Phase 1 — app shell + auth**
Expo Router skeleton, `theme.ts`, fonts, API client (Bearer, single-flight refresh, error mapping),
login, paste-invite + join, blocked/removed, role routing from `/api/me`.

**Phase 2 — employee flows** (the crew is the main mobile user)
Home (shift start/end with the office rings and reason sheet) → Check in (nearest-first, location) →
check-in/out sheet (fence reason, overtime reason) → My tickets + detail (past = view-only) → status
sheet (blocked reasons + shortages; review with 1–5 camera photos, compressed ≤ 1 MB) → Attendance
month → Requests + new → Profile → Notifications (new for employees).
Acceptance: the same outcomes as the web for check-in opening 10 min early, outside-fence reason,
overtime reason, past-ticket lock, photo rules (`screens.md` §4).

**Phase 3 — owner/supervisor core**
`/api/dashboard/summary` + `/api/nav-counts` (backend) → Home → Tickets (status tabs, detail, "Move
to…", create/edit with map pin + geocode) → Approvals → Notifications (+ Logs for owner) → Projects →
People (invite via share sheet, remove).

**Phase 4 — the rest**
Attendance (crew/visits), Calendar (agenda), Operations ×4 (one screen), Schedules (per-day),
Maintenance (camera), Inventory + stock purchases, Sales + bill view (share image/PDF/WhatsApp,
quote link) with `GET /api/bills/{id}`, Parties + ledger, Payments, Expenses, Reports (read-only +
CSV share), Settings (read-only; `GET /api/business`).

**Phase 5 — beyond Expo Go**
`/api/sync` + version counters, push notifications (device-token endpoint + Expo push in
`src/lib/notify.ts`), universal links (`/.well-known/*` files), EAS development/production builds,
optional background geofence reminders.
