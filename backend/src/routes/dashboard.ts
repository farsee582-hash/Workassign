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

router.get('/management', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'), async (_req, res) => {
  const [campaigns, tasks] = await Promise.all([
    prisma.campaign.findMany(),
    prisma.task.findMany({ include: { assignedTo: { select: { id: true, name: true } } } }),
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

  res.json({
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
  });
});

export default router;
