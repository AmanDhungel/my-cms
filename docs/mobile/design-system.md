# EMS design system — web → React Native (Expo)

Goal: the app looks like the web app. All values are taken from the code, with `file:line`.
Where the design reference `EMS-Design-System.html` and the code disagree, **follow the code** (noted
inline).

## 0. What the web actually uses

- **Tailwind v4 with no config file** — tokens live in `src/app/globals.css` (`@theme`,
  `:60-142`); `components.json:8` has `"config": ""`; PostCSS runs only `@tailwindcss/postcss`
  (`postcss.config.mjs:1-6`).
- shadcn (`radix-nova`, `components.json:3`) is installed, but feature code imports only `dialog`,
  `skeleton`, `calendar`, `popover`, `sonner` (and `dropdown-menu` on the landing). **Button, Input,
  Select, Badge, Card, Table are never used by screens.** The real visual language is the hand-written
  classes in `src/components/dashboard/ui.tsx`, `src/components/auth/field.tsx` and each view.
- **Light only.** `ThemeProvider forcedTheme="light"` (`src/components/providers.tsx:39-45`; comment
  "the EMS style guide is light-only", `:35-37`). There is a `dark` custom variant
  (`globals.css:5`) but **no dark token block**. → Build light-only.
- `src/components/ticket-card.tsx` and `src/components/status-badge.tsx` are **landing-page only**
  (imported only by `src/app/page.tsx`); don't use them for the app.

---

## 1. Colour tokens (all exact hex; none are oklch/hsl)

| Ramp | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **p** petrol teal (primary) | #EAF6F5 | #CFEDEA | #9DDBD4 | #64C2B9 | #35A79C | **#0E7C7B** | #0B6362 | #094F4E | #073C3B | #052A29 | `globals.css:14-23` |
| **a** marigold (accent) | #FDF6E9 | #FAE8C4 | #F6D48C | #F1BB55 | **#E89A1C** | #C87F0F | #A3660A | #7C4E07 | #563605 | #331F03 | `globals.css:26-35` |
| **n** warm grey | **#FAF9F7** (page bg) | #F2F0EC | #E4E1DA (borders) | #CFCAC0 | #A39D8F | #78715F | #5A5447 | #423D33 | #2B2721 | **#1B1815** (text) | `globals.css:38-47` |

**Status `s-*`** (`globals.css:50-55`; comment `:49`: "never used without its text label"):

| token | hex | meaning |
|---|---|---|
| s-pending | #64748B | pending / checked out |
| s-progress | #2F7DE1 | in progress / assigned |
| s-material | #E8A317 | blocked |
| s-time | #8B5CF6 | in review |
| s-done | #1DA76B | done / checked in |
| s-overdue | #E5484D | danger / overdue / destructive |

**Semantic (shadcn) tokens** (`globals.css:150-185`): background n-50 · foreground n-900 · card/popover
#FFFFFF · primary p-500 / white · secondary, muted, accent n-100 · muted-foreground n-600 · destructive
s-overdue · border n-200 · input n-300 · ring p-500 · chart-1..5 = p-500, a-400, s-progress, s-time,
s-done (**unused**; reports use `#35A79C` and `#C87F0F` with grid `#E4E1DA`, axis `#78715F`,
`src/components/dashboard/reports/report-chart.tsx:22-26`).

**Base layer:** links p-600, pressed p-700, no underline (`globals.css:239-245`); body
`bg-background text-foreground` (`:228-230`).

**Off-ramp literals used in code** (exact):

| hex | role | example |
|---|---|---|
| #FDECEC / #F7D4D5 | danger tint bg / border | `src/components/dashboard/employee/requests-view.tsx:21` |
| #EEFAF4 | success tint bg (paid, money in) | `src/components/dashboard/sales/payment.tsx:19` |
| #EEF4FD | info tint bg (quotation) | `payment.tsx:22` |
| #EFE9FD / #DED3FA / #5B3FB5 | leave (violet) bg/border/text | `src/components/dashboard/employee/attendance-view.tsx:23` |
| #EAF3FC / #CFE3F7 / #2F5D8A | training (blue) | `src/lib/operations.ts:111` |
| #F6EBFB / #E0B3F2 / #7A2E9C | overtime (purple) | `src/components/dashboard/attendance/crew-attendance-view.tsx:249` |
| rgba(27,24,21,0.45) | dialog scrim | `src/components/dashboard/dialog-chrome.ts:6` |
| rgba(250,249,247,0.9) | sticky header bg | `src/components/dashboard/owner-shell.tsx:227` |

Tailwind opacity modifiers (`/15`, `/40`, …) compile to `color-mix(in oklab, X N%, transparent)`; in RN
use `rgba()` (values in the theme below). Toasts use Sonner's `richColors` library defaults (HSL →
hex conversions in the theme; `node_modules/sonner/dist/styles.css:472-486`).

---

## 2. Fonts

