import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    include: {
      owner: { select: { id: true, name: true } },
      departments: { include: { department: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(campaigns);
});

router.get('/:id', async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true } },
      departments: { include: { department: true } },
    },
  });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.post('/', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER'), async (req, res) => {
  const b = req.body;
  if (!b.code || !b.name || !b.startDate || !b.endDate) {
    return res.status(400).json({ error: 'code, name, startDate, endDate are required' });
  }
  const campaign = await prisma.campaign.create({
    data: {
      code: b.code,
      name: b.name,
      type: b.type,
      description: b.description,
      startDate: new Date(b.startDate),
      endDate: new Date(b.endDate),
      ownerId: b.ownerId ?? req.user!.id,
      priority: b.priority ?? 'MEDIUM',
      budget: b.budget,
      status: b.status ?? 'DRAFT',
      notes: b.notes,
    },
  });
  await logAudit('Campaign', campaign.id, 'CREATE', req.user!.id, campaign.name);
  res.status(201).json(campaign);
});

router.put('/:id', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER'), async (req, res) => {
  const b = req.body;
  const data: Record<string, unknown> = {
    name: b.name,
    type: b.type,
    description: b.description,
    startDate: b.startDate ? new Date(b.startDate) : undefined,
    endDate: b.endDate ? new Date(b.endDate) : undefined,
    priority: b.priority,
    budget: b.budget,
    status: b.status,
    notes: b.notes,
    ownerId: b.ownerId,
  };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const campaign = await prisma.campaign.update({ where: { id: req.params.id }, data });
  await logAudit('Campaign', campaign.id, 'UPDATE', req.user!.id, JSON.stringify(data));
  res.json(campaign);
});

router.delete('/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/:id/departments', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER'), async (req, res) => {
  const { departmentId } = req.body;
  if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
  const link = await prisma.campaignDepartment.upsert({
    where: { campaignId_departmentId: { campaignId: req.params.id, departmentId } },
    create: { campaignId: req.params.id, departmentId },
    update: {},
  });
  res.status(201).json(link);
});

router.delete('/:id/departments/:departmentId', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER'), async (req, res) => {
  await prisma.campaignDepartment.delete({
    where: {
      campaignId_departmentId: { campaignId: req.params.id, departmentId: req.params.departmentId },
    },
  });
  res.status(204).send();
});

// Department-wise completion is auto-calculated from task status/completionPercent,
// never stored manually, so it always reflects live task data.
router.get('/:id/progress', async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: { departments: { include: { department: true } } },
  });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const tasks = await prisma.task.findMany({
    where: { campaignId: req.params.id },
    include: { assignedTo: { select: { id: true, name: true } }, department: true },
  });

  const progress = campaign.departments.map(({ department }) => {
    const deptTasks = tasks.filter((t) => t.departmentId === department.id);
    const totalPercent = deptTasks.reduce((sum, t) => sum + t.completionPercent, 0);
    const completionPercent = deptTasks.length ? Math.round(totalPercent / deptTasks.length) : 0;
    return {
      department: { id: department.id, name: department.name },
      taskCount: deptTasks.length,
      completedCount: deptTasks.filter((t) => t.status === 'COMPLETED').length,
      completionPercent,
      tasks: deptTasks.map((t) => ({
        id: t.id,
        taskId: t.taskId,
        title: t.title,
        status: t.status,
        completionPercent: t.completionPercent,
        assignedTo: t.assignedTo.name,
        dueDate: t.dueDate,
        overdue: t.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(t.status),
      })),
    };
  });

  res.json({ campaignId: campaign.id, campaignName: campaign.name, departments: progress });
});

export default router;
