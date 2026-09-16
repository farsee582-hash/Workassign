# WorkAssign — Work Management, Campaign & Staff Monitoring System

This repository implements **Phase 1 (Core)** of the Work Management, Campaign &
Staff Monitoring System: staff/department/campaign data model, role-based task
assignment and tracking, auto-calculated campaign progress, and staff/management
dashboards. Phase 2/3 features (notifications, escalation, exports, etc.) are
explicitly out of scope for this build — see **Roadmap** below.

## Architecture

- **backend/** — Node.js + TypeScript + Express + Prisma ORM + SQLite (file DB).
  JWT auth (bcrypt-hashed passwords), role-based authorization middleware,
  REST API, local file uploads served from `/uploads`.
- **frontend/** — React + TypeScript + Vite, React Router, axios. Plain CSS
  (no UI framework) for a clean, functional interface.

SQLite was chosen so the project runs anywhere with zero external services.
The Prisma schema deliberately avoids SQLite-only features (enums are modeled
as plain `String` columns instead of native enums, which SQLite doesn't
support) so migrating to Postgres later only requires changing the
`datasource` provider/URL in `backend/prisma/schema.prisma` and rerunning
`prisma migrate`.

## Getting started

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init   # creates dev.db and applies schema
npm run seed                         # optional if migrate dev didn't auto-seed
npm run dev                          # http://localhost:4000
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
`Task`, `TaskComment`, `TaskAttachment`, `TaskDependency`, `AuditLog` — see
`backend/prisma/schema.prisma` for the full schema.

## Role-based visibility

Enforced server-side in `backend/src/middleware/auth.ts` and the task
scoping helper in `backend/src/routes/tasks.ts`:

- **Management** (GMA / AGM / ADMIN): see all tasks and campaigns.
- **Department Manager / Coordinator**: see their department's tasks.
- **Assistant Manager**: see tasks they created or are assigned.
- **Executive**: see only tasks assigned to them.

## Key API endpoints

- `POST /auth/login`
- `GET/POST/PUT/DELETE /users`, `/departments`, `/departments/:id/sub-departments`
- `GET/POST/PUT/DELETE /campaigns`, `POST /campaigns/:id/departments`,
  `GET /campaigns/:id/progress` (auto-calculated department completion %)
- `GET/POST/PUT/DELETE /tasks`, `PATCH /tasks/:id/status`,
  `PATCH /tasks/:id/assign`, `POST /tasks/:id/comments`,
  `POST /tasks/:id/attachments`
- `GET /dashboard/me`, `GET /dashboard/management`

Overdue status is never stored — it's computed on every response as
`dueDate < now && status not in (COMPLETED, CANCELLED)`.

## Roadmap / Phase 2 & 3 (not built here)

- Notifications and reminders (due-today/overdue alerts, email/push)
- Escalation workflows beyond the simple `approvalStatus` field
- Enforcement of `TaskDependency` (blocking dependent tasks until
  prerequisites complete) — the data model exists, the rule is not enforced
- Deeper department/staff dashboard drill-down views and workload monitoring
- Data exports (CSV/PDF/Excel reports)
- Audit trail UI (the `AuditLog` table is populated but has no admin screen)
- Calendar views beyond a simple day/week/month due-date list
