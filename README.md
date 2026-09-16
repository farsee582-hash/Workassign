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
  `GET /campaigns/:id/progress` (auto-calculated department completion %)
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
