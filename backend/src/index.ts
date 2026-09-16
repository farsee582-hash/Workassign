import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import campaignRoutes from './routes/campaigns';
import taskRoutes from './routes/tasks';
import dashboardRoutes from './routes/dashboard';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Each router below applies the `authenticate` middleware itself, except /auth.
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/departments', departmentRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/tasks', taskRoutes);
app.use('/dashboard', dashboardRoutes);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
