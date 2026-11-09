import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set in the server environment');
  }
  return secret;
}

export const JWT_SECRET = getJwtSecret();

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'ESTIMATOR' | 'SALES_HEAD' | 'ADMIN';
  department?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const permissions = {
  RFQ_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  RFQ_CREATE: ['ESTIMATOR'],
  RFQ_EDIT: ['ESTIMATOR'],
  RFQ_STATUS_UPDATE: ['ESTIMATOR'],
  COSTING: ['ESTIMATOR'],
  QUOTE_CREATE: ['ESTIMATOR'],
  QUOTE_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  APPROVAL_VIEW: ['SALES_HEAD', 'ADMIN'],
  APPROVAL_DECIDE: ['SALES_HEAD'],
  RATE_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  RATE_WRITE: ['SALES_HEAD', 'ADMIN'],
  AI_INTAKE: ['ESTIMATOR'],
  HISTORICAL_READ: ['ESTIMATOR', 'SALES_HEAD', 'ADMIN'],
  HISTORICAL_IMPORT: ['ADMIN'],
  PDF_GENERATE: ['ESTIMATOR', 'SALES_HEAD'],
  USER_MANAGE: ['ADMIN'],
  AUDIT_READ: ['ADMIN', 'SALES_HEAD'],
} as const;

export type Permission = keyof typeof permissions;
export type UserRole = AuthenticatedUser['role'];

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication token missing or malformed' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }
  if (typeof decoded === 'string' || typeof decoded.id !== 'string') {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, department: true },
    });
    if (!user || (user.role !== 'ESTIMATOR' && user.role !== 'SALES_HEAD' && user.role !== 'ADMIN')) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ...(user.department ? { department: user.department } : {}),
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User authentication required' });
      return;
    }

    if (!(permissions[permission] as readonly UserRole[]).includes(req.user.role)) {
      res.status(403).json({ error: `Forbidden: Permission ${permission} is required` });
      return;
    }

    next();
  };
}