| Role | Family | Weights used | Web loader | Where |
|---|---|---|---|---|
| Headings, stat values, dialog titles, avatars, "EMS" wordmark | **Sora** | 500/600/700 | `next/font/google`, `src/app/layout.tsx:11-15` | `font-heading` (`globals.css:102`) |
| Body, labels, buttons, inputs | **Inter** (variable) | 400/500/600/700 | `layout.tsx:17-20` | `font-sans` on `<html>` (`globals.css:231-233`) |
| Eyebrows, stat labels, table heads, chips, times, money, IDs | **JetBrains Mono** (variable) | 400/500/600/700 | `layout.tsx:22-30` | `font-mono` |

Roles comment: "Sora for display/headings, Inter for body, JetBrains Mono for IDs and numeric
metadata" (`layout.tsx:9-10`). No local font files exist in the repo (all Google Fonts).

**Expo (works in Expo Go):**

```ts
// npx expo install expo-font @expo-google-fonts/inter @expo-google-fonts/sora @expo-google-fonts/jetbrains-mono
import { useFonts } from "expo-font"
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter"
import { Sora_500Medium, Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora"
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono"

const [loaded] = useFonts({
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  Sora_500Medium, Sora_600SemiBold, Sora_700Bold,
  JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold,
})
// Keep the splash screen up (expo-splash-screen) until `loaded`.
```

Pick weight by **`fontFamily`** (e.g. `"Inter_600SemiBold"`), never `fontWeight` — Android does not map
`fontWeight` onto separately registered files. `tabular-nums` → `fontVariant: ["tabular-nums"]`. The
package/export names follow the `@expo-google-fonts` convention; confirm against the installed versions
(they are not in this repo).

---

## 3. Type scale, tracking, spacing, radii, borders, shadows

### 3.1 Type roles (as the app uses them — follow these, not the reference doc)

| Role | Font | Size / tracking | Colour | Source |
|---|---|---|---|---|
| Page H1 | Sora 700 | 28, −0.015em (−0.42 px) | n-900 | `src/components/dashboard/ui.tsx:39` |
| Employee H1 | Sora 700 | 22, −0.01em | n-900 | `src/components/dashboard/employee/screen.tsx:33` |
| Page subtitle | Inter 400 | 14.5 | n-600 | `ui.tsx:43` |
| **Eyebrow** | **Mono, UPPERCASE** | **11.5, +0.08em (0.92 px)** | p-600 | `ui.tsx:35` (employee 11 / 0.07em, `screen.tsx:30`) |
| Panel title | Sora 600 | 16 | n-900 | `ui.tsx:72` |
| Dialog title | Sora 600 | 19, line-height 1 | n-900 | `src/components/dashboard/employee/request-dialog.tsx:46` |
| Dialog description | Inter | 13.5 | n-500 | `request-dialog.tsx:49` |
| Stat label | Mono UPPERCASE | 10.5, +0.07em | n-500 | `ui.tsx:126` |
| Stat value | Sora 600 | 28, line-height 1 | n-900 | `ui.tsx:134` |
| Row title | Inter 600 | 14.5 (or 14) | n-900 | `src/components/dashboard/tickets/tickets-view.tsx:196` |
| Meta | Inter | 12.5 | n-500 | `tickets-view.tsx:199` |
| Body | Inter | 13, relaxed (1.625) | n-600 | `src/components/dashboard/employee/ticket-card.tsx:97` |
| Field label | Inter 600 UPPERCASE | 13, +0.05em | n-600 | `src/components/auth/field.tsx:10` |
| Input text | Inter | 15 | n-900 | `field.tsx:6` |
| Field error | Inter | 12.5 | s-overdue | `field.tsx:21` |
| Helper | Inter | 11.5 | n-500 | `src/components/dashboard/money-pickers.tsx:83` |
| Table header | Mono UPPERCASE | 10.5, +0.07em | n-500 | `src/components/dashboard/sales/sales-view.tsx:256` |
| Money | Mono 600 tabular | 13 | by direction | `src/components/dashboard/payments/payments-view.tsx:274` |

Reference doc (`EMS-Design-System.html:105-111`) says H1 Sora 600 26 and eyebrow mono 12 / 0.06em —
the code uses 700 28 and 11.5 / 0.08em.

Most-used arbitrary sizes: 12.5 (205×), 13 (121), 13.5 (107), 12 (74), 10.5 (71), 11.5 (47), 11, 19,
10, 15. **Arbitrary sizes set only font-size**, so line height = **round(size × 1.5)** (preflight
`html { line-height: 1.5 }`) unless a `leading-*` class is present (none 1, tight 1.25, snug 1.375,
relaxed 1.625, `[1.55]`).

**Letter spacing** — RN needs px = em × fontSize: 0.08em eyebrow/nav-group, 0.07em stat label/table
head, 0.06em phone label/business name, 0.05em field label/mono chips, −0.015em H1, −0.01em small headings.

### 3.2 Spacing

