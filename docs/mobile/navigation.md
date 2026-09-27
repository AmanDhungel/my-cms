# Navigation — Expo Router structure per role

Built from the web shells (`src/components/dashboard/employee-shell.tsx:10-17`,
`src/components/dashboard/owner-shell.tsx:75-223`) and the recommendations in `screens.md` §9.
Expo Router file conventions (`_layout.tsx`, `(group)` folders, `[param]` segments) are Expo's, not
this repo's — check them against the pinned SDK.

## 1. Tree

```
app/
  _layout.tsx                 Root: fonts, QueryClientProvider, AuthProvider, toast host.
                              Decides the branch from the stored session + GET /api/me:
                              none → (auth) · employee → (employee) · owner/supervisor → (manager)
                              403 removed → /removed · 403 blocked → /blocked
  +not-found.tsx

  (auth)/                     Stack, no header
    _layout.tsx
    login.tsx                 email + password → POST /api/mobile/auth/login (proposed)
    join/[token].tsx          GET /api/invites/{token} → POST /api/invites/{token}/accept → login
    paste-invite.tsx          "Paste your invite link" → extracts the token → join/[token]  (works in Expo Go)

  blocked.tsx                 terminal screens (full-screen, sign out only)
  removed.tsx

  (employee)/                 Tabs — mirrors the web's 6-tab bottom bar (employee-shell.tsx:10-17)
    _layout.tsx               Tabs: Home · Check in · My tickets · Attendance · Requests · Profile
    index.tsx                 Home: shift tiles, Start/End shift, Today/Upcoming/Done
    check-in.tsx              nearest-first list with live distance
    tickets/
      _layout.tsx             Stack
      index.tsx               My tickets: Now / Upcoming / Past
      [id].tsx                ticket detail (read-only when past), history, photos, directions
    attendance.tsx            month grid + day list
    requests/
      index.tsx               list + filter chips
    profile/
      index.tsx               profile, sign out, change password (after backend §1.6)
      notifications.tsx       NEW — employees receive notifications but the web has no screen for them

  (manager)/                  owner + supervisor
    _layout.tsx               Tabs: Home · Tickets · Approvals · Alerts · More
                              (supervisor: Approvals is read-only; "More" hides owner-only items)
    index.tsx                 Home: 4 stat tiles, today's tickets, pending approvals (GET /api/dashboard/summary, proposed)
    tickets/
      index.tsx               status tabs (Listed / In progress / In review / Completed) + scope chips
      [id].tsx                detail: crew, photos, blocker, materials, history, map, directions, "Move to…"
    approvals.tsx             Waiting / Approved / Rejected; owner approves/rejects inline
    notifications.tsx         feed + (owner) Logs segment
    more/
      index.tsx               grouped menu mirroring the web sidebar groups (see §3)
      projects/index.tsx
      projects/[id].tsx
      people/index.tsx
      people/[id].tsx
      attendance.tsx          Days / Tickets segments, day stepper
      calendar.tsx            month agenda
      operations/[kind].tsx   kind = meeting | installation | follow_up | deadline (one screen, KIND_COPY)
      schedules.tsx           per-day roster
      maintenance/index.tsx
      maintenance/[id].tsx
      inventory/index.tsx     items · categories · purchases
      inventory/[id].tsx
      sales/index.tsx
      sales/[id].tsx          bill: payment state, void, share image/PDF/WhatsApp/email, quote link
      customers/index.tsx
      customers/[id].tsx      ledger (owner only)
      payments.tsx            owner only
      expenses.tsx            owner only
      reports/[group].tsx     sales | inventory | finance (owner) | employee
      reports/view/[slug].tsx
      settings.tsx            read-only summary + "Edit on the web" link

  modals (presentation: "modal" or "formSheet" in the owning Stack)
    (employee)/tickets/[id]/check-in.tsx      check in / check out (fresh location fix, reason, overtime reason)
    (employee)/tickets/[id]/status.tsx        In progress / Blocked / Ready for review (+ photos)
    (employee)/shift-reason.tsx               "Starting away from the office" reason chips
    (employee)/requests/new.tsx               leave / advance / material
    (manager)/tickets/new.tsx                 create ticket (map pin, crew, window)
    (manager)/tickets/[id]/edit.tsx
    (manager)/tickets/[id]/move.tsx           action sheet of the 4 columns
    (manager)/tickets/[id]/materials.tsx
    (manager)/more/people/invite.tsx          → share sheet with joinUrl
    (manager)/more/maintenance/new.tsx
    (manager)/more/inventory/new.tsx
    (manager)/more/operations/[kind]/new.tsx
    (manager)/more/sales/new.tsx              stepped bill form
    (manager)/more/payments/new.tsx
    (manager)/more/expenses/new.tsx
    photo-viewer.tsx                          shared lightbox
```

