# Recommended stack — Expo, runnable in Expo Go

Constraint: **Expo Go**, i.e. only the native modules that ship inside Expo Go; no custom native code,
no config plugins that need a rebuild. Library availability in Expo Go and SDK specifics are Expo's,
not this repo's — confirm each against the SDK you pin (Expo Go only runs the latest SDK).

## 1. Environment

```bash
# .env (Expo reads EXPO_PUBLIC_* at build time and inlines them)
EXPO_PUBLIC_API_BASE_URL=https://my-cms-ebon.vercel.app
```

Never point at `localhost`. When a custom domain arrives, the base URL must be the root domain or a
reserved label (`app.`, `api.`), never a tenant subdomain — tenant hosts answer 404 to every `/api`
(`src/proxy.ts:116-117`, `src/lib/tenancy.ts:22-49`).

## 2. Libraries

| Concern | Choice | In Expo Go | Why / mapping to the web |
|---|---|---|---|
| Routing | **expo-router** | ✅ | file routes (`navigation.md`), typed routes, deep links |
| Language | **TypeScript** (strict) | ✅ | same as web |
| Server state | **@tanstack/react-query v5** | ✅ (JS) | same caching model as web (`src/lib/query-client.ts:9-11`: `staleTime 60 s`, `retry 1`); **reuse the web's query keys** (`src/lib/queries.ts:53-84`) and invalidation groups (`:294-298, 591-593, 631-634, 685-688, 740-744, 856-859, 1285-1289`). Wire `focusManager` to `AppState` and `onlineManager` to NetInfo |
| Connectivity | @react-native-community/netinfo | ✅ | offline banner, pause queries |
| Validation | **zod v4** + **react-hook-form** + @hookform/resolvers | ✅ (JS) | **same schemas as the web** (§3). Zod v4 probes for `eval`; if Hermes complains, call `z.config({ jitless: true })` once at startup |
| Tokens | **expo-secure-store** | ✅ | access + refresh tokens (`backend-gaps.md` §1) |
| Location | **expo-location** (foreground) | ✅ | `getCurrentPositionAsync({ accuracy: Accuracy.Highest })`, 15 s timeout, no cache — same as `src/lib/geolocation.ts:18-39`; send `accuracyM` |
| Camera / gallery | **expo-image-picker** | ✅ | camera + library; the web only has a file input (`src/components/dashboard/image-picker.tsx:280-291`) |
| Compression | **expo-image-manipulator** | ✅ | ≤ 1,000,000 bytes, same ladder as `src/lib/images/compress.ts:22-33` (`backend-gaps.md` §4) |
| Upload | **expo-file-system** `uploadAsync` (multipart) | ✅ | known length from disk; mitigates the 411 rule |
| Images | **expo-image** | ✅ | disk cache honours the objects' `immutable` Cache-Control (`src/lib/storage/s3.ts:58`) |
| Maps | **react-native-maps** | ✅ | `<Marker>` + **`<Circle radius={ticket.radiusM}>`** for the geofence (and the office's two rings, dashed outer); Apple Maps on iOS, Google on Android. Place search stays on `GET /api/geocode` |
| Directions | `Linking.openURL` | ✅ | same Google Maps URL the web opens (`src/components/dashboard/tickets/ticket-detail-dialog.tsx:119-126`) or `maps:` on iOS |
| Notifications | **expo-notifications** | ⚠️ local ✅ · remote push on Android ❌ in Expo Go (SDK 53+) | see §5 |
| Sheets | **@gorhom/bottom-sheet** (+ reanimated, gesture-handler) | ✅ | web dialogs → sheets (`design-system.md` §4.6) |
| Date/time pickers | **@react-native-community/datetimepicker** | ✅ | web uses native `date`/`time`/`datetime-local` inputs |
| Icons | **react-native-svg** (port `nav-icons.tsx` paths) + **lucide-react-native** | ✅ | `design-system.md` §5 |
| Fonts | **expo-font** + `@expo-google-fonts/{sora,inter,jetbrains-mono}` + expo-splash-screen | ✅ | `design-system.md` §2 |
| Share / export | Share API, **expo-sharing**, **expo-print** (PDF), **react-native-view-shot** (bill image) | ✅ | bill print/PNG/WhatsApp/email (`src/components/dashboard/sales/bill-view.tsx:236-287`); CSV exports via a file + share sheet |
| Clipboard | expo-clipboard | ✅ | invite/quote links |
| Web pages | expo-web-browser | ✅ | quote, signup, site builder, settings editing |
| Toasts | small custom `Animated` toast (or a JS-only toast lib) | ✅ | rich colours in `design-system.md` §6 |
| Dates | `Intl.DateTimeFormat` with `timeZone` + the web's `src/lib/time.ts` helpers | ✅ (Hermes `Intl`) | all day keys are in the **workspace** zone; verify Hermes time-zone support on the pinned SDK |

## 3. Sharing the Zod schemas with the web

The validation closure is **pure** — every module imports only `zod` or other pure modules:
`src/lib/validations/*.ts` → `src/lib/work-constants.ts`, `src/lib/time.ts`,
`src/lib/security/safe-url.ts`, `src/lib/security/safe-url-schema.ts`, `src/lib/site-templates.ts`,
`src/lib/tenancy.ts`, `src/lib/storage/types.ts` (checked by grep of their imports). Useful pure
helpers ride along: `src/lib/ticket-window.ts` (past/current/upcoming), `src/lib/office.ts`
(`placeAgainstOffice`), `src/lib/geo.ts` (haversine, `formatDistance`), `src/lib/week.ts`. The OpenAPI
generator in this folder imports them under plain Node, which shows they don't depend on Next.

- **Phase 1 (start now): copied folder.** A `sync-shared` script copies those files into
  `mobile/src/shared/` (rewriting `@/lib/` → `@/shared/`) and writes a hash file; CI fails when the
  hashes drift. Zero change to the web repo.
- **Phase 2: workspace package.** Move them to `packages/shared` (`@ems/shared`) and import from both
  apps (npm workspaces + Metro `watchFolders`). Do this once the backend work for mobile lands, so the
  web refactor happens in one go.

Either way the app gets identical rules and messages (e.g. *"Say what you're blocked on"*,
`src/lib/validations/work.ts:137-142`) and `fieldErrors` from the server map onto the same form paths.

## 4. Styling: **StyleSheet + the theme object** (not NativeWind)

Pick: `StyleSheet.create` with `theme.ts` from `design-system.md` §6, plus a handful of primitives
(`Text` variants, `Button`, `Pill`, `Panel`, `StatTile`, `Sheet`, `Field`).

Why:
1. The web's look is **hand-written arbitrary values**, not a token-driven class vocabulary — 12.5 px,
   13.5 px, `px-[18px]`, `tracking-[0.07em]` (`design-system.md` §3). Porting class strings buys little.
2. The web is on **Tailwind v4 with CSS-first config and no JS config** (`components.json:8`,
   `src/app/globals.css`). NativeWind's stable line targets a Tailwind v3 JS config, so the tokens
   would be re-declared anyway.
3. RN specifics need code, not classes: letter-spacing must be converted em → px, fonts are chosen by
   family name per weight, shadows split into iOS props + Android elevation.
4. No component code is shared between web (DOM + Radix) and native either way; fewer build-time
   pieces means fewer Expo Go surprises.

## 5. What Expo Go can't do (and what it would need)

| Feature | Status in Expo Go | Needs |
|---|---|---|
| Remote push notifications on **Android** | not available (SDK 53+) | a development build (`expo-dev-client`) + FCM credentials |
| Remote push on iOS | verify for the pinned SDK | development build recommended anyway |
| **Background location / geofencing** (auto check-in reminders when entering a ticket's circle, `Location.startGeofencingAsync` + `expo-task-manager`) | not usable | development build (background modes, Android foreground service) + "Always" permission; the server would still decide check-ins (`src/app/api/tickets/[id]/check-in/route.ts:80-114`) |
| Universal links / custom scheme (`https://…/join/<token>`, `ems://`) | Expo Go only handles `exp://…/--/` links | development build + `/.well-known/apple-app-site-association` and `assetlinks.json` on the web domain |
| Google Maps with your own API key (Android, production) | Expo Go uses its own setup | build with the key in `app.json` |
| App icon, splash, bundle id, store builds | n/a | EAS Build |

Everything in §2 marked ✅ works in Expo Go for development and for the first internal pilot.

## 6. App-side conventions

- **API client:** port `apiFetch` (`src/lib/api-client.ts:28-56`): JSON headers, throw an
  `ApiRequestError(message, status, fieldErrors, body)` on non-2xx, and add `Authorization: Bearer`.
  On 401: single-flight `POST /api/mobile/auth/refresh`, retry once, else sign out. On 403 with
  `removed`/`blocked` messages (or the proposed `code`): route to the terminal screens.
- **Errors in forms:** same behaviour as `reportMutationError` (`src/lib/queries.ts:301-318`): first
  `fieldErrors` message per field onto the form, then a toast with `error`.
- **Clock:** show everything in `business.timeZone`; compute "past ticket" with the shared
  `isPastTicket` (`src/lib/ticket-window.ts:35-38`) so buttons hide exactly when the server refuses.
- **Location UX:** request foreground permission on first check-in / shift start, not at launch; show
  accuracy; never block the button on accuracy (the server doesn't, `backend-gaps.md`/`screens.md` §0.4).
- **Photos:** compress on pick, upload on save, clean up fresh uploads on failure
  (`src/components/dashboard/employee/status-dialog.tsx:138-160`).
