// Value sets stored as plain strings in SQLite (see prisma/schema.prisma header).
// Kept here purely for reference/documentation; not enforced at the DB layer in Phase 1.

export const ROLES = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ASSISTANT_MANAGER', 'EXECUTIVE', 'ADMIN'] as const;
export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export const CAMPAIGN_STATUSES = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CLOSED'] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const WORK_TYPES = ['CAMPAIGN', 'DAILY'] as const;
export const TASK_STATUSES = [
  'NOT_STARTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
  'COMPLETED',
  'CANCELLED',
] as const;
export const APPROVAL_STATUSES = ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'] as const;
