# EMS screens — every web page, per role, and what the app should do with it

Companion to [`api.md`](./api.md) (endpoints), [`navigation.md`](./navigation.md) (mobile routes) and
[`backend-gaps.md`](./backend-gaps.md) (what the server must add). Every claim cites `file:line`.
Where a component was not read, it says **NOT VERIFIED**.

**Totals:** **43 `page.tsx` files** under `src/app` (the dynamic `reports/[report]` page serves 26
slugs); `/dashboard` and `/dashboard/attendance` branch by role, giving **45 page × role variants →
KEEP 24 · SIMPLIFY 14 · WEB-ONLY 7** (§9). The app needs **40 screens + 16 modal sheets**
(`navigation.md` §1). **12 GAPS** (data a page loads server-side with no API) are flagged `GAP-n` and
collected in §8 and in `backend-gaps.md` §3.

---

## 0. Cross-cutting behaviour

### 0.1 Page guards → what the app must reproduce

`src/lib/auth/page-guards.ts`:

| Condition | Web behaviour | Line |
|---|---|---|
| no session | redirect `/login` | `:46-48` |
| session, no member row | `/login` | `:58-60` |
| `status === "removed"` | `/removed` | `:62-64` |
| member or workspace blocked | `/blocked` | `:66-68` |
| session older than `sessionsValidAfter` | `/login` | `:74-76` |
| wrong role on `requirePageRole(...)` | redirect `/dashboard` | `:24-34` |

API equivalents (what the app actually sees): 401 *"Sign in to continue"* → login; 403 *"You are no
longer part of this workspace"* → Removed screen; 403 *"This account has been blocked"* → Blocked
screen (`src/lib/auth/guards.ts:28-55`). The 403 message does **not** say whether the account or the
workspace is blocked; `/blocked` distinguishes them server-side (`src/app/blocked/page.tsx:38`) — GAP-12.

### 0.2 Client role model

`useViewer()` reads `role` from the Auth.js session (the JWT), not the DB
(`src/lib/use-viewer.ts:11-21`): `isOwner`, `mayRemovePicture(uploadedById)` (owner any; others own
only). The app should derive the same from `/api/me` (GAP-1), refreshed on app foreground.

### 0.3 Shared states

- **Error**: `EmptyState` with *"Couldn't load … Your connection may have dropped."* + **Try again**
  (refetch) on every list (e.g. `src/components/dashboard/employee/employee-home.tsx:328-343`).
- **Mutation errors**: `reportMutationError` → first `fieldErrors` message per field onto the form,
  then `toast.error(error.message)`; network failure → *"Could not reach the server"*
  (`src/lib/queries.ts:301-318`).
- **Skeletons**: `StatGridSkeleton`, `HeadingSkeleton`, `RowsSkeleton`, `CardsSkeleton`,
  `PhoneScreenSkeleton`, `CalendarSkeleton` (`src/components/dashboard/skeletons.tsx`).
- **Pagination** is client-side, 10 per page (12 on operations), label *"Showing {from}–{to} of
  {total} {noun}"* (`src/components/dashboard/pagination.tsx:10-23,46-49`). Server caps: see `api.md`.
- **Unsaved-changes guard** on item, status, settings dialogs: *"You have unsaved changes. Leave
  without saving?"* (`src/lib/use-unsaved-guard.ts:5`).

### 0.4 Device constants (the numbers the app must honour)

| Constant | Value | Source |
|---|---|---|
| Ticket geofence default / range | 50 m / 10–5000 m | `src/lib/work-constants.ts:26`; `src/lib/validations/work.ts:28-32` |
| Office rings default | 100 m (office) / 300 m (reason beyond) | `src/lib/work-constants.ts:235-236` |
| Office ring limits | 20–5000 m / 20–20000 m, outer ≥ inner | `src/lib/validations/auth.ts:22-38` |
| Check-in opens | 10 min before `startAt` | `src/lib/work-constants.ts:76` |
| Late grace | 10 min | `src/lib/work-constants.ts:48` |
| **GPS accuracy threshold** | **none** — `accuracyM` optional, stored, never used to accept/reject | `src/lib/validations/work.ts:59`; `src/app/api/tickets/[id]/check-in/route.ts:80-84` |
| Location request | high accuracy, 15 s timeout, `maximumAge 0`, one-shot | `src/lib/geolocation.ts:18-39` |
| Upload ceiling | 1,000,000 bytes after compression | `src/lib/storage/types.ts:18` |
| Accepted image types | JPEG, PNG, WebP, AVIF | `src/lib/storage/types.ts:24-29` |
| Web compression | skip if ≤ 1 MB; else WebP (JPEG fallback), edges 2000→1600→1200→1000, quality .85→.5 | `src/lib/images/compress.ts:22-33,78-100` |
| Ticket completion photos | ≤ 5 **per person per ticket**, ≥ 1 to send for review | `src/models/ticket.ts:67`; `src/app/api/tickets/[id]/status/route.ts:111-132` |
| Inventory item pictures | ≤ 3 | `src/models/inventory-item.ts:33` |
| Maintenance photos | ≤ 8 | `src/lib/validations/maintenance.ts:56-58` |

Location error copy (reuse verbatim) `src/lib/geolocation.ts:41-62`: *"This device can't share a
location. Ask your owner to check you in."* · *"Location is blocked. Allow it for this site, then try
again."* · *"No position yet. Step outside or turn GPS on and try again."* · *"Finding you took too
long. Try again with a clearer view of the sky."* · *"Could not read your location."*

### 0.5 Push-worthy events (all exist today as in-app notification rows)

`notifyUser` / `notifySupervisors` (`src/lib/notify.ts:24-49`; kinds `src/lib/work-constants.ts:59-69`):

