import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const userSelect = {
  id: true,
  employeeId: true,
  name: true,
  email: true,
  mobile: true,
  departmentId: true,
  subDepartmentId: true,
  designation: true,
  role: true,
  reportingManagerId: true,
  joiningDate: true,
  status: true,
  username: true,
  permissionLevel: true,
};

router.get('/', async (req, res) => {
  const { departmentId, role } = req.query as Record<string, string | undefined>;
  const users = await prisma.user.findMany({
    where: { departmentId: departmentId || undefined, role: role || undefined },
    select: userSelect,
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: userSelect });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.post('/', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  const b = req.body;
  if (!b.username || !b.password || !b.name || !b.email || !b.employeeId || !b.role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const passwordHash = await bcrypt.hash(b.password, 10);
  const user = await prisma.user.create({
    data: {
      employeeId: b.employeeId,
      name: b.name,
      email: b.email,
      mobile: b.mobile,
      departmentId: b.departmentId ?? null,
      subDepartmentId: b.subDepartmentId ?? null,
      designation: b.designation,
      role: b.role,
      reportingManagerId: b.reportingManagerId ?? null,
      joiningDate: b.joiningDate ? new Date(b.joiningDate) : null,
      username: b.username,
      passwordHash,
      permissionLevel: b.permissionLevel ?? 1,
    },
    select: userSelect,
  });
  res.status(201).json(user);
});

router.put('/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  const b = req.body;
  const data: Record<string, unknown> = {
    name: b.name,
    email: b.email,
    mobile: b.mobile,
    departmentId: b.departmentId,
    subDepartmentId: b.subDepartmentId,
    designation: b.designation,
    role: b.role,
    reportingManagerId: b.reportingManagerId,
    joiningDate: b.joiningDate ? new Date(b.joiningDate) : undefined,
    status: b.status,
    permissionLevel: b.permissionLevel,
  };
  if (b.password) {
    data.passwordHash = await bcrypt.hash(b.password, 10);
  }
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: userSelect });
  res.json(user);
});

router.delete('/:id', requireRoles('ADMIN', 'GMA'), async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { status: 'INACTIVE' } });
  res.status(204).send();
});

export default router;