4 px base (`--spacing: 0.25rem`). Most used: 8 (`gap-2`), 7 (label→input gap), 14 (`gap-3.5`, grid
gaps), 10, 12, 6, **18 (panel/row horizontal inset `px-[18px]`)**, 16, 20, 24.
Owner page frame `px-5 pt-7 pb-12`, section gap 20–24 (`ui.tsx:11`); employee screen header `px-5 pt-4
pb-[18px]`, content `gap-4 px-5 pb-6` (`screen.tsx:28,40`).

### 3.3 Radii (`--radius` = 10 px, `globals.css:176`)

| use | px |
|---|---|
| bare `rounded` (priority chip, blocked strip) | 4 |
| segmented item | 5 |
| **buttons, inputs, small boxes (`rounded-md`)** | **8** |
| logo/avatar squares | 9 |
| tiles, board cards, nav items (`rounded-lg`) | 10 |
| **StatCard, Panel, EmptyState, phone cards** | **14** |
| **dialog / sheet** | **18** |
| pills, chips, round avatars | 9999 |

(The reference doc says md 10 / lg 16 — the code uses the table above.)

### 3.4 Borders

1 px everywhere. Colours: n-200 panels/cards/dividers; `rgba(228,225,218,0.7)` row dividers; n-300
inputs, outline buttons, dialog edge, **dashed empty states**; p-400 active chip; a-400 accent tile /
blocked card; s-progress checked-in employee card. Exceptions: 2 px left border on the blocked callout
(`employee/ticket-card.tsx:103`), 2 px ring on "today" (`attendance-view.tsx:114`).

### 3.5 Shadows (exact web values; RN mapping in the theme)

| name | CSS | where |
|---|---|---|
| sm | `0 1px 2px rgb(27 24 21 / .07)` | `globals.css:144` |
| md | `0 4px 14px rgb(27 24 21 / .09)` | `globals.css:145` |
| lg | `0 14px 34px rgb(27 24 21 / .13)` | `globals.css:146` |
| primary button | `0 3px 10px rgba(14,124,123,.22)` | `ui.tsx:160` |
| accent button | `0 3px 10px rgba(200,127,15,.22)` | `people/people-view.tsx:97` |
| checked-in card | `0 6px 18px rgba(47,125,225,.12)` | `employee/ticket-card.tsx:65` |
| dialog | `0 24px 60px rgba(27,24,21,.3)` | `dialog-chrome.ts:9` |
| input focus halo | `0 0 0 3px rgba(14,124,123,.14)` (danger `rgba(229,72,77,.16)`) | `auth/field.tsx:6` |

### 3.6 Motion

View-in: opacity 0→1, translateY 18→0, 350 ms `cubic-bezier(.2,.7,.2,1)` (`globals.css:188-197`).
In-progress pulse halo: 1.8 s, scale 0.6→1.9, opacity 0.6→0 (`globals.css:213-222`). Skeleton: opacity
1→0.5→1 over 2 s. Respect reduced motion (`globals.css:264-275`) → `AccessibilityInfo.isReduceMotionEnabled`.

---

## 4. Component patterns → RN spec

### 4.1 Stat tiles
- **StatCard** (`ui.tsx:106-152`): radius 14, 1 px n-200, white, padding 16, gap 8. Accent: border
  a-400, bg a-50, label a-700, value a-900. Label mono 10.5 +0.07em n-500 (already uppercase text);
  value Sora 600 28 / 28; hint 12.5 n-600, often led by a 7 px dot. Grid gap 14 (2 cols phone).
- **PhoneStat** (employee, `screen.tsx:71-95`): radius 10, n-200, padding 12×10, label mono 10
  +0.06em, value Sora 600 18.
- **Employee home Tile** (`employee-home.tsx:277-317`): as PhoneStat; value **Inter** 600 15; tone
  "good" = border p-400, bg p-50, label p-600, value p-700; "muted" value n-400.

### 4.2 Chips, filters, segmented controls
- **Filter chip** (`sales-view.tsx:369-398`): pill, 1 px, padding 12×6, 12.5 px (≈33 tall). Active bg
  p-100, border p-400, text p-700 semibold; inactive white, border n-200, text n-600 medium. Optional
  count mono 11 @ 70% opacity.
- **Segmented control** (`sales-view.tsx:129-146`): container border n-200, white, radius 8, padding 2,
  gap 2; item radius 5, padding 12×6, 12.5 px; active p-100 / p-700 semibold.
- **Choice cards in sheets** (`employee/status-dialog.tsx:216-220`): radius 10, padding 14×12; selected
  border p-400 bg p-50; title 14 semibold, hint 12.5 n-500.

### 4.3 Status pills — every status → colour

**Ticket** — "dot pill": bg n-100, text n-800, pill, padding 6 / 12 / 10, gap 7, 12.5 medium, 8 px dot
(`src/components/dashboard/ticket-status-badge.tsx:10-47`):

| status | label | dot |
|---|---|---|
| pending | Pending | #64748B |
| in_progress | In progress | #2F7DE1 **+ pulse halo** |
| in_review | In review | #8B5CF6 |
| blocked | Blocked | #E8A317 |
| done | Completed | #1DA76B |
| cancelled | Cancelled | #A39D8F |

