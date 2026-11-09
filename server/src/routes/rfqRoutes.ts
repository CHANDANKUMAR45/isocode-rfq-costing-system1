import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';
import { getRfqWorkflowStatus } from '../services/rfqWorkflow.js';

const router = Router();

const createRfqSchema = z.object({
  rfqNumber: z.string().min(1),
  customerId: z.string().min(1),
  targetDueDate: z.string(),
  notes: z.string().optional(),
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
router.get('/', requireAuth, requirePermission('RFQ_READ'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { status, search, assignedTo } = req.query;

  try {
    const where: Record<string, unknown> = {};

    if (req.user?.role === 'ESTIMATOR') {
      where.assignedEstimatorId = req.user.id;
    } else if (assignedTo && typeof assignedTo === 'string') {
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
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        _count: {
          select: { quotes: true, parts: true },
        },
      },
      orderBy: { targetDueDate: 'asc' },
    });

    const workflowRfqs = rfqs.map((rfq) => ({
      ...rfq,
      status: getRfqWorkflowStatus(
        rfq.status,
        rfq.parts.flatMap((part) => part.quotes),
      ),
    }));
    res.json(
      status && typeof status === 'string' && status !== 'ALL'
        ? workflowRfqs.filter((rfq) => rfq.status === status)
        : workflowRfqs,
    );
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    res.status(500).json({ error: 'Failed to fetch RFQs' });
  }
});

// Get single RFQ with all relations
router.get('/:id', requireAuth, requirePermission('RFQ_READ'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    if (req.user?.role === 'ESTIMATOR' && rfq.assignedEstimatorId !== req.user.id) {
      res.status(403).json({ error: 'Forbidden: RFQ is not assigned to this estimator' });
      return;
    }

    res.json({
      ...rfq,
      status: getRfqWorkflowStatus(rfq.status, rfq.parts.flatMap((part) => part.quotes)),
    });
  } catch (error) {
    console.error('Error fetching RFQ detail:', error);
    res.status(500).json({ error: 'Failed to fetch RFQ details' });
  }
});

// Create RFQ
router.post('/', requireAuth, requirePermission('RFQ_CREATE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = createRfqSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;

  try {
    const rfq = await prisma.$transaction(async (tx) => {
      const created = await tx.rFQ.create({
        data: {
          rfqNumber: data.rfqNumber,
          customerId: data.customerId,
          assignedEstimatorId: req.user!.id,
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
        include: { customer: true, parts: true },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'RFQ',
          entityId: created.id,
          action: 'CREATE',
          userId: req.user!.id,
          details: JSON.stringify({
            after: { rfqNumber: created.rfqNumber, status: created.status, assignedEstimatorId: req.user!.id },
          }),
        },
      });
      return created;
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

router.patch('/:id', requireAuth, requirePermission('RFQ_EDIT'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    customerId: z.string().min(1),
    targetDueDate: z.string().min(1),
    notes: z.string().max(5000).optional(),
    part: z.object({
      partNumber: z.string().trim().min(1).max(120),
      partName: z.string().trim().min(1).max(240),
      materialName: z.string().trim().min(1).max(120),
      grossWeightKg: z.number().positive(),
      netWeightKg: z.number().positive(),
      annualVolume: z.number().int().positive(),
      notes: z.string().max(5000).optional(),
    }).strict(),
  }).strict().safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid RFQ edit payload', details: parsed.error.format() });
    return;
  }
  if (parsed.data.part.netWeightKg > parsed.data.part.grossWeightKg) {
    res.status(400).json({ error: 'Net weight cannot exceed gross weight' });
    return;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.rFQ.findUnique({
        where: { id: req.params.id },
        include: {
          customer: { select: { id: true } },
          parts: { select: { id: true, partNumber: true, partName: true, materialName: true, grossWeightKg: true, netWeightKg: true, annualVolume: true }, take: 1 },
          quotes: { select: { id: true }, take: 1 },
        },
      });
      if (!existing) return { error: 'NOT_FOUND' as const };
      if (existing.assignedEstimatorId !== req.user!.id) return { error: 'FORBIDDEN' as const };
      if (existing.status !== 'ESTIMATING' || existing.quotes.length > 0) return { error: 'NOT_EDITABLE' as const };
      if (!existing.parts[0]) return { error: 'NO_PART' as const };

      const targetDate = new Date(parsed.data.targetDueDate);
      if (Number.isNaN(targetDate.getTime())) return { error: 'INVALID_DATE' as const };
      const part = parsed.data.part;
      const result = await tx.rFQ.update({
        where: { id: existing.id },
        data: {
          customerId: parsed.data.customerId,
          targetDueDate: targetDate,
          notes: parsed.data.notes,
          parts: {
            update: {
              where: { id: existing.parts[0].id },
              data: {
                partNumber: part.partNumber,
                partName: part.partName,
                materialName: part.materialName,
                grossWeightKg: part.grossWeightKg,
                netWeightKg: part.netWeightKg,
                annualVolume: part.annualVolume,
                notes: part.notes,
              },
            },
          },
        },
        include: { customer: true, parts: true },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'RFQ',
          entityId: existing.id,
          action: 'UPDATE_DETAILS',
          userId: req.user!.id,
          details: JSON.stringify({
            before: {
              customerId: existing.customerId,
              targetDueDate: existing.targetDueDate.toISOString(),
              part: existing.parts[0],
            },
            after: {
              customerId: result.customerId,
              targetDueDate: result.targetDueDate.toISOString(),
              part: {
                partNumber: part.partNumber,
                partName: part.partName,
                materialName: part.materialName,
                grossWeightKg: part.grossWeightKg,
                netWeightKg: part.netWeightKg,
                annualVolume: part.annualVolume,
              },
            },
          }),
        },
      });
      return { result };
    });

    if ('error' in updated) {
      if (updated.error === 'NOT_FOUND') res.status(404).json({ error: 'RFQ not found' });
      else if (updated.error === 'FORBIDDEN') res.status(403).json({ error: 'Forbidden: RFQ is not assigned to this estimator' });
      else if (updated.error === 'NO_PART') res.status(409).json({ error: 'RFQ has no editable primary part' });
      else if (updated.error === 'INVALID_DATE') res.status(400).json({ error: 'Target due date is invalid' });
      else res.status(409).json({ error: 'Only estimating RFQs without submitted quotes can be edited' });
      return;
    }

    res.json(updated.result);
  } catch (error) {
    console.error('Error editing RFQ:', error);
    res.status(500).json({ error: 'Failed to edit RFQ' });
  }
});

