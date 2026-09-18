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

## Campaign chat: reply, message info, pin, downloads (this update)

Five additions to the existing campaign chat feature, built on the same
patterns as the earlier edit/delete work (base64 inline attachments,
`requireCampaignAccess()` gating on every route).

- **Reply to a message** — any campaign-chat participant (not just the
  message owner) can reply to any message. `POST /campaigns/:id/messages`
  accepts an optional `replyToId`, validated to belong to the same campaign,
  and both the list (`GET .../messages`) and the create response include a
  `replyTo: { id, text, attachmentName, user: { name } }` snippet so the
  quoted preview renders with no extra request. The composer shows a
  cancelable quoted-reply preview above the input; each reply renders a
  small quoted block (sender + truncated snippet) above its own content,
  clickable to scroll to the original.
- **Message info (date + seen by)** — a new lightweight `CampaignChatRead`
  model (`{ campaignId, userId, lastSeenAt }`, unique per campaign+user)
  replaces a heavy per-message-per-user read table. The frontend upserts its
  own `lastSeenAt` via `POST /campaigns/:id/chat-read` on chat load and on
  every existing 4s poll tick; `GET /campaigns/:id/chat-read` returns all
  read rows (with user names) for the campaign. "Seen by" for any message is
  then computed client-side as: every read row with `lastSeenAt >=` that
  message's `createdAt`, excluding the message's own author — no backend
  per-message computation. Clicking the timestamp/ⓘ on a message opens a
  small popover (styled like the existing `.dash-notif-panel`) with the full
  date+time and the seen-by list.
- **Pin a message** — `pinned Boolean @default(false)` on `CampaignMessage`,
  toggled via `PATCH /campaigns/:id/messages/:messageId/pin`. Kept open to
  anyone with chat access (same gate as sending a message) rather than
  restricted to the campaign-management role set used for campaign-level
  actions like `PUT /:id/access` — pinning a chat message is low-stakes and
  reversible by anyone in the same chat, unlike changing who can see the
  campaign. Pinned messages show a "📌 Pinned" label inline and are listed in
  a compact strip above the scrolling message list (click an entry to scroll
  to it).
- **Explicit download button on every attachment type** — image and audio
  attachments now also get a small download icon (image: overlaid on the
  thumbnail; audio: next to the player) that triggers a browser download of
  the existing base64 `attachmentData`, matching the affordance generic
  files already had. No backend change.
- **Icon-only attach/send controls** — the 📎 emoji label and literal "Send"
  text button were replaced with small hand-written inline SVG icons
  (paperclip, paper-plane), matching the icon style already used in
  `Layout.tsx`/`Charts.tsx`, with `aria-label`/`title` kept for
  accessibility.

**Schema safety** (see "recent incident" note on `prisma db push
--accept-data-loss` with no migration history — every new required column
must be nullable or safely defaulted):
- `CampaignMessage.replyToId String?` — nullable self-relation FK, no
  default needed since it's optional.
- `CampaignMessage.pinned Boolean @default(false)` — has a default Prisma
  can apply to existing rows with no backfill.
- `CampaignChatRead` — an entirely new table; new tables need no backfill
  regardless of their own columns being required, since there are no
  existing rows to violate a NOT NULL constraint.

### Further chat improvements considered but not built (suggestions)

@mentions with notification, emoji reactions, typing indicators, an
unread-message divider with scroll-to-unread on open, multi-file attach in
a single message, in-chat search, per-campaign chat muting, message
forwarding between campaigns, link previews for pasted URLs, and a chat
export/transcript download (PDF or plain text).

## Management Overview dashboard restructure (visual/richer widgets)

The "Management Overview" section of the main Dashboard was restructured
into a richer, more visual set of widgets, reusing the existing card/gauge/
chart components and the amber/charcoal/cream color system as-is (no new
palette, no photo cards, no dark panels).

**Implemented:**
- **6-card KPI row** — Active Campaigns, Total Tasks (+ "N pending"),
  Completed (+ completion %), In Progress (+ "N not started"), Overdue
  (+ subtle "⚠ Attention" when non-zero), Due Today. Reuses the existing
  `.kpi-card`/`.icon-chip` styles.