**Priority chip** (only when not normal): radius 4, padding 6×2, mono 10 +0.05em uppercase — high
a-700 on a-50, critical #E5484D on #FDECEC (`ticket-status-badge.tsx:50-54`).
**Blocked callout:** 2 px left border a-400, bg a-50, text a-900, radius 8, 12.5 relaxed
(`employee/ticket-card.tsx:103`).
**Kanban columns** (`tickets/ticket-board.tsx:25-50`): Listed (s-pending) · In progress (s-progress,
also holds blocked) · In review (s-time, *"Waiting on your sign-off"*) · Completed (s-done).
Cancelled hidden.

**Bill payment chip** (pill, 1 px, padding 8×2, mono 10.5 +0.05em uppercase; `sales/payment.tsx:7-44`):
paid #1DA76B on #EEFAF4 (border s-done 40%) · unpaid #E5484D on #FDECEC · cheque a-700 on a-50 (border
a-400, + cheque no.) · quotation #2F7DE1 on #EEF4FD. **void**: s-overdue text + 40% border, no bg, row
at 55% opacity (`sales-view.tsx:268-276`).

**Request** (pill, padding 10×4, 11.5 medium; `employee/requests-view.tsx:18-22,124-131`): pending
"Waiting" a-700 on a-50 / a-200 · approved p-700 on p-100 / p-200 · rejected #E5484D on #FDECEC / #F7D4D5.

**Attendance** (same pill; `employee/attendance-view.tsx:20-25`, `crew-attendance-view.tsx:38-45`):
present p-700/p-100/p-200 · late a-700/a-50/a-200 · leave #5B3FB5/#EFE9FD/#DED3FA · absent
#E5484D/#FDECEC/#F7D4D5 · rest "Off" n-600/n-100/n-300 · overtime tag #7A2E9C/#F6EBFB/#E0B3F2.

**Schedule kinds** (`src/lib/operations.ts:95-124`): Working p · Overtime a · Training blue · Off n · Leave violet.

**Operations** (`operations/operations-view.tsx:326-338`; labels per kind `src/lib/operations.ts:39-84`):
scheduled a-700/a-50/a-200 ("Scheduled / Booked / Due / Open") · overdue #E5484D/#FDECEC ("Overdue") ·
done p-700/p-100/p-200 ("Held / Installed / Done / Met") · cancelled n-500 on white, border n-300. Kind
dots: meeting s-progress, installation p-500, follow-up a-400, deadline s-overdue.

**Maintenance** (no border, padding 8×2, 11.5 semibold; `maintenance/maintenance-view.tsx:57-65,291-303`):
received / diagnosing / "On the bench" p-700 on p-100 · awaiting_parts a-700 on a-400 @15% · repaired
#1DA76B on s-done @15% · returned / scrapped n-500 on n-100.

**Quote review** (`sales/quote-review-panel.tsx:100-119`): Waiting on them p-700/p-100 · Approved
s-done on 15% · Changes requested a-700 on a-400 15% · Withdrawn n-500/n-100.

**Payment direction** (`payments-view.tsx:477-490`): in #1DA76B/#EEFAF4 · out #E5484D/#FDECEC; amount
"+"/"−" in the same colour.
**Stock** (`inventory/inventory-view.tsx:524-540`): OUT s-overdue outline · LOW a-700 on a-50, border a-400.
**Notification dots** (`notifications-view.tsx:25-35`): check_in s-done · check_out s-pending ·
ticket_blocked s-material · ticket_in_review s-time · ticket_done s-done · ticket_assigned s-progress ·
request_raised a-400 · request_decided s-time · member_joined p-500. Unread row bg p-50 @40%, bold title.

### 4.4 Ticket cards
- **Employee card** (`employee/ticket-card.tsx:59-187`): radius 14, 1 px n-200 (checked in: border
  s-progress + checked-in shadow), white, padding 15, gap 12. Window mono 10 +0.06em n-500 · title Inter
  600 16 · site 12.5 n-500 with 12 px pin · status pill + eye button (border n-300, radius 8) ·
  description 13 n-600 · blocked callout · *"Checked in at HH:MM"* 12 p-600 with a 7 px s-done dot ·
  view-only line mono 10.5. Buttons: **Check in** p-500/white, **Check out** n-700/white, **Update
  status** outline — each radius 8, 13.5 semibold, padding 12×10, flex 1; disabled opacity .45.
- **Owner board card** (`tickets/ticket-board.tsx:203-333`): radius 10, border n-200 (a-400 if blocked),
  padding 12, gap 8; title 13.5 semibold; site 12 n-500; footer top border with up to 3 × 22 px
  avatars (on site: p-500/white), start time mono 10.5; *"N ON SITE · HH:MM"* mono p-600.
- **Board → RN:** segmented tabs per column (or a horizontal pager); replace drag + `<select>` with a
  "Move to…" bottom sheet listing the four columns.

