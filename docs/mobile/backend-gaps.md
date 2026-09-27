# Backend gaps — what the server must change before the app works

Every item: the evidence (`file:line`), why it blocks a native client, and a proposed **additive**
fix (new routes / new branches; the web's cookie path keeps working unchanged). Nothing here has been
implemented. Live observations come from unauthenticated GETs against
`https://my-cms-ebon.vercel.app` on 2026-09-27; no writes were sent.

**Totals: 9 gap areas → 24 concrete backend changes** — §1: 7, §2: 1, §3: 10, §4: 1, §5: 3, §6: 2.
**7 are blockers** (🔴): `MobileSession` model, mobile login, refresh, Bearer in `requireUser`, the
CSRF bypass for Bearer, `GET /api/me`, and the upload length fallback (the last pending a device test).

| # | Area | Blocks the app? |
|---|---|---|
| 1 | Token auth (login/refresh/logout, Bearer in guards, password change, invalidation) | 🔴 yes |
| 2 | Origin/Referer CSRF check on every mutation | 🔴 yes |
| 3 | Server-loaded pages with no API (12 gaps → 8 endpoints) | 🔴 yes for `/api/me`; others for parity |
| 4 | Uploads from RN (Content-Length / 411) | 🔴 likely on Android — must be tested |
| 5 | IP-keyed rate limits vs mobile NAT | 🟠 degrades under load |
| 6 | Sync/version counters + push notifications | 🟠 parity (web polls) |
| 7 | Image URLs | 🟢 works as-is |
| 8 | Vercel env | 🟢 names listed |
| 9 | Other native blockers (tenant host rule, time zones, …) | 🟠 mixed |

---

## 1. 🔴 Auth: the web uses Auth.js session cookies only

**Evidence**
- Credentials provider + JWT **cookie** session (`src/auth.ts:12-62`, `src/auth.config.ts:14-16`).
  Cookie `__Secure-authjs.session-token` (`src/proxy.ts:99-106`). Live: `GET /api/auth/csrf` sets
  `__Host-authjs.csrf-token` / `__Secure-authjs.callback-url` (`HttpOnly; Secure; SameSite=Lax`).
- Every API guard reads the session via `auth()` — **only in `src/lib/auth/guards.ts:25` and `:104`**
  (the other `auth()` callers are pages). So Bearer support is a single change point.
- The guard already re-reads the member and workspace from Mongo on every request and refuses removed
  / blocked / stale sessions (`src/lib/auth/guards.ts:37-55`). That logic must be reused, not duplicated.
- No password change or reset route exists: the `password` rate limit says "no such route yet"
  (`src/lib/security/limits.ts:14-15`); the `password_changed` activity type is declared
  (`src/lib/work-constants.ts:302`) but nothing writes it; "Forgot password?" links back to `/login`
  (`src/components/auth/login-form.tsx:98-100`).
- A stateless JWT cannot be revoked; the only kill switches are block, remove and
  `sessionsValidAfter` (set only when a removed account is adopted,
  `src/app/api/invites/[token]/accept/route.ts:84`).

**Why it blocks:** a native app can't use the browser flow cleanly: the session cookie is `HttpOnly`
(can't be put in `expo-secure-store`), the login is a form POST with a double-submit CSRF cookie, and
RN's shared native cookie jar is not a reliable, inspectable store. (It *might* work with the native
cookie jar plus a hand-set `Origin` header — see §2 — but that is not a design to ship.)

**Proposed fix (additive)**

1. **New model `MobileSession`** (`src/models/mobile-session.ts`):
   `{ user, business, deviceId, deviceName, platform, accessHash, accessExpiresAt, refreshHash,
   refreshExpiresAt, family, createdAt, lastUsedAt, revokedAt }`, unique indexes on `accessHash` and
   `refreshHash`, TTL index on `refreshExpiresAt`. Tokens are **opaque** (`randomBytes(32).toString("base64url")`),
   stored as SHA-256 only — the same pattern as invite tokens (`src/models/invite.ts:57-64`). Opaque
   tokens mean no new dependency (`jose` is only a transitive dependency, v6.2.12 via next-auth) and
   **instant revocation**, at the cost of one indexed lookup per request (the guard already does a DB
   round trip, `src/lib/auth/membership.ts:28-54`; the lookup can be folded into that aggregate).

2. **`POST /api/mobile/auth/login`** `{ email, password, deviceId, deviceName?, platform? }` →
   `200 { accessToken, accessExpiresAt, refreshToken, refreshExpiresAt, user: UserDTO, business: MeBusiness }`.
   - Reuse exactly the `authorize` checks (`src/auth.ts:20-59`): `credentialsSchema`, `DUMMY_HASH`
     timing-safe compare, refuse `removed`, blocked account, blocked workspace — all as one generic
     401 *"Email or password is incorrect"*.
   - Apply `loginEmail` + `loginIp` limits (`src/lib/security/limits.ts:7-9`) and the same audit
     actions `login_succeeded|login_failed|login_rate_limited`
     (`src/app/api/auth/[...nextauth]/route.ts:104-118`).
   - Refuse super-admin sign-in here (admin stays web-only), or allow it but never accept Bearer in
     `requireSuperAdmin`.
   - TTLs: access 1 h, refresh 60 d (suggested; nothing in the code dictates them).

3. **`POST /api/mobile/auth/refresh`** `{ refreshToken }` → new pair; **rotate** (old refresh hash
   invalidated; presenting a used refresh token revokes the whole `family` — reuse detection). Refuse
   (401) when the session is revoked/expired, the member is removed or blocked, the workspace is
   blocked, or `session.createdAt < member.sessionsValidAfter`.

4. **`POST /api/mobile/auth/logout`** (Bearer) → `revokedAt = now` for this session; also used to drop
   the push token (§6).

5. **Guards accept `Authorization: Bearer`** — change `requireUser()` (`src/lib/auth/guards.ts:24-68`):
   ```ts
   // new: src/lib/auth/claims.ts
   export async function readClaims(): Promise<{ id: string; signedInAt?: number; via: "cookie" | "bearer" } | null> {
     const header = (await headers()).get("authorization")
     if (header?.startsWith("Bearer ")) {
       const s = await MobileSession.findOne({ accessHash: sha256(header.slice(7)), revokedAt: null, accessExpiresAt: { $gt: new Date() } })
       return s ? { id: String(s.user), signedInAt: s.createdAt.getTime(), via: "bearer" } : null  // never fall back to cookies
     }
     const session = await auth()
     return session?.user?.id ? { id: session.user.id, signedInAt: session.user.signedInAt, via: "cookie" } : null
   }
   ```
   Everything after the claims (membership, removed/blocked, `isStaleSession`) stays as is, so blocked
   accounts and adopted accounts are refused on the next request for both transports.
   **Rule: when an `Authorization` header is present, authenticate by it alone** — this is what makes
   the CSRF bypass in §2 safe.

6. **Password change** — `POST /api/me/password` `{ currentPassword, newPassword (≥10) }`, limit
   `password` (`src/lib/security/limits.ts:15`), writes activity `password_changed`, sets
   `sessionsValidAfter = now` (kills every cookie session) and revokes all `MobileSession`s except the
   caller's. Reset-by-email is out of scope: **there is no mail gateway** (stated for quotes,
   `src/lib/validations/review.ts:3-9`; no mailer in `src/`).

