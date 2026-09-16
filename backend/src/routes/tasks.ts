import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../lib/prisma';
import { AuthUser, authenticate, isManagement } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
router.use(authenticate);

// Serverless (Vercel) has no persistent disk, so uploads are kept in memory and
// only metadata is stored (no file bytes persisted). See README for details.
const upload = multer({ storage: multer.memoryStorage() });

function withOverdue<T extends { dueDate: Date; status: string }>(task: T) {
  return {
    ...task,
    overdue: task.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(task.status),
  };
}

/**
 * Builds a Prisma where-clause implementing the visibility matrix:
 * Management (GMA/AGM/ADMIN) see all tasks; MANAGER/COORDINATOR see their
 * department's tasks; ASSISTANT_MANAGER sees tasks they created or are assigned;
 * EXECUTIVE sees only tasks assigned to them.
 */
function scopeFilter(user: AuthUser) {
  if (isManagement(user.role)) return {};
  if (user.role === 'MANAGER' || user.role === 'COORDINATOR') {
    return user.departmentId ? { departmentId: user.departmentId } : { assignedToId: user.id };
  }
  if (user.role === 'ASSISTANT_MANAGER') {
    return { OR: [{ assignedToId: user.id }, { createdById: user.id }] };
  }
  return { assignedToId: user.id };
}

const include = {
  campaign: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true } },
  subDepartment: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
};

router.get('/', async (req, res) => {
  const filter = scopeFilter(req.user!);
  const { workType, campaignId, status } = req.query;
  const tasks = await prisma.task.findMany({
    where: {
      ...filter,
      workType: workType ? (workType as string) : undefined,
      campaignId: campaignId ? (campaignId as string) : undefined,
      status: status ? (status as string) : undefined,
    },
    include,
    orderBy: { dueDate: 'asc' },
  });
  res.json(tasks.map(withOverdue));
});

router.get('/:id', async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { ...include, comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } }, attachments: true },
  });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(withOverdue(task));
});

router.post('/', async (req, res) => {
  const b = req.body;
  if (!b.title || !b.workType || !b.departmentId || !b.assignedToId || !b.startDate || !b.dueDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const taskId = `T-${Date.now().toString(36).toUpperCase()}`;
  const task = await prisma.task.create({
    data: {
      taskId,
      title: b.title,
      description: b.description,
      workType: b.workType,
      campaignId: b.campaignId ?? null,
      departmentId: b.departmentId,
      subDepartmentId: b.subDepartmentId ?? null,
      assignedToId: b.assignedToId,
      createdById: req.user!.id,
      reviewerId: b.reviewerId ?? null,
      startDate: new Date(b.startDate),
      dueDate: new Date(b.dueDate),
      priority: b.priority ?? 'MEDIUM',
      status: 'ASSIGNED',
    },
    include,
  });
  await logAudit('Task', task.id, 'CREATE', req.user!.id, `Assigned to ${task.assignedTo.name}`);
  res.status(201).json(withOverdue(task));
});

router.put('/:id', async (req, res) => {
  const b = req.body;
  const data: Record<string, unknown> = {
    title: b.title,
    description: b.description,
    campaignId: b.campaignId,
    departmentId: b.departmentId,
    subDepartmentId: b.subDepartmentId,
    reviewerId: b.reviewerId,
    startDate: b.startDate ? new Date(b.startDate) : undefined,
    dueDate: b.dueDate ? new Date(b.dueDate) : undefined,
    priority: b.priority,
  };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const task = await prisma.task.update({ where: { id: req.params.id }, data, include });
  await logAudit('Task', task.id, 'UPDATE', req.user!.id, JSON.stringify(data));
  res.json(withOverdue(task));
});

router.patch('/:id/status', async (req, res) => {
  const { status, completionPercent, approvalStatus } = req.body;
  const data: Record<string, unknown> = { status, completionPercent, approvalStatus };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
  const task = await prisma.task.update({ where: { id: req.params.id }, data, include });
  await logAudit('Task', task.id, 'STATUS_CHANGE', req.user!.id, JSON.stringify(data));
  res.json(withOverdue(task));
});

router.patch('/:id/assign', async (req, res) => {
  const { assignedToId } = req.body;
  if (!assignedToId) return res.status(400).json({ error: 'assignedToId is required' });
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: { assignedToId, status: 'ASSIGNED' },
    include,
  });
  await logAudit('Task', task.id, 'ASSIGN', req.user!.id, `Reassigned to ${task.assignedTo.name}`);
  res.json(withOverdue(task));
});

router.delete('/:id', async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/:id/comments', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const comment = await prisma.taskComment.create({
    data: { taskId: req.params.id, userId: req.user!.id, text },
    include: { user: { select: { id: true, name: true } } },
  });
  res.status(201).json(comment);
});

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: req.params.id,
      fileName: req.file.originalname,
      // No persistent disk on serverless deploys; store metadata only (no bytes).
      filePath: `unavailable://${req.file.originalname}`,
      uploadedById: req.user!.id,
    },
  });
  res.status(201).json(attachment);
});

export default router;
