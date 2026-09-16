import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AuthUser, authenticate, isManagement, requireRoles } from '../middleware/auth';
import { logAudit } from '../lib/audit';

const router = Router();
router.use(authenticate);

const campaignInclude = {
  coordinator: { select: { id: true, name: true } },
  departments: { include: { department: true } },
  access: { include: { department: true, user: { select: { id: true, name: true, departmentId: true } } } },
  _count: { select: { tasks: true } },
};

async function generateCampaignNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CAM-${year}-`;
  const last = await prisma.campaign.findFirst({
    where: { campaignNumber: { startsWith: prefix } },
    orderBy: { campaignNumber: 'desc' },
  });
  const lastSeq = last ? parseInt(last.campaignNumber.slice(prefix.length), 10) || 0 : 0;
  const next = (lastSeq + 1).toString().padStart(3, '0');
  return `${prefix}${next}`;
}

/** Whether `user` may view/act on `campaignId` per the access-control rules
 * (item 2 of the new requirements): Management roles always have full access;
 * the campaign Coordinator always has access; otherwise the user needs to be
 * listed (by department or individually) in CampaignAccess. A campaign with
 * no access rows at all is treated as open to anyone in a department already
 * "involved" in it, to keep pre-existing campaigns (created before this
 * feature) working without needing a backfill.
 */
export async function hasCampaignAccess(user: AuthUser, campaignId: string): Promise<boolean> {
  if (isManagement(user.role)) return true;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { access: true, departments: true },
  });
  if (!campaign) return false;
  if (campaign.coordinatorId === user.id) return true;
  if (campaign.access.length === 0) {
    // No explicit access list configured yet — fall back to "involved departments".
    return campaign.departments.some((d) => d.departmentId === user.departmentId);
  }
  return campaign.access.some(
    (a) => a.userId === user.id || (a.departmentId && a.departmentId === user.departmentId && !a.userId)
  );
}

function requireCampaignAccess() {
  return async (req: any, res: any, next: any) => {
    const ok = await hasCampaignAccess(req.user!, req.params.id);
    if (!ok) return res.status(403).json({ error: 'You do not have access to this campaign' });
    next();
  };
}

router.get('/', async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    include: campaignInclude,
    orderBy: { createdAt: 'desc' },
  });
  // Non-management users only see campaigns they have access to.
  const user = req.user!;
  const visible = isManagement(user.role)
    ? campaigns
    : campaigns.filter(
        (c) =>
          c.coordinatorId === user.id ||
          c.access.length === 0 ||
          c.access.some((a: any) => a.userId === user.id || (a.departmentId === user.departmentId && !a.userId))
      );
  res.json(visible);
});

router.get('/:id', requireCampaignAccess(), async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: campaignInclude,
  });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.post('/', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'), async (req, res) => {
  const b = req.body;
  if (!b.code || !b.name || !b.startDate || !b.endDate) {
    return res.status(400).json({ error: 'code, name, startDate, endDate are required' });
  }
  const campaignNumber = await generateCampaignNumber();
  const campaign = await prisma.campaign.create({
    data: {
      code: b.code,
      campaignNumber,
      name: b.name,
      type: b.type,
      description: b.description,
      startDate: new Date(b.startDate),
      endDate: new Date(b.endDate),
      coordinatorId: b.coordinatorId ?? req.user!.id,
      priority: b.priority ?? 'MEDIUM',
      status: b.status ?? 'DRAFT',
      notes: b.notes,
      departments: Array.isArray(b.departmentIds)
        ? { create: b.departmentIds.map((departmentId: string) => ({ departmentId })) }
        : undefined,
      access: Array.isArray(b.access)
        ? {
            create: b.access.map((a: { departmentId?: string; userId?: string }) => ({
              departmentId: a.departmentId ?? null,
              userId: a.userId ?? null,
            })),
          }
        : undefined,
    },
    include: campaignInclude,
  });
  await logAudit('Campaign', campaign.id, 'CREATE', req.user!.id, campaign.name);
  res.status(201).json(campaign);
});

router.put('/:id', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'), async (req, res) => {
  const b = req.body;
  const data: Record<string, unknown> = {
    name: b.name,
    type: b.type,
    description: b.description,
    startDate: b.startDate ? new Date(b.startDate) : undefined,
    endDate: b.endDate ? new Date(b.endDate) : undefined,
    priority: b.priority,
    status: b.status,
    notes: b.notes,
    coordinatorId: b.coordinatorId,
  };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const campaign = await prisma.campaign.update({ where: { id: req.params.id }, data, include: campaignInclude });
  await logAudit('Campaign', campaign.id, 'UPDATE', req.user!.id, JSON.stringify(data));
  res.json(campaign);
});

router.delete('/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/:id/departments', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'), async (req, res) => {
  const { departmentId } = req.body;
  if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
  const link = await prisma.campaignDepartment.upsert({
    where: { campaignId_departmentId: { campaignId: req.params.id, departmentId } },
    create: { campaignId: req.params.id, departmentId },
    update: {},
  });
  res.status(201).json(link);
});

router.delete('/:id/departments/:departmentId', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'), async (req, res) => {
  await prisma.campaignDepartment.delete({
    where: {
      campaignId_departmentId: { campaignId: req.params.id, departmentId: req.params.departmentId },
    },
  });
  res.status(204).send();
});

// --- Access control management (item 2) ---------------------------------

router.put('/:id/access', requireRoles('ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'), async (req, res) => {
  const { access } = req.body as { access: { departmentId?: string; userId?: string }[] };
  if (!Array.isArray(access)) return res.status(400).json({ error: 'access array is required' });
  await prisma.$transaction([
    prisma.campaignAccess.deleteMany({ where: { campaignId: req.params.id } }),
    prisma.campaignAccess.createMany({
      data: access.map((a) => ({
        campaignId: req.params.id,
        departmentId: a.departmentId ?? null,
        userId: a.userId ?? null,
      })),
    }),
  ]);
  const rows = await prisma.campaignAccess.findMany({
    where: { campaignId: req.params.id },
    include: { department: true, user: { select: { id: true, name: true, departmentId: true } } },
  });
  res.json(rows);
});

// --- Chat (item 1) --------------------------------------------------------

router.get('/:id/messages', requireCampaignAccess(), async (req, res) => {
  const messages = await prisma.campaignMessage.findMany({
    where: { campaignId: req.params.id },
    include: { user: { select: { id: true, name: true, department: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
});

router.post('/:id/messages', requireCampaignAccess(), async (req, res) => {
  const { text } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
  const message = await prisma.campaignMessage.create({
    data: { campaignId: req.params.id, userId: req.user!.id, text: String(text).trim() },
    include: { user: { select: { id: true, name: true, department: { select: { name: true } } } } },
  });
  res.status(201).json(message);
});

// Department-wise completion is auto-calculated from task status/completionPercent,
// never stored manually, so it always reflects live task data.
router.get('/:id/progress', requireCampaignAccess(), async (req, res) => {
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
