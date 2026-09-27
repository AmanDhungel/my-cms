# EMS API — every endpoint the mobile app will call

Base URL: **`https://my-cms-ebon.vercel.app`** (live). All paths below are relative to it.
Machine-readable companion: [`openapi.json`](./openapi.json) (generated from the Zod schemas by
[`tools/generate-openapi.mjs`](./tools/generate-openapi.mjs); re-run with
`node --experimental-strip-types --no-warnings docs/mobile/tools/generate-openapi.mjs`).

Totals: **65 route files → 102 callable operations** (97 app routes + 5 Auth.js operations; 8 route
files / 11 operations added on `feature/mobile-api`, §19). `GET /api/uploads` exists only to answer 405 and is not counted
(`src/app/api/uploads/route.ts:53-56`).

> Every claim cites `file:line` in this repo. Where the code can't settle something, it says so.

---

## 0. Conventions that apply to every route

### 0.1 Auth model — web cookies, plus Bearer tokens for the app (branch `feature/mobile-api`)

> **Mobile:** sign in with `POST /api/mobile/auth/login` (§19) and send `Authorization: Bearer
> <accessToken>` on every call. A request carrying that header is authenticated **by the token alone**
> (cookies ignored) and returns the same `SessionUser` to every route (`src/lib/auth/guards.ts:27-111`);
> a genuine token also replaces the Origin check on writes (§0.2). Everything below about cookies is
> the web path, unchanged. The super admin routes refuse Bearer (403).

- Auth.js v5, Credentials provider, **JWT session strategy** (`src/auth.config.ts:14-16`,
  `src/auth.ts:12-62`). The session lives in the cookie `__Secure-authjs.session-token` on
  HTTPS (`src/proxy.ts:99-106`; confirmed live: `GET /api/auth/csrf` sets
  `__Host-authjs.csrf-token` and `__Secure-authjs.callback-url`, both `HttpOnly; Secure; SameSite=Lax`).
- JWT claims: `sub`, `role`, `businessId`, `superAdmin`, `signedInAt` (`src/auth.config.ts:37-53`,
  `src/types/next-auth.d.ts:5-39`). No `session.maxAge` is configured, so Auth.js' own default
  applies (not set anywhere in `src/`).
- **Every guarded request re-reads the account and workspace from Mongo**
  (`src/lib/auth/guards.ts:24-68`): removed → 403 *"You are no longer part of this workspace"*
  (`:41-43`); account or workspace blocked → 403 *"This account has been blocked"* (`:45-47`);
  session signed in before `sessionsValidAfter` → 401 *"Sign in to continue"* (`:53-55`,
  `:88-91`). So role/business changes take effect on the next request, whatever the token says.
- Guards:
  - `requireUser()` — any active member (`src/lib/auth/guards.ts:24`).
  - `requireRole(...roles)` — 403 *"You don't have access to that"* otherwise (`:71-81`).
  - `requireSuperAdmin()` — email in `SUPER_ADMIN_EMAILS`, re-read from DB; deliberately ignores
    blocked/removed (`:103-123`, `src/lib/auth/super-admin.ts:9-27`).
- Roles: `owner | supervisor | employee` (`src/models/user.ts:19-20`). Super admin is not a role;
  it is an env allow-list.

### 0.2 The request pipeline (`src/proxy.ts`)

The proxy runs on every path except `api/auth/*`, `api/uploads`, static files
(`src/proxy.ts:203-205`). In order (`:112-184`):

1. **Tenant host** (`<slug>.<NEXT_PUBLIC_ROOT_DOMAIN>`) → any `/api/*` is **404** (`:117`). Not an
   issue for `my-cms-ebon.vercel.app` (live probes return 401/405, not 404).
2. **CSRF**: `POST|PUT|PATCH|DELETE` on `/api/*` must carry `Origin` (or `Referer`) whose host
   equals `x-forwarded-host`/`host` → else **403** *"Cross-origin requests aren't allowed"*
   (`src/lib/security/same-origin.ts:21-33`). `/api/uploads` repeats the check itself.
   **Exceptions (`feature/mobile-api`):** a request with a *genuine* Bearer access token skips it (a
   browser can't attach `Authorization` cross-site without a CORS preflight, and no CORS headers are
   ever sent); a write whose Bearer token is bad/expired is **401** *"Sign in to continue"* (so the
   app knows to refresh); `/api/mobile/auth/{login,refresh,logout}` are exempt (credential in the
   body, no cookie). Cookie requests keep the check.
3. **Rate limits** (`:124-140`): `/api/quote/*` → `publicPage` 120/min per IP; every other API
   mutation → `mutation` **300 per 10 min per session** (key = SHA-256 of the session cookie, or
   the IP when there is no cookie; **the user id for a genuine Bearer request**). Limits table: `src/lib/security/limits.ts:5-24`.
   Mongo-backed fixed windows (`src/lib/security/rate-limit.ts:45-78`); 429 carries `Retry-After`.
4. Pages only: auth gate for `/dashboard`, `/admin`, `/choose` → 307 to `/login?callbackUrl=…`
   (confirmed live for `/dashboard`).

### 0.3 Bodies

- JSON bodies go through `readJson` (`src/lib/api-response.ts:85-111`): **413** over 100 KiB
  (`MAX_JSON_BYTES`, `:77`), **400** *"Send a JSON body"* when empty, **400** *"That isn't valid
  JSON"*. Always send `Content-Type: application/json`.
- Zod objects **strip unknown keys** (no `.strict()` anywhere in `src/lib/validations/`).
- Dates: `dayKey` fields are `YYYY-MM-DD` in the **workspace time zone** (default
  `Asia/Kathmandu`, `src/models/business.ts:104`). Ticket `startAt/endAt` use `z.iso.datetime()`
  (`src/lib/validations/work.ts:36-37`) — Zod v4's default refuses offsets, so send
  `Date.prototype.toISOString()` (UTC `Z`).
- Numbers declared with `z.coerce.number()` accept numeric strings too.

### 0.4 Errors (one shape)

```ts
type ApiError = { error: string; fieldErrors?: Record<string, string[]> } // src/lib/api-response.ts:4-8
```

`handleApiError` (`src/lib/api-response.ts:50-74`) maps:

| Thrown | Status | Body |
|---|---|---|
| `HttpError(status, msg, fieldErrors?)` | that status | `{ error: msg, fieldErrors? }` (+ headers, e.g. `Retry-After`) |
| `ZodError` | **422** | `{ error: "Validation failed", fieldErrors: { "<path.joined.by.dots>": [msg] } }` (`:55-57`, `:113-120`) |
| Mongoose `CastError` (malformed id) | **404** | `{ error: "Not found" }` (`:61-63`) |
| Mongo duplicate key 11000 | **409** | `{ error: "That <field> is already taken", fieldErrors: { <field>: [...] } }` (`:65-70`) |
| anything else | **500** | `{ error: "Something went wrong" }` (`:72-73`) |

Exceptions: Auth.js credentials refusals are `{ error, url }`
(`src/app/api/auth/[...nextauth]/route.ts:46-50`); the site save stale 409 is
`{ error, code: "stale", updatedAt }` (`src/app/api/site/route.ts:51-60`).

**Shorthand used below**

- **G** (guard errors): 401 *"Sign in to continue"*, 403 removed / blocked / wrong role, 500.
- **M** (proxied mutation errors): 403 cross-origin, 429 `mutation` limit, 400/413 body, 422 Zod.
- **id-404**: malformed or foreign `{id}` → 404.

### 0.4b Version counters / sync

**No route bumps a version counter, because none exist**: there is no `/api/sync` (live `GET
/api/sync` → 404) and no version field on any model. The web refreshes by `invalidateQueries` after its
own writes and by 60 s notification polling (`src/lib/queries.ts:294-298,365-405`). The "side effects"
listed per endpoint below are therefore S3 writes/deletes, stock/ledger moves, activity-log rows and
notification rows. Proposal: `backend-gaps.md` §6.

### 0.5 Delete permission (one rule everywhere)

`src/lib/auth/permissions.ts:21-60`:

- **Owner deletes anything.** Supervisors and employees can **never delete a record** →
  403 *"Only the owner can delete this."* (`assertCanDeleteRecord`, `:40-44`). Every record
  `DELETE` route calls `requireUser()` then `assertCanDeleteRecord` — so a supervisor gets 403 (not
  a role 403 from `requireRole`).
- **Images**: a non-owner may remove only pictures **they uploaded**; an employee not even that on
  a **past ticket**; pictures with no recorded uploader are owner-only
  (`:25-34`). Saves that drop images call `assertCanRemoveImages` → 403 *"You can only remove
  pictures you added."* and nothing is saved (`:51-60`).

### 0.6 Pictures & storage

- Upload first (`POST /api/uploads`, multipart), then put the returned `url` into the record's
  JSON body. Keys: `businesses/{businessId}/{purpose}/{uuid}.{ext}`
  (`src/lib/storage/s3.ts:113-127`), `Cache-Control: public, max-age=31536000, immutable`
  (`:58`).
