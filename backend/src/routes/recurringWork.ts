import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, canAssignWork } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
router.use(authenticate);

const include = {
  department: { select: { id: true, name: true } },
  subDepartment: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

router.get('/', async (_req, res) => {
  const templates = await prisma.recurringWorkTemplate.findMany({ include, orderBy: { createdAt: 'desc' } });
  res.json(templates);
});

router.post('/', async (req, res) => {
  if (!canAssignWork(req.user!.role)) {
    return res.status(403).json({ error: 'You are not permitted to create recurring work' });
  }
  const b = req.body;
  if (!b.title || !b.departmentId || !b.recurrenceType) {
    return res.status(400).json({ error: 'title, departmentId, recurrenceType are required' });
  }
  if (b.recurrenceType === 'WEEKLY' && (b.weekday === undefined || b.weekday === null)) {
    return res.status(400).json({ error: 'weekday is required for WEEKLY recurrence' });
  }
  if (b.recurrenceType === 'MONTHLY' && (b.dayOfMonth === undefined || b.dayOfMonth === null)) {
    return res.status(400).json({ error: 'dayOfMonth is required for MONTHLY recurrence' });
  }
  const template = await prisma.recurringWorkTemplate.create({
    data: {
      title: b.title,
      description: b.description,
      departmentId: b.departmentId,
      assignedToId: b.assignedToId ?? null,
      recurrenceType: b.recurrenceType,
      weekday: b.weekday ?? null,
      dayOfMonth: b.dayOfMonth ?? null,
      priority: b.priority ?? 'MEDIUM',
      createdById: req.user!.id,
      startDate: b.startDate ? new Date(b.startDate) : new Date(),
      endDate: b.endDate ? new Date(b.endDate) : null,
      subDepartmentId: b.subDepartmentId ?? null,
      region: b.region ?? null,
      dmWorkType: b.dmWorkType ?? null,
    },
    include,
  });
  await logAudit('RecurringWorkTemplate', template.id, 'CREATE', req.user!.id, template.title);
  res.status(201).json(template);
});

router.patch('/:id', async (req, res) => {
  if (!canAssignWork(req.user!.role)) {
    return res.status(403).json({ error: 'You are not permitted to modify recurring work' });
  }
  const { active } = req.body;
  const data: Record<string, unknown> = { active };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const template = await prisma.recurringWorkTemplate.update({ where: { id: req.params.id }, data, include });
  await logAudit('RecurringWorkTemplate', template.id, 'UPDATE', req.user!.id, JSON.stringify(data));
  res.json(template);
});

function startOfDay(d = new Date()) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function isDueToday(t: { recurrenceType: string; weekday: number | null; dayOfMonth: number | null }, today: Date) {
  if (t.recurrenceType === 'DAILY') return true;
  if (t.recurrenceType === 'WEEKLY') return t.weekday === today.getDay();
  if (t.recurrenceType === 'MONTHLY') return t.dayOfMonth === today.getDate();
  return false;
}

/**
 * "Ensure today's occurrences exist" — idempotently generates a Task per
 * active RecurringWorkTemplate that is due today (item 5). There is no
 * cron/scheduler available in this deployment environment, so this is
 * triggered from the frontend on Daily Work / Calendar page load instead of
 * running on a real schedule — see README for the tradeoff.
 */
router.get('/generate', async (req, res) => {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const templates = await prisma.recurringWorkTemplate.findMany({
    where: { active: true, startDate: { lte: tomorrow }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
    include: { department: { include: { users: true } } },
  });

  const created: string[] = [];
  for (const t of templates) {
    if (!isDueToday(t, today)) continue;
    const staffIds = t.assignedToId
      ? [t.assignedToId]
      : t.department.users.filter((u) => u.status === 'ACTIVE').map((u) => u.id);
    for (const assignedToId of staffIds) {
      const existing = await prisma.task.findFirst({
        where: { recurringTemplateId: t.id, assignedToId, startDate: { gte: today, lt: tomorrow } },
      });
      if (existing) continue;
      const task = await prisma.task.create({
        data: {
          taskId: `T-REC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
          title: t.title,
          description: t.description,
          workType: 'DAILY',
          departmentId: t.departmentId,
          subDepartmentId: t.subDepartmentId ?? null,
          assignedToId,
          createdById: t.createdById,
          startDate: today,
          dueDate: today,
          priority: t.priority,
          status: 'ASSIGNED',
          recurringTemplateId: t.id,
          region: t.region ?? null,
          dmWorkType: t.dmWorkType ?? null,
        },
      });
      created.push(task.id);
    }
  }
  res.json({ generated: created.length, taskIds: created });
});

export default router;