- **Overall Work Progress** — now the largest widget in the grid (spans
  both columns via a new `.card-wide` class), showing the completion % as
  a big number next to the existing `DonutChart` broken out into
  Completed/In Progress/Pending/Overdue.
- **Campaign Progress** — a card listing campaigns (Campaign Number + Name
  + horizontal `.progress-bar` + %), in-progress campaigns first then by
  completion %, capped at 6, with a "View All →" link to `/campaigns`.
  Each row links to `/campaigns/:id`. Reuses `mgmt.campaignProgress` from
  `/dashboard/management` directly — no recomputation.
- **Department Progress** — restyled as a clean name + bar + % list (new
  `ProgressRow` component) instead of the generic `BarChart`, reusing
  `mgmt.departmentCompletion`.
- **Staff Workload** — unchanged `BarChart` of `mgmt.staffWithPendingWork`.
  The Department/Staff toggle suggested in the spec was **skipped** — the
  existing bar chart already satisfies the core ask and the toggle would
  add meaningful state/UI complexity for limited benefit.
- **Attention Required** (new) — a card with colored-dot severity rows for
  Overdue, Due Today, Awaiting review/approval (`SUBMITTED`/`UNDER_REVIEW`),
  and Revision Required counts, computed from the extended
  `/dashboard/management` response. Deep-linking each row to a
  filtered `/my-work` or `/daily-work` list was **skipped**: `TaskListPage`
  currently filters via local component state, not URL query params, so
  wiring a real filtered deep link would require new filter-URL plumbing
  outside this task's scope.
- **Upcoming Deadlines** (new) — a compact "Today" / "Tomorrow" grouped
  list of tasks (title, department, assignee), computed server-side from
  the same management-scoped task query and added to the endpoint
  response as `upcomingDeadlines`.
- **Recent Activity** (new) — the `AuditLog` model already existed and is
  already written by task/campaign mutations elsewhere in the backend, so
  a new `GET /dashboard/recent-activity` endpoint was added: returns the
  last 10 audit log entries, scoped to all entries for management roles
  and to the current user's own entries otherwise. Rendered as a simple
  timestamped list card.
- **Calendar widget on the dashboard** — deliberately **skipped**, per the
  spec: a full dedicated Calendar page already exists at
  `frontend/src/pages/Calendar.tsx` and an inline mini-calendar duplicate
  wasn't worth the complexity for this pass.

**Backend response-shape additions (all additive, nothing removed):**
- `GET /dashboard/management` — `tasks` gained `inProgress`, `dueToday`,
  `awaitingReview`, `revisionRequired`; a new top-level `upcomingDeadlines:
  { today: [...], tomorrow: [...] }` field was added (each entry has
  `id`, `title`, `dueDate`, `department`, `assignedTo`).
- New endpoint `GET /dashboard/recent-activity` — returns the 10 most
  recent audit log entries the caller may see (`id`, `entityType`,
  `entityId`, `action`, `actorName`, `details`, `createdAt`).

No Prisma schema changes were needed for any of this — `AuditLog` already
existed, and every new field above is computed from data already queried
by the existing `/dashboard/management` handler, so there is no migration
risk.

**Layout:** the widgets follow the existing `.charts-grid` 2-column
(collapsing to 1 on mobile) pattern; only "Overall Work Progress" is given
extra visual weight via `.card-wide` (spans both columns above ~780px).
The department/role filter row was left where it already was (directly
below the header) rather than moved, since it was already reasonably close
to the header controls and moving it risked more layout churn than the
spec's "small clean change" bar allowed.

## Department-wise Work Management — Marketing / Digital Marketing

A new "Digital Marketing" nav tile (`/departments/digital-marketing`)
opens a Work / Calendar / Chart page scoped to the existing seeded
`Marketing` department + `Digital Marketing` sub-department (found by name
on load, not hardcoded IDs anywhere in the frontend or backend — the
department/sub-department is resolved once and threaded through as
`departmentId`/`subDepartmentId`). Nothing about it is specific to
"Digital Marketing" beyond that name lookup, so the same page/components
can be reused for a future department by changing the lookup.