| Kind | Trigger | Recipients |
|---|---|---|
| `ticket_assigned` | ticket created / assignee added (`src/app/api/tickets/route.ts:162-177`, `[id]/route.ts:122-138`) | each new assignee except the actor |
| `check_in` / `check_out` | `check-in/route.ts:175-185`, `check-out/route.ts:144-154` | owners + supervisors |
| `ticket_blocked` / `ticket_in_review` | `status/route.ts:276-293` | owners + supervisors |
| `ticket_done` | reviewer signs off (`status/route.ts:299-315`) | assignees |
| `request_raised` | `src/app/api/requests/route.ts:107-114` | owners + supervisors |
| `request_decided` | owner decides (`src/app/api/requests/[id]/route.ts:76-84`); **also** a client reviews a quote (`src/app/api/quote/[token]/route.ts:92-106`) | requester / workspace owner |
| `member_joined` | `src/app/api/invites/[token]/accept/route.ts:114-120` | owners + supervisors |

Web delivery is polling only (`useNotifications`/`useUnreadCount` every 60 s,
`src/lib/queries.ts:365-405`). **Employees get notifications but have no screen for them** (employee
nav has none, `src/components/dashboard/employee-shell.tsx:10-17`; `/dashboard/notifications` is
owner/supervisor, `src/app/dashboard/notifications/page.tsx:11`; the employee home "bell" links to
Requests, `src/components/dashboard/employee/employee-home.tsx:143-149`). The app should fix that.

---

## 1. Public & auth screens

### 1.1 `/` — landing · `src/app/page.tsx`
- Anyone. Static marketing sections (`:55-355`); links to `/signup` and `/login`.
- Copy claims "100 m GEOFENCE RADIUS" and an "Offline CHECK-IN QUEUE" (`:12-16`) — neither matches the
  code (50 m default; no offline queue exists).
- **WEB-ONLY** — marketing page.

### 1.2 `/login` · `src/app/login/page.tsx` → `src/components/auth/login-form.tsx`
- Anyone. Fields email, password, "Keep me signed in" (`remember` is **not sent**, `:26-30`).
- Validation `loginSchema` (`src/lib/validations/auth.ts:78-82`): *"Enter a valid work email"*, *"Enter your password"*.
- Action: `signIn("credentials", {email, password, redirect:false})` (`login-form.tsx:26-30`) →
  `POST /api/auth/callback/credentials`. Failure → *"Email or password is incorrect"*; rate limited →
  the server's message (`:32-42`). Success → `/choose` if super admin else `/dashboard` (`:46-48`).
- Dead controls: "Forgot password?" links to `/login` (`:98-100`) — **no reset flow exists**; "Continue with an invite link" only toasts (`:120-128`).
- **KEEP** — native login against the proposed token endpoint (`backend-gaps.md` §1).

### 1.3 `/signup` · `src/app/signup/page.tsx` → `src/components/auth/signup-form.tsx`
- Anyone with a super-admin workspace invite `?invite=`; **GAP-11** (`findPendingWorkspaceInvite`
  server-side, `:24-34`, no public API).
- No/invalid invite → *"That link is no longer valid"* / *"Sign-up is by invitation"* (`:108-142`).
- Form: business, name, phone, email (locked if the invite names one), office pin, password, crew
  size, terms; `signupSchema` (`src/lib/validations/auth.ts:137-160`) → `POST /api/register`, then sign in.
- The office map search calls `/api/geocode`, which needs owner/supervisor
  (`src/app/api/geocode/route.ts:26`) — likely broken on this unauthenticated page (inference, NOT
  VERIFIED at runtime).
- **WEB-ONLY** — rare, invite-only; the app opens the web page.

### 1.4 `/join/[token]` · `src/app/join/[token]/page.tsx` → `src/components/auth/join-form.tsx`
- Invitee. Data: `findPendingInvite` server-side (`:18-23`) — **the same data is public at
  `GET /api/invites/{token}`**, so not a real gap.
- Invalid → *"Link expired / That invite is no longer valid / Invite links last seven days and work
  once. Ask the workspace owner to send a new one — it arrives on the same email address."* (`:68-94`).