Guarding: the root layout redirects by role; each group layout re-checks the role from `/api/me` and
redirects to its home on mismatch (same effect as `requirePageRole` → `/dashboard`,
`src/lib/auth/page-guards.ts:24-34`). Owner-only screens (payments, expenses, customer ledger,
finance reports, activity log) are hidden from supervisors in "More" and guarded again on the screen;
the API is the real guard (403).

## 2. Employee tabs

| Tab | Icon (port from `employee-shell.tsx:185-236`) | Mobile route | Web route |
|---|---|---|---|
| Home | HomeGlyph | `(employee)/index` | `/dashboard` |
| Check in | PinGlyph | `(employee)/check-in` | `/dashboard/check-in` |
| My tickets | TicketsGlyph | `(employee)/tickets` | `/dashboard/my-tickets` |
| Attendance | ClockGlyph | `(employee)/attendance` | `/dashboard/attendance` |
| Requests | SheetGlyph | `(employee)/requests` | `/dashboard/requests` |
| Profile | PersonGlyph | `(employee)/profile` | `/dashboard/profile` |

Add an unread badge on Profile (or a bell in the Home header → `profile/notifications`) —
the web links its bell to Requests (`src/components/dashboard/employee/employee-home.tsx:143-149`).

## 3. Owner / supervisor tabs and "More"

Five tabs (a native tab bar can't carry the web's 25 items — the web's own mobile fallback is a
horizontal scroller, `owner-shell.tsx:477-516`):

| Tab | Mobile route | Web route | Badge |
|---|---|---|---|
| Home | `(manager)/index` | `/dashboard` | — |
| Tickets | `(manager)/tickets` | `/dashboard/tickets` | open count (nav-counts) |
| Approvals | `(manager)/approvals` | `/dashboard/approvals` | pending (marigold) |
| Alerts | `(manager)/notifications` | `/dashboard/notifications` | unread (red, "99+") |
| More | `(manager)/more` | sidebar | — |

"More" groups, in the web's order (`owner-shell.tsx:75-223`): **Workspace** — Projects, People,
Attendance · **Operations** — Calendar, Meetings, Installation dates, Follow-ups, Employee schedules,
Important deadlines, Maintenance · **Sales & stock** — Inventory, Sales, Parties, Expenses★, Payments★ ·
**Reports** — Sales, Inventory, Finance★, Employee · **Account** — Organization settings, Sign out.
★ owner only (`owner-shell.tsx:162,194`). Super admin and the website builder are not listed (web-only).

## 4. Web route → mobile route