**Schema (additive, nullable, safe for the live table):**
- `Task.region String?` — `"KERALA" | "TAMIL_NADU" | "BOTH"` stored as a
  plain string (not a hard enum) so more regions can be added later without
  a migration.
- `Task.dmWorkType String?` — free-form content-type label (Social Media
  Post, Instagram Reel, Google Ads, …), populated from a fixed dropdown in
  the frontend (`frontend/src/lib/digitalMarketing.ts`). Deliberately kept
  separate from the existing `workType` enum (`CAMPAIGN`/`DAILY`), which is
  a work-classification concept, not a content type.
- `RecurringWorkTemplate.subDepartmentId/region/dmWorkType` — the existing
  recurring-work generator (`GET /recurring-work/generate`, unchanged
  logic) now carries these three fields through to each generated `Task`
  occurrence, so Digital Marketing recurring templates show up on the
  calendar correctly.
- New models `DepartmentGoal` and `DepartmentTodo` — minimal
  `{ id, departmentId, subDepartmentId?, text, order, createdAt }`
  (+`done Boolean @default(false)` for todos) backing the "Top Goals" /
  "To-Do List" widgets under the Calendar tab. Plain CRUD via a new
  `backend/src/routes/departmentWork.ts` (`GET/POST /department-work/:departmentId/goals`,
  `PATCH/DELETE /department-work/goals/:id`, same shape for `/todos`).

**Reused rather than rebuilt:** the existing `Task`, `RecurringWorkTemplate`,
`TaskComment`/`TaskAttachment` models and their existing endpoints
(`GET/POST /tasks`, `/tasks/bulk`, `/tasks/:id/status`, `/comments`,
`/attachments`) — no parallel task model was created. `GET /tasks` gained
additive query filters (`departmentId`, `subDepartmentId`, `region`,
`dmWorkType`, `assignedToId`, `dateFrom`/`dateTo`) used by the Digital
Marketing page and available to any other page. The existing role
visibility scoping in `tasks.ts` (`scopeFilter`) and `canAssignWork()` /
`isManagement()` checks are used as-is — no new permission model.

**Frontend pieces:**
- `frontend/src/components/MonthCalendar.tsx` — new dependency-free,
  reusable Day/Week/Month/Year calendar (Month is the full task-chip grid;
  Day is a list; Week is a 7-column grid; Year is a 12-month count
  summary — all real data, no placeholders).
- `frontend/src/components/TaskDetailModal.tsx` — the task detail panel
  (item 13) as a modal, calling the same `/tasks/:id` GET/PATCH/comments/
  attachments endpoints as the existing full `TaskDetail` page (which
  remains the canonical deep-linkable `/tasks/:id` route — the modal links
  out to it rather than duplicating every action, e.g. reassignment stays
  on the full page for now).
- `frontend/src/pages/DigitalMarketing.tsx` — the Work/Calendar/Chart page,
  filters (Region/Staff/Work Type/Status/Campaign) shared across all three
  tabs via one piece of component state, summary cards computed client-side
  from the currently filtered task list (no new aggregate endpoint was
  needed for this), and the Top Goals/To-Do widgets.
- `AssignWorkForm.tsx` and `RecurringWork.tsx` were extended (not
  duplicated) with an optional sub-department picker and, when that
  sub-department is "Digital Marketing", Region + Work Type dropdowns.

**Status mapping:** the requested filter statuses (Not Started, In
Progress, Submitted, Under Review, Revision Required, Completed, Overdue)
map directly onto existing `Task.status` enum values of the same name,
except **Overdue**, which isn't a stored status — it's derived the same
way the rest of the app already derives it (`task.overdue`, computed
server-side as "past due date and not COMPLETED/CANCELLED"), so the
Overdue filter option filters on that flag instead of `status`.

**Skipped / simplified for this pass:** Finance and Purchase departments
(explicitly out of scope); a dedicated `work-summary` aggregate endpoint
(the filtered task list already gives the frontend everything needed for
the summary cards/charts without a second server round trip); reassignment
and approve/reject actions inside the modal (available on the full task
page it links to, to avoid duplicating that logic in two places).
