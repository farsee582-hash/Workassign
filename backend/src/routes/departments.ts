import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const departments = await prisma.department.findMany({
    include: { subDepartments: true },
    orderBy: { name: 'asc' },
  });
  res.json(departments);
});

router.post('/', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const dept = await prisma.department.create({ data: { name, description } });
  res.status(201).json(dept);
});

router.put('/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  const { name, description } = req.body;
  const dept = await prisma.department.update({
    where: { id: req.params.id },
    data: { name, description },
  });
  res.json(dept);
});

router.delete('/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  await prisma.department.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/:id/sub-departments', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const sub = await prisma.subDepartment.create({
    data: { name, departmentId: req.params.id },
  });
  res.status(201).json(sub);
});

router.put('/sub-departments/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  const { name } = req.body;
  const sub = await prisma.subDepartment.update({ where: { id: req.params.id }, data: { name } });
  res.json(sub);
});

router.delete('/sub-departments/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  await prisma.subDepartment.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

const DEFAULT_DEPARTMENTS: { name: string; subs: string[] }[] = [
  { name: 'Marketing', subs: ['Digital Marketing', 'Campaigns', 'Showroom Marketing', 'Care'] },
  { name: 'Purchase', subs: ['Sale', 'Stock'] },
  { name: 'Audit', subs: [] },
  { name: 'Finance', subs: ['Bills'] },
];

router.post('/bootstrap-defaults', requireRoles('ADMIN', 'GMA'), async (_req, res) => {
  const result: { department: string; created: boolean; subs: { name: string; created: boolean }[] }[] = [];
  for (const d of DEFAULT_DEPARTMENTS) {
    const existing = await prisma.department.findUnique({ where: { name: d.name } });
    const dept = existing ?? (await prisma.department.create({ data: { name: d.name } }));
    const subs: { name: string; created: boolean }[] = [];
    for (const subName of d.subs) {
      const existingSub = await prisma.subDepartment.findUnique({
        where: { departmentId_name: { departmentId: dept.id, name: subName } },
      });
      if (existingSub) {
        subs.push({ name: subName, created: false });
      } else {
        await prisma.subDepartment.create({ data: { name: subName, departmentId: dept.id } });
        subs.push({ name: subName, created: true });
      }
    }
    result.push({ department: d.name, created: !existing, subs });
  }
  res.json({ result });
});

export default router;