7. **Session invalidation hooks** — revoke all `MobileSession`s for the user in:
   `DELETE /api/people/[id]` (`src/app/api/people/[id]/route.ts:146-148`), admin block
   (`src/app/api/admin/users/[id]/route.ts:36-41`), and when an invite adopts a removed account
   (`src/app/api/invites/[token]/accept/route.ts:78-90`). Workspace block is already enforced per
   request (`src/lib/auth/guards.ts:45-47`), so no hook is needed there.

---

## 2. 🔴 The Origin/Referer CSRF check 403s native requests

**Evidence:** `src/proxy.ts:119-122` refuses any `POST|PUT|PATCH|DELETE` under `/api` whose
`Origin`/`Referer` host ≠ `host` (`src/lib/security/same-origin.ts:21-33`) with 403 *"Cross-origin
requests aren't allowed"*. `/api/uploads` repeats it (`src/app/api/uploads/route.ts:61,146`). RN's
`fetch` sends no `Origin` → **every mutation fails**. There are no CORS headers anywhere (grep:
none), which is fine for native.

**Proposed fix:** skip the check **only** for requests carrying `Authorization: Bearer …`, keep it for
everything else:
```ts
// src/lib/security/same-origin.ts — edge-safe string check
export function isBearer(headers: Headers) {
  return /^Bearer\s+\S+$/.test(headers.get("authorization") ?? "")
}
// src/proxy.ts:120 and src/app/api/uploads/route.ts:61,146
if (isApi && !isBearer(request.headers) && !isSameOrigin(request.method, request.headers)) { … 403 … }
```
Why this is safe: CSRF abuses *ambient* credentials (cookies). A cross-site page cannot attach an
`Authorization` header without a CORS preflight, which this server never approves; and with §1.5 a
request that carries the header is authenticated by it **alone**, so a victim's cookie can never ride
along. Cookie requests keep the Origin check.