- Every DTO returns pictures through `servedUrl()` (`src/lib/storage/urls.ts:157-161`): the CDN
  (`AWS_PUBLIC_BASE_URL`) when configured, else the plain bucket URL (`:38-42`). **Live today the
  page CSP lists only the S3 bucket origins and no CDN** (probe of `GET /login`), i.e. production
  currently serves direct S3 URLs — `AWS_PUBLIC_BASE_URL` is apparently not set there (inferred
  from `src/proxy.ts:46-68`). Both forms load fine in React Native.

### 0.7 Shared response shapes (DTOs)

Referenced by name below; all nullable fields are `null`, never absent.

| DTO | Source |
|---|---|
| `TicketDTO` | `src/models/ticket.ts:200-250` (built by `toTicketDTO` `:267-340`; `myCheckedInAt` and `photos[].byMe` are per viewer) |
| `CheckInDTO` | `src/models/check-in.ts:57-68` |
| `AttendanceDTO` | `src/models/attendance.ts:110-135` |
| `UserDTO` | `src/models/user.ts:115-126` |
| `BusinessDTO` | `src/models/business.ts:140-158` |
| `InviteDTO` / `PendingInvite` | `src/models/invite.ts:66-75` / `src/lib/auth/invites.ts:6-17` |
| `WorkspaceInviteDTO` | `src/models/workspace-invite.ts:58-69` |
| `RequestDTO` | `src/models/request.ts:62-75` |
| `ProjectDTO` | `src/models/project.ts:41-48` |
| `NotificationDTO` | `src/models/notification.ts:47-55` |
| `ActivityDTO` | `src/models/activity.ts:73-86` |
| `BillDTO` (+`review`) | `src/models/bill.ts:186-251` |
| `PublicQuote` | `src/lib/quote-review.ts:17-50` |
| `CustomerDTO` | `src/models/customer.ts:52-63` |
| `PartyLedger` | `src/lib/ledger.ts:77-106` |
| `ExpenseDTO` | `src/models/expense.ts:117-143` |
| `CategoryDTO` / `ItemDTO` | `src/models/inventory-category.ts:34-39` / `src/models/inventory-item.ts:97-113` |
| `MaintenanceDTO` | `src/models/maintenance.ts:110-131` |
| `OperationDTO` | `src/models/operation.ts:93-109` |
| `PaymentDTO` / `AccountDTO` | `src/models/payment.ts:96-110` / `src/models/account.ts:69-86` |
| `ScheduleDTO` | `src/models/schedule.ts:53-61` |
| `SiteDTO` | `src/models/site.ts:183-223` |
| `ReportPayload` | `src/lib/reports.ts:323-357` |
| `WeekPattern` | `src/lib/week.ts:15-28` (7 × `{kind:"work"|"off", startTime, endTime}`, Monday first) |

`TicketDTO` in full, because the crew app lives on it:

```ts
{
  id, title, description: string|null, site, lat, lng, radiusM,
  startAt, endAt,                                  // ISO
  status: "pending"|"in_progress"|"in_review"|"blocked"|"done"|"cancelled",
  priority: "normal"|"high"|"critical",
  blockedReason: string|null,
  blocker: { reason: BlockerReason|null, note, needs: {name, qty, unit}[], raisedAt } | null, // only while raised
  materials: { itemId, name, unit, qty, unitCost, total }[], materialsTotal,
  onSite: { id, name, at }[],                      // everyone checked in right now
  myCheckedInAt: string|null,                      // THIS viewer's open check-in → Check in / Check out button
  checkedOutAt: string|null,
  assignees: { id, name }[], project: { id, name } | null,
  photos: { url, uploadedById, uploadedByName, uploadedAt, byMe }[]
}
```

---

## 1. Auth (Auth.js built-ins) — `src/app/api/auth/[...nextauth]/route.ts`

Not in the proxy matcher (`src/proxy.ts:204`): no Origin check, no `mutation` limit. Tenant hosts
get 404 (`route.ts:28-31`, `:33-34`).

### 1.1 `GET /api/auth/csrf`
- Public. Returns `{ csrfToken }` and sets `__Host-authjs.csrf-token` (confirmed live).
- Example → `200 {"csrfToken":"9f1c…"}`

### 1.2 `GET /api/auth/session`
- Public. `null` when signed out (confirmed live), else
  `{ user: { id, name, email, role, businessId, superAdmin, signedInAt }, expires }`
  (`src/auth.config.ts:46-53`).
- Example → `200 {"user":{"id":"66f1…a1","name":"Asha Rai","email":"asha@example.com","role":"employee","businessId":"66f0…b2","superAdmin":false,"signedInAt":1790000000000},"expires":"2026-10-27T08:00:00.000Z"}`

### 1.3 `GET /api/auth/providers`
- Public. Live answer: `{"credentials":{"id":"credentials","name":"Credentials","type":"credentials","signinUrl":"https://my-cms-ebon.vercel.app/api/auth/signin/credentials","callbackUrl":"https://my-cms-ebon.vercel.app/api/auth/callback/credentials"}}`.
  The absolute URLs show Auth.js resolves its own URL to the live host.

### 1.4 `POST /api/auth/callback/credentials` — sign in
- Public. Body `application/x-www-form-urlencoded` (or JSON, `route.ts:82-92`):
  `csrfToken` (from 1.1, must match the cookie), `email`, `password`, optional `callbackUrl`,
  `redirect`.
- Pre-checks (`route.ts:52-67`): non-string email/password → **422** `{error:"Validation failed",url}`;
  body > 16 KiB treated as invalid (`:84`); **429** when `loginEmail` 5/15 min per email or `loginIp`
  20/15 min per IP is exceeded (`src/lib/security/limits.ts:7-9`), `Retry-After` set.
- `authorize` (`src/auth.ts:20-59`): email via `credentialsSchema` (`src/lib/validations/auth.ts:73-76`),
  bcrypt compare (cost 12, `src/lib/auth/password.ts:4-15`) always runs; refuses unknown email,
  wrong password, `status:"removed"`, blocked account, blocked workspace — **all as the same
  generic failure** (Auth.js redirect to `/login?error=CredentialsSignin`).
- Success: `Set-Cookie: __Secure-authjs.session-token=…` (the route treats that cookie as the only
  success signal, `route.ts:72-78`).
- Side effects: activity `login_succeeded` / `login_failed` / `login_rate_limited` for known
  accounts (`route.ts:65,77`, `:104-118`).
- **Mobile note:** this is a browser-cookie flow; the proposed token login replaces it
  (`backend-gaps.md` §1).

### 1.5 `POST /api/auth/signout`
- Form `csrfToken`, optional `callbackUrl`; clears the session cookie. With a stateless JWT there is
  **no server-side revocation** — the only kill switches are block/remove/`sessionsValidAfter`
  (`src/lib/auth/guards.ts:41-55`).

---

## 2. Onboarding (public)

### 2.1 `POST /api/register` — open a workspace
- Public, `src/app/api/register/route.ts:38-168`. Rate limit `register` 5/hour per IP (`:41`) +
  proxy `mutation` (per IP, no cookie) + proxy Origin check.
- Body `signupSchema` (`src/lib/validations/auth.ts:137-160`): `invite?` string (the super admin
  token), `bootstrapToken?` ≤200, `business` ≥2, `name` ≥2, `phone` ≥7, `email` email,
  `password` ≥10, `crewSize` `"1–10"|"11–50"|"50+"` (`:86`), `office?` `{lat, lng, label?≤200}`,
  `terms` must be `true`.
- 201 `{ user: UserDTO, business: BusinessDTO }` (`:164`).
- Errors: 403 *"Opening a workspace needs an invite link"* (`:56-58`); 403 reserved super-admin
  address (`:62-64`); 404 *"That invite link is no longer valid"* (`:75-82`); 409 invite addressed
  to someone else (`:85-90`); 409 *"already been used"* (`:121-123`); 409 duplicate email (unique
  index → `handleApiError`); M.
- Side effects: transaction creates User(owner) + Business, claims WorkspaceInvite (`:100-154`).
- Mobile: **WEB-ONLY recommended** (super-admin invite link flow). Example →
  `{"invite":"tok_x","business":"Balaju Electric","name":"Ram K","phone":"9800000000","email":"ram@example.com","password":"correct horse 1","crewSize":"1–10","terms":true}` →
  `201 {"user":{…},"business":{…}}`

### 2.2 `GET /api/invites/{token}` — who a crew invite is for
- Public, `src/app/api/invites/[token]/route.ts:7-17`; `findPendingInvite`
  (`src/lib/auth/invites.ts:23-52`).
- 200 `{ invite: PendingInvite }`; 404 *"That invite link is no longer valid"* for
  spent/expired/unknown (`:30-38`, confirmed live).
- Example → `200 {"invite":{"id":"…","name":"Asha Rai","email":"asha@example.com","phone":"98…","role":"employee","shift":"09:00–17:00","message":null,"businessId":"…","businessName":"Balaju Electric","expiresAt":"2026-10-04T…Z"}}`

