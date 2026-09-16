export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  const cls = overdue ? 'overdue' : status === 'COMPLETED' ? 'completed' : status === 'IN_PROGRESS' ? 'progress' : '';
  return <span className={`badge ${cls}`}>{overdue ? 'OVERDUE' : status.replace(/_/g, ' ')}</span>;
}
