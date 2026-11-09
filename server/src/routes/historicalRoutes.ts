import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

// Search past quotes across 1,400+ historical records
router.get('/search', requireAuth, requirePermission('HISTORICAL_READ'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { query, material, customer, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const skip = (pageNum - 1) * pageSize;

  try {
    const where: any = {};

    if (query && typeof query === 'string' && query.trim() !== '') {
      where.OR = [
        { partName: { contains: query.trim() } },
        { rfqNumber: { contains: query.trim() } },
        { routingsSummary: { contains: query.trim() } },
      ];
    }

    if (material && typeof material === 'string' && material !== 'ALL') {
      where.material = { contains: material };
    }

    if (customer && typeof customer === 'string' && customer !== 'ALL') {
      where.customerName = { contains: customer };
    }

    const [total, records] = await Promise.all([
      prisma.historicalQuote.count({ where }),
      prisma.historicalQuote.findMany({
        where,
        orderBy: { quotedDate: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    res.json({
      records,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Historical search error:', error);
    res.status(500).json({ error: 'Failed to search past quotes' });
  }
});

// Routing suggestions based on similar historical parts
router.get('/suggest-routings', requireAuth, requirePermission('HISTORICAL_READ'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { partName, material } = req.query;

  if (!partName || typeof partName !== 'string') {
    res.status(400).json({ error: 'partName is required to find routing suggestions' });
    return;
  }

  try {
    // Search for historical parts with similar name or material
    const matches = await prisma.historicalQuote.findMany({
      where: {
        OR: [
          { partName: { contains: partName.split(' ')[0] } },
          { material: typeof material === 'string' ? material : undefined },
        ],
      },
      orderBy: { quotedDate: 'desc' },
      take: 5,
    });

    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve routing suggestions' });
  }
});

// Bulk import historical quotes (simulating Excel / CSV import)
router.post('/import', requireAuth, requirePermission('HISTORICAL_IMPORT'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const rowSchema = z.object({
    rfqNumber: z.string().min(1),
    customerName: z.string().min(1),
    partName: z.string().min(1),
    material: z.string().min(1),
    grossWeightKg: z.number().positive(),
    annualVolume: z.number().int().positive(),
    cycleTimeMin: z.number().positive(),
    machineHourRate: z.number().positive(),
    unitPriceInr: z.number().positive(),
    quotedDate: z.string().optional(),
    status: z.string().default('WON'),
    routingsSummary: z.string().optional(),
  });

  const schema = z.object({
    rows: z.array(rowSchema).min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  try {
    const data = parsed.data.rows.map((r) => ({
      ...r,
      quotedDate: r.quotedDate ? new Date(r.quotedDate) : new Date(),
    }));

    const created = await prisma.$transaction(async (tx) => {
      const result = await tx.historicalQuote.createMany({ data });
      await tx.auditLog.create({
        data: {
          entityType: 'HISTORICAL_QUOTES',
          entityId: 'bulk-import',
          action: 'IMPORT',
          userId: req.user!.id,
          details: JSON.stringify({ after: { importedCount: result.count } }),
        },
      });
      return result;
    });

    res.status(201).json({
      message: `Successfully imported ${data.length} historical quotes.`,
      count: created.count,
    });
  } catch (error) {
    console.error('Historical import error:', error);
    res.status(500).json({ error: 'Failed to import historical rows' });
  }
});

export default router;