### 4.5 Lists / tables
Real "tables" are grid rows in a **Panel** (radius 14, n-200, white, `ui.tsx:51-61`): toolbar padding
18×14; header strip n-100 with mono 10.5 +0.07em labels (desktop only); row padding 18×14, divider
`rgba(228,225,218,0.7)`. **RN:** FlatList rows padding 18/14 with a hairline divider; no header strip.

### 4.6 Dialogs → bottom sheets
EMS dialog chrome (`src/components/dashboard/dialog-chrome.ts:6-9`, used by every dialog): scrim
`rgba(27,24,21,0.45)`, surface n-50, border n-300, radius 18, shadow `0 24px 60px rgba(27,24,21,.3)`;
content padding 20–24, max width 440–680; body scrolls in 60–62 vh with gap 16; footer top border n-200,
bg ≈ #F6F5F2, buttons gap 8 (`request-dialog.tsx:41-52,108,223,231`).
**RN sheet:** backdrop scrim; surface #FAF9F7, top radius 18, 1 px #CFCAC0; padding 20; title
Sora_600SemiBold 19; description Inter 13.5 #78715F; body max ~60% height; footer #F6F5F2 with top
border; Cancel (outline) + primary action. Use `@gorhom/bottom-sheet` (Expo Go compatible) or RN `Modal`.

### 4.7 Forms
- **Input** (`auth/field.tsx:5-6`): height ≈ 48, padding-x 14, radius 8, 1 px n-300, white, Inter 15
  n-900, placeholder n-400. Focus: border p-500 + 3 px halo `rgba(14,124,123,.14)`. Invalid: border
  s-overdue (+ red halo).
- **Label** Inter 600 13 UPPERCASE +0.05em n-600; label→input gap 7; **error** 12.5 s-overdue; helper
  11.5 n-500.
- **Textarea** = input + min height 80 (`request-dialog.tsx:213`).
- **Select** = native `<select>` styled as the input (`money-pickers.tsx:59-80`) → RN: pressable styled
  as the input + bottom-sheet option list (add a chevron).
- **Date / time** = native `date` / `time` / `datetime-local` inputs (`shift-picker.tsx:44-61`) → RN:
  `@react-native-community/datetimepicker` (in Expo Go) behind an input-styled pressable. **Show and send
  times in the workspace time zone** (see `screens.md` §5.2, §5.10).
- **Search**: box border n-200, bg n-50, radius 8, 14 px glyph n-400, input 13.5 (`sales-view.tsx:240-248`).
- **Checkbox**: accent p-500, 15 px (`auth/login-form.tsx:93`).
- **Image picker**: single — box radius 10, 104 px thumb, "NO PICTURE" mono 9 +0.08em; multi — 92 px
  tiles radius 10, dashed add tile, counter mono 11 (`src/components/dashboard/image-picker.tsx:70-266`).

### 4.8 Empty states (dashed boxes)
- **EmptyState** (`ui.tsx:92-100`): 1 px **dashed** n-300, radius 14, white, padding 24×40, centred;
  message Inter 14 n-500 relaxed, max ~46ch; optional action below.
- **PhoneEmpty** (employee, `screen.tsx:62-63`): same, padding 16×32, 13 px.
- **Board column empty**: dashed n-300, radius 10, 12.5 n-400, *"Nothing here"*.
- **Error panel**: solid s-overdue border, radius 14, text s-overdue 13.5, outline *"Try again"*
  (`employee-home.tsx:330-340`).
- RN: `borderStyle: "dashed"` with `borderWidth: 1` works on both platforms.

### 4.9 Avatars, initials, logo fallback
`initialsOf` = first letter of the first two words, uppercased, `"??"` if empty
(`src/components/dashboard/viewer.ts:18-23`). Header avatar 32 px, p-100 bg, p-700 text, Sora 600 12
(owner radius 9, employee round). Business logo 32 px radius 9, cover; **fallback = same square with
the business initials** (`owner-shell.tsx:263-276`). Member rows 32 round Sora 11.5; board 22 px.
Brand mark: 24 px p-500 square radius 7 with an 8 px n-50 dot.

### 4.10 Buttons (hand-written; ignore shadcn Button)

| Variant | Spec | Source |
|---|---|---|
| Primary | bg p-500, white Inter 600 14, radius 8, padding 15×10 (≈40 tall), shadow primary, disabled 60% | `ui.tsx:159-160` |
| Secondary | white, 1 px n-300, n-700 text, same geometry | `ui.tsx:163-164` |
| Accent | bg a-400, text a-900, accent shadow | `people/people-view.tsx:97` |
| Danger solid | bg s-overdue, white, padding 18×10 | `payments-view.tsx:467` |
| Danger outline | border n-300, white, text s-overdue, pressed bg #FDECEC, 12.5 | `people-view.tsx:217` |
| Row action | outline n-300, n-700, radius 8, padding 10×6, 12.5 semibold (≈33 tall) | `sales-view.tsx:327` |
| Dark | bg n-700, white, 13.5 semibold | `employee/ticket-card.tsx:142` |
| Round icon | 34 px, border n-200, bg n-100 | `employee-home.tsx:146` |