### 2.3 `POST /api/invites/{token}/accept` — join
- Public, `src/app/api/invites/[token]/accept/route.ts:22-126`. Rate limit `inviteAccept` 5/hour per
  IP (`:28`) + proxy Origin check + `mutation`.
- Body `acceptInviteSchema` (`src/lib/validations/auth.ts:182-187`): `password` ≥10, `terms: true`.
- 201 `{ user: UserDTO }` (`:122`). **Does not sign in**; the client must then log in.
- Errors: 404 invalid token; 403 super-admin address (`:33-35`); 409 *"That email already has an
  account"* (`:45-47`, `:88-90`); 409 *"That invite has already been used"* (`:63-65`); M.
- Side effects: creates or re-adopts the user (adopting sets `sessionsValidAfter`, `:84`); activity
  `member_joined` (`:102-112`); notification `member_joined` to owners+supervisors (`:114-120`).
- Example → `{"password":"a-long-pass-123","terms":true}` → `201 {"user":{…,"role":"employee"}}`

---

## 3. Uploads — `src/app/api/uploads/route.ts`

Outside the proxy matcher (so the handler sees headers before the body); does its own tenant 404,
Origin check and rate limit.

### 3.1 `POST /api/uploads` — one picture
- Roles: all (`:63`), per purpose (`:27-31`):
  owner `site|maintenance|ticket|products|logo`; supervisor `maintenance|ticket|products`;
  employee `ticket`. Wrong purpose for role → 403 *"You can't add pictures there"* (`:86-88`).
- **multipart/form-data** fields: `purpose` (one of the five, else 400 `:80-82`) and `file`
  (else 400 *"No file was sent"* `:89-91`). RN: `form.append("file", { uri, name, type } as any)`.
- Size gates (`src/lib/storage/http.ts`): a declared `Content-Length` > 1,000,000 + 64 KiB → **413**
  before reading; then the body is read with a running byte count and abandoned with **413** the
  moment it passes that cap — **no `Content-Length` is needed** (the old 411 rule is gone on
  `feature/mobile-api`, so chunked multipart from React Native works). File > 1,000,000 bytes → 413
  *"Pictures are compressed under 1 MB before uploading"* (`MAX_UPLOAD_BYTES`
  `src/lib/storage/types.ts:18`).
- Type by magic bytes, not the declared type: JPEG/PNG/WebP/AVIF else **415** *"Images only —
  JPEG, PNG, WebP or AVIF"* (`:109-112`, `src/lib/storage/types.ts:24-29`).
- 201 `{ key, url }` (`:123`). Non-multipart body → **410** *"Uploads now go through the form
  upload"* (`:126`). Storage unconfigured → **503** (`src/lib/storage/s3.ts:74-79`).
- Rate limit: `uploads` 60 / 10 min **per user** (`:64`). Not subject to `mutation`.
- Side effects: S3 `PutObject` to `businesses/{businessId}/{purpose}/{uuid}.{ext}`, uploader id in
  object metadata (`:114-121`).
- Example → multipart `purpose=ticket`, `file=<photo.jpg 612 KB>` →
  `201 {"key":"businesses/66f0…/ticket/2b1e….jpg","url":"https://<bucket>.s3.<region>.amazonaws.com/businesses/66f0…/ticket/2b1e….jpg"}`

### 3.2 `DELETE /api/uploads` — tidy orphaned uploads
- Roles: all (`:148`). Body `deleteUploadSchema` (`src/lib/validations/uploads.ts:40-42`):
  `urls: string[]` (safe http(s), ≤600 chars each, ≤50).
- Only keys under the caller's workspace are considered (`:156-159`). **Own-images rule**: owner
  may delete any; others only if every record referencing it records them as uploader (employee not
  on a past ticket), or — for an unreferenced fresh upload — the object metadata names them
  (`:171-192`).
- 200 `{ deleted, refused }` (`:208`). Errors: G, 403 cross-origin, 413, 422.
- Side effects: S3 delete; activity `image_deleted` for pictures a record pointed at (`:197-206`).
- Mobile: call after a failed save or when the user discards a draft with fresh uploads.

---

## 4. Tickets

### 4.1 `GET /api/tickets`
- `requireUser` (`src/app/api/tickets/route.ts:36`). **Employees only ever get their own**
  (`:45-47`).
- Query: `scope` = `today|in_progress|in_review|upcoming|done|all|mine` (default `all`, `:19-27`,
  `:185-187`); `assigneeId` (owner/supervisor only, `:48-51`); `projectId` (`:54-57`).
  `today` = window overlaps today in the workspace zone, not cancelled (`:64-73`,
  `src/lib/ticket-window.ts:82-84`); `upcoming` = starts ≥ now and pending/in_progress/blocked
  (`:80-83`); `done` = done|cancelled.
- 200 `{ tickets: TicketDTO[] }`, max 200 (`:87-95`), sorted `startAt` asc (desc for `done`/`mine`).
- Errors: G.
- Example → `GET /api/tickets?scope=mine` → `200 {"tickets":[{"id":"…","title":"Fix DB panel","site":"Balaju Chowk","lat":27.73,"lng":85.30,"radiusM":50,"status":"pending","myCheckedInAt":null,…}]}`

### 4.2 `POST /api/tickets`
- `requireRole("owner","supervisor")` (`:104`). Body `ticketSchema`
  (`src/lib/validations/work.ts:15-47`): `title` 2–140, `description?` ≤2000, `site` 2–160,
  `lat` −90..90, `lng` −180..180, `radiusM` int 10–5000, `projectId` ObjectId, `startAt`/`endAt`
  ISO datetime (UTC), `assigneeIds` 1–20 ObjectIds, `priority` `normal|high|critical`;
  refine `endAt > startAt`.
- 201 `{ ticket: TicketDTO }` (`:179`).
- Errors: M; 422 *"Someone on that list isn't in this workspace"* (`src/lib/tickets.ts:43-45`);
  422 *"That project isn't in this workspace"* / *"That project is archived"* (`:119-125`).
- Side effects: activity `ticket_created`; notification `ticket_assigned` to every assignee except
  the creator (`:149-177`).
- Example → `{"title":"Fix DB panel","site":"Balaju Chowk","lat":27.7352,"lng":85.3043,"radiusM":50,"projectId":"66f2…","startAt":"2026-09-28T03:15:00.000Z","endAt":"2026-09-28T09:15:00.000Z","assigneeIds":["66f1…a1"],"priority":"high"}` → `201 {"ticket":{…,"status":"pending"}}`

### 4.3 `GET /api/tickets/{id}`
- `requireUser` (`src/app/api/tickets/[id]/route.ts:20`); `loadTicketForViewer` scopes employees to
  their own (`src/lib/tickets.ts:10-27`) → foreign/unknown **404** *"That ticket doesn't exist"*.
- 200 `{ ticket: TicketDTO, history: CheckInDTO[] }` (last 50, newest first, `:31-36`).
- Errors: G, id-404.

### 4.4 `PATCH /api/tickets/{id}` — edit terms
- `requireRole("owner","supervisor")` (`:51`); same `ticketSchema` (full body).
- 200 `{ ticket }`. Errors: M, id-404; 409 *"That ticket is closed. Reopen it to make changes"*
  (done/cancelled, `:59-61`); 422 project/crew as 4.2; 409 *"Someone you're removing is checked in.
  They have to check out first"* (`:81-90`).
- Side effects: activity `ticket_updated`; `ticket_assigned` to newly added people only (`:122-138`).

### 4.5 `PATCH /api/tickets/{id}/status` — move a ticket
- `requireUser` (`src/app/api/tickets/[id]/status/route.ts:50`). Body `ticketStatusSchema`
  (`src/lib/validations/work.ts:79-142`): `status` `pending|in_progress|in_review|blocked|done`;
  `blockedReason?` ≤500 (required ≥3 when blocked); `blockerReason?`
  `material|equipment|access|client|weather|permit|payment|other`; `blockerNote?` ≤800;
  `needs?` ≤15 × `{name 1–140, qty? 0..1e6, unit? ≤12}`; `photos?` ≤5 × `{url}`;
  `overtimeReason?` 3–500 (empty string = absent).
- Rules, in order: cancelled → 409 (`:58-60`); **employee on a past ticket → 403**
  *"This ticket is finished, so it's view-only now. Ask your owner if it needs reopening."*
  (`:66-71`, `src/lib/ticket-window.ts:35-38,74-75`); employee may set only
  `in_progress|blocked|in_review` → 403 (*"Send it for review — your owner signs work off"* for
  done, `:36-40`, `:75-82`); same status → 409 *"That ticket is already …"* (`:84-86`).
- **Completion photos (employee only):** the list is the sender's own photos in order (kept by URL,
  new ones as just uploaded with purpose `ticket`); >5 → 422 `photos`; another's photo → 422
  *"That photo was added by someone else"*; not this workspace's ticket picture → 422; used on
  another ticket → 422; **`in_review` with zero photos → 422 *"Add at least one photo of the
  finished work"*** (`:97-140`, `MAX_TICKET_PHOTOS_EACH = 5` `src/models/ticket.ts:67`).
