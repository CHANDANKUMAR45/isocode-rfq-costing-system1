import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';
import { parseEffectiveDate, planRateVersion, RateVersionConflictError } from '../services/rateVersioning.js';

const router = Router();

// Get active rates snapshot (effective today) for real-time quotation calculation
router.get('/active', requireAuth, requirePermission('RATE_READ'), async (_req, res) => {
  try {
    const now = new Date();

    const [materials, machines, labour] = await Promise.all([
      prisma.materialRate.findMany({
        where: {
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { materialCode: 'asc' },
      }),
      prisma.machineRate.findMany({
        where: {
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { machineCode: 'asc' },
      }),
      prisma.labourRate.findMany({
        where: {
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { labourType: 'asc' },
      }),
    ]);

    res.json({ materials, machines, labour });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active rates' });
  }
});

// Materials List (All versions with effective dates)
router.get('/materials', requireAuth, requirePermission('RATE_READ'), async (_req, res) => {
  try {
    const materials = await prisma.materialRate.findMany({
      orderBy: [{ materialCode: 'asc' }, { effectiveFrom: 'desc' }],
    });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch material rates' });
  }
});

// Create or Version Material Rate
router.post('/materials', requireAuth, requirePermission('RATE_WRITE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const schema = z.object({
    materialCode: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    ratePerKg: z.number().positive(),
    scrapRatePerKg: z.number().nonnegative(),
    density: z.number().default(7.85),
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() });
    return;
  }

  const data = parsed.data;

  try {
    const effectiveFromDate = parseEffectiveDate(data.effectiveFrom);
    if (!effectiveFromDate) {
      res.status(400).json({ error: 'effectiveFrom must be a valid date' });
      return;
    }
    const requestedEffectiveTo = data.effectiveTo ? parseEffectiveDate(data.effectiveTo) : null;
    if (data.effectiveTo && !requestedEffectiveTo) {
      res.status(400).json({ error: 'effectiveTo must be a valid date' });
      return;
    }

    const newRate = await prisma.$transaction(async (tx) => {
      const history = await tx.materialRate.findMany({
        where: { materialCode: data.materialCode },
        orderBy: { effectiveFrom: 'asc' },
      });
      const plan = planRateVersion(history, effectiveFromDate, requestedEffectiveTo);
      if (plan.closePrevious) {
        const closed = await tx.materialRate.updateMany({
          where: { id: plan.closePrevious.id, effectiveTo: null },
          data: { effectiveTo: plan.closePrevious.effectiveTo },
        });
        if (closed.count !== 1) throw new RateVersionConflictError('Rate history changed while creating the version');
      }
      const created = await tx.materialRate.create({
        data: {
          materialCode: data.materialCode,
          name: data.name,
          category: data.category,
          ratePerKg: data.ratePerKg,
          scrapRatePerKg: data.scrapRatePerKg,
          density: data.density,
          effectiveFrom: effectiveFromDate,
          effectiveTo: plan.effectiveTo,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'MATERIAL_RATE',
          entityId: created.id,
          action: 'CREATE_VERSION',
          userId: req.user!.id,
          details: JSON.stringify({
            before: plan.closePrevious
              ? history.filter((rate) => rate.id === plan.closePrevious!.id)
              : [],
            after: {
              materialCode: created.materialCode,
              ratePerKg: created.ratePerKg,
              scrapRatePerKg: created.scrapRatePerKg,
              density: created.density,
              effectiveFrom: created.effectiveFrom,
              effectiveTo: created.effectiveTo,
            },
          }),
        },
      });
      return created;
    });

    res.status(201).json(newRate);
  } catch (error) {
    if (error instanceof RateVersionConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Material rate version creation failed');
    res.status(500).json({ error: 'Failed to create material rate' });
  }
});

router.put('/materials/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable; create a new effective-dated version instead' });
});
router.patch('/materials/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable; create a new effective-dated version instead' });
});
router.delete('/materials/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable and cannot be deleted' });
});

// Machines List (All versions)
router.get('/machines', requireAuth, requirePermission('RATE_READ'), async (_req, res) => {
  try {
    const machines = await prisma.machineRate.findMany({
      orderBy: [{ machineCode: 'asc' }, { effectiveFrom: 'desc' }],
    });
    res.json(machines);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch machine rates' });
  }
});