*Interim note:* RN lets you set `Origin` by hand, so a prototype could pass today with the cookie flow
+ `Origin: https://my-cms-ebon.vercel.app`. Not verified (no writes were sent) and not recommended.

---

## 3. 🔴/🟠 Pages that load data server-side with no API

From `screens.md` §8. Proposed endpoints (all read-only, additive):

### 3.1 🔴 `GET /api/me` — GAP-1, 4, 5, 6, 12
Replaces the shell/page loaders `src/app/dashboard/layout.tsx:32-58`, `src/app/dashboard/page.tsx:38-47`,
`src/app/dashboard/profile/page.tsx:17-24` and the `timeZone`/`today`/`vatRate` props of 9 pages.
Guard `requireUser`.
```ts
{
  user: UserDTO,                                   // src/models/user.ts:115-126
  superAdmin: boolean,                             // isSuperAdmin(email), src/lib/auth/super-admin.ts:24-27
  business: {
    id, name, logoUrl: string | null,              // servedUrl(logo.url), src/app/dashboard/layout.tsx:42-49
    timeZone, today: "YYYY-MM-DD",                 // dayKeyInZone(now, timeZone)
    vatRate, pan: string | null,
    office: BusinessDTO["office"],                 // employee shift-start needs it, src/models/business.ts:145-151
    week: WeekPattern | null, ownerId,
  },
  can: { deleteRecords: role === "owner", seeMoney: role === "owner", decideRequests: role === "owner" }
}
```

### 3.2 `GET /api/nav-counts` — GAP-2 (`src/app/dashboard/layout.tsx:60-103`)
`requireRole("owner","supervisor")` → `{ people, pendingInvites, projects, tickets, inventory, sales,
customers, maintenance, approvals, unread, payments?, expenses? }` (last two owner only; same queries
as the layout).

### 3.3 `GET /api/dashboard/summary` — GAP-3 (`src/app/dashboard/page.tsx:50-81`)
`requireRole("owner","supervisor")` → `{ timeZone, today, onSite: number, crew: number,
ticketsToday: TicketDTO[≤6], pendingRequests: RequestDTO[≤4] }`. (Note `crew` counts removed members,
`:56`; fix to `status:"active"` while moving it.)

### 3.4 `GET /api/business` — GAP-8 (`src/app/dashboard/settings/page.tsx:19-38`)
Today `/api/business` has PATCH only (live `GET` → 405). Add GET, `requireRole("owner","supervisor")`
→ `{ business: BusinessDTO, stats: { members, pendingInvites }, uploads: boolean, canEdit }`.

### 3.5 `GET /api/projects/{id}` — GAP-9 (`src/app/dashboard/projects/[id]/page.tsx:20-37`)
`requireRole("owner","supervisor")` → `{ project: ProjectDTO & { tickets: {total, open, blocked, done} } }`.

### 3.6 `GET /api/bills/{id}` — GAP-10 (`src/app/dashboard/sales/[id]/page.tsx:28-53`)
`requireRole("owner","supervisor")` → `{ bill: BillDTO, payments: {id, amount, method, reference, paidOn}[],
business: {name, pan}, issuedBy: string | null }`. Consider stripping `review.token` for supervisors
(it is the live public credential; `src/models/bill.ts:216-217,347`).

### 3.7 `GET /api/invites` for supervisors — GAP-7 (`src/app/dashboard/people/page.tsx:16-37`)
The page shows invites to supervisors but the API is owner-only (`src/app/api/invites/route.ts:21`).
Allow `owner|supervisor` on GET (POST stays owner-only).

### 3.8 403 `code` for blocked vs removed — GAP-12
Add `code: "removed" | "account_blocked" | "workspace_blocked"` to the 403 bodies thrown at
`src/lib/auth/guards.ts:41-47` (`HttpError` already carries extra fields only as `fieldErrors`/headers,
`src/lib/api-response.ts:11-30` — extend it with an optional `code`, as the site route already does
ad hoc, `src/app/api/site/route.ts:51-60`).