// Update RFQ Status (Won, Lost, Sent, Estimating)
router.patch('/:id/status', requireAuth, requirePermission('RFQ_STATUS_UPDATE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const parsed = z.object({
    status: z.enum(['WON', 'LOST']),
    lossReason: z.string().trim().min(3).optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid RFQ status update', details: parsed.error.format() });
    return;
  }
  const { status, lossReason } = parsed.data;
  if (status === 'LOST' && !lossReason) {
    res.status(400).json({ error: 'A loss reason is required when marking an RFQ as lost' });
    return;
  }

  try {
    const existing = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        quotes: {
          select: {
            status: true,
            requiresApproval: true,
            totalAnnualValue: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'RFQ not found' });
      return;
    }
    if (existing.assignedEstimatorId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden: RFQ is not assigned to this estimator' });
      return;
    }
    const workflowStatus = getRfqWorkflowStatus(existing.status, existing.quotes);
    if (workflowStatus !== 'SENT') {
      res.status(409).json({ error: 'Only RFQs sent to the customer can be marked won or lost' });
      return;
    }

    const rfq = await prisma.$transaction(async (tx) => {
      const update = await tx.rFQ.updateMany({
        where: { id, assignedEstimatorId: req.user!.id, status: existing.status },
        data: {
          status,
          lossReason: status === 'LOST' ? lossReason : null,
        },
      });
      if (update.count !== 1) return null;
      const updated = await tx.rFQ.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          entityType: 'RFQ',
          entityId: id,
          action: 'UPDATE_STATUS',
          userId: req.user!.id,
          details: JSON.stringify({
            before: { status: workflowStatus, lossReason: existing.lossReason },
            after: { status: updated.status, lossReason: updated.lossReason },
          }),
        },
      });
      return updated;
    });
    if (!rfq) {
      res.status(409).json({ error: 'RFQ status changed; reload and try again' });
      return;
    }

    res.json(rfq);
  } catch (error) {
    console.error('Error updating RFQ status:', error);
    res.status(500).json({ error: 'Failed to update RFQ status' });
  }
});

export default router;