| Web route | Mobile route | Notes |
|---|---|---|
| `/` | — | web-only |
| `/login` | `(auth)/login` | |
| `/signup?invite=` | open in browser | web-only |
| `/join/[token]` | `(auth)/join/[token]` | deep link |
| `/choose`, `/admin` | — | web-only |
| `/blocked`, `/removed` | `blocked`, `removed` | from 403 codes |
| `/quote/[token]` | open in browser | web-only; shared from `sales/[id]` |
| `/sites/[slug]` | open in browser | web-only |
| `/dashboard` | `(employee)/index` · `(manager)/index` | by role |
| `/dashboard/check-in` | `(employee)/check-in` | |
| `/dashboard/my-tickets` | `(employee)/tickets` | |
| `/dashboard/attendance` | `(employee)/attendance` · `(manager)/more/attendance` | by role |
| `/dashboard/requests` | `(employee)/requests` | |
| `/dashboard/profile` | `(employee)/profile` | |
| `/dashboard/tickets` | `(manager)/tickets` | |
| `/dashboard/projects`, `/[id]` | `(manager)/more/projects`, `/[id]` | |
| `/dashboard/people` | `(manager)/more/people` | |
| `/dashboard/approvals` | `(manager)/approvals` | |
| `/dashboard/notifications` | `(manager)/notifications` · `(employee)/profile/notifications` | |
| `/dashboard/calendar` | `(manager)/more/calendar` | |
| `/dashboard/meetings` | `(manager)/more/operations/meeting` | |
| `/dashboard/installations` | `(manager)/more/operations/installation` | |
| `/dashboard/follow-ups` | `(manager)/more/operations/follow_up` | |
| `/dashboard/deadlines` | `(manager)/more/operations/deadline` | |
| `/dashboard/schedules` | `(manager)/more/schedules` | |
| `/dashboard/maintenance` | `(manager)/more/maintenance` | |
| `/dashboard/inventory` | `(manager)/more/inventory` | |
| `/dashboard/sales`, `/[id]` | `(manager)/more/sales`, `/[id]` | |
| `/dashboard/customers`, `/[id]` | `(manager)/more/customers`, `/[id]` | ledger owner-only |
| `/dashboard/payments` | `(manager)/more/payments` | owner |
| `/dashboard/expenses` | `(manager)/more/expenses` | owner |
| `/dashboard/reports/{group}` | `(manager)/more/reports/{group}` | finance owner |
| `/dashboard/reports/[slug]` | `(manager)/more/reports/view/[slug]` | |
| `/dashboard/settings` | `(manager)/more/settings` | read-only |
| `/dashboard/site` | open in browser | web-only |

## 5. Deep links

**Scheme:** `ems://` (set `scheme` in `app.json`). **In Expo Go** links are
`exp://<dev-host>/--/<path>` and custom schemes / universal links are not claimed by the app, so the
realistic Expo Go path is the **"Paste invite link"** screen plus in-app navigation from notifications.
Universal links need a development/production build **and** two files served by the web app (new,
additive): `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`.

| Link (as the server builds it) | Built at | App handling |
|---|---|---|
| `https://my-cms-ebon.vercel.app/join/<token>` | `src/app/api/invites/route.ts:88` | universal link → `(auth)/join/[token]`; if signed in as someone else, confirm sign-out first. Token = 32 random bytes base64url, 7-day TTL, single use (`src/models/invite.ts:15,57-64`) |
| `https://my-cms-ebon.vercel.app/quote/<token>` | `src/app/api/bills/[id]/review/route.ts:85` | **don't claim it** — it's for the client; the owner shares it with the native share sheet |
| `https://my-cms-ebon.vercel.app/signup?invite=<token>` | `src/app/api/admin/invites/route.ts:53-54` | don't claim — web-only |
| `ems://tickets/<id>` | — | from push `data.ticketId` → `(employee)/tickets/[id]` or `(manager)/tickets/[id]` |

**Notification `href` → route** (hrefs are web paths, `src/models/notification.ts:26-27`; values from the
notify call sites, `screens.md` §0.5):

| `href` | Employee | Owner / supervisor |
|---|---|---|
| `/dashboard` (ticket_assigned) | `tickets/[ticketId]` if present, else Home | Home |
| `/dashboard/tickets` | `tickets/[ticketId]` | `tickets/[ticketId]` or Tickets |
| `/dashboard/approvals` | — | Approvals |
| `/dashboard/requests` | Requests | — |
| `/dashboard/people` | — | More › People |
| `/dashboard/sales/<id>` | — | More › Sales › `[id]` |
| anything else | open the matching route from §4, or Home | same |

`ticketId` is stored on notifications but not returned by `NotificationDTO`
(`src/models/notification.ts:31,47-55`) — `backend-gaps.md` §3 proposes adding it.
