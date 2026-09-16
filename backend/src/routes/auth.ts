import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({
    id: user.id,
    role: user.role,
    departmentId: user.departmentId,
    name: user.name,
  });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      employeeId: user.employeeId,
      designation: user.designation,
    },
  });
});

export default router;