Map web hover to RN pressed state (`Pressable` `pressed` style).

### 4.11 Badges
Nav count mono 11 n-500; marigold chip a-400/a-900 pill mono 11 (only when > 0); **alert badge**
s-overdue, 18 tall, min-width 18, mono 10.5 semibold white, "99+" above 99, hidden at 0
(`owner-shell.tsx:404-475`). → RN `tabBarBadge` styled the same.

### 4.12 Skeletons
bg #F2F0EC, radius 8, opacity pulse 1→0.5→1 / 2 s (`src/components/ui/skeleton.tsx:7`); shapes in
`src/components/dashboard/skeletons.tsx:9-121` (stat tiles, heading, rows, cards, phone screen, calendar).

### 4.13 Navigation chrome
- **Employee bottom bar** (`employee-shell.tsx:142-161`) → Expo Router `Tabs`: bg **#F2F0EC**, top
  border #E4E1DA, padding top 10 / bottom 16 + safe area; active tint **#094F4E** semibold, inactive
  **#78715F**; label Inter 11; icon 19; no active pill.
- **Owner sidebar** (`owner-shell.tsx:260-342`: width 236, bg n-100, groups mono 10.5 +0.08em n-400,
  items 13.5 with 15 px icons, active white bg + p-700 semibold + nav shadow) → RN **drawer** with the
  same five groups; the web's mobile fallback is a 25-item horizontal scroller (`:477-516`), which doesn't
  map to a native tab bar. Proposed tabs: see `navigation.md`.
- **Header** (`owner-shell.tsx:227-258`): 49 px, bg rgba(250,249,247,.9) + blur, bottom border n-200,
  brand mark + "EMS" Sora 700 15 + business name mono 11 +0.06em uppercase.

### 4.14 Toasts
Web: Sonner `<Toaster richColors position="top-right" />` (`src/components/providers.tsx:47`), radius 10,
border n-200, 13 px, 16 px lucide icons (CircleCheck / Info / TriangleAlert / OctagonX / Loader2,
`src/components/ui/sonner.tsx:11-43`), 4 s lifetime. → RN: a top toast (e.g. `sonner-native` if it runs
in Expo Go — **verify**; otherwise a small custom `Animated` toast) with the rich colours in the theme.

### 4.15 Pagination
Client-side, 10/page (`src/components/dashboard/pagination.tsx`). → RN: infinite scroll over the already
-fetched list (the server returns whole capped lists).

---

## 5. Icons

- The product UI uses **custom inline SVGs** (`src/components/dashboard/nav-icons.tsx`: viewBox 24,
  `fill="none"`, `stroke="currentColor"`, `strokeWidth 2`, default butt caps/miter joins). `lucide-react`
  appears only inside shadcn primitives and toasts.
- Nav icons (`nav-icons.tsx`): Dashboard :11 · Projects :22 · Tickets :30 · People :38 · Approvals :48 ·
  Bell :56 · Settings :65 · Pin :74 · Clock :83 · Inbox :92 · User :101 · Plus :110 · Eye :118 · Box :127 ·
  Receipt :136 · Wallet :145 · Contact :155 · Calendar :165 · Handshake :174 · Wrench :183 · Loop :191 ·
  Roster :202 · Flag :211 · Chart :220 · Stack :229 · Coins :238 · Outgoing :250 · Badge :261.
  Employee glyphs Home/Clock/Tickets/Sheet/Pin/Person (`employee-shell.tsx:185-236`).
- **RN recommendation: port the SVG path data 1:1 with `react-native-svg`** (bundled in Expo Go) —
  identical look. Use **`lucide-react-native`** (also Expo Go compatible) for generic UI icons (X,
  Check, Chevron*, toast icons). Approximate lucide analogues if you prefer one set: LayoutDashboard,
  Folder, AlignLeft, Users, Check, Bell, Sun (the custom "settings" is a circle with rays, not a gear),
  MapPin, Clock, Package, Receipt, Wallet, Contact, Calendar, Handshake, Wrench, RefreshCw, Table, Flag,
  ChartColumn, Layers, Coins, Award — names to be checked against the installed version.
- Sizes: tab 19, drawer 15–17, inline 12–14, bell 16.

---

## 6. Ready-to-paste `theme.ts`

