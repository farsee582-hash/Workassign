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

export default router;
