import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthUser {
  id: string;
  role: string;
  departmentId: string | null;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const MANAGEMENT_ROLES = ['GMA', 'AGM', 'ADMIN'];

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function isManagement(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

// Roles allowed to add campaign tasks / daily work in bulk (item 3 & 4 of the
// new requirements): GMA, AGM, Coordinator, Department Manager, Admin.
export const WORK_ASSIGNERS = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ADMIN'];

export function canAssignWork(role: string): boolean {
  return WORK_ASSIGNERS.includes(role);
}