- Moving to `in_review`/`done` while checked in **closes the actor's visit** (check-out) → if after
  shift end / rest day and no `overtimeReason` → **422** `fieldErrors.overtimeReason`
  *"You're outside your shift. Say why you're working now."* (`:171-227`,
  `src/lib/overtime.ts:75-76`).
- 200 `{ ticket }`. Side effects: dropped own photos deleted from S3 after save (`:231`); blocker
  raised/cleared (`:155-166`); attendance `markDeparture`; activity `ticket_status`;
  notifications (`:263-325`): `blocked` → owners+supervisors `ticket_blocked` (body lists
  shortages); `in_review` → `ticket_in_review`; `done` by reviewer → each assignee `ticket_done`;
  `done` by non-reviewer → owners+supervisors.
- Example → `{"status":"in_review","photos":[{"url":"https://…/ticket/a.jpg"}]}` → `200 {"ticket":{…,"status":"in_review"}}`

### 4.6 `POST /api/tickets/{id}/check-in`
- `requireRole("employee","supervisor")` (owners cannot check in) (`src/app/api/tickets/[id]/check-in/route.ts:36`).
  Rate limit `checkIn` 30 / 10 min per user (`:37`) + `mutation`.
- Body `checkInSchema` (`src/lib/validations/work.ts:56-74`): `lat`, `lng` (numbers, **not**
  coerced), `accuracyM?` 0–100000, `reason?` ≤500, `overtimeReason?` 3–500.
- Rules: employee on past ticket → 403 (`:48-53`); done/cancelled → 409 *"That ticket is already
  closed"* (`:55-57`); **before `startAt − 10 min` → 409** *"Check-in opens at HH:MM, 10 minutes
  before the ticket starts"* (`:61-68`, `CHECK_IN_OPENS_MIN = 10` `src/lib/work-constants.ts:76`);
  already checked in → 409 (`:72-78`).
- **Geofence is decided on the server**: haversine distance vs `ticket.radiusM`
  (default 50 m, `src/lib/work-constants.ts:26`; `src/lib/geo.ts:2-19`). Outside and no `reason` →
  **422** `fieldErrors.reason` *"You're outside the 50 m check-in area. A reason is required."*,
  top-level *"You're 180 m from <site>. Say why before checking in."*; overtime and no
  `overtimeReason` → 422 `fieldErrors.overtimeReason` — both asked at once (`:96-114`).
  **`accuracyM` is stored but not used in the decision** (`:80-84`, `:116-131`).
- 201 `{ ticket, checkIn: CheckInDTO, attendance: AttendanceDTO }` (`:187-193`).
- Side effects: CheckIn row; ticket `pending|blocked → in_progress` (`:134-137`); attendance
  `markArrival` (derived); activity `ticket_checked_in`; notify owners+supervisors `check_in`.
- Example → `{"lat":27.7353,"lng":85.3041,"accuracyM":12}` → `201 {"ticket":{…,"status":"in_progress","myCheckedInAt":"…"},"checkIn":{"type":"in","distanceM":23,"insideFence":true,…},"attendance":{…}}`

### 4.7 `POST /api/tickets/{id}/check-out`
- Same guard/limits (`src/app/api/tickets/[id]/check-out/route.ts:31-32`), same body.
- Not checked in → 409 *"You aren't checked in to this ticket"* (`:45-47`). **No past-ticket
  check and no fence reason required** (reason only stored when outside, `:93`). After shift end /
  rest day without `overtimeReason` → 422 (`:68-73`).
- 201 `{ ticket, checkIn, attendance }`. Status is **not** changed (`:22-25`).
- Side effects: CheckIn row; attendance `markDeparture` (+ overtime minutes); activity
  `ticket_checked_out`; notify owners+supervisors `check_out`.

### 4.8 `PUT /api/tickets/{id}/materials`
- `requireUser` (`src/app/api/tickets/[id]/materials/route.ts:34`); employee must be an assignee
  (403 *"That isn't one of your tickets"* `:49-51`) and not on a past ticket (403 `:52-57`).
- Body `ticketMaterialsSchema` (`src/lib/validations/work.ts:230-253`): `materials` ≤40 ×
  `{itemId?, name 1–140, unit ≤12 (default "pcs"), qty > 0, unitCost ≥0 (default 0)}` — the whole
  list each time. Lines with `itemId` take name/unit/cost from the item (`:59-85`); unknown item →
  404 (`:75-77`).
- 200 `{ ticket }`. Does **not** move stock (`:16-27`). Activity `ticket_updated`.

---

## 5. Attendance

### 5.1 `GET /api/attendance` — a month
- `requireUser` (`src/app/api/attendance/route.ts:32`). Employees: always themselves;
  owner/supervisor may pass `userId` (404 if not in workspace, `:42-52`).
- Query `month` `YYYY-MM` (default current, `:224-226`).
- 200 `{ month, today, timeZone, week: WeekPattern|null, days: AttendanceDTO[], summary:{present,late,leave,absent} }` (`:73-86`).
- Side effect: closes finished shifts first (`:57-61`).

### 5.2 `POST /api/attendance` — start / end shift
- `requireUser` (`:95`). Body `attendanceActionSchema` (`src/lib/validations/work.ts:151-158`):
  `action` `start|end`, `lat?`, `lng?`, `accuracyM?`, `reason?` (`wfh|site_visit|client_meeting|field_work|delivery|travel|training|other`), `note?` ≤500.
- **Office geofence** (only when the workspace pinned an office, `:113-140`): `start` without
  lat/lng → **400** *"Share your location to start your shift — …"*; distance ≤ `radiusM` (default
  100 m) = `office`, ≤ `awayRadiusM` (default 300 m) = `near`, beyond = `away` and **needs
  `reason` → 409** *"You are 4.2 km from the office. Say why you are starting from here."*
  (`src/lib/office.ts:41-55`, `src/lib/work-constants.ts:235-236`).
- 409 *"Your shift is already started"* / *"Start your shift before ending it"* / *"Your shift is
  already ended"* (`:148-158`).
- 201 `{ attendance: AttendanceDTO }` (`:217`). Activity `shift_started|shift_ended`.
- Example → `{"action":"start","lat":27.71,"lng":85.32,"accuracyM":15}` → `201 {"attendance":{"day":"2026-09-27","inAt":"…","status":"present","inPlace":"office",…}}`

### 5.3 `GET /api/attendance/crew` — a day, everyone
- `requireRole("owner","supervisor")` (`src/app/api/attendance/crew/route.ts:25`). Query `day`.
- 200 `{ day, today, timeZone, rows:[{ user:{id,name,role,shift,removed,resting,week}, attendance: AttendanceDTO|null }], summary:{crew,present,resting,absent,late,leave,away,stillIn} }` (`:83-102`).

### 5.4 `GET /api/attendance/visits` — a day of ticket visits
- `requireRole("owner","supervisor")` (`src/app/api/attendance/visits/route.ts:23`). Query `day`.
- 200 `{ day, today, timeZone, visits:[{id,type,at,user:{id,name},ticket:{id,title,site},lat,lng,accuracyM,distanceM,insideFence,reason}], summary:{total,arrivals,departures,outside,people} }` (max 500, `:37`, `:62-73`).

---

## 6. Requests (leave / advance / material)

### 6.1 `GET /api/requests`
- `requireUser` (`src/app/api/requests/route.ts:17`); employees see their own (`:22-24`). Query
  `status` `pending|approved|rejected`.
- 200 `{ requests: RequestDTO[], counts:{pending,approved,rejected} }` (max 200, `:31-45`).

### 6.2 `POST /api/requests`
- `requireRole("employee","supervisor")` (`:54`). Body `requestSchemaChecked`
  (`src/lib/validations/work.ts:162-194`), discriminated on `kind`:
  - `leave`: `message` 3–1000, `startDate`, `endDate` (dayKeys, end ≥ start);
  - `advance`: `message`, `amount` > 0 ≤ 10,000,000;
  - `material`: `message`, `ticketId?` (must be visible to the viewer, else 404, `:60-64`).
- 409 *"You already have a leave request waiting for a decision"* — one pending per kind (`:68-79`).
- 201 `{ request: RequestDTO }`. Activity `request_raised`; notify owners+supervisors `request_raised`.
- Example → `{"kind":"leave","message":"Family wedding","startDate":"2026-10-02","endDate":"2026-10-03"}` → `201 {"request":{…,"status":"pending"}}`

### 6.3 `PATCH /api/requests/{id}` — decide
- `requireRole("owner")` (`src/app/api/requests/[id]/route.ts:25`). Body `requestDecisionSchema`
  (`src/lib/validations/work.ts:197-200`): `status` `approved|rejected`, `decisionNote?` ≤500.
- 409 *"That request was already approved"* / 404 (`:46-54`).
- Side effects: **approved leave writes `status:"leave"` attendance rows** for each day (max 366,
  `:96-139`); activity `request_decided`; notify requester `request_decided` (`:76-84`).

---

## 7. Projects