```ts
// theme.ts — EMS tokens for React Native (Expo). Light-only (web forces light: src/components/providers.tsx:39-45).
// Sources: src/app/globals.css, src/components/dashboard/*, src/components/auth/field.tsx.

const p = { 50: "#EAF6F5", 100: "#CFEDEA", 200: "#9DDBD4", 300: "#64C2B9", 400: "#35A79C", 500: "#0E7C7B", 600: "#0B6362", 700: "#094F4E", 800: "#073C3B", 900: "#052A29" } as const
const a = { 50: "#FDF6E9", 100: "#FAE8C4", 200: "#F6D48C", 300: "#F1BB55", 400: "#E89A1C", 500: "#C87F0F", 600: "#A3660A", 700: "#7C4E07", 800: "#563605", 900: "#331F03" } as const
const n = { 50: "#FAF9F7", 100: "#F2F0EC", 200: "#E4E1DA", 300: "#CFCAC0", 400: "#A39D8F", 500: "#78715F", 600: "#5A5447", 700: "#423D33", 800: "#2B2721", 900: "#1B1815" } as const
const s = { pending: "#64748B", progress: "#2F7DE1", material: "#E8A317", time: "#8B5CF6", done: "#1DA76B", overdue: "#E5484D" } as const

export const theme = {
  colors: {
    p, a, n, s,
    white: "#FFFFFF",
    background: n[50], foreground: n[900],
    card: "#FFFFFF", primary: p[500], primaryForeground: "#FFFFFF",
    secondary: n[100], muted: n[100], mutedForeground: n[600],
    destructive: s.overdue, border: n[200], input: n[300], ring: p[500],
    link: p[600], linkPressed: p[700],
    reportSeries: ["#35A79C", "#C87F0F"], // report-chart.tsx:22
    tint: {
      danger: { bg: "#FDECEC", border: "#F7D4D5", text: s.overdue },
      success: { bg: "#EEFAF4", border: "rgba(29,167,107,0.4)", text: s.done },
      info: { bg: "#EEF4FD", border: "rgba(47,125,225,0.4)", text: s.progress },
      violet: { bg: "#EFE9FD", border: "#DED3FA", text: "#5B3FB5" },
      training: { bg: "#EAF3FC", border: "#CFE3F7", text: "#2F5D8A" },
      overtime: { bg: "#F6EBFB", border: "#E0B3F2", text: "#7A2E9C" },
      primary: { bg: p[100], border: p[200], text: p[700] },
      accent: { bg: a[50], border: a[200], text: a[700] },
      neutral: { bg: n[100], border: n[300], text: n[600] },
    },
    alpha: {
      scrim: "rgba(27,24,21,0.45)",
      headerBg: "rgba(250,249,247,0.9)",
      rowDivider: "rgba(228,225,218,0.7)",
      boardColumn: "rgba(242,240,236,0.6)",
      sheetFooter: "#F6F5F2",
      unreadRow: "rgba(234,246,245,0.4)",
      successFill15: "rgba(29,167,107,0.15)",
      accentFill15: "rgba(232,154,28,0.15)",
      dangerBorder40: "rgba(229,72,77,0.4)",
      focusRing: "rgba(14,124,123,0.14)",
      focusRingDanger: "rgba(229,72,77,0.16)",
    },
    toast: { // Sonner richColors defaults (HSL → hex)
      normal: { bg: "#FFFFFF", border: n[200], text: n[900] },
      success: { bg: "#ECFDF3", border: "#BFFCD9", text: "#008A2E" },
      info: { bg: "#F0F8FF", border: "#DDE7FD", text: "#0973DC" },
      warning: { bg: "#FFFCF0", border: "#FBEEB1", text: "#DC7609" },
      error: { bg: "#FFF0F0", border: "#FFE0E1", text: "#E60000" },
    },
  },

  fonts: {
    heading: { medium: "Sora_500Medium", semibold: "Sora_600SemiBold", bold: "Sora_700Bold" },
    body: { regular: "Inter_400Regular", medium: "Inter_500Medium", semibold: "Inter_600SemiBold", bold: "Inter_700Bold" },
    mono: { regular: "JetBrainsMono_400Regular", medium: "JetBrainsMono_500Medium", semibold: "JetBrainsMono_600SemiBold", bold: "JetBrainsMono_700Bold" },
  },

  // px. Web arbitrary sizes inherit line-height 1.5 → lh(size)
  fontSizes: { 9: 9, 9.5: 9.5, 10: 10, 10.5: 10.5, 11: 11, 11.5: 11.5, 12: 12, 12.5: 12.5, 13: 13, 13.5: 13.5, 14: 14, 14.5: 14.5, 15: 15, 16: 16, 18: 18, 19: 19, 22: 22, 28: 28 },
  lh: (size: number, ratio = 1.5) => Math.round(size * ratio),
  lineHeightRatio: { none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, card: 1.55 },

  // letter-spacing is em on the web; RN wants px
  ls: (em: number, fontSize: number) => Math.round(em * fontSize * 1000) / 1000,
  letterSpacing: { eyebrow: 0.92, statLabel: 0.735, tableHead: 0.735, phoneLabel: 0.6, fieldLabel: 0.65, monoChip10: 0.5, monoChip10_5: 0.525, navGroup: 0.84, h1: -0.42, h1Employee: -0.22 },

  spacing: { 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, labelGap: 7, inset: 18, card: 15 },

  radii: { bare: 4, segment: 5, sm: 6, md: 8, logo: 9, lg: 10, xl: 14, sheet: 18, full: 9999 },

  borders: {
    hairline: 1, accentLeft: 2,
    color: { default: n[200], strong: n[300], row: "rgba(228,225,218,0.7)", active: p[400], accent: a[400], focus: p[500], danger: s.overdue },
    dashed: { borderStyle: "dashed" as const, borderWidth: 1, borderColor: n[300] },
  },

  // iOS shadow* + Android elevation (approximate). RN ≥ 0.76 new arch also accepts `boxShadow` strings.
  shadows: {
    sm: { shadowColor: "#1B1815", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 1, elevation: 1 },
    md: { shadowColor: "#1B1815", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 7, elevation: 4 },
    lg: { shadowColor: "#1B1815", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.13, shadowRadius: 17, elevation: 10 },
    primaryButton: { shadowColor: "#0E7C7B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 5, elevation: 3 },
    accentButton: { shadowColor: "#C87F0F", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 5, elevation: 3 },
    checkedInCard: { shadowColor: "#2F7DE1", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 9, elevation: 4 },
    sheet: { shadowColor: "#1B1815", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 16 },
  },

  pills: {
    ticketDot: { pending: s.pending, in_progress: s.progress, in_review: s.time, blocked: s.material, done: s.done, cancelled: n[400] },
    ticketLabel: { pending: "Pending", in_progress: "In progress", in_review: "In review", blocked: "Blocked", done: "Completed", cancelled: "Cancelled" },
    dotPill: { bg: n[100], text: n[800], fontSize: 12.5, paddingVertical: 6, paddingLeft: 10, paddingRight: 12, gap: 7, dot: 8 },
    priority: { high: { bg: a[50], text: a[700] }, critical: { bg: "#FDECEC", text: s.overdue } },
    billPayment: {
      paid: { bg: "#EEFAF4", border: "rgba(29,167,107,0.4)", text: s.done },
      unpaid: { bg: "#FDECEC", border: "rgba(229,72,77,0.4)", text: s.overdue },
      cheque: { bg: a[50], border: a[400], text: a[700] },
      quotation: { bg: "#EEF4FD", border: "rgba(47,125,225,0.4)", text: s.progress },
    },
    request: { pending: { bg: a[50], border: a[200], text: a[700] }, approved: { bg: p[100], border: p[200], text: p[700] }, rejected: { bg: "#FDECEC", border: "#F7D4D5", text: s.overdue } },
    attendance: {
      present: { bg: p[100], border: p[200], text: p[700] }, late: { bg: a[50], border: a[200], text: a[700] },
      leave: { bg: "#EFE9FD", border: "#DED3FA", text: "#5B3FB5" }, absent: { bg: "#FDECEC", border: "#F7D4D5", text: s.overdue },
      off: { bg: n[100], border: n[300], text: n[600] }, overtime: { bg: "#F6EBFB", border: "#E0B3F2", text: "#7A2E9C" },
    },
    maintenance: {
      received: { bg: p[100], text: p[700] }, diagnosing: { bg: p[100], text: p[700] }, repairing: { bg: p[100], text: p[700] },
      awaiting_parts: { bg: "rgba(232,154,28,0.15)", text: a[700] }, repaired: { bg: "rgba(29,167,107,0.15)", text: s.done },
      returned: { bg: n[100], text: n[500] }, scrapped: { bg: n[100], text: n[500] },
    },
    operation: { scheduled: { bg: a[50], border: a[200], text: a[700] }, overdue: { bg: "#FDECEC", border: "#F7D4D5", text: s.overdue }, done: { bg: p[100], border: p[200], text: p[700] }, cancelled: { bg: "#FFFFFF", border: n[300], text: n[500] } },
    quoteReview: { pending: { bg: p[100], text: p[700] }, approved: { bg: "rgba(29,167,107,0.15)", text: s.done }, changes_requested: { bg: "rgba(232,154,28,0.15)", text: a[700] }, revoked: { bg: n[100], text: n[500] } },
    paymentDirection: { in: { bg: "#EEFAF4", border: "rgba(29,167,107,0.4)", text: s.done }, out: { bg: "#FDECEC", border: "rgba(229,72,77,0.4)", text: s.overdue } },
    stock: { out: { bg: "transparent", border: "rgba(229,72,77,0.4)", text: s.overdue }, low: { bg: a[50], border: a[400], text: a[700] } },
    notificationDot: { check_in: s.done, check_out: s.pending, ticket_blocked: s.material, ticket_in_review: s.time, ticket_done: s.done, ticket_assigned: s.progress, request_raised: a[400], request_decided: s.time, member_joined: p[500] },
  },

  motion: {
    viewIn: { duration: 350, fromTranslateY: 18, easing: [0.2, 0.7, 0.2, 1] },
    dotPulse: { duration: 1800, fromScale: 0.6, toScale: 1.9, fromOpacity: 0.6, toOpacity: 0 },
    skeletonPulse: { duration: 2000, minOpacity: 0.5 },
  },
} as const

export type Theme = typeof theme
```

`shadowRadius` ≈ CSS blur ÷ 2; Android `elevation` values are approximations.

## 7. Light / dark

Light only (§0). If a dark theme is ever wanted it has to be designed; nothing exists to port.
