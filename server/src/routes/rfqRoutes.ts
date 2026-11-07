import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

const createRfqSchema = z.object({
  rfqNumber: z.string().min(1),
  customerId: z.string().min(1),
  targetDueDate: z.string(),
  notes: z.string().optional(),
  assignedEstimatorId: z.string().optional(),
  parts: z.array(
    z.object({
      partNumber: z.string().min(1),
      partName: z.string().min(1),
      materialId: z.string().optional(),
      materialName: z.string().default('EN8'),
      grossWeightKg: z.number().positive(),
      netWeightKg: z.number().positive(),
      annualVolume: z.number().int().positive(),
      targetPrice: z.number().optional(),
      drawingNumber: z.string().optional(),
      drawingRevision: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1),
});

// List all RFQs with search & status filters
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { status, search, assignedTo } = req.query;

  try {
    const where: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (assignedTo && typeof assignedTo === 'string') {
      where.assignedEstimatorId = assignedTo;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { rfqNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { parts: { some: { partName: { contains: search } } } },
      ];
    }

    const rfqs = await prisma.rFQ.findMany({
      where,
      include: {
        customer: true,
        assignedEstimator: {
          select: { id: true, name: true, email: true },
        },
        parts: {
          include: {
            operations: true,
            quotes: {
              select: {
                id: true,
                quoteNumber: true,
                status: true,
                totalAnnualValue: true,
                requiresApproval: true,
              },
            },
          },
        },
        _count: {
          select: { quotes: true, parts: true },
        },
      },
      orderBy: { targetDueDate: 'asc' },
    });

    res.json(rfqs);
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    res.status(500).json({ error: 'Failed to fetch RFQs' });
  }
});

// Get single RFQ with all relations
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedEstimator: {
          select: { id: true, name: true, email: true },
        },
        parts: {
          include: {
            material: true,
            operations: {
              include: { machine: true },
              orderBy: { sequence: 'asc' },
            },
            quotes: {
              include: {
                volumeTiers: true,
                createdBy: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        aiExtractions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!rfq) {
      res.status(404).json({ error: 'RFQ not found' });
      return;
    }

    res.json(rfq);
  } catch (error) {
    console.error('Error fetching RFQ detail:', error);
    res.status(500).json({ error: 'Failed to fetch RFQ details' });
  }
});

// Create RFQ
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = createRfqSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;

  try {
    const rfq = await prisma.rFQ.create({
      data: {
        rfqNumber: data.rfqNumber,
        customerId: data.customerId,
        assignedEstimatorId: data.assignedEstimatorId || req.user?.id,
        targetDueDate: new Date(data.targetDueDate),
        notes: data.notes,
        parts: {
          create: data.parts.map((p) => ({
            partNumber: p.partNumber,
            partName: p.partName,
            materialId: p.materialId,
            materialName: p.materialName,
            grossWeightKg: p.grossWeightKg,
            netWeightKg: p.netWeightKg,
            annualVolume: p.annualVolume,
            targetPrice: p.targetPrice,
            drawingNumber: p.drawingNumber,
            drawingRevision: p.drawingRevision || 'Rev-A',
            notes: p.notes,
          })),
        },
      },
      include: {
        customer: true,
        parts: true,
      },
    });

    res.status(201).json(rfq);
  } catch (error: any) {
    console.error('Error creating RFQ:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: `An RFQ with number "${data.rfqNumber}" already exists.` });
      return;
    }
    res.status(500).json({ error: 'Failed to create RFQ' });
  }
});

// Update RFQ Status (Won, Lost, Sent, Estimating)
router.patch('/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, lossReason } = req.body;

  try {
    const rfq = await prisma.rFQ.update({
      where: { id },
      data: {
        status,
        lossReason: status === 'LOST' ? lossReason : null,
      },
    });

    res.json(rfq);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update RFQ status' });
  }
});

export default router;
