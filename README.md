# WorkAssign — Work Management, Campaign & Staff Monitoring System

This repository implements **Phase 1 (Core)** of the Work Management, Campaign &
Staff Monitoring System: staff/department/campaign data model, role-based task
assignment and tracking, auto-calculated campaign progress, and staff/management
dashboards. Phase 2/3 features (notifications, escalation, exports, etc.) are
explicitly out of scope for this build — see **Roadmap** below.

## Architecture

- **backend/** — Node.js + TypeScript + Express + Prisma ORM + Postgres.
  JWT auth (bcrypt-hashed passwords), role-based authorization middleware,
  REST API. `backend/api/index.ts` re-exports the Express app as a Vercel
  serverless function (catch-all via `backend/vercel.json`); `backend/src/index.ts`
  is still the local `npm run dev` entry point.
- **frontend/** — React + TypeScript + Vite, React Router, axios. Plain CSS
  (no UI framework) for a clean, functional interface.

The Prisma schema deliberately avoids Postgres-specific features it doesn't
need (enums are modeled as plain `String` columns) — it was originally built
against SQLite for local dev and migrated to Postgres for deployment; see
`backend/prisma/schema.prisma`.

### Deployment status (as of this writing)

Local dev (`npm run dev` in each folder against SQLite/Postgres) works fully.
**A live Vercel deployment was attempted but could not be completed or
verified end-to-end with the Vercel MCP tools available in that session**:

- There is no tool in that toolset to provision a Postgres database (Vercel
  Postgres / Neon / any other) — `buy_addon` only supports the `siem`
  add-on, and no Postgres-provisioning or storage-integration tool was
  exposed. Without `DATABASE_URL` pointing at a real reachable Postgres
  instance, the backend cannot serve any data-backed route.
- There is no tool to set environment variables on a Vercel project
  (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `VITE_API_URL`), so even a
  successful build has no way to be configured for production via the
  available tooling.
- Test deployments made with `deploy_to_vercel` (e.g. `workassign-api`)
  returned success, but the resulting project/deployment could not
  subsequently be found via `list_projects`/`get_project`, and the live URL
  could not be fetched (via `web_fetch_vercel_url` or through the sandboxed
  network) to confirm it actually serves traffic — so **no working deployment
  URL has been verified as reachable.**

All application-side changes needed for a deploy (Postgres datasource,
serverless entry point, in-memory attachment uploads, configurable CORS) are
in this branch and ready to use once a real `DATABASE_URL` and project env
vars can be set — see the code in `backend/api`, `backend/vercel.json`, and
`backend/prisma/schema.prisma`. To finish deployment by hand:

1. Provision a Postgres database (e.g. Vercel Postgres/Neon via the Vercel
   dashboard, or any other Postgres host) and copy its connection string.
2. Create/link a Vercel project rooted at `backend/`, set `DATABASE_URL`,
   `JWT_SECRET`, and `CORS_ORIGIN` (the frontend's URL) as project env vars.
3. Run `npx prisma db push` (no migration history exists yet — the old
   SQLite-flavored migration was removed) and `npm run seed` against that
   `DATABASE_URL` to load the demo data below.
4. Create/link a Vercel project rooted at `frontend/`, set `VITE_API_URL` to
   the backend project's URL, and deploy.

### Attachment storage tradeoff

Vercel's serverless functions have no persistent disk, so `POST
/tasks/:id/attachments` no longer writes files to a local `/uploads`
directory. It still records attachment metadata (file name, uploader,
timestamp) via `multer`'s in-memory storage, but the file bytes themselves
are discarded (`filePath` is stored as `unavailable://<filename>`). This was
chosen over wiring up Vercel Blob storage to keep the change minimal for
this MVP demo; swapping in Blob storage later only requires changing the
`POST /tasks/:id/attachments` handler in `backend/src/routes/tasks.ts`.

**Campaign chat attachments follow the same tradeoff, but actually keep the
bytes.** `POST /campaigns/:id/messages` accepts an optional file (any type)
alongside the text, sent as JSON with `attachmentName`, `attachmentType`
(MIME type) and `attachmentData` (a base64 `data:` URL) — no multipart/disk
handling needed. The bytes are stored inline on the `CampaignMessage` row
(`attachmentData String? @db.Text` in `backend/prisma/schema.prisma`) rather
than discarded, since there's no external object storage configured and no
credentials to add one without a new required env var. This is fine for an
MVP at low volume but has real costs: it bloats Postgres row size and counts
against Neon's storage quota, and every base64 byte is ~33% bigger than the
original file. A **3MB raw-file cap** is enforced both client-side (instant
feedback before upload) and server-side (the real guard) in
`backend/src/routes/campaigns.ts` — set below the requested ~5MB because a
5MB file becomes ~6.8MB of base64 JSON, over Vercel serverless functions'
~4.5MB request body limit; 3MB stays safely under that ceiling. Image
attachments render as inline thumbnails in the chat; everything else renders
as a filename + download link. If this grows past MVP usage, swap in Vercel
Blob (or similar) the same way the `TaskAttachment` tradeoff note above
describes.

**Voice messages reuse this exact mechanism — no new schema fields.** The
chat input's 🎙️ button records audio with `MediaRecorder`
(`navigator.mediaDevices.getUserMedia({ audio: true })`), lets the user
preview/re-record before sending, then sends the recorded `Blob` through the
same `attachmentName`/`attachmentType`/`attachmentData` fields as a file
attachment (`attachmentType` is the real recorded MIME type, e.g. `audio/mp4`
on Safari or `audio/webm` on Chrome; `attachmentName` gets a matching
extension). Playback renders an inline `<audio controls>` player whenever
`attachmentType` starts with `audio/`, alongside the existing image-thumbnail
and generic-download cases. Since MediaRecorder's default/supported
`mimeType` differs by browser (iOS/iPadOS Safari only supports MP4-wrapped
audio, not `audio/webm`), the recorder probes
`MediaRecorder.isTypeSupported()` against a candidate list (`audio/mp4` first
for Safari, then `audio/webm;codecs=opus` for Chromium/Firefox, then other
fallbacks) rather than assuming one browser's behavior. Rather than tracking
exact base64 byte size live during recording, recording auto-stops at **~2
minutes** as a simple, robust proxy for staying under the existing 3MB
attachment cap (compressed voice audio at typical bitrates is well under 3MB
for 2 minutes); the same 3MB check on the resulting blob still applies before
sending, same as any other attachment.

## Getting started

### Backend

Requires a Postgres database (a free local one via `docker run -e
POSTGRES_PASSWORD=postgres -p 5432:5432 postgres` works fine for dev).

```bash
cd backend
cp .env.example .env   # set DATABASE_URL to your Postgres connection string
npm install
npx prisma db push     # applies schema (no migration history in this repo yet)
npm run seed
npm run dev             # http://localhost:4000
```

`npm run build && npm start` runs the compiled production build.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev     # http://localhost:5173
npm run build   # type-checked production build
```

The frontend expects the backend at `VITE_API_URL` (default
`http://localhost:4000`).

## Seeded login credentials

| Role              | Username      | Password     |
|-------------------|---------------|--------------|
| Admin / GMA        | `admin`       | `Admin@123`  |
| Marketing Manager  | `mktg.manager`| `Manager@123`|
| Finance Manager    | `fin.manager` | `Manager@123`|
| Marketing Executive| `exec.arun`   | `Exec@123`   |
| Finance Executive  | `exec.divya`  | `Exec@123`   |

Seed data also creates 5 departments (Marketing, Finance, HR, Purchase, IT)
with sub-departments, the campaign "Onam Campaign 2026" attached to
Marketing and Finance with sample tasks, and two daily-work tasks.

## Data model

`User`, `Department`, `SubDepartment`, `Campaign`, `CampaignDepartment`,
`CampaignAccess`, `CampaignMessage`, `Task`, `TaskComment`, `TaskAttachment`,
`TaskDependency`, `RecurringWorkTemplate`, `AuditLog` — see
`backend/prisma/schema.prisma` for the full schema.

## Role-based visibility

Enforced server-side in `backend/src/middleware/auth.ts` and the task
scoping helper in `backend/src/routes/tasks.ts`:

- **Management** (GMA / AGM / ADMIN): see all tasks and campaigns, always.
- **Department Manager / Coordinator**: see their department's tasks.
- **Assistant Manager**: see tasks they created or are assigned.
- **Executive**: see only tasks assigned to them.

Campaign visibility (including a campaign's tasks and its chat) is further
restricted by **Campaign Access**: a per-campaign list of departments and/or
individual staff allowed to view/act on it (`CampaignAccess` model,
`backend/src/routes/campaigns.ts` → `hasCampaignAccess`). Management roles
and the campaign's Coordinator always have full access regardless of this
list; a campaign with no access rows configured falls back to "anyone in an
involved department" so pre-existing campaigns keep working. The access
picker lives on the campaign create form (`frontend/src/pages/Campaigns.tsx`).

**Who can add work**: GMA, AGM, Coordinator, Department Manager, and Admin
(plus a campaign's own Coordinator for that campaign's tasks) can use
"Add Task" (on a campaign) and "Add Work" (on Daily Work) — both open a
Department → Staff picker with "Select All Staff" and bulk-create one task
per selected person via `POST /tasks/bulk`.

## Key API endpoints

- `POST /auth/login`
- `GET/POST/PUT/DELETE /users` (supports `?departmentId=`, `?role=` filters),
  `/departments`, `/departments/:id/sub-departments`
- `GET/POST/PUT/DELETE /campaigns`, `POST/DELETE /campaigns/:id/departments`,
  `PUT /campaigns/:id/access` (replace the access list),
  `GET/POST /campaigns/:id/messages` (chat),
  `GET /campaigns/:id/progress` (auto-calculated department completion %),
  `GET /campaigns/:id/dashboard` (per-campaign mini-dashboard: KPI totals,
  status/priority breakdown, department completion, staff workload)
- `GET/POST/PUT/DELETE /tasks`, `POST /tasks/bulk` (bulk-assign to many
  staff), `PATCH /tasks/:id/status`, `PATCH /tasks/:id/assign`,
  `POST /tasks/:id/comments`, `POST /tasks/:id/attachments`
- `GET/POST/PATCH /recurring-work`, `GET /recurring-work/generate`
  (idempotently creates today's occurrences — see tradeoff below)
- `GET /dashboard/me`, `GET /dashboard/management` (now accepts
  `?range=today|week|month|custom&from&to`, `?departmentId=`, `?role=`)

Overdue status is never stored — it's computed on every response as
`dueDate < now && status not in (COMPLETED, CANCELLED)`.

## Recurring Daily Work — "generate on page load" tradeoff

There is no cron job or scheduler available in this deployment environment
(Vercel serverless functions only run in response to a request). Rather than
leave recurring work unimplemented, `RecurringWorkTemplate` records are
turned into real, independently-completable `Task` rows (workType=DAILY,
linked back via `Task.recurringTemplateId`) by `GET /recurring-work/generate`,
which the frontend calls once whenever the Daily Work, Calendar, or Recurring
Work page loads. The endpoint is idempotent — it checks whether today's
occurrence already exists (by template + assignee + start-of-day) before
creating one — so calling it repeatedly, from multiple pages or multiple
users, never creates duplicates. The tradeoff: if nobody opens one of those
pages on a given day, that day's occurrences are simply generated the next
time someone does (backfill only happens for "today", not missed past days).
A real cron trigger (e.g. Vercel Cron once available, or an external
scheduler hitting `/recurring-work/generate`) would remove this limitation
without any other code changes.

## Roadmap / Phase 2 & 3 (not built here)

- Notifications and reminders (due-today/overdue alerts, email/push)
- Escalation workflows beyond the simple `approvalStatus` field
- Enforcement of `TaskDependency` (blocking dependent tasks until
  prerequisites complete) — the data model exists, the rule is not enforced
- Data exports (CSV/PDF/Excel reports)
- Audit trail UI (the `AuditLog` table is populated but has no admin screen)
- A real cron/scheduler for recurring work (see tradeoff above) — currently
  generated lazily on page load instead
- Campaign chat is polling-based (every ~4s), not websockets — fine for MVP
  scale but not real-time at larger scale
- Server-side pagination for task/campaign lists (current lists load
  everything the caller can see and filter client-side, which is fine at
  MVP data volumes but won't scale indefinitely)

## Done in this update (additive, on top of Phase 1)

- Campaign Number auto-generation (`CAM-YYYY-NNN`), Campaign Coordinator
  (replacing Owner), Budget field removed
- Campaign chat (`CampaignMessage`), polling-based
- Campaign Access control (departments + individual staff), enforced on
  campaign detail, its tasks, and its chat
- Permission-gated "Add Task" (campaign) / "Add Work" (daily) bulk-assign
  flows (department → staff picker → Select All)
- Recurring Daily Work templates (`RecurringWorkTemplate`) with
  daily/weekly/monthly recurrence and lazy "generate on page load" occurrence
  creation
- Calendar: task type (Campaign/Daily/Recurring) badges, completed/overdue
  styling
- Management Dashboard: dependency-free SVG bar/donut charts (task status,
  department completion, campaign progress, staff workload) plus Date
  Range / Department / Role filters wired into `/dashboard/management`
- "My Work" sub-filter bar (All/Pending/In Progress/Due Today/Upcoming/
  Overdue/Completed/Campaign/Daily/Recurring)
- Search + filter controls on Campaigns and Task list screens (client-side
  filtering over the already-scoped list)
- Staff, Departments, Roles/Hierarchy and Permissions unified into one
  "Organization & Access Management" page with tabs (`/admin`); old
  `/staff` and `/departments` links redirect there
- Password show/hide eye-icon toggle on Login and the admin staff-creation
  form (`frontend/src/components/PasswordInput.tsx`)
- Full mobile responsiveness pass: the sidebar collapses into an off-canvas
  menu behind a hamburger toggle below 768px (`frontend/src/components/Layout.tsx`),
  every table scrolls within its own container instead of the whole page,
  forms/KPI grids/dashboard charts reflow to one column, and inputs use a
  16px font on mobile to avoid iOS Safari's auto-zoom-on-focus
  (`frontend/src/index.css`)
- Calendar redesigned with a clean month-grid view (Mon–Sun columns, today
  highlighted, compact truncating task-title pills per day, prev/next/Today
  navigation, click a day to see its tasks inline) alongside the existing
  day/week list views, plus a search + department/status filter bar
  (`frontend/src/pages/Calendar.tsx`)
- Campaign chat file attachments (any file type, inline base64 storage, 3MB
  cap) — see "Attachment storage tradeoff" above
- Dedicated per-campaign dashboard on the Campaign Detail page: a KPI row
  (total/completed/in-progress/pending/overdue/completion %), task status
  donut, department completion bar chart, staff workload bar chart and
  priority breakdown, all computed live from that campaign's tasks by the new
  `GET /campaigns/:id/dashboard` endpoint (reuses the same `hasCampaignAccess`
  check and overdue definition as the rest of the campaign routes, and the
  same `BarChart`/`DonutChart`/`.kpi-grid`/`.charts-grid` components/styles as
  the management dashboard — no new schema fields or charting library). The
  existing per-department task table stays below it unchanged.
- Modernist/Swiss-style visual redesign of the frontend, first pass (pure CSS,
  no new dependencies, no functional changes). Flat cards/tables with 1px
  borders instead of drop shadows, a dark flat sidebar with a left
  accent-border active state, consistent spacing/radius scales.

### "Modernist" Claude Design spec adoption (token layer, in progress)

A high-fidelity Claude Design spec ("Work Management System — Modernist")
was later supplied as the actual design target — an HTML prototype +
handoff README + shared `styles.css` describing exact tokens, typography,
per-screen layout and new interactions (kanban drag-and-drop, task drawer,
Add Task wizard, global search, notifications panel, toasts, etc.).

**Completed in this pass (Priority 1 — design tokens):**
`frontend/src/index.css`'s `:root` block now defines the exact Modernist
token set from the spec: `--color-bg #f4f4f2`, `--color-surface #e8e8e5`,
`--color-text #16181a`, `--color-accent #b68235`,
`--color-divider rgba(22,24,26,0.20)`, the full neutral ramp
(`--color-neutral-100…900`) and accent ramp (`--color-accent-100…900`),
`--shadow-sm/md/lg`, radius `0` everywhere, and the spacing scale
(`--space-1…6` = 4.6/9.2/13.8/18.4/27.6/36.8px). Archivo + Archivo Narrow
(400/500/600) are loaded via Google Fonts and applied to `--font-sans` /
`--font-heading`; headings use Archivo Narrow 600 with `-0.02em` tracking,
`h6` added for the 13px uppercase 0.14em label style, and
`font-variant-numeric: tabular-nums` is set globally per the "every figure
is tabular" rule. The old ad-hoc token values (`--color-primary` etc.) are
kept as aliases pointing at the new accent/status tokens so every existing
component that already referenced them (buttons, badges, charts, KPI cards,
tables) picks up the new palette without per-file rewrites.

**Not yet done — explicitly deferred, not silently skipped:**
- The `styles.css` component-class vocabulary (`.btn`/`.btn-primary`/
  `.btn-secondary`/`.btn-ghost`/`.tag`/`.seg`/`.radio`/`.dialog` etc.) has
  **not** been rebuilt as first-class classes in `index.css` — existing
  component styles were re-tokened in place rather than replaced with the
  spec's class system.
- **Priority 2** (per-screen layout rework — sidebar/top-bar shell, KPI
  grid/donut/department/workload/deadline chart specs, Campaign Detail's
  two-column + access-chips layout, Calendar's Monday-start/today-highlight
  spec, Organization & Access's indented hierarchy + permissions matrix) was
  **not performed** in this pass — screens keep their prior layout, now
  under the new color/type/spacing tokens.
- **Priority 3** (global search + notifications panel, toast system, My
  Work list/kanban toggle with drag-and-drop, task drawer, Add Task wizard
  modal, dashboard drill-down panels) was **not implemented**.

This means the app currently has the *correct palette, fonts, spacing unit
and square-corner radius* from the Modernist spec applied globally, but the
screen-by-screen layouts and the new interactive functionality described in
the handoff doc are still open work for a follow-up pass.

### Design direction pivot: Modernist → soft rounded "cream" style

The Modernist direction above (square corners, dark sidebar, mustard-on-cool-
grey, condensed Archivo Narrow type) was superseded after the user reviewed
it and asked for a different, softer aesthetic based on a new reference
screenshot. `frontend/src/index.css`'s `:root` token block was **replaced**
(not layered) with a new system:

- Warm cream page background (`--color-bg: #f7f0e2`), white rounded cards
  with soft box-shadows instead of hairline borders
  (`--radius-lg: 20px`, `--shadow-sm/md/lg`)
- One warm amber accent (`--color-accent-500: #e8b923`) plus charcoal
  (`--color-charcoal: #241f18`) as the strong contrast color, used for
  primary buttons and the sidebar's active nav tile
- Plus Jakarta Sans (Google Fonts) replaces Archivo/Archivo Narrow; no more
  uppercase-tracked labels
- Status badges are soft-tinted rounded pills; buttons are pill-shaped
- Sidebar rebuilt as a 2-column grid of rounded nav tiles with the active
  item shown as a solid charcoal tile, a "Quick Links" section with colored
  dot bullets, and a profile card (avatar-initials chip + name + role +
  log-out) pinned at the bottom — the existing mobile hamburger-collapse
  behavior is unchanged underneath this new look
- `frontend/src/components/Charts.tsx`'s `COLORS` palette updated to the new
  amber/charcoal/muted set, and two new dependency-free SVG chart helpers
  were added in the same style: `GaugeChart` (semicircular progress ring for
  a hero percentage) and `LineChart` (sparkline with a dashed average
  reference line). No charting library was introduced.

**Kanban view (new, on My Work only):** `frontend/src/pages/TaskListPage.tsx`
gained a List/Kanban toggle, shown only on the "My Work" page. Kanban groups
the real `Task.status` enum into 4 columns — Not Started (`NOT_STARTED`,
`ASSIGNED`), In Progress (`IN_PROGRESS`, `ON_HOLD`), Submitted/Review
(`SUBMITTED`, `UNDER_REVIEW`, `REVISION_REQUIRED`), Completed (`APPROVED`,
`COMPLETED`). Cards show title, an assignee initials chip, due date and a
priority tag, with a status-colored left accent bar (red for overdue).
Dragging a card to another column uses native HTML5 drag-and-drop
(`draggable`/`onDragStart`/`onDragOver`/`onDrop` — no new dependency) and
calls the existing `PATCH /tasks/:id/status` endpoint, with an optimistic
UI update that rolls back on failure and a brief toast confirmation either
way. No schema changes were needed or made.

**Restyle status by page (this pass):**
- Done via the shared token/class rewrite (card, btn, kpi-card, badge,
  table, tab-bar, calendar grid, sidebar, mobile patterns all live in
  `index.css`): Dashboard, Login (uses only shared `.login-page`/
  `.login-box`/`.btn` classes, so it picked up the new look automatically),
  Calendar, Task Detail, Recurring Work, Campaigns, Campaign Detail,
  Organization & Access — all render with the new cream/white/amber system
  and rounded corners because they build on the shared classes.
- **Kanban view** (the explicitly-requested missing piece): implemented on
  **My Work only**, as scoped.
- **Not yet individually redesigned beyond the shared tokens:** a handful of
  small inline hex values remain in `CampaignDetail.tsx` (priority-color map,
  chat bubble backgrounds, a couple of KPI-chart colors) and `Dashboard.tsx`
  (management KPI donut colors) that were not remapped to the new palette's
  exact hex values — they still read fine on the new cream background
  (blue/green/red semantic colors) but haven't been swapped for the amber-
  first palette. A follow-up pass could tighten these plus add the
  gauge/grouped-bar-chart/list-card patterns described in the new reference
  (KPI gauge, grouped bar chart with floating labels, search-box-in-card-
  header, small linked stat chips) to Dashboard and Campaign Detail
  specifically — the primitives (`GaugeChart`, `LineChart`, `.stat-chip`,
  `.card-header`, `.search-box` CSS) now exist in `Charts.tsx`/`index.css`
  for that follow-up to use.

### Dashboard header refinement: greeting, gauge, gradient + glass

`frontend/src/pages/Dashboard.tsx` gained a dedicated header row above the
existing KPI grid/charts/tables (all of which are unchanged):

- **Left:** a small "Home / Dashboard" breadcrumb, a large bold time-of-day
  greeting ("Good morning/afternoon/evening, {first name}" from `useAuth()`,
  based on `new Date().getHours()`), and a muted subtitle with today's full
  date.
- **Right:** a hero `GaugeChart` (reused from `Charts.tsx`) showing the
  overall completion percentage, computed client-side from existing counts
  (`mgmt.tasks.completed / mgmt.tasks.total` for managers, otherwise
  `my.counts.completed / my.counts.total`) — no new backend fields. Next to
  it, the management dashboard's date-range selector was moved up into the
  header (department/role filters and the custom-date inputs remain below,
  unchanged), plus a bell-icon notifications button with a count badge and a
  dropdown panel listing overdue/due-today tasks, derived client-side from
  the already-loaded `/dashboard/me` data — no new notifications backend.
- Responsive: at the existing 768px breakpoint the header stacks
  (greeting block above the gauge/controls block) instead of overflowing.

**Gradient + glass:** `index.css` adds `--gradient-page` (very subtle, used
on `body`) and `--gradient-hero` (warmer, used on the dashboard header
background) CSS custom properties within the existing cream/amber palette,
plus a reusable `.glass` utility class (translucent white + `backdrop-filter:
blur()` + soft border) applied only to the header's gauge card, date-range
select, and notifications button/panel — the rest of the app keeps its
existing solid-white rounded-card system unchanged.

### Visual refinement pass: sidebar tiles, KPI icons, gauge, logomark

A follow-up pass closed four remaining gaps against the "Homies Lab"
reference screenshot, pure frontend/CSS, no schema or API changes:

- **Sidebar nav tiles** (`Layout.tsx`, `index.css`): rebuilt as square
  icon-above-label tiles in the existing 2-column grid, with hand-written
  inline thin-stroke SVG icons (no icon library) replacing the previous
  emoji/unicode glyphs — active tile stays solid charcoal with a white
  icon+label, inactive tiles are light. The existing mobile hamburger
  collapse/overlay behavior is unchanged.
- **KPI card icon chips** (`Dashboard.tsx`): every `.kpi-card` (both "My
  Dashboard" and "Management Overview" sets) now shows a small rounded
  soft-tinted icon chip above the number, with the icon chosen per stat's
  meaning (checklist, clock, progress, calendar, alert, check, flag,
  megaphone) and tint colors varied slightly per card for visual interest.
- **Gauge chart** (`Charts.tsx`, `GaugeChart`): thicker arc, a warm amber
  gradient fill (`<linearGradient>`, dark→light), small tick number labels
  at 0/20/40/60/80/100 around the arc, and a circular handle dot marking
  the end of the filled arc. New `min`/`max`/`showTicks` props are optional
  with defaults, so existing call sites (`Dashboard.tsx`) work unchanged.
- **Sidebar logomark**: a small circular charcoal badge with a minimal
  checkmark-style SVG mark now sits immediately before the "WorkAssign"
  text in both the desktop sidebar header and the mobile top bar
  (pure CSS/inline SVG, no image asset).
- **Organization & Access — Staff tab rebuilt** (`frontend/src/pages/Admin.tsx`)
  to match the design-spec layout: a "New staff" form (name/ID/department/role,
  then a full-width password field using `PasswordInput`'s new `variant="button"`
  uppercase Show/Hide toggle plus a "stored hashed" caption), a "Staff" table
  with Employee/ID/Department/Designation/Reporting To/Open Work/Status
  columns, and a "Hierarchy" card built from real `reportingManagerId` chains
  (Executives are collapsed into one "{Department} executives — N staff" row
  per manager instead of listed individually). "Reporting To" resolves the
  manager's name client-side from the already-loaded `/users` list (no backend
  change needed); "Open Work" is a real per-user count of non-terminal
  assigned tasks added as a `_count`/aggregate on the existing `GET /users`
  query (`backend/src/routes/users.ts`) — additive and query-time only, no
  schema migration.
- **Permissions tab rebuilt** as a read-only matrix (Permission ×
  GMA/AGM/Coordinator/Manager/Executive) that mirrors the real
  `requireRoles(...)`/`canAssignWork(...)` server-side guards — e.g. "Manage
  Users" and "Manage Permissions" are GMA-only (AGM is deliberately
  unchecked, matching `requireRoles('ADMIN', 'GMA')` on the users/departments
  write routes), while campaign/task/report actions follow the
  `WORK_ASSIGNERS` group (GMA, AGM, Coordinator, Manager).
