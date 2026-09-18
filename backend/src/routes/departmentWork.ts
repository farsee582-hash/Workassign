import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, canAssignWork } from '../middleware/auth';

// Lightweight, generic "Top Goals" and "To-Do List" widgets for a department
// (optionally scoped to a sub-department) — item 12 of the Department-wise
// Work Management feature. Not tied to Marketing/Digital Marketing in any
// way; any department/sub-department id works so this extends to future
// departments without changes here.
const router = Router();
router.use(authenticate);

router.get('/:departmentId/goals', async (req, res) => {
  const { subDepartmentId } = req.query;
  const goals = await prisma.departmentGoal.findMany({
    where: { departmentId: req.params.departmentId, subDepartmentId: subDepartmentId ? (subDepartmentId as string) : undefined },
    orderBy: { order: 'asc' },
  });
  res.json(goals);
});

router.post('/:departmentId/goals', async (req, res) => {
  if (!canAssignWork(req.user!.role)) return res.status(403).json({ error: 'Not permitted' });
  const { text, subDepartmentId, order } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const goal = await prisma.departmentGoal.create({
    data: { departmentId: req.params.departmentId, subDepartmentId: subDepartmentId ?? null, text, order: order ?? 0 },
  });
  res.status(201).json(goal);
});

router.patch('/goals/:id', async (req, res) => {
  if (!canAssignWork(req.user!.role)) return res.status(403).json({ error: 'Not permitted' });
  const { text, order } = req.body;
  const data: Record<string, unknown> = { text, order };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const goal = await prisma.departmentGoal.update({ where: { id: req.params.id }, data });
  res.json(goal);
});

router.delete('/goals/:id', async (req, res) => {
  if (!canAssignWork(req.user!.role)) return res.status(403).json({ error: 'Not permitted' });
  await prisma.departmentGoal.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.get('/:departmentId/todos', async (req, res) => {
  const { subDepartmentId } = req.query;
  const todos = await prisma.departmentTodo.findMany({
    where: { departmentId: req.params.departmentId, subDepartmentId: subDepartmentId ? (subDepartmentId as string) : undefined },
    orderBy: { order: 'asc' },
  });
  res.json(todos);
});

router.post('/:departmentId/todos', async (req, res) => {
  if (!canAssignWork(req.user!.role)) return res.status(403).json({ error: 'Not permitted' });
  const { text, subDepartmentId, order } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const todo = await prisma.departmentTodo.create({
    data: { departmentId: req.params.departmentId, subDepartmentId: subDepartmentId ?? null, text, order: order ?? 0 },
  });
  res.status(201).json(todo);
});

router.patch('/todos/:id', async (req, res) => {
  if (!canAssignWork(req.user!.role)) return res.status(403).json({ error: 'Not permitted' });
  const { text, done, order } = req.body;
  const data: Record<string, unknown> = { text, done, order };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  const todo = await prisma.departmentTodo.update({ where: { id: req.params.id }, data });
  res.json(todo);
});

router.delete('/todos/:id', async (req, res) => {
  if (!canAssignWork(req.user!.role)) return res.status(403).json({ error: 'Not permitted' });
  await prisma.departmentTodo.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
