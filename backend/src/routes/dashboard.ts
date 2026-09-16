import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

router.get('/me', async (req, res) => {
  const userId = req.user!.id;
  const tasks = await prisma.task.findMany({
    where: { assignedToId: userId },
    include: { campaign: { select: { name: true } }, department: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const today = startOfDay();
  const tomorrow = startOfDay(1);
  const dayAfterTomorrow = startOfDay(2);
  const activeStatuses = ['NOT_STARTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'REVISION_REQUIRED'];

  const isOverdue = (t: (typeof tasks)[number]) =>
    t.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(t.status);

  res.json({
    counts: {
      total: tasks.length,
      pending: tasks.filter((t) => activeStatuses.includes(t.status)).length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      dueToday: tasks.filter((t) => t.dueDate >= today && t.dueDate < tomorrow).length,
      dueTomorrow: tasks.filter((t) => t.dueDate >= tomorrow && t.dueDate < dayAfterTomorrow).length,
      overdue: tasks.filter(isOverdue).length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    },
    dueToday: tasks.filter((t) => t.dueDate >= today && t.dueDate < tomorrow),
    dueTomorrow: tasks.filter((t) => t.dueDate >= tomorrow && t.dueDate < dayAfterTomorrow),
    dueThisWeek: tasks.filter((t) => t.dueDate >= today && t.dueDate < startOfDay(7)),
    overdueTasks: tasks.filter(isOverdue),
  });
});

// Query params (item 8 — Dashboard filters):
//   range = today | week | month | custom   (with from/to for custom)
//   departmentId = a Department id
//   role = a Role string (GMA/AGM/COORDINATOR/MANAGER/ASSISTANT_MANAGER/EXECUTIVE)
router.get('/management', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'), async (req, res) => {
  const { range, departmentId, role, from, to } = req.query as Record<string, string | undefined>;

  let createdFrom: Date | undefined;
  let createdTo: Date | undefined;
  if (range === 'today') {
    createdFrom = startOfDay();
    createdTo = startOfDay(1);
  } else if (range === 'week') {
    createdFrom = startOfDay(-7);
    createdTo = startOfDay(1);
  } else if (range === 'month') {
    createdFrom = startOfDay(-30);
    createdTo = startOfDay(1);
  } else if (range === 'custom' && from && to) {
    createdFrom = new Date(from);
    createdTo = new Date(to);
  }

  const taskWhere: Record<string, unknown> = {};
  if (createdFrom && createdTo) taskWhere.createdAt = { gte: createdFrom, lt: createdTo };
  if (departmentId) taskWhere.departmentId = departmentId;
  if (role) taskWhere.assignedTo = { role };

  const [campaigns, tasks] = await Promise.all([
    prisma.campaign.findMany({
      where: departmentId ? { departments: { some: { departmentId } } } : undefined,
      include: { tasks: { select: { status: true, completionPercent: true } } },
    }),
    prisma.task.findMany({
      where: taskWhere,
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        department: { select: { id: true, name: true } },
      },
    }),
  ]);

  const isOverdue = (t: (typeof tasks)[number]) =>
    t.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(t.status);

  const staffPending = new Map<string, { id: string; name: string; count: number }>();
  tasks
    .filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status))
    .forEach((t) => {
      const entry = staffPending.get(t.assignedTo.id) ?? { id: t.assignedTo.id, name: t.assignedTo.name, count: 0 };
      entry.count += 1;
      staffPending.set(t.assignedTo.id, entry);
    });

  // Department-wise completion breakdown for the chart.
  const deptMap = new Map<string, { id: string; name: string; total: number; completed: number }>();
  tasks.forEach((t) => {
    const entry = deptMap.get(t.department.id) ?? { id: t.department.id, name: t.department.name, total: 0, completed: 0 };
    entry.total += 1;
    if (t.status === 'COMPLETED') entry.completed += 1;
    deptMap.set(t.department.id, entry);
  });

  const campaignProgress = campaigns.map((c) => {
    const total = c.tasks.length;
    const avg = total ? Math.round(c.tasks.reduce((s, t) => s + t.completionPercent, 0) / total) : 0;
    return { id: c.id, name: c.name, campaignNumber: (c as any).campaignNumber, status: c.status, taskCount: total, completionPercent: avg };
  });

  res.json({
    filters: { range: range ?? 'all', departmentId: departmentId ?? null, role: role ?? null },
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter((c) => ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW'].includes(c.status)).length,
      completed: campaigns.filter((c) => ['COMPLETED', 'CLOSED'].includes(c.status)).length,
    },
    tasks: {
      total: tasks.length,
      pending: tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status)).length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      overdue: tasks.filter(isOverdue).length,
    },
    staffWithPendingWork: Array.from(staffPending.values()).sort((a, b) => b.count - a.count),
    departmentCompletion: Array.from(deptMap.values()).map((d) => ({
      ...d,
      completionPercent: d.total ? Math.round((d.completed / d.total) * 100) : 0,
    })),
    campaignProgress,
  });
});

export default router;