### 7.1 `GET /api/projects` — `requireUser` (employees read too) (`src/app/api/projects/route.ts:19`).
Query `status` `active|archived`. 200 `{ projects: (ProjectDTO & {tickets:{total,open,blocked,done}})[] }` (max 200, `:45-59`).

### 7.2 `POST /api/projects` — `requireRole("owner","supervisor")` (`:68`). Body `projectSchema`
(`src/lib/validations/work.ts:205-209`): `name` 2–140, `description?` ≤2000, `site?` ≤160.
201 `{ project }`. Duplicate name → 409 via unique index (`src/models/project.ts:33`). Activity `project_created`.

### 7.3 `PATCH /api/projects/{id}` — `requireRole("owner","supervisor")`
(`src/app/api/projects/[id]/route.ts:20`). Body `projectUpdateSchema` = `{status:"active"|"archived"}`
**or** the full `projectSchema` (`src/lib/validations/work.ts:217-220`). 409 *"That project is already
archived"* (`:34-36`); 404. **Archiving cancels its pending tickets** (`:43-48`). Projects are never
deleted (`:11-14`). Activity `project_archived|project_reopened|project_updated`.

---

## 8. People, invites, workspace settings

### 8.1 `GET /api/people` — `requireRole("owner","supervisor")` (`src/app/api/people/route.ts:11`).
Query `includeRemoved=1`. 200 `{ members: UserDTO[] }` sorted status, name (`:19-24`).

### 8.2 `PATCH /api/people/{id}` — `requireRole("owner")` (`src/app/api/people/[id]/route.ts:20`).
Body `memberUpdateSchema` (`src/lib/validations/auth.ts:219-234`): `name` ≥2, `phone` ≥7, `role`,
`shiftStart?`/`shiftEnd?` `HH:MM` (end > start), `week?` WeekPattern | null (null = follow the workspace).
404 removed/unknown (`:31-33`); 409 owner can't change own role / one owner only (`:37-43`).
200 `{ member }`. Activity `member_updated` (+ `role_changed`).

### 8.3 `DELETE /api/people/{id}` — `requireUser` + `assertCanDeleteRecord` (owner only)
(`:107-109`). 409 already removed / yourself / the workspace owner / still checked in somewhere
(`:123-144`). 200 `{ member, cancelledTickets }`. Soft delete: `status:"removed"`, their **pending
tickets are cancelled** (`:146-155`). Activity `member_removed`.

### 8.4 `GET /api/invites` — `requireRole("owner","supervisor")` (`src/app/api/invites/route.ts:23-37`;
widened on `feature/mobile-api` to match the People page, which already shows supervisors this list).
200 `{ invites: InviteDTO[] }` (unaccepted, newest first).

### 8.5 `POST /api/invites` — `requireRole("owner")` (`:41`). Body `inviteSchema`
(`src/lib/validations/auth.ts:165-177`): `name` ≥2, `email`, `phone` ≥7, `role` `employee|supervisor`,
`shiftStart`, `shiftEnd` (`HH:MM`, end > start), `message?` ≤500. 422 super-admin email (`:45-49`);
409 *"Someone already signs in with that email"* (`:55-59`). Re-inviting replaces the unaccepted
invite (`:61-67`). 201 `{ invite, joinUrl }` — **`joinUrl` = `https://my-cms-ebon.vercel.app/join/<token>`,
shown once, TTL 7 days** (`:84-90`, `src/models/invite.ts:15`). No email/SMS is sent anywhere
(`src/lib/validations/review.ts:3-9` states the same for quotes; no mailer exists in `src/`).

### 8.6 `PATCH /api/business` — `requireRole("owner")` (`src/app/api/business/route.ts:15`).
Body `businessSettingsSchema` (`src/lib/validations/auth.ts:192-214`): `name` ≥2, `crewSize`,
`timeZone` (valid IANA), `pan?` ≤30, `vatRate` 0–100, `office?` `{lat,lng,label?,radiusM 20–5000,
awayRadiusM 20–20000 ≥ radiusM}` | `null` (clears), `week?` WeekPattern | `null`, `logo?`
`{url}` | `null` (absent = unchanged). Logo URL must be this workspace's `logo` upload → 400
*"That picture isn't one of ours"* (`:26-33`). 200 `{ business: BusinessDTO }`. Replaced logo deleted
from S3 after save (`:80-86`); activity `logo_changed`. **There is no `GET /api/business`**
(live: 405) — see gaps.

---

## 9. Notifications & activity

### 9.1 `GET /api/notifications` — `requireUser` (`src/app/api/notifications/route.ts:14`).
`?count=1` → `{ unread }` (the web badge polls this, `:19-28`); `?unread=1` → unread only; else
`{ notifications: NotificationDTO[] (≤100, newest first), unread }` (`:39-48`).
Kinds: `check_in|check_out|ticket_blocked|ticket_in_review|ticket_done|ticket_assigned|request_raised|request_decided|member_joined`
(`src/lib/work-constants.ts:59-69`). `href` is a **web path** (e.g. `/dashboard/tickets`) — map it
in the app (`navigation.md` §5).

### 9.2 `POST /api/notifications` — mark read. Body `{ id? }` (24-hex; empty/absent = all,
`:55-60`, `:67-71`). 200 `{ marked, unread }`.

### 9.3 `GET /api/activity` — `requireRole("owner")` (`src/app/api/activity/route.ts:22`). Query
`day`. 200 `{ day, today, timeZone, entries: ActivityDTO[] (≤500), summary:{total,people} }`.

---

## 10. Operations (meetings, installations, follow-ups, deadlines), calendar, schedules

### 10.1 `GET /api/operations` — `requireRole("owner","supervisor")` (`src/app/api/operations/route.ts:32`).
Query `kind` `meeting|installation|follow_up|deadline`, `status` `scheduled|done|cancelled`, `from`, `to`
(ISO; `startAt` window). 200 `{ operations: OperationDTO[] }` (≤500).

### 10.2 `POST /api/operations` — same roles (`:71`). Body `operationSchema`
(`src/lib/validations/operations.ts:22-50`): `kind`, `title` 2–160, `details?` ≤2000, `startAt`
(any `Date.parse`-able string), `endAt?` (> startAt), `allDay` bool, `status`, `priority`,
`assigneeIds` ≤20, `customerId?`/`projectId?` (`""` or ObjectId), `location?` ≤200. 422 for foreign
crew/customer/project (`src/lib/operations-server.ts:23-43`). 201 `{ operation }`. Activity `operation_created`.

### 10.3 `PATCH /api/operations/{id}` — same roles (`src/app/api/operations/[id]/route.ts:28`).
A body of exactly `{status}` flips state (409 if unchanged, `:47-76`); otherwise the full
`operationSchema` (`:78-119`). 200 `{ operation }`.

### 10.4 `DELETE /api/operations/{id}` — owner only (`:130-132`). 200 `{ id }`. Activity `operation_deleted`.

### 10.5 `GET /api/calendar` — `requireRole("owner","supervisor")` (`src/app/api/calendar/route.ts:23`).
Query `month`. 200 `{ month, today, timeZone, items:[{id,source:"operation"|"ticket",kind,title,day,startAt,endAt,allDay,status,priority,people:string[],where}], summary }` (`:60-107`).

### 10.6 `GET /api/schedules` — `requireRole("owner","supervisor")` (`src/app/api/schedules/route.ts:23`).
Query `from` (week start `YYYY-MM-DD`). 200 `{ from, days[7], today, timeZone, crew:[{id,name,role,shift,week}], entries: ScheduleDTO[] }`.

### 10.7 `POST /api/schedules` — upsert one person-day (`:67-124`). Body `scheduleSchema`
(`src/lib/validations/operations.ts:63-101`): `userId`, `day`, `kind` `work|off|leave|training|overtime`,
`startTime?`/`endTime?` `HH:MM` (required and ordered unless off/leave), `note?` ≤300. 422 not in
workspace, 409 removed member (`:79-82`). 201 `{ entry }`.

### 10.8 `DELETE /api/schedules/{id}` — owner only (`src/app/api/schedules/[id]/route.ts:20-22`). 200 `{ id }`.

---

## 11. Sales: bills, quotations, customers

### 11.1 `GET /api/bills` — `requireRole("owner","supervisor")` (`src/app/api/bills/route.ts:19`).
200 `{ bills: BillDTO[] }` (≤200, newest first; `paid`/`due` from the payments ledger, `:22-31`).
**There is no `GET /api/bills/{id}`** — see gaps.

### 11.2 `POST /api/bills` — same roles (`:45`). Body `billSchema` (`src/lib/validations/sales.ts:30-64`):
`source` `custom|inventory`, `customerId?`, `customer:{name 2–140, phone?≤30, email?, address?≤200, pan?≤30}`,
`lines` 1–60 × `{itemId?, name 1–140, unit?≤16, price 0..1e8, qty >0..1e6, discountPct 0–100}`
(inventory: every line needs `itemId`, price taken from stock), `withVat` bool (uses workspace
`vatRate`), `payment` `paid|unpaid|cheque|quotation` (default unpaid), `chequeNo?` ≤40, `note?` ≤500.
Errors: 404 item gone (`:78-80`); 409 insufficient stock (`:104-112`) or stock moved (`:148-153`).
201 `{ bill }`. Side effects: `Business.billSeq` `$inc` → `BILL-0007` (`:132-138`); stock decremented
unless quotation (`:95-102`, `:140-154`).