// Create or Version Machine Rate
router.post('/machines', requireAuth, requirePermission('RATE_WRITE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const schema = z.object({
    machineCode: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    hourRate: z.number().positive(),
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() });
    return;
  }

  const data = parsed.data;

  try {
    const effectiveFromDate = parseEffectiveDate(data.effectiveFrom);
    if (!effectiveFromDate) {
      res.status(400).json({ error: 'effectiveFrom must be a valid date' });
      return;
    }
    const requestedEffectiveTo = data.effectiveTo ? parseEffectiveDate(data.effectiveTo) : null;
    if (data.effectiveTo && !requestedEffectiveTo) {
      res.status(400).json({ error: 'effectiveTo must be a valid date' });
      return;
    }

    const newRate = await prisma.$transaction(async (tx) => {
      const history = await tx.machineRate.findMany({
        where: { machineCode: data.machineCode },
        orderBy: { effectiveFrom: 'asc' },
      });
      const plan = planRateVersion(history, effectiveFromDate, requestedEffectiveTo);
      if (plan.closePrevious) {
        const closed = await tx.machineRate.updateMany({
          where: { id: plan.closePrevious.id, effectiveTo: null },
          data: { effectiveTo: plan.closePrevious.effectiveTo },
        });
        if (closed.count !== 1) throw new RateVersionConflictError('Rate history changed while creating the version');
      }
      const created = await tx.machineRate.create({
        data: {
          machineCode: data.machineCode,
          name: data.name,
          category: data.category,
          hourRate: data.hourRate,
          effectiveFrom: effectiveFromDate,
          effectiveTo: plan.effectiveTo,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'MACHINE_RATE',
          entityId: created.id,
          action: 'CREATE_VERSION',
          userId: req.user!.id,
          details: JSON.stringify({
            before: plan.closePrevious
              ? history.filter((rate) => rate.id === plan.closePrevious!.id)
              : [],
            after: {
              machineCode: created.machineCode,
              hourRate: created.hourRate,
              effectiveFrom: created.effectiveFrom,
              effectiveTo: created.effectiveTo,
            },
          }),
        },
      });
      return created;
    });

    res.status(201).json(newRate);
  } catch (error) {
    if (error instanceof RateVersionConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Machine rate version creation failed');
    res.status(500).json({ error: 'Failed to create machine rate' });
  }
});

router.put('/machines/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable; create a new effective-dated version instead' });
});
router.patch('/machines/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable; create a new effective-dated version instead' });
});
router.delete('/machines/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable and cannot be deleted' });
});

// Labour Rates
router.get('/labour', requireAuth, requirePermission('RATE_READ'), async (_req, res) => {
  try {
    const labour = await prisma.labourRate.findMany({
      orderBy: [{ labourType: 'asc' }, { effectiveFrom: 'desc' }],
    });
    res.json(labour);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labour rates' });
  }
});

router.post('/labour', requireAuth, requirePermission('RATE_WRITE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const schema = z.object({
    labourType: z.string().trim().min(1),
    hourRate: z.number().positive(),
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.format() });
    return;
  }

  const data = parsed.data;
  const effectiveFromDate = parseEffectiveDate(data.effectiveFrom);
  const requestedEffectiveTo = data.effectiveTo ? parseEffectiveDate(data.effectiveTo) : null;
  if (!effectiveFromDate || (data.effectiveTo && !requestedEffectiveTo)) {
    res.status(400).json({ error: 'Effective dates must be valid calendar dates' });
    return;
  }

  try {
    const newRate = await prisma.$transaction(async (tx) => {
      const history = await tx.labourRate.findMany({
        where: { labourType: data.labourType },
        orderBy: { effectiveFrom: 'asc' },
      });
      const plan = planRateVersion(history, effectiveFromDate, requestedEffectiveTo);
      if (plan.closePrevious) {
        const closed = await tx.labourRate.updateMany({
          where: { id: plan.closePrevious.id, effectiveTo: null },
          data: { effectiveTo: plan.closePrevious.effectiveTo },
        });
        if (closed.count !== 1) throw new RateVersionConflictError('Rate history changed while creating the version');
      }
      const created = await tx.labourRate.create({
        data: {
          labourType: data.labourType,
          hourRate: data.hourRate,
          effectiveFrom: effectiveFromDate,
          effectiveTo: plan.effectiveTo,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'LABOUR_RATE',
          entityId: created.id,
          action: 'CREATE_VERSION',
          userId: req.user!.id,
          details: JSON.stringify({
            before: plan.closePrevious
              ? history.filter((rate) => rate.id === plan.closePrevious!.id)
              : [],
            after: {
              labourType: created.labourType,
              hourRate: created.hourRate,
              effectiveFrom: created.effectiveFrom,
              effectiveTo: created.effectiveTo,
            },
          }),
        },
      });
      return created;
    });

    res.status(201).json(newRate);
  } catch (error) {
    if (error instanceof RateVersionConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Labour rate version creation failed');
    res.status(500).json({ error: 'Failed to create labour rate' });
  }
});

router.put('/labour/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable; create a new effective-dated version instead' });
});
router.patch('/labour/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable; create a new effective-dated version instead' });
});
router.delete('/labour/:id', requireAuth, requirePermission('RATE_WRITE'), (_req, res) => {
  res.status(405).json({ error: 'Rate versions are immutable and cannot be deleted' });
});

export default router;
