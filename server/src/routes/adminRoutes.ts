import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();
const roleSchema = z.enum(['ESTIMATOR', 'SALES_HEAD', 'ADMIN']);

router.get('/users', requireAuth, requirePermission('USER_MANAGE'), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, department: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Admin user-list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', requireAuth, requirePermission('USER_MANAGE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    email: z.string().email().transform((email) => email.toLowerCase()),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(12).max(128),
    role: roleSchema,
    department: z.string().trim().max(120).optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid user payload', details: parsed.error.format() });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          passwordHash,
          role: parsed.data.role,
          department: parsed.data.department,
        },
        select: { id: true, email: true, name: true, role: true, department: true, createdAt: true },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'USER',
          entityId: created.id,
          action: 'CREATE',
          userId: req.user!.id,
          details: JSON.stringify({
            after: { email: created.email, name: created.name, role: created.role, department: created.department },
          }),
        },
      });
      return created;
    });
    res.status(201).json(user);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    console.error('Admin user-create error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id/role', requireAuth, requirePermission('USER_MANAGE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = z.object({ role: roleSchema }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid role update', details: parsed.error.format() });
    return;
  }
  if (req.params.id === req.user!.id) {
    res.status(403).json({ error: 'Administrators cannot change their own role' });
    return;
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, email: true, name: true, role: true, department: true },
      });
      if (!before) return null;
      const updated = await tx.user.update({
        where: { id: before.id },
        data: { role: parsed.data.role },
        select: { id: true, email: true, name: true, role: true, department: true },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'USER',
          entityId: updated.id,
          action: 'UPDATE_ROLE',
          userId: req.user!.id,
          details: JSON.stringify({ before: { role: before.role }, after: { role: updated.role } }),
        },
      });
      return updated;
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error('Admin role-update error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.get('/audit-logs', requireAuth, requirePermission('AUDIT_READ'), async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50));
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.json(logs);
  } catch (error) {
    console.error('Audit log read error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
