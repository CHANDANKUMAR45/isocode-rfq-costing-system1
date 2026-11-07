import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'company-a-sample location-rfq-jwt-secret-key-2026';

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

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication token missing or malformed' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }
}

export function requireRole(allowedRoles: ('ESTIMATOR' | 'SALES_HEAD' | 'ADMIN')[]) {
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
