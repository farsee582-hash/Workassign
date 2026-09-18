// Shared constants for department-wise work management. Kept generic (plain
// string lists, not hardcoded to a specific department) so a future
// department can reuse the same page/components with a different list.

export const DM_WORK_TYPES = [
  'Social Media Post',
  'Instagram Reel',
  'Facebook Post',
  'Story',
  'Campaign Creative',
  'Advertisement',
  'Google Ads',
  'Meta Ads',
  'Video',
  'Product Shoot',
  'Content Creation',
  'Monthly Report',
  'Performance Report',
  'Website Update',
  'Other',
];

export const REGIONS: { value: string; label: string; color: string }[] = [
  { value: 'KERALA', label: 'Kerala', color: '#f2ab0e' },
  { value: 'TAMIL_NADU', label: 'Tamil Nadu', color: '#c0432b' },
  { value: 'BOTH', label: 'Both', color: '#a89a7c' },
];

export function regionColor(region?: string | null): string {
  return REGIONS.find((r) => r.value === region)?.color ?? '#d7ccb8';
}

export function regionLabel(region?: string | null): string {
  return REGIONS.find((r) => r.value === region)?.label ?? '—';
}

// Task.status enum values (see backend/src/lib/enums.ts) mapped onto the
// user-facing status names requested for Department Work filters. "Overdue"
// is not a stored status — it is derived from `task.overdue` (dueDate passed
// and not COMPLETED/CANCELLED), so it is handled separately in filtering UI.
export const DM_STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'REVISION_REQUIRED', label: 'Revision Required' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'OVERDUE', label: 'Overdue' },
];