### 11.3 `PATCH /api/bills/{id}` — same roles (`src/app/api/bills/[id]/route.ts:27`). Body
`billUpdateSchema` (`src/lib/validations/sales.ts:72-78`): `{status:"void"}` **or**
`{payment, chequeNo?}`. Moving between quotation and a sale moves stock (409 if short, `:61-94`);
void returns stock (`:136-145`); 404 / 409 already void (`:125-133`). Bills are never deleted.

### 11.4 `POST /api/bills/{id}/review` — share a quotation. Roles owner, supervisor
(`src/app/api/bills/[id]/review/route.ts:40`). Body `inviteReviewSchema`
(`src/lib/validations/review.ts:11-25`): `invitedTo` (email or phone, 3–160), `days` int 1–90
(default 30). 409 not a quotation (`:21-23`). 200 `{ bill, url }` — **`url` =
`https://my-cms-ebon.vercel.app/quote/<token>`**, fresh token each time (`:53-86`). Activity `quote_shared`.

### 11.5 `DELETE /api/bills/{id}/review` — revoke. Owner only (`:98-100`). 409 *"That quotation
hasn't been shared"* (`:106-108`). 200 `{ bill }`. Activity `quote_revoked`.

### 11.6 `GET /api/quote/{token}` — **public**, the client's view (`src/app/api/quote/[token]/route.ts:20-33`).
Rate limit `publicPage` 120/min per IP. 200 `{ quote: PublicQuote }`; 404 *"This link is no longer
good"* for unknown/short(<16)/revoked/expired/not-a-quotation/blocked workspace
(`src/lib/quote-review.ts:53-75`; confirmed live).