(GAP-11, the super-admin sign-up invite page, stays web-only — no endpoint needed.)

Also missing for parity (not page gaps):
- `NotificationDTO` omits the stored `ticket` id (`src/models/notification.ts:47-55`) → add
  `ticketId` so a notification can deep-link to the ticket.
- Employees can PUT materials (`src/app/api/tickets/[id]/materials/route.ts:34-57`) but can't read the
  stock list (`src/app/api/inventory/items/route.ts:19`) → either allow a slim
  `GET /api/inventory/items?fields=picker` for employees or keep employee materials free-text only.

---

## 4. 🔴 Uploads from React Native

**Evidence:** `POST /api/uploads` requires multipart **with a numeric `Content-Length`** or answers
**411** *"Send the picture with its size"*; declared > 1,000,000 + 64 KiB → 413
(`src/lib/storage/http.ts:30-45`, called at `src/app/api/uploads/route.ts:74`). File > 1,000,000 bytes
→ 413; type by magic bytes JPEG/PNG/WebP/AVIF else 415 (`route.ts:92-112`,
`src/lib/storage/sniff.ts`). Role × purpose matrix `route.ts:27-31`.

**RN request shape:**
```ts
const form = new FormData()
form.append("purpose", "ticket")
form.append("file", { uri, name: "photo.jpg", type: "image/jpeg" } as any)
await fetch(`${API}/api/uploads`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form })
// do NOT set Content-Type yourself — the boundary must come from the runtime
```

**Does RN send `Content-Length` for that body?** **Cannot be determined from this repo.** It depends on
the platform networking layer (iOS builds the multipart body in memory; Android streams file parts and
may use chunked transfer). It must be tested on a real Android and iOS device against a staging server.

