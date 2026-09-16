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
import recurringWorkRoutes from './routes/recurringWork';

const app = express();

// Allow the deployed frontend origin (and local dev) to call this API.
// "*" must be passed through as-is (not inside an array) or the cors
// package treats it as a literal origin string instead of a wildcard.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.includes('*') || !allowedOrigins.length ? true : allowedOrigins,
  }),
);
// Campaign chat attachments are sent inline as base64 JSON (see README), so
// the default 100kb express.json limit is raised. Kept under Vercel's own
// ~4.5MB serverless request-body cap.
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Each router below applies the `authenticate` middleware itself, except /auth.
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/departments', departmentRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/tasks', taskRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/recurring-work', recurringWorkRoutes);

export default app;