- Form: read-only name + email; password (*"Use at least 10 characters"*); terms (*"Accept the terms to
  continue"*) (`src/lib/validations/auth.ts:182-187`) → `POST /api/invites/{token}/accept` → sign in →
  `/dashboard`; if sign-in fails: *"Account created — log in to continue"* (`join-form.tsx:39-69`).
- **KEEP** — deep link target (the main way crew arrive on the phone).

### 1.5 `/choose` · `src/app/choose/page.tsx`
- Super admin only (`:22-27`); two cards → `/dashboard` or `/admin`. **WEB-ONLY** (drop in app).

### 1.6 `/blocked` · `src/app/blocked/page.tsx`
- Text (`:49-57`): *"This workspace has been blocked"* / *"This account has been blocked"* + *"… Nothing
  has been deleted …"*; actions Sign out, Back to site. **KEEP** as a terminal screen driven by the 403.

### 1.7 `/removed` · `src/app/removed/page.tsx`
- *"You've been removed from this workspace … Ask an owner to send a new invite to {email} — opening
  that link brings you back."* (`:43-52`). **KEEP** as a terminal screen.

### 1.8 `/quote/[token]` · `src/app/quote/[token]/page.tsx` → `src/components/quote/quote-review.tsx`
- Public (the token is the credential); `noindex` (`page.tsx:7-11`); server-loads `toPublicQuote`
  (`:29-36`) — also available at `GET /api/quote/{token}`.
- Client can comment per line, approve, request changes (`quote-review.tsx:43-73`) → `POST /api/quote/{token}`.
- **WEB-ONLY** — the client is not an app user; the owner shares the URL from the app.

### 1.9 `/sites/[slug]` · `src/app/sites/[slug]/page.tsx`
- The tenant's public website (proxy rewrite, `src/proxy.ts:149-166`). Not read in detail. **WEB-ONLY**.

### 1.10 `/admin` · `src/app/admin/page.tsx` → `src/components/admin/admin-view.tsx`
- Super admin (`isSuperAdmin(me.email)`, `page.tsx:22-30`). Tabs businesses / users / projects /
  invites (`admin-view.tsx:44,56`). Hooks `useAdminOverview`, `useBlockUser`, `useBlockBusiness`,
  `useCreateWorkspaceInvite`, `useRevokeWorkspaceInvite` (`src/lib/queries.ts:927-995`).
- Empty invites: *"No workspace invites yet. Nobody can register without one — issue a link and hand
  it over."* (`src/components/admin/invites-panel.tsx:59-60`).
- **WEB-ONLY** — platform administration.

---

## 2. Shells (navigation chrome)

### 2.1 Employee shell · `src/components/dashboard/employee-shell.tsx`
- `NAV` (`:10-17`): Home `/dashboard` · Check in `/dashboard/check-in` · My tickets
  `/dashboard/my-tickets` · Attendance `/dashboard/attendance` · Requests `/dashboard/requests` ·
  Profile `/dashboard/profile`. Six-tab bottom bar below `lg` (`:142-161`). No badges.
- Header: logo, business name, initials, Sign out (`signOut({callbackUrl:"/login"})`,
  `src/components/dashboard/sign-out-button.tsx:9`). Sidebar card "YOUR SHIFT" `viewer.shift ?? "Not set"` (`:121-131`).
- Data: `src/app/dashboard/layout.tsx:32-58` loads `{name, email, role, businessName, businessLogo, superAdmin, shift}` — **GAP-1**.

### 2.2 Owner / supervisor shell · `src/components/dashboard/owner-shell.tsx`
Groups and items (owner-only marked ★):

| Group | Items (route) | Badge |
|---|---|---|
| Workspace (`:75-107`) | Dashboard `/dashboard` · Projects · All tickets · People (+ amber pending-invites chip `:420-431`) · Attendance · Approvals (amber chip when > 0, `:435-442`) | grey counts |
| Operations (`:111-136`) | Calendar · Meetings · Installation dates · Follow-ups · Employee schedules · Important deadlines · Maintenance | Maintenance count |
| Sales & stock (`:140-178`) | Inventory · Sales · Parties (`/dashboard/customers`) · ★Expenses · ★Payments (`:162`) | counts |
| Reports & analytics (`:182-208`) | Sales reports · Inventory reports · ★Finance reports (`:194`) · Employee reports | — |
| Account (`:210-223`) | Notifications (red badge, `99+`, `:413-416,458-475`) · Organization settings | unread |

- All counts are server-loaded in `src/app/dashboard/layout.tsx:60-103` — **GAP-2**. The unread badge
  then polls `GET /api/notifications?count=1` every 60 s (`useUnreadCount`, `src/lib/queries.ts:396-405`).
- `/dashboard/site` (website builder) is **not in the nav**; the Settings "Build your site" link is
  commented out in the working tree (`src/components/dashboard/settings/settings-view.tsx:226-228`).
- Extras: "Super admin →" when `viewer.superAdmin` (`:318-327`); "INVITE ONLY" card (`:329-341`).

---

## 3. Dashboard home — `/dashboard` · `src/app/dashboard/page.tsx`

Guard `loadViewer()` (`:32`); branches on role (`:38`). Loading: `src/app/dashboard/loading.tsx`.

### 3.1 Employee home · `src/components/dashboard/employee/employee-home.tsx` — **KEEP**
- Props (**GAP-4**): `name`, `shift`, `office` (`page.tsx:38-47`).
- Data: `useAttendance()` → `GET /api/attendance` (today's record + `timeZone`); `useTickets(scope)`
  for `today|upcoming|done` → `GET /api/tickets?scope=` (`:29-61`).
- Tiles (`:152-185`): SHIFT, ATTENDANCE (*"In at HH:MM"* / *"Not checked in"*, *"Xm late"*),
  ASSIGNED TODAY, CHECKED IN.
- **Start shift** (`:81-124,188-203`): no office → `POST /api/attendance {action:"start"}`; with office →
  location fix → `placeAgainstOffice` (`src/lib/office.ts:41-55`); beyond outer ring →
  `ShiftStartDialog` (`src/components/dashboard/employee/shift-start-dialog.tsx`): *"Starting away from
  the office"*, reason chips (Working from home, On a site visit, Meeting a client, Field work, Delivery
  or pickup, Travelling, Training, Something else — `src/lib/office.ts:13-22`), optional note, button
  disabled until a reason is picked. Disabled when `today.inSource === "manual"`. Labels *"Finding
  you…"* / *"Saving…"* / *"Start shift"*.
- **End shift** (`:204-216`): disabled without `inAt` or when `outSource==="manual"`; sends even without a fix.
- Toasts *"Shift started"* / *"Shift ended"* (`:70`). Server errors: 400 location required, 409 away
  without reason, 409 already started/ended (`api.md` §5.2).
- Scope chips Today / Upcoming / Done (`:224-241`). Empty texts (`:248-256`):
  *"Nothing assigned to you today, {firstName}. Anything your owner assigns will appear here with its
  site and check-in area."* · *"Nothing scheduled ahead of today."* · *"No finished tickets yet."*
- Cards: `EmployeeTicketCard` (§4.1).

### 3.2 Owner / supervisor home (server component) — **KEEP (simplified)**
- **GAP-3**: all data server-loaded (`page.tsx:50-81`): crew count (includes removed, `:56`), today's
  tickets (overlap today, not cancelled, **limit 6**, `:57-65`), people on site (sum of
  `openCheckIns`, `:68-72,80`), pending requests (**limit 4**, `:73-76`), greeting in business zone (`:231-251`).
- Header *"{Good morning|afternoon|evening}, {firstName}"*, *"{n} ticket(s) scheduled today · {m}
  waiting on you."*; action New ticket (`:85-92`).
- Stat cards (`:94-131`): CHECKED IN NOW, TICKETS TODAY, CREW MEMBERS, AWAITING YOU (accent > 0).
- Empty texts: *"Nothing scheduled today. Assign a ticket with a site and a check-in area and it shows
  up here."* (`:146-152`); *"Nothing waiting. Leave, advance and material requests queue here."* (`:190-194`).
- `DashboardCharts finance={role==="owner"}` (`:226`) → `useReportGroup("finance"|"inventory"|"sales")`
  (`src/components/dashboard/reports/dashboard-charts.tsx:26-31`); hidden entirely when nothing to draw (`:51-53`).
- App: stats + today list + approvals from the proposed `GET /api/dashboard/summary`; charts optional.

---

## 4. Employee screens

### 4.1 Shared: `EmployeeTicketCard` · `src/components/dashboard/employee/ticket-card.tsx`
- Clock re-evaluates every 30 s (`:33-43`). Check-in opens at `startAt − 10 min`; before that the
  button reads *"Opens HH:MM"* disabled (`:45,147-156`).
- **Past rule** (`isPastTicket`, `src/lib/ticket-window.ts:35-38`): status in `in_review|done|cancelled`,
  or the end day is before today in the business zone.
  - Past, not checked in → label *"VIEW ONLY · SENT FOR REVIEW | SIGNED OFF | CANCELLED | ENDED"* (`:124-127`).
  - Past but still checked in → only **Check out** (`:128-135`).
  - Otherwise **Check in** / **Check out** (by `myCheckedInAt`) + **Update status** (`:136-166`).
- Shows window, title, project · site · "fence {radius}", status badge, description, *"Blocked: …"*,
  *"Checked in at HH:MM"*, *"With N other(s) · K on site now"*; eye button → `TicketDetailDialog
  readOnly={past} showHistory={past}` (`:179-186`).

### 4.2 `/dashboard/check-in` · `src/app/dashboard/check-in/page.tsx` — **KEEP (core GPS screen)**
- `requirePageRole("employee")` (`:9`). Loading `PhoneScreenSkeleton`.
- `CheckInView` (`src/components/dashboard/employee/check-in-view.tsx`): `useTickets("today")` +
  `useAttendance()`; one fix on open (`src/components/dashboard/employee/use-location.ts`); finished
  tickets hidden, rest sorted by haversine distance (`:28-36`).
- Position card: *"Finding you…"*; error + *"Try again"* + *"You can still check in from a card below —
  you'll be asked for a reason if your position can't be confirmed."* (`:48-66`) — **inaccurate: the
  dialog cannot submit without a fix** (`check-in-dialog.tsx:256`); *"YOUR POSITION — Checked in at
  {site}" / "{d} from {nearest}" / "No ticket nearby"*, *"Accurate to about {acc} · refresh"*.
- Per card: *"{d} AWAY · INSIDE THE AREA | OUTSIDE THE AREA"* (`:98-112`).
- Empty: *"Nothing open today. When your owner assigns a ticket it appears here, nearest first."* (`:96`).
- Device: foreground location (expo-location), map optional.

### 4.3 Check-in / check-out dialog · `src/components/dashboard/employee/check-in-dialog.tsx`
- Fresh fix each open (`:60-62`). Readout *"INSIDE THE CHECK-IN AREA" / "OUTSIDE THE AREA"*, *"{d} from
  {site}"*, *"Area is {radius} · your GPS is accurate to about {acc}"* (`:163-190`).
- Outside → reason required: *"Why are you outside the area?"*, ≥ 3 chars, *"Say why you're checking in
  from outside the area"* (`:100-103`), hint *"Your owner sees this next to the check-in."*
- Overtime: on 422 with `fieldErrors.overtimeReason` show *"Outside your shift — why?"* (≤ 500, ≥ 3
  *"Say a little more about why"*) instead of a toast (`:124-129,217-241`).
- Submit disabled until a fix exists (`:256`) → `POST /api/tickets/{id}/check-in|check-out`
  `{lat, lng, accuracyM, reason?, overtimeReason?}`; toasts *"Checked in at {site}"* / *"Checked out of {site}"*.
- Server-side rules (too early, already in, past, closed): `api.md` §4.6-4.7.

### 4.4 Status dialog · `src/components/dashboard/employee/status-dialog.tsx`
- Choices (`:35-43`): In progress (*"Working on it now"*), Blocked (*"Waiting on something"*), Ready for
  review (*"Done my part — over to the owner"*). Current one disabled *"Current status"*.
- Blocked: cause chips Material/Equipment/Access/Client/Weather/Permit/Payment/Other
  (`src/lib/tickets-client.ts:22-31`); if Material, shortage rows (≤ 15, name/qty/unit, *"Add a shortage"*,
  `:256-335`); *"What's blocking you?"* ≥ 3 *"Say what you're blocked on"* (`:125-128`).
- Ready for review: `ImagePickerList` *"Photos of the finished work"*, *"At least one, up to five. They
  upload when you save."*, limit 5 (`:360-377`); ≥ 1 *"Add at least one photo of the finished work"*
  (`:129-132`); *"You're still checked in — handing it over will check you out too."* (`:405-410`).
- Submit (`:122-201`): upload each photo (`POST /api/uploads`, purpose `ticket`) → on failure
  `DELETE /api/uploads` the fresh ones → `PATCH /api/tickets/{id}/status`. Toast *"Status updated"*.
  Labels *"Uploading photos…"* / *"Saving…"* / *"Save"*. Unsaved guard (`:110`).
- Device: camera + gallery (the web has only a file input, no `capture`,
  `src/components/dashboard/image-picker.tsx:280-291`).

### 4.5 `/dashboard/my-tickets` · `src/app/dashboard/my-tickets/page.tsx` — **KEEP**
- `requirePageRole("employee")` (`:9`); no own `loading.tsx`.
- `MyTicketsView`: `useTickets("mine")`, grouped by `groupMyTickets` (`src/lib/ticket-window.ts:53-71`)
  into Now / Upcoming / Past, re-evaluated every 60 s. Empty texts (`my-tickets-view.tsx:56-76`):
  *"Nothing to work on right now."* · *"Nothing scheduled ahead."* · *"No finished tickets yet."*

### 4.6 `/dashboard/attendance` (employee branch) · `src/app/dashboard/attendance/page.tsx:19` — **KEEP**
- `AttendanceView` (`src/components/dashboard/employee/attendance-view.tsx`): `useAttendance(month)`
  with ‹ › month navigation; stats PRESENT/LATE/LEAVE/ABSENT; Monday-first month grid coloured by
  status; day list incl. *"Working from home · 4.2 km away — note"* (`:141-178`).
- Empty: *"No days recorded this month. A day opens when you start your shift or check in to a ticket."* (`:142`).

### 4.7 `/dashboard/requests` · `src/app/dashboard/requests/page.tsx` — **KEEP**
- `requirePageRole("employee")` (`:9`). `RequestsView`: `useRequests()`; chips All / Waiting · n /
  Approved / Rejected (client-side, `:24-29,54-74`).
- Card: *"{KIND} · {date}"*, *"Leave on X" / "Leave X – Y" / "Advance of N" / "Material needed"*,
  status pill, message, *"Owner: {decisionNote}"* (`:101-147`).
- Empty: *"Nothing sent yet. Leave, advance and material requests all go to your owner from here."* /
  *"Nothing in that state."* (`:81-87`).
- **New** → `RequestDialog` (`request-dialog.tsx`): Leave (dates), Advance (amount), Material (ticket
  from `useTickets("today")` or *"Not ticket specific"*); `requestSchemaChecked` messages *"Add a short
  note"*, *"Pick a date"*, *"Enter an amount"*, *"Leave has to end on or after it starts"*
  (`src/lib/validations/work.ts:162-194`) → `POST /api/requests`; toast *"Request sent to your owner"*;
  409 one pending per kind.

### 4.8 `/dashboard/profile` · `src/app/dashboard/profile/page.tsx` — **KEEP**
- `requirePageRole("employee")` (`:15`). **GAP-5**: name, role, email, phone, shift (`?? "Not set"`),
  workspace name server-loaded (`:17-24`). Only action: Sign out. **No edit, no password change** (no
  such API exists; `src/lib/security/limits.ts:14` says "no such route yet").
- App: add Notifications entry and (after the backend adds it) Change password.

---

## 5. Owner / supervisor screens — work

### 5.1 `/dashboard/tickets` · `src/components/dashboard/tickets/tickets-view.tsx` — **SIMPLIFY**
- `requirePageRole("owner","supervisor")` (`src/app/dashboard/tickets/page.tsx:11`); prop `timeZone` (**GAP-6**).
- Data `useTickets(scope)` → `GET /api/tickets?scope=`. Stats OPEN / IN REVIEW / BLOCKED / COMPLETED
  (client-computed, `:52-59,80-97`). Scope chips All/Today/In progress/In review/Upcoming/Done.
- Board (`ticket-board.tsx:25-61`): columns Listed · In progress · In review · Completed; **cancelled
  never shown**; blocked drawn inside In progress with amber border. HTML5 drag + a per-card `<select>`
  *"Move {title}"* fallback → `PATCH /api/tickets/{id}/status {status}`; toast *"Moved to {column}"*.
- List view: Edit disabled for done/cancelled (`:241-243`); board Edit is not (server 409s).
- Empty: *"Nothing finished in this view yet."* / *"No tickets here. Assign one with a site, a time
  window and a check-in radius."* (`:151-168`); column *"Nothing here"*.
- App: segmented status tabs + "Move to…" action sheet; drag board is web-only.

### 5.2 Ticket dialog (create/edit) · `src/components/dashboard/tickets/ticket-dialog.tsx` — **KEEP**
- Data: `usePeople()` (assignees exclude owners, `:115-117`), `useProjects("active")`.
- Fields: title, project (+ nested *"+ New project"*), description, assignees (checkboxes), priority,
  Starts/Ends (`datetime-local` in **device** zone, `:457-470`), site, radius (default 50), map pin
  (`MapPicker`). No pin → *"Drop a marker on the map"* (`:156-159`); then `ticketSchema` messages
  (`src/lib/validations/work.ts:15-47`).
- → `POST /api/tickets` / `PATCH /api/tickets/{id}`; toasts *"Ticket assigned"* / *"Ticket updated"*.
- Device: map pin + geocode search (`GET /api/geocode`), "Use my location".

### 5.3 Ticket detail · `src/components/dashboard/tickets/ticket-detail-dialog.tsx` — **KEEP**
- Status, priority, blocker panel (*"WAITING ON"* list), materials + total, window, fence, crew chips
  (on-site highlighted), completion photos grid + lightbox, optional history (`useTicket(id)` →
  `GET /api/tickets/{id}`; *"Nobody checked in to this one."*), read-only map.
- Footer: Materials, Close, **Get directions** → `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` (`:119-126`).

### 5.4 Materials dialog · `src/components/dashboard/tickets/materials-dialog.tsx` — **KEEP (simplified)**
- `useInventoryItems()` (owner/supervisor only — employees can't load the stock list), stock lines
  read-only name/unit/cost; *"Something else"* free lines; empty *"Nothing recorded yet. …"* (`:230-234`).
- → `PUT /api/tickets/{id}/materials`; toasts *"Materials recorded"* / *"Materials cleared"*.

### 5.5 `/dashboard/projects` + `/dashboard/projects/[id]` — **KEEP**
- List (`projects-view.tsx`): `useProjects()`; filters Active/Archived/All; cards with OPEN/BLOCKED/DONE;
  archive/reopen **without confirmation** → `PATCH /api/projects/{id} {status}`; empty *"No projects
  yet. Create one and you can start assigning tickets to it."* (`:119-137`).
- Detail: **GAP-9** — project loaded server-side (`src/app/dashboard/projects/[id]/page.tsx:20-37`), no
  `GET /api/projects/{id}`; tickets via `useTickets(scope, projectId)`. Archived banner; New ticket
  disabled when archived (`project-detail-view.tsx:103-120`).

### 5.6 `/dashboard/people` · `src/components/dashboard/people/people-view.tsx` — **SIMPLIFY**
- **GAP-7**: members (incl. removed), pending invites, `ownerId`, `workspaceWeek` all server-loaded
  (`src/app/dashboard/people/page.tsx:16-37`); supervisors see invites though `GET /api/invites` is owner-only.
- Filters Everyone/Owners/Supervisors/Employees/Removed; search; rows with Edit / Remove (owner only,
  not self, not the workspace owner, `:204-221`).
- **Invite** (owner) → `POST /api/invites`; shows the one-time `joinUrl` with Copy (`invite-dialog.tsx:224-275`).
  App: native share sheet.
- **Edit member** (owner) → `PATCH /api/people/{id}`; week editor → web-only in the app.
- **Remove** (owner) → `DELETE /api/people/{id}`; toast *"{name} removed · {n} unstarted ticket(s) cancelled"*.
- Empty invites: *"No invites outstanding. Every account in this workspace was created through one —
  there is no open sign-up."*; no revoke/resend UI.

### 5.7 `/dashboard/attendance` (owner/supervisor) · `src/components/dashboard/attendance/crew-attendance-view.tsx` — **SIMPLIFY**
- Prop `businessName` (**GAP-6**). Tabs Days / Tickets (`:52-57`); `DayStepper` (next disabled at today).
- Days: `useCrewAttendance(day)` → `GET /api/attendance/crew`; rows with in/out, place
  (`describeStartPlace`, `src/lib/office.ts:69-83`), download icon per person. Empty *"Nobody is on
  this workspace yet. Invite your crew from People."* (`:157`).
- Tickets: `useVisits(day)` → `GET /api/attendance/visits`; empty *"No ticket check-ins on this day.
  They appear the moment someone arrives at a job."* (`:357`).
- **Download** (`attendance-download-dialog.tsx`): month sheet → `window.print()` or CSV built
  client-side (`:120-136,208-220`, `src/lib/attendance-export.ts`). App: WEB-ONLY or share a CSV.

### 5.8 `/dashboard/approvals` · `src/components/dashboard/approvals/approvals-view.tsx` — **KEEP**
- `canDecide = role === "owner"` (`src/app/dashboard/approvals/page.tsx:9-10`); supervisors read-only.
- `useRequests()`; stats WAITING/APPROVED/REJECTED; filters Waiting (default)/Approved/Rejected/All.
- Owner on pending: note *"Add a note (optional)"*, Approve / Reject → `PATCH /api/requests/{id}`;
  toast *"Approved"* / *"Rejected"*. Empty *"Nothing waiting on you."* / *"Nothing in that state."*

### 5.9 `/dashboard/notifications` · `src/components/dashboard/notifications-view.tsx` — **KEEP (and extend to employees)**
- Props `timeZone`, `canSeeLogs = owner` (`src/app/dashboard/notifications/page.tsx:16-20`, **GAP-6**).
- Feed: `useNotifications(unreadOnly)` (poll 60 s); *"Mark all read ({n})"* → `POST /api/notifications {}`;
  row tap → mark read + follow `href`. Grouped Today / Yesterday / weekday. Dot colour per kind (`:25-35`).
  Empty *"Nothing unread."* / *"Nothing yet. Check-ins, blocked tickets and decisions all land here."*
- Logs tab (owner): `useActivity(day)` → `GET /api/activity`; *"{actor} {verb} {subject}"*
  (`src/lib/activity-labels.ts:9-52`). **SIMPLIFY** (owner-only, lower priority).

### 5.10 Operations: `/dashboard/{meetings,installations,follow-ups,deadlines}` · `src/components/dashboard/operations/operations-view.tsx` — **KEEP (one generic screen)**
- Each page passes `kind` only (`src/app/dashboard/meetings/page.tsx:9-10` etc.). Per-kind copy table
  `KIND_COPY` (`src/lib/operations.ts:12-85`) — reuse verbatim (titles, state words "Held / Installed /
  Done / Met", empty texts e.g. *"No meetings on the books. Add one and it shows up here and on the calendar."*).
- `useOperations(kind)`; filters Open/Overdue/Closed/Cancelled/All; toggle *"Mark held"* etc. →
  `PATCH /api/operations/{id} {status}`; delete (owner) with confirm.
- Dialog (`operation-dialog.tsx`): date/time sent as a **zone-less local string** (`:129-137`) parsed by
  the server's local zone (`src/app/api/operations/route.ts:91`) — the app should send ISO with offset.

### 5.11 `/dashboard/calendar` · `src/components/dashboard/operations/calendar-view.tsx` — **SIMPLIFY**
- `useCalendar(month)` → `GET /api/calendar`; read-only; legend toggles; month grid; day panel *"Nothing
  on this day."* (`:238`). App: agenda list per month.

### 5.12 `/dashboard/schedules` · `src/components/dashboard/operations/schedules-view.tsx` — **SIMPLIFY**
- `useSchedules(from)` → `GET /api/schedules`; 8-column week grid (min 820 px); cell → dialog → upsert
  `POST /api/schedules`, owner-only *"Clear this day"* → `DELETE /api/schedules/{id}`.
- Empty *"Nobody to roster yet. Invite your crew from People."* No past-day lock. App: per-day list.

### 5.13 `/dashboard/maintenance` · `src/components/dashboard/maintenance/maintenance-view.tsx` — **KEEP**
- Prop `today` (**GAP-6**, `src/app/dashboard/maintenance/page.tsx:25`). `useMaintenance()` + people + customers.
- Stats ON THE BENCH / AWAITING PARTS / READY TO GO BACK / PAST DUE; filter chips; search; photo thumbs.
- Dialog: item, make/model, serial, owner (party or text), fault, **photos ≤ 8** (purpose `maintenance`),
  state, dates, assignee, cost, diagnosis, note. Photos upload **before** validation with no orphan
  cleanup (`:487-525`) — app should validate first. Delete (owner) has **no confirm** on web (`:369-389`).
- Empty: *"Nothing in for repair. When something comes in, record what it is, its serial number and what
  is wrong with it — and photograph it, which is the only defence against an argument about a scratch later."*

---

## 6. Owner / supervisor screens — sales & money

### 6.1 `/dashboard/inventory` · `src/components/dashboard/inventory/inventory-view.tsx` — **SIMPLIFY**
- Prop `today` (**GAP-6**). Tabs items / categories / purchases.
- Items: `useInventoryItems()` + categories; stats ITEMS / CATEGORIES / RUNNING OUT / STOCK VALUE; chips +
  search; `OUT` / `LOW` chips; Edit all, Delete owner.
- Item dialog: pictures ≤ 3 (purpose `products`), validated **before** upload, orphans deleted on failure
  (`item-dialog.tsx:177-261`); duplicate name/SKU 409.
- Purchases tab = `ExpensesPanel kinds=["stock"] stockOnly` — **the supervisor's only way to record
  stock in** (`:150-151`).
- Empty: *"Nothing in stock yet. Add a category first — cables, tools, safety gear — then the items that sit in it."*

### 6.2 `/dashboard/sales` · `src/components/dashboard/sales/sales-view.tsx` — **SIMPLIFY**
- Props `vatRate`, `canSeeExpenses`, `today` (**GAP-6**, `src/app/dashboard/sales/page.tsx:20-28`).
- `useBills()`; stats BILLS / BILLED / STILL OWED / VAT CHARGED (over ≤ 200 bills only); chips by
  payment, date range, search. Empty *"No bills yet. A custom bill is typed by hand; an inventory bill
  pulls its prices from stock and takes the quantities off it."*
- **New bill** (`bill-dialog.tsx`): custom vs inventory → customer (saved or typed), lines, discount
  groups, payment state, VAT toggle, note → `POST /api/bills`; toast *"{BILL-0007} raised"*.
- App: list + a stepped "new bill" form; per-line discount instead of groups.

### 6.3 `/dashboard/sales/[id]` · `src/components/dashboard/sales/bill-view.tsx` — **KEEP**
- **GAP-10**: bill, its payments, business name/PAN, issuer name all server-loaded
  (`src/app/dashboard/sales/[id]/page.tsx:28-53`); no `GET /api/bills/{id}`.
- Tax invoice / customer copy toggle; payment picker (instant save → `PATCH /api/bills/{id}`); Void
  (owner **and** supervisor) with confirm; Print/PDF, Download image, Share image, WhatsApp
  (`wa.me/{digits}?text=`), Email (`mailto:`) — all client-side (`:236-287`, `src/lib/bill-image.ts`).
- Quote panel (`quote-review-panel.tsx`): share → `POST /api/bills/{id}/review` → URL + Copy; Withdraw
  (owner) → `DELETE`. The URL is only kept in component state; the app can rebuild it from
  `bill.review.token`.
- App: native share sheet, view-shot for the image, expo-print for PDF.

### 6.4 `/dashboard/customers` + `/dashboard/customers/[id]` — **KEEP**
- Parties list (`customers-view.tsx`): `useCustomers()` + `useBills()` (standing computed client-side
  over ≤ 200 bills); Ledger link shown to supervisors but the ledger page is owner-only.
- Party ledger (`party-ledger-view.tsx`, owner): `usePartyLedger(id)` → `GET /api/customers/{id}/ledger`.
  Empty *"Nothing has passed between you yet. …"*

### 6.5 `/dashboard/payments` (owner) · `src/components/dashboard/payments/payments-view.tsx` — **SIMPLIFY**
- Prop `today` (**GAP-6**). Tabs Payments / Parties / Accounts. **Web bug:** Accounts tab shows the
  payments empty state when there are no payments (`:166-195`).
- Record payment (`payment-dialog.tsx`) → `POST /api/payments`; against a bill (direction in only).
- Accounts (`accounts-panel.tsx`) → accounts CRUD; close has no confirm; `openedOn` off-by-one in UTC+ (`:287`).

### 6.6 `/dashboard/expenses` (owner) · `src/components/dashboard/expenses/expenses-panel.tsx` — **KEEP**
- Prop `today` (**GAP-6**, `src/app/dashboard/expenses/page.tsx:20-26`). `useExpenses()`; kind groups
  (`src/lib/expenses.ts:65-77`); stock purchase line editor; delete (owner) with confirm.
- No receipt photo exists (no upload purpose for it, `src/lib/storage/types.ts:49-55`).

### 6.7 Reports — `/dashboard/reports/{sales,inventory,finance,employee}` + `/dashboard/reports/[report]` — **SIMPLIFY**
- Hubs: `ReportHub group` → `useReportGroup(group, filters)` → `GET /api/report-groups/{group}`
  (`src/components/dashboard/reports/report-hub.tsx:35-41`). Finance is owner-only
  (`src/app/dashboard/reports/finance/page.tsx:11`; `src/lib/reports.ts:310-312`).
- Report page (`report-view.tsx`): `useReport(slug, filters)`; filter bar (range + employee/customer/
  category/payment per `ReportDef.filters`); table, totals, stats, chart; **Print** and **Download CSV**
  (built client-side, `:89-137`). Empty *"Nothing in this window. Try widening the dates or clearing
  the filters."* (`:255`); blocked reports explain themselves (`:345`).
- App: read-only cards + table; CSV via share sheet; print web-only.

---

## 7. Owner screens — workspace

### 7.1 `/dashboard/settings` · `src/components/dashboard/settings/settings-view.tsx` — **SIMPLIFY (read-only in app)**
- **GAP-8**: business, me, member count, pending invites, `uploadsConfigured()` server-loaded
  (`src/app/dashboard/settings/page.tsx:19-38`); **no `GET /api/business`** (live: 405).
- Owner edits name, crew size, time zone (8 zones, `src/lib/time.ts:7-16`), logo (`ImagePicker` purpose
  `logo`), standard week, office pin + rings, PAN, VAT → `PATCH /api/business`; toast *"Workspace updated"*.
- Supervisors see disabled inputs, but the week editor and office picker are not disabled (`:365-393`).
- App: read-only summary + "Your account"; editing is web-only.

### 7.2 `/dashboard/site` · `src/components/dashboard/site/site-builder.tsx` — **WEB-ONLY**
- `requirePageRole("owner")` (`src/app/dashboard/site/page.tsx:16`); `useSite` / `useSaveSite` /
  `usePublishSite`; template gallery + inline editor. Not linked from nav.

---

## 8. GAPS — pages that load data with no API equivalent

| # | Page / file:line | Data loaded server-side | Proposed endpoint |
|---|---|---|---|
| GAP-1 | shell `src/app/dashboard/layout.tsx:32-58` | viewer name/email/role, business name + logo, superAdmin, shift | `GET /api/me` |
| GAP-2 | shell `src/app/dashboard/layout.tsx:60-103` | 12 nav counts | `GET /api/nav-counts` |
| GAP-3 | owner home `src/app/dashboard/page.tsx:50-81` | crew, onSite, today's tickets (≤6), pending requests (≤4), greeting zone | `GET /api/dashboard/summary` |
| GAP-4 | employee home `src/app/dashboard/page.tsx:38-47` | shift, office | `GET /api/me` (include `business.office`) |
| GAP-5 | profile `src/app/dashboard/profile/page.tsx:17-24` | UserDTO + business name | `GET /api/me` |
| GAP-6 | tickets, notifications, projects/[id], attendance, expenses, inventory, maintenance, payments, sales pages | `timeZone`, `today`, `vatRate`, `businessName`, role flags | `GET /api/me` → `business{timeZone, today, vatRate, name, pan}` |
| GAP-7 | people `src/app/dashboard/people/page.tsx:16-37` | members incl. removed, invites (supervisor too), ownerId, week | widen `GET /api/invites` to supervisors (read); `ownerId`/`week` in `/api/me` |
| GAP-8 | settings `src/app/dashboard/settings/page.tsx:19-38` | BusinessDTO, stats, uploads flag | `GET /api/business` |
| GAP-9 | project detail `src/app/dashboard/projects/[id]/page.tsx:20-37` | ProjectDTO | `GET /api/projects/{id}` |
| GAP-10 | bill `src/app/dashboard/sales/[id]/page.tsx:28-53` | bill + payments + business + issuer | `GET /api/bills/{id}` |
| GAP-11 | signup `src/app/signup/page.tsx:24-34` | workspace invite | (web-only; none) |
| GAP-12 | blocked `src/app/blocked/page.tsx:29-38` | account vs workspace block | add `code: "account_blocked" \| "workspace_blocked"` to the 403 |

Shapes and file:line proposals: `backend-gaps.md` §3.

---

## 9. Summary: web page → recommendation

| Web route | Roles | Recommendation | Reason |
|---|---|---|---|
| `/` | all | WEB-ONLY | marketing |
| `/login` | all | KEEP | native login |
| `/signup` | invited owner | WEB-ONLY | rare, super-admin invite |
| `/join/[token]` | invitee | KEEP | crew onboarding deep link |
| `/choose` | super admin | WEB-ONLY | super admin is web |
| `/blocked`, `/removed` | any | KEEP | terminal screens from 403 |
| `/admin` | super admin | WEB-ONLY | platform admin |
| `/quote/[token]` | public | WEB-ONLY | external client |
| `/sites/[slug]` | public | WEB-ONLY | tenant website |
| `/dashboard` (employee) | E | KEEP | core day screen |
| `/dashboard` (owner/sup) | O,S | KEEP (simplified) | stats + today + approvals |
| `/dashboard/check-in` | E | KEEP | GPS check-in |
| `/dashboard/my-tickets` | E | KEEP | own tickets |
| `/dashboard/attendance` | E / O,S | KEEP / SIMPLIFY | own month / crew day |
| `/dashboard/requests` | E | KEEP | leave/advance/material |
| `/dashboard/profile` | E | KEEP | profile + sign out |
| `/dashboard/tickets` | O,S | SIMPLIFY | list + move sheet (no drag board) |
| `/dashboard/projects`, `[id]` | O,S | KEEP | lists + detail |
| `/dashboard/people` | O,S | SIMPLIFY | list, invite via share, remove |
| `/dashboard/approvals` | O,S | KEEP | quick-action inbox |
| `/dashboard/notifications` | O,S (+E in app) | KEEP | feed; logs simplified |
| `/dashboard/meetings` `installations` `follow-ups` `deadlines` | O,S | KEEP (one screen by kind) | lists |
| `/dashboard/calendar` | O,S | SIMPLIFY | agenda |
| `/dashboard/schedules` | O,S | SIMPLIFY | per-day roster |
| `/dashboard/maintenance` | O,S | KEEP | camera intake |
| `/dashboard/inventory` | O,S | SIMPLIFY | items + stock purchase |
| `/dashboard/sales`, `[id]` | O,S | SIMPLIFY / KEEP | bills, share |
| `/dashboard/customers`, `[id]` | O,S / O | KEEP | parties + ledger |
| `/dashboard/payments` | O | SIMPLIFY | ledger + record |
| `/dashboard/expenses` | O | KEEP | quick expense |
| `/dashboard/reports/*` (4 hubs + `[report]`) | O,S (finance O) | SIMPLIFY | read-only; exports via share |
| `/dashboard/settings` | O,S | SIMPLIFY (read-only) | edits on web |
| `/dashboard/site` | O | WEB-ONLY | template editor |