**Proposed fixes (both additive; do the first, keep the second as the safety net):**
1. **App side:** upload with `expo-file-system`'s `uploadAsync(url, fileUri, { httpMethod: "POST",
   uploadType: FileSystemUploadType.MULTIPART, fieldName: "file", mimeType: "image/jpeg",
   parameters: { purpose }, headers: { Authorization } })` (in Expo Go). It uploads from a file on disk,
   so the length is known — still verify on both platforms.
2. **Server side:** for **Bearer** requests only, replace the hard 411 with a counted read: stream the
   body up to `MAX_UPLOAD_BYTES + 64 KiB` (the same technique `readJson` uses,
   `src/lib/api-response.ts:85-111`) and parse the multipart from the buffered bytes
   (`new Response(bytes, { headers }).formData()`). The route is outside the proxy matcher precisely so
   it sees headers before Next buffers the body (`src/proxy.ts:196-201`), so this stays bounded.

**Compression on the device** (the server checks stay unchanged): mirror
`src/lib/images/compress.ts:22-100` with `expo-image-manipulator` — skip if the picked file is already
≤ 1,000,000 bytes *and* JPEG/PNG/WebP; otherwise resize longest edge to 2000 → 1600 → 1200 → 1000 and
encode JPEG at 0.85 → 0.75 → 0.65 → 0.55 → 0.5 until ≤ 1,000,000 bytes (check with
`FileSystem.getInfoAsync(uri, { size: true })`), else show *"That picture is still over 1 MB after
compressing. Try a smaller one."* Always re-encode HEIC (iPhone camera) — the server would 415 it.
Use JPEG output: the server accepts it and `SaveFormat.WEBP` platform support should be checked
before relying on it.

Flow per screen (from the web): pick/compress → on Save upload each new picture → send URLs in the
record body → on save failure `DELETE /api/uploads { urls }` for the fresh uploads
(`src/lib/upload-client.ts:92-164`, `src/components/dashboard/employee/status-dialog.tsx:138-160`).

---

## 5. 🟠 Rate limits keyed by IP

`src/lib/security/limits.ts:5-24`, keys in `src/proxy.ts:99-140` and the routes:

| Limit | Key | Mobile problem | Proposal |
|---|---|---|---|
| `mutation` 300/10 min | hash of the session **cookie**, else **IP** (`src/proxy.ts:99-106`) | Bearer requests have no cookie → **every app user behind one carrier NAT shares 300 writes / 10 min** | key by `sha256(bearer token)` when `Authorization` is present (same trust level as the cookie hash today) |
| `loginIp` 20/15 min | IP | NAT'd users lock each other out of login | keep `loginEmail` 5/15 min (per account); raise `loginIp` for the mobile login or key it by `ip + deviceId` |
| `register`, `inviteAccept` 5/h | IP | a crew onboarding on the same site Wi-Fi/NAT hits 5/h | key `inviteAccept` by `token` + IP |
| `publicPage` 120/min | IP | only `/quote/*` (web-only) | none |
| `uploads` 60/10 min, `checkIn` 30/10 min | user id | fine | none |

IP source: `clientIp` takes the **last** `x-forwarded-for` hop unless `TRUST_PROXY` is set
(`src/lib/security/client-ip.ts:14-22`). Whether `TRUST_PROXY` is set on Vercel cannot be determined
from the code; check the project env.

---

## 6. 🟠 Cache refresh (`/api/sync`) and push notifications

**Evidence:** there is **no `/api/sync` and no version counter** anywhere (grep; live `GET /api/sync` →
404). The web stays fresh by `invalidateQueries` after its own mutations and by polling notifications
every 60 s (`src/lib/queries.ts:294-298,365-405`; defaults `staleTime 60 s`,
`src/lib/query-client.ts:9-11`). Other people's changes are only seen after the 60 s staleTime or a refetch.

**Proposed `GET /api/sync`** → `{ versions: { tickets, attendance, requests, notifications, projects,
people, inventory, bills, payments, expenses, customers, maintenance, operations, schedules, site }, serverTime }`.
Implementation: a `versions` subdocument on `Business` bumped with `$inc` in the same write as each
mutation (deletes must bump too, so `max(updatedAt)` is not enough). Mapping (route → counter):
tickets* → `tickets` (+`attendance` for check-in/out/status); attendance POST, requests/[id] (leave) →
`attendance`; requests* → `requests`; notify.ts inserts → `notifications` (per user: keep a
`User.notificationsVersion` instead); projects* → `projects`; people*, invites* → `people`;
inventory*, bills* (stock), expenses* (stock) → `inventory`; bills* → `bills`; payments*, expenses* →
`payments`; customers* → `customers`; maintenance* → `maintenance`; operations* → `operations`;
schedules* → `schedules`. The app polls `/api/sync` on foreground and every 30–60 s, and invalidates
the TanStack keys whose counter changed (same keys as the web, `src/lib/queries.ts:53-84`).

**Push notifications.** Events that already create notification rows (`src/lib/notify.ts:24-49`,
call sites in `screens.md` §0.5):

| Event | Push to |
|---|---|
| `ticket_assigned` | the assignee(s) |
| `ticket_done` (signed off) | the crew on the ticket |
| `request_decided` | the requester |
| `check_in`, `check_out`, `ticket_blocked`, `ticket_in_review`, `request_raised`, `member_joined` | owners + supervisors (consider making `check_in/out` digest-only — high volume) |
| quote reviewed (reuses `request_decided`) | the workspace owner |

Needed: `expo-notifications` in the app; **`POST /api/mobile/devices`** `{ expoPushToken, platform,
deviceId }` (upsert on `MobileSession`) and removal on logout; in `notifyUser`/`notifySupervisors`
(additive, fire-and-forget, after the insert) send to the Expo push service with
`data: { kind, href, ticketId }`; prune tokens on `DeviceNotRegistered` receipts. Not implemented today:
"ticket starts in 10 min / you haven't checked in" reminders (would need a scheduler, e.g. Vercel Cron).
**Expo Go caveat:** remote push is not available in Expo Go on Android from SDK 53 — a development
build is needed (verify against the SDK you pin; see `stack.md`).

---

## 7. 🟢 Image URLs work as-is

DTOs return pictures through `servedUrl()` (`src/lib/storage/urls.ts:157-161`): the CDN when
`AWS_PUBLIC_BASE_URL` is set, else the bucket URL (`:38-42`). **Live today the page CSP lists only S3
bucket origins and no CDN origin** (probe of `GET /login`), which by `src/proxy.ts:46-68` means
`AWS_PUBLIC_BASE_URL` is not set in production yet — pictures are served straight from S3. Either form
loads in `expo-image` / `<Image>` (no CSP in native, plain HTTPS GET, no auth header). Objects carry
`Cache-Control: public, max-age=31536000, immutable` (`src/lib/storage/s3.ts:58`), which suits
`expo-image`'s disk cache. When the CDN is switched on, old links are rewritten server-side, so the app
must not persist image URLs as identities (compare by key/record, not URL string).

---

## 8. 🟢 Vercel environment (names only)

Referenced in `src/` (grep of `process.env.*`):
`MONGODB_URI`, `MONGODB_DB`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
`AWS_BUCKET_NAME`, `AWS_LEGACY_BUCKET_NAME`, `AWS_PUBLIC_BASE_URL`, `SUPER_ADMIN_EMAILS`,
`SUPER_ADMIN_BOOTSTRAP_TOKEN`, `NEXT_PUBLIC_ROOT_DOMAIN`, `TRUST_PROXY`, `RATE_LIMITS` (ignored in
production, `src/lib/security/rate-limit.ts:37-39`).

Read by Auth.js itself (not referenced in `src/`): `AUTH_SECRET` (required), `AUTH_URL`,
`AUTH_TRUST_HOST`. Live `GET /api/auth/providers` returns absolute URLs on `my-cms-ebon.vercel.app`, so
host resolution works in production today.

New for mobile (proposed): `EXPO_ACCESS_TOKEN` (optional, if push security is enabled);
`MOBILE_ACCESS_TTL_S` / `MOBILE_REFRESH_TTL_S` (optional tuning). Set `AWS_PUBLIC_BASE_URL` when the
CDN goes live. Check `TRUST_PROXY` (§5).

---

## 9. Other things that will bite a native client

1. **Tenant-host 404 rule.** Any `/api/*` on a host that parses as `<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>`
   answers 404 (`src/proxy.ts:116-117`, `src/lib/tenancy.ts:85-103`; auth and uploads repeat it,
   `src/app/api/auth/[...nextauth]/route.ts:29,34`, `src/app/api/uploads/route.ts:54,59,145`). Fine on
   `my-cms-ebon.vercel.app` today (live probes return 401/405, not 404). **When a custom domain is set**,
   `EXPO_PUBLIC_API_BASE_URL` must be the root domain or a reserved label such as `app.` / `api.`
   (`src/lib/tenancy.ts:22-49`) — never a tenant subdomain.
2. **Operation times are zone-less.** The operation dialog sends `YYYY-MM-DDTHH:MM` without an offset
   (`src/components/dashboard/operations/operation-dialog.tsx:129-137`) and the server does
   `new Date(values.startAt)` in its own zone (`src/app/api/operations/route.ts:91-92`; Vercel runs in
   UTC — not visible in code). The app should send ISO strings **with** an offset computed in the
   workspace zone; `Date.parse` accepts them (`src/lib/validations/operations.ts:40-50`).
3. **Ticket times must be UTC ISO** — `z.iso.datetime()` refuses offsets by default
   (`src/lib/validations/work.ts:36-37`); send `toISOString()`.
4. **Day keys are workspace-zone days** (`src/lib/time.ts`; `Asia/Kathmandu` default,
   `src/models/business.ts:104`). The app needs `business.timeZone` (`/api/me`, §3.1) and should use
   `Intl.DateTimeFormat(…, { timeZone })` — Hermes ships `Intl` with time-zone support in current Expo
   SDKs (verify for the pinned SDK).
5. **Notification/activity `href`s are web paths** (`/dashboard/tickets`, …) — the app maps them
   (`navigation.md` §5).
6. **Pages redirect, APIs don't.** Never call page routes from the app; the gate returns 307 to
   `/login` (live: `GET /dashboard` → 307).
7. **Page CSP / security headers** (`src/proxy.ts:70-87`, `next.config.ts:29-66`) only affect browsers;
   irrelevant to native. `Permissions-Policy: geolocation=(self)` is browser-only too.
8. **Cookies have no `Domain`** (host-only, `__Host-`/`__Secure-` prefixes) — irrelevant once Bearer is used.
9. **No offline support** on the server side (no idempotency keys). Check-in/out and status moves are
   guarded against double submits by state (`409 "You're already checked in…"`,
   `src/app/api/tickets/[id]/check-in/route.ts:72-78`), so a retry after a lost response is safe to
   treat 409 as success-ish; other creates (bills, payments, expenses) are **not** idempotent — an
   `Idempotency-Key` header would be needed before adding an offline queue.
10. **Supervisors can check in and raise requests via the API** (`requireRole("employee","supervisor")`,
    `check-in/route.ts:36`, `src/app/api/requests/route.ts:54`) but the web gives them no screen for it;
    decide whether the app exposes it.