### 11.7 `POST /api/quote/{token}` — client remark/decision (public, `:42-131`). Body
`clientReviewSchema` (`src/lib/validations/review.ts:36-57`): `clientName?` ≤140, `remark?` ≤1500,
`lineIndex?` 0–500 (must exist, else 400 `:57-62`), `decision?` `approved|changes_requested`;
remark or decision required. **Proxy Origin check applies** (it is under `/api/`). 200
`{ quote }`. Notifies the owner (kind `request_decided`, `:92-106`); activity `quote_reviewed`.
Mobile: **WEB-ONLY** (the client isn't an app user).

### 11.8 Customers (parties)
- `GET /api/customers` — owner/supervisor (`src/app/api/customers/route.ts:13`); 200 `{ customers: CustomerDTO[] }` (≤1000, by name).
- `POST /api/customers` — owner/supervisor (`:28`); body `customerSchema`
  (`src/lib/validations/customers.ts:6-18`): `name` 2–140, `kind` `customer|vendor|both`
  (default customer), `company?`, `phone?`≤30, `email?` (or `""`), `location?`≤200, `pan?`≤30,
  `note?`≤500. 409 *"X is already a customer"* (case-insensitive, `:33-38`). 201 `{ customer }`.
- `PATCH /api/customers/{id}` — owner/supervisor (`src/app/api/customers/[id]/route.ts:17`); same body; 404/409.
- `DELETE /api/customers/{id}` — owner only (`:63-65`); bills keep their own copy. Activity `record_deleted`.
- `GET /api/customers/{id}/ledger` — **owner only** (`src/app/api/customers/[id]/ledger/route.ts:25`);
  200 `{ party: CustomerDTO, ledger: PartyLedger }` (quotations excluded, `src/lib/ledger.ts:118-137`).

---

## 12. Money: expenses, payments, accounts

### 12.1 Expenses — `src/app/api/expenses/*`
- `GET /api/expenses` — owner/supervisor; **supervisors see `kind:"stock"` only** (`route.ts:32-35`, `:44-46`,
  `src/lib/expenses.ts:86`). 200 `{ expenses: ExpenseDTO[] }` (≤500).
- `POST /api/expenses` — owner/supervisor (`:75`); supervisor + non-stock → 403 *"A supervisor can record
  stock purchases. …"* (`:78-83`). Body `expenseSchema` (`src/lib/validations/expenses.ts:21-75`):
  `kind` (21 kinds, `src/lib/work-constants.ts:204-226`), `payee` 2–140, `employeeId?`, `partyId?`,
  `accountId?`, `amount?` (ignored for stock; >0 otherwise), `method` `cash|cheque|bank|online`,
  `reference?`≤60, `note?`≤500, `spentOn` dayKey, `lines` ≤100 × `{itemId, qty>0, cost≥0}` (stock
  only, ≥1, no duplicate item). 404 unknown employee/party/item; 404/409 account missing/closed
  (`src/lib/money-refs.ts:36-53`). 201 `{ expense }`.
  Side effects (one transaction): stock `+qty`, item `costPrice` re-averaged, **mirror `Payment`
  (direction out)** (`:116-181`); activity `expense_recorded`.
- `PATCH /api/expenses/{id}` — owner/supervisor, same body; stock moved by the delta; 409 if goods
  already sold (`src/lib/expenses-server.ts:72-85`).
- `DELETE /api/expenses/{id}` — owner only (`[id]/route.ts:182-184`); reverses stock + mirror payment.

### 12.2 Payments — **owner only** (`src/app/api/payments/route.ts:23,45`)
- `GET /api/payments` → `{ payments: PaymentDTO[] }` (≤500).
- `POST /api/payments` — body `paymentSchema` (`src/lib/validations/payments.ts:14-42`):
  `direction` `in|out`, `party` 2–140, `amount` >0, `partyId?`, `accountId?`, `method`,
  `reference?`, `note?`, `paidOn` dayKey, `billId?` (only with `in`). 404 bill; 409 void bill or
  still a quotation (`:66-76`). Bill `payment` flag re-synced (`src/lib/payments.ts:32-59`). 201 `{ payment }`.
- `DELETE /api/payments/{id}` — owner only (`[id]/route.ts:21-23`); bill re-synced.

### 12.3 Accounts — **owner only** (`src/app/api/accounts/route.ts:20,42`)
- `GET /api/accounts` → `{ accounts: AccountDTO[] }` (balance computed from payments, `src/lib/ledger.ts:22-60`).
- `POST /api/accounts` — body `accountSchema` (`src/lib/validations/accounts.ts:8-34`): `name` 2–90,
  `kind` `bank|wallet|cash`, `reference?`≤60, `detail?`≤120, `openingBalance` ±1e8, `openedOn?`,
  `isDefault?`. 409 same name. First account becomes default (`:72-75`).
- `PATCH /api/accounts/{id}` — same body.
- `DELETE /api/accounts/{id}` — owner; **archives** instead when money moved through it:
  200 `{ id, archived, movements }` (`[id]/route.ts:91-113`).

---

## 13. Inventory — owner/supervisor for everything except deletes

- `GET /api/inventory/categories` → `{ categories: (CategoryDTO & {items})[] }` (`src/app/api/inventory/categories/route.ts:18-46`).
- `POST /api/inventory/categories` — body `categorySchema` (`src/lib/validations/inventory.ts:7-10`):
  `name` 2–80, `description?`≤500. 409 duplicate (case-insensitive).
- `PATCH /api/inventory/categories/{id}` — same body; 404/409.
- `DELETE /api/inventory/categories/{id}` — owner only; 409 *"3 items are still in Cables. Move or delete them first."* (`[id]/route.ts:77-84`).
- `GET /api/inventory/items` → `{ items: ItemDTO[] (≤500), uploads: boolean }` (`items/route.ts:17-35`).
- `POST /api/inventory/items` — body `itemSchema` (`src/lib/validations/inventory.ts:18-49`):
  `name` 2–140, `sku?`≤40, `categoryId`, `description?`≤2000, `unit` `pcs|box|set|pair|kg|g|l|m|roll`,
  `price`, `stock`, `lowStockAt`, `location?`≤120, `images?` **≤3** × `{url}` (must be this
  workspace's `products` uploads, 400 otherwise, `src/lib/inventory.ts:55-87`). 404 category; 409
  name/SKU taken (`src/lib/inventory.ts:20-45`).
- `PATCH /api/inventory/items/{id}` — same body; `images` absent = unchanged; dropping someone else's
  picture → 403 own-pictures rule (`[id]/route.ts:85-99`); dropped pictures deleted from S3 if no
  other item uses them (`:107-113`).
- `DELETE /api/inventory/items/{id}` — owner only; pictures deleted (`:128-168`).

## 14. Maintenance (repair bench) — owner/supervisor, delete owner only

- `GET /api/maintenance?status=` → `{ items: MaintenanceDTO[] (≤500), uploads }` (`src/app/api/maintenance/route.ts:28-52`).
- `POST /api/maintenance` — body `maintenanceSchema` (`src/lib/validations/maintenance.ts:18-61`):
  `item` 2–140, `makeModel?`, `serialNumber?`, `owner?`, `ownerId?`, `fault` 3–1000, `diagnosis?`,
  `status` (`received|diagnosing|awaiting_parts|repairing|repaired|returned|scrapped`),
  `receivedAt` dayKey, `dueAt?`, `returnedAt?`, `cost?`, `assigneeId?`, **`photos` ≤8 URLs**
  (bucket photos must be this workspace's `maintenance` uploads → 422 `photos`, `:63-67`), `note?`.
- `PATCH /api/maintenance/{id}` — full body; own-pictures rule on dropped photos (`[id]/route.ts:68`);
  orphans reconciled in S3 (`:79`).
- `DELETE /api/maintenance/{id}` — owner only; photos deleted.

## 15. Reports — owner/supervisor; **finance group owner only** (`src/lib/reports.ts:310-312`)

- `GET /api/reports/{report}` (`src/app/api/reports/[report]/route.ts:17-51`). Slugs (26):
  `src/lib/reports.ts:68-301`. Query (all optional): `from`, `to` (whole day), `employeeId`,
  `customerId`, `categoryId`, `payment` (`src/lib/report-runner.ts:32-47`). 200
  `ReportPayload & {blocked:false, note?}` or `{slug, blocked:true, missing, unlock}` for
  `damaged-stock`, `payables`, `payroll`. 404 unknown slug; 403 finance for supervisor.
- `GET /api/report-groups/{group}` (`sales|inventory|finance|employee`) → `{ group, reports:[{slug,title,subtitle,status,missing,chart,stats(≤2),rows}] }` (`src/app/api/report-groups/[group]/route.ts:27-91`).

## 16. Website builder — owner only (`src/app/api/site/route.ts`)

- `GET /api/site` → `{ site: SiteDTO, uploads }`; creates the site on first read (`src/lib/site-server.ts:47-76`).
- `PUT /api/site` — body `siteSchema` (`src/lib/validations/site.ts:72-159`, whole document,
  optimistic `updatedAt`): 409 `{code:"stale"}` (`:88-90`) or slug taken (`:92-99`); 400 foreign picture.
- `POST /api/site` — `{ published: boolean }`; 400 without a business name (`:173-175`).
- Mobile: **WEB-ONLY** (template editor).

## 17. Super admin — `requireSuperAdmin` (`src/lib/auth/guards.ts:103-123`)

- `GET /api/admin/overview` → `{ businesses: AdminBusiness[], users: AdminUser[], projects: AdminProject[], invites: WorkspaceInviteDTO[] }` (`src/app/api/admin/overview/route.ts:30-134`).
- `PATCH /api/admin/businesses/{id}` — `{ blocked: boolean }` → `{ business }`.
- `PATCH /api/admin/users/{id}` — `{ blocked: boolean }` → `{ user }`; 409 can't block a super admin (`:32-34`).
- `POST /api/admin/invites` — `{ email?, businessName?≤120, note?≤500 }` → 201 `{ invite, signupUrl }`
  (`signupUrl` = `/signup?invite=<token>`, TTL 14 days `src/models/workspace-invite.ts:11`).
- `DELETE /api/admin/invites/{id}` — revoke; 409 already used.
- Mobile: **WEB-ONLY**.

## 18. Geocode

- `GET /api/geocode?q=` — owner/supervisor (`src/app/api/geocode/route.ts:26`). `q` < 3 chars →
  `{results:[]}`; proxies Nominatim, cached a day; upstream failure → `{results:[], unavailable:true}`.
  200 `{ results: {label, lat, lng}[] }` (≤6).

---

## 19. Mobile token auth and the new read endpoints (`feature/mobile-api`)

All additive; existing responses are unchanged. Tokens:

| Token | Form | Lifetime | Stored server-side |
|---|---|---|---|
| **access** | Auth.js `encode` (next-auth/jwt) with `AUTH_SECRET` and salt `"ems-mobile-access"` → an encrypted, integrity-protected JWT (JWE `dir`/A256CBC-HS512). Claims `{ sub, businessId, role, tokenVersion, typ:"access", iat, exp, jti }` | 15 min (`ACCESS_TOKEN_TTL_S`, `src/lib/auth/mobile-tokens.ts`) | nothing |
| **refresh** | 256 random bits, base64url, opaque | 30 days (`REFRESH_TOKEN_TTL_MS`, `src/lib/auth/mobile-sessions.ts`) | SHA-256 only, in `MobileSession` (`src/models/mobile-session.ts`), TTL index on `expiresAt` |

An access token is refused (401) when it fails to decode (tampered, wrong key, expired), has
`typ ≠ "access"`, or its `tokenVersion` ≠ the account's current `tokenVersion`. **Revocation**
(`revokeMobileAccess`, `src/lib/auth/mobile-sessions.ts`) = `tokenVersion += 1` + revoke every
`MobileSession` of the account. It runs on: user blocked (`PATCH /api/admin/users/{id}`), workspace
blocked (`PATCH /api/admin/businesses/{id}`, all members), role change (`PATCH /api/people/{id}`),
removal (`DELETE /api/people/{id}`), adoption by another workspace (`POST /api/invites/{token}/accept`),
password change (`POST /api/me/password`), and `POST /api/mobile/auth/logout-all`. Removed/blocked
accounts are also refused per request by the guard's DB check, exactly as on the web (403).

### 19.1 `POST /api/mobile/auth/login` — public
- Body `{ email: string, password: string, deviceName?: string ≤120 }` (strings only, else 422).
- Same password check as the web — `verifyCredentials` (`src/lib/auth/verify-credentials.ts`), which the
  web's Auth.js `authorize` now calls too (`src/auth.ts`).
- Same limits and buckets as the web sign-in: `loginEmail` 5 / 15 min per email, `loginIp` 20 / 15 min
  per IP → **429** with `Retry-After`. Same audit rows (`login_succeeded|login_failed|login_rate_limited`).
- **200** `{ accessToken, refreshToken, expiresIn: 900, user: MeDTO }` (§19.5).
- **401** `{ error: "Email or password is incorrect" }` for every refusal (wrong password, unknown email,
  removed, blocked account, blocked workspace).
- No Origin needed (exempt path). Example → `{"email":"asha@example.com","password":"a-long-pass-123","deviceName":"Pixel 8"}` →
  `200 {"accessToken":"eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoi…","refreshToken":"Qk3…","expiresIn":900,"user":{…}}`

### 19.2 `POST /api/mobile/auth/refresh` — public
- Body `{ refreshToken }` (16–200 chars). Claims the row atomically, revokes it, issues a new pair in
  the same family → **200** `{ accessToken, refreshToken, expiresIn }`.
- **401** *"Sign in to continue"* for unknown / expired / revoked tokens and for a removed or blocked
  account or workspace. **Reuse of an already-rotated token revokes the whole family** (theft detection).

### 19.3 `POST /api/mobile/auth/logout` — public
- Body `{ refreshToken }` → revokes it. **200** `{ ok: true }` whether or not it was live. The access
  token already issued lapses within 15 min (use `logout-all` to end it at once).

### 19.4 `POST /api/mobile/auth/logout-all` — any signed-in role
- Bearer (or cookie). Revokes all of the account's mobile sessions and bumps `tokenVersion` → its access
  tokens fail on their next request. Web cookie sessions are not affected. **200** `{ ok: true }`.

### 19.5 `GET /api/me` — any signed-in role (`src/app/api/me/route.ts`, builder `src/lib/me.ts`)
```ts
{
  user: UserDTO,                                   // src/models/user.ts
  superAdmin: boolean,
  business: BusinessDTO & { today: "YYYY-MM-DD" }, // logo.url is the served (CDN) URL; office, week, vatRate, pan, timeZone
  shift: { day, resting: boolean, hours: "HH:MM–HH:MM" | null },  // own week → workspace week → standing shift
  permissions: { isOwner, deleteRecords, manageWork, decideRequests, manageTeam, seeMoney,
                 editSettings, checkIn, raiseRequests, uploadPurposes: string[] }
}
```
Same data the web's layout and pages load server-side (`src/app/dashboard/layout.tsx:32-58`,
`src/app/dashboard/page.tsx:38-47`, `src/app/dashboard/profile/page.tsx:17-24`). The login response
embeds exactly this object.

### 19.6 `POST /api/me/password` — any signed-in role
- Body `{ currentPassword, newPassword (≥10) }`; limit `password` 5 / hour per user.
- Wrong current password → **422** `fieldErrors.currentPassword`. Success → `{ ok: true }`; sets
  `sessionsValidAfter = now` (web sessions end), revokes mobile access (the caller signs in again),
  activity `password_changed`.

### 19.7 `GET /api/business` — owner, supervisor
- **200** `{ business: BusinessDTO, stats: { members, pendingInvites }, canEdit, uploads }` — as the
  Organization settings page loads it (`src/app/dashboard/settings/page.tsx:15-38`).

### 19.8 `GET /api/bills/{id}` — owner, supervisor
- **200** `{ bill: BillDTO, payments: {id, amount, method, reference, paidOn}[], business: {name, pan}, issuedBy: string|null }`
  — as the bill page loads it (`src/app/dashboard/sales/[id]/page.tsx:20-53`). 404 *"That bill doesn't exist"*.

### 19.9 `GET /api/projects/{id}` — owner, supervisor
- **200** `{ project: ProjectDTO }` — as the project page loads it (`src/app/dashboard/projects/[id]/page.tsx:16-37`).
  404 *"That project doesn't exist"*. Its tickets: `GET /api/tickets?projectId=`.

### 19.10 `GET /api/nav-counts` — owner, supervisor
- **200** `{ counts: { people, pendingInvites, projects, tickets, inventory, sales, customers, payments, expenses, maintenance, approvals, unread } }`
  — the dashboard layout's queries verbatim (`src/app/dashboard/layout.tsx:60-103`).

### 19.11 `GET /api/dashboard/summary` — owner, supervisor
- **200** `{ today, timeZone, crew, onSite, tickets: TicketDTO[≤6], pendingRequests: RequestDTO[≤4] }` —
  the owner/supervisor home's queries verbatim (`src/app/dashboard/page.tsx:50-81`).

Not done (would change existing response shapes): a `code` on the removed/blocked 403s, and
`ticketId` on `NotificationDTO` (`backend-gaps.md` §3).

---

## 20. Endpoint → web screen(s)

Where each endpoint is called from on the web (hooks in `src/lib/queries.ts` and direct `apiFetch`
calls in components). “—” = not called by any screen (API-only or server-side).

| Endpoint | Web screen(s) |
|---|---|
| `GET /api/auth/csrf`, `GET /api/auth/providers` | Auth.js client internals of `signIn`/`signOut` (login, signup, join, sign-out buttons) — library-internal, not called by app code |
| `GET /api/auth/session` | every page via `SessionProvider` (`src/components/providers.tsx:67-70`); `useViewer` (`src/lib/use-viewer.ts`); post-login `getSession()` (`src/components/auth/login-form.tsx:46-48`) |
| `POST /api/auth/callback/credentials` | `/login` (`login-form.tsx:26-30`); after `/signup` and `/join` succeed |
| `POST /api/auth/signout` | Sign out buttons (`src/components/dashboard/sign-out-button.tsx:9`), `/choose`, `/blocked` |
| `POST /api/register` | `/signup` (`src/components/auth/signup-form.tsx:68`) |
| `GET /api/invites` | — (People page reads invites server-side, `src/app/dashboard/people/page.tsx:23-26`) |
| `POST /api/invites` | People › Invite dialog (`src/components/dashboard/people/invite-dialog.tsx:53-55`) |
| `GET /api/invites/{token}` | — (`/join` page loads server-side, `src/app/join/[token]/page.tsx:18-23`) |
| `POST /api/invites/{token}/accept` | `/join/[token]` (`src/components/auth/join-form.tsx:39`) |
| `POST /api/uploads` | status dialog (ticket photos), item dialog (products), maintenance dialog, settings (logo), site builder — all via `src/lib/upload-client.ts:135-164` |
| `DELETE /api/uploads` | orphan clean-up in `status-dialog.tsx:115`, `inventory/item-dialog.tsx:256`, `settings-view.tsx:206`, `site/site-builder.tsx:275` |
| `GET /api/tickets` | employee Home, Check in, My tickets, request dialog (today); owner Tickets, Project detail (`useTickets`, `src/lib/queries.ts:106`) |
| `POST /api/tickets` | Ticket dialog (Tickets, dashboard home `NewTicketButton`, Project detail) |
| `GET /api/tickets/{id}` | Ticket detail dialog history (`useTicket`, employee past tickets) |
| `PATCH /api/tickets/{id}` | Ticket dialog (edit) |
| `PATCH /api/tickets/{id}/status` | employee Status dialog (`useTicketStatus`); owner board / "Move" select (`useMoveTicket`) |
| `POST /api/tickets/{id}/check-in` · `…/check-out` | employee Check-in dialog (ticket card, Check in page) |
| `PUT /api/tickets/{id}/materials` | Materials dialog (ticket detail) |
| `GET /api/attendance` | employee Home, Check in, My tickets (zone), Attendance; crew download dialog (month sheet — NOT VERIFIED) |
| `POST /api/attendance` | employee Home Start/End shift (`useShiftAction`) |
| `GET /api/attendance/crew` · `GET /api/attendance/visits` | owner/supervisor Attendance (Days / Tickets tabs) |
| `GET /api/requests` | employee Requests; Approvals |
| `POST /api/requests` | employee Request dialog |
| `PATCH /api/requests/{id}` | Approvals (owner) |
| `GET /api/projects` | Projects; Ticket dialog and Operation dialog pickers |
| `POST /api/projects` | Project dialog (Projects, nested in Ticket dialog) |
| `PATCH /api/projects/{id}` | Projects (archive/reopen), Project dialog (edit) |
| `GET /api/people` | Ticket dialog, Operation dialog, Maintenance dialog, Expense dialog (salary/commission) |
| `PATCH /api/people/{id}` · `DELETE /api/people/{id}` | People › Member dialog / Remove dialog |
| `PATCH /api/business` | Organization settings |
| `GET /api/notifications` | owner shell badge (`?count=1`, 60 s poll); Notifications |
| `POST /api/notifications` | Notifications (mark one / all read) |
| `GET /api/activity` | Notifications › Logs (owner) |
| `GET /api/calendar` | Calendar |
| `GET /api/geocode` | Map picker search (Ticket dialog, Settings office picker, Sign-up office pin) |
| `GET /api/bills` | Sales; Parties (standings); Payment dialog bill picker |
| `POST /api/bills` | Bill dialog |
| `PATCH /api/bills/{id}` | Bill view (payment state, void) |
| `POST` · `DELETE /api/bills/{id}/review` | Bill view › Quote review panel (`sales/quote-review-panel.tsx:47,70`) |
| `GET /api/quote/{token}` | — (`/quote/[token]` loads server-side) |
| `POST /api/quote/{token}` | `/quote/[token]` (`src/components/quote/quote-review.tsx:43`) |
| `GET /api/customers` | Parties; Bill dialog; party pickers in Payment / Expense / Maintenance / Operation dialogs |
| `POST` · `PATCH /api/customers[/{id}]` | Customer dialog (Parties, nested in Bill dialog) |
| `DELETE /api/customers/{id}` | Parties (owner) |
| `GET /api/customers/{id}/ledger` | Party ledger (owner) |
| `GET /api/expenses` | Expenses; Sales › Expenses tab; Inventory › Purchases tab |
| `POST` · `PATCH /api/expenses[/{id}]` | Expense dialog |
| `DELETE /api/expenses/{id}` | Expenses panel (owner) |
| `GET /api/inventory/categories` | Inventory; Item dialog |
| `POST` · `PATCH /api/inventory/categories[/{id}]` | Category dialog |
| `DELETE /api/inventory/categories/{id}` | Inventory delete dialog (owner) |
| `GET /api/inventory/items` | Inventory; Item dialog; Materials dialog; Bill dialog; Expense dialog (stock) |
| `POST` · `PATCH /api/inventory/items[/{id}]` | Item dialog |
| `DELETE /api/inventory/items/{id}` | Inventory delete dialog (owner) |
| `GET /api/maintenance` | Maintenance |
| `POST` · `PATCH /api/maintenance[/{id}]` | Maintenance dialog |
| `DELETE /api/maintenance/{id}` | Maintenance row "×" (owner) |
| `GET /api/operations` | Meetings, Installation dates, Follow-ups, Important deadlines |
| `POST` · `PATCH /api/operations[/{id}]` | Operation dialog; row "Mark …" toggle |
| `DELETE /api/operations/{id}` | Operations delete dialog (owner) |
| `GET /api/schedules` | Employee schedules |
| `POST /api/schedules` · `DELETE /api/schedules/{id}` | Schedule cell dialog (clear: owner) |
| `GET /api/payments` | Payments |
| `POST /api/payments` · `DELETE /api/payments/{id}` | Payment dialog; Payments delete |
| `GET /api/accounts` | Payments › Accounts; account pickers in Payment / Expense dialogs |
| `POST` · `PATCH` · `DELETE /api/accounts[/{id}]` | Account dialog; Accounts "×" |
| `GET /api/reports/{report}` | `/dashboard/reports/[report]` |
| `GET /api/report-groups/{group}` | Report hubs (sales/inventory/finance/employee); owner/supervisor dashboard charts |
| `GET` · `PUT` · `POST /api/site` | `/dashboard/site` (website builder) |
| `GET /api/admin/overview`, `PATCH /api/admin/{businesses,users}/{id}`, `POST /api/admin/invites`, `DELETE /api/admin/invites/{id}` | `/admin` |
| `POST /api/mobile/auth/{login,refresh,logout,logout-all}`, `GET /api/me`, `POST /api/me/password`, `GET /api/nav-counts`, `GET /api/dashboard/summary`, `GET /api/business`, `GET /api/bills/{id}`, `GET /api/projects/{id}` | — (added for the mobile app; the web keeps loading the same data server-side) |
