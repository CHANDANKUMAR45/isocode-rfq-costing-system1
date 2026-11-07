import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Get active rates snapshot (effective today) for real-time quotation calculation
router.get('/active', requireAuth, async (_req, res) => {
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
router.get('/materials', requireAuth, async (_req, res) => {
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
router.post('/materials', requireAuth, requireRole(['SALES_HEAD', 'ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const effectiveFromDate = new Date(data.effectiveFrom);

    // If there is an existing active rate with open end-date, close it at effectiveFromDate
    await prisma.materialRate.updateMany({
      where: {
        materialCode: data.materialCode,
        effectiveTo: null,
      },
      data: {
        effectiveTo: effectiveFromDate,
      },
    });

    const newRate = await prisma.materialRate.create({
      data: {
        materialCode: data.materialCode,
        name: data.name,
        category: data.category,
        ratePerKg: data.ratePerKg,
        scrapRatePerKg: data.scrapRatePerKg,
        density: data.density,
        effectiveFrom: effectiveFromDate,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });

    res.status(201).json(newRate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create material rate' });
  }
});

// Machines List (All versions)
router.get('/machines', requireAuth, async (_req, res) => {
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
router.post('/machines', requireAuth, requireRole(['SALES_HEAD', 'ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const effectiveFromDate = new Date(data.effectiveFrom);

    await prisma.machineRate.updateMany({
      where: {
        machineCode: data.machineCode,
        effectiveTo: null,
      },
      data: {
        effectiveTo: effectiveFromDate,
      },
    });

    const newRate = await prisma.machineRate.create({
      data: {
        machineCode: data.machineCode,
        name: data.name,
        category: data.category,
        hourRate: data.hourRate,
        effectiveFrom: effectiveFromDate,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });

    res.status(201).json(newRate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create machine rate' });
  }
});

// Labour Rates
router.get('/labour', requireAuth, async (_req, res) => {
  try {
    const labour = await prisma.labourRate.findMany({
      orderBy: { labourType: 'asc' },
    });
    res.json(labour);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labour rates' });
  }
});

export default router;
