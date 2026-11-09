import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';
import { calculatePartCost, CostingCalculationInput } from '../services/costingEngine.js';

const router = Router();

const calculateSchema = z.object({
  grossWeightKg: z.number().positive(),
  netWeightKg: z.number().positive(),
  materialRatePerKg: z.number().positive(),
  scrapRecoveryRatePerKg: z.number().nonnegative(),
  annualVolume: z.number().int().positive(),
  overheadPct: z.number().default(12.0),
  packingPerUnit: z.number().default(8.0),
  freightPerUnit: z.number().default(12.0),
  marginPct: z.number().default(15.0),
  gstPct: z.number().default(18.0),
  volumeTiers: z.array(
    z.object({
      volume: z.number().int().positive(),
      label: z.string().optional(),
    })
  ).min(1),
  operations: z.array(
    z.object({
      sequence: z.number().int().positive(),
      operationName: z.string().min(1),
      machineId: z.string().optional(),
      machineName: z.string().min(1),
      setupTimeMin: z.number().nonnegative(),
      cycleTimeMin: z.number().positive(),
      machineHourRate: z.number().nonnegative(),
      labourRateHr: z.number().nonnegative(),
    })
  ).min(1),
});

// Live calculation preview (no database commit)
router.post('/calculate', requireAuth, requirePermission('COSTING'), (req: AuthenticatedRequest, res: Response): void => {
  const parsed = calculateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const result = calculatePartCost(parsed.data as CostingCalculationInput);
  res.json(result);
});

// Save Quote with Volume Tiers & Immutable Rate Snapshot
router.post('/save-quote', requireAuth, requirePermission('QUOTE_CREATE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const saveSchema = z.object({
    rfqId: z.string().min(1),
    partId: z.string().min(1),
    costingInput: calculateSchema,
    quoteNumber: z.string().optional(),
    validityDays: z.number().int().min(1).max(365).default(30),
  });

  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const { rfqId, partId, costingInput, validityDays } = parsed.data;
  const userId = req.user!.id;

  try {
    const [rfq, part] = await Promise.all([
      prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, assignedEstimatorId: true, status: true } }),
      prisma.part.findUnique({ where: { id: partId }, select: { id: true, rfqId: true } }),
    ]);
    if (!rfq || !part) {
      res.status(404).json({ error: 'RFQ or part not found' });
      return;
    }
    if (rfq.assignedEstimatorId !== userId) {
      res.status(403).json({ error: 'Forbidden: RFQ is not assigned to this estimator' });
      return;
    }
    if (part.rfqId !== rfqId) {
      res.status(400).json({ error: 'Part does not belong to the requested RFQ' });
      return;
    }
    if (rfq.status !== 'ESTIMATING' && rfq.status !== 'SENT') {
      res.status(409).json({ error: `RFQ cannot accept a quote while its status is ${rfq.status}` });
      return;
    }

    // 1. Calculate deterministic values
    const calculation = calculatePartCost(costingInput as CostingCalculationInput);

    // 2. Determine quote number
    const quoteNumber = parsed.data.quoteNumber || `QT-${Date.now().toString().slice(-6)}`;

    // 3. Status determination: Quotes exceeding ₹25 Lakh annual value require approval
    const status = calculation.requiresSalesHeadApproval ? 'PENDING_APPROVAL' : 'SENT';

    // 4. Save Quote record
    const quote = await prisma.$transaction(async (tx) => {
      const createdQuote = await tx.quote.create({
        data: {
          quoteNumber,
          rfqId,
          partId,
          createdById: userId,
          version: 1,
          status,
          overheadPct: costingInput.overheadPct,
          packingPerUnit: costingInput.packingPerUnit,
          freightPerUnit: costingInput.freightPerUnit,
          marginPct: costingInput.marginPct,
          gstPct: costingInput.gstPct,
          requiresApproval: calculation.requiresSalesHeadApproval,
          totalAnnualValue: calculation.maxAnnualValue,
          validityDays,
          volumeTiers: {
            create: calculation.tiers.map((tier) => ({
              volume: tier.volume,
              label: tier.label,
              materialCostPerUnit: tier.grossMaterialCost,
              scrapCreditPerUnit: tier.scrapCredit,
              netMaterialCostPerUnit: tier.netMaterialCost,
              machiningCostPerUnit: tier.machiningCost,
              labourCostPerUnit: tier.labourCost,
              directCostPerUnit: tier.directCost,
              overheadCostPerUnit: tier.overheadCost,
              packingPerUnit: tier.packingCost,
              freightPerUnit: tier.freightCost,
              baseCostPerUnit: tier.baseCost,
              marginPerUnit: tier.marginAmount,
              unitPriceExGst: tier.unitPriceExGst,
              gstAmountPerUnit: tier.gstAmount,
              unitPriceInclGst: tier.unitPriceInclGst,
              totalAnnualValue: tier.totalAnnualValue,
            })),
          },
        },
      });

      const capturedAt = new Date();
      const ratesData = JSON.stringify({
        material: {
          materialCode: 'ACTIVE_MAT',
          name: 'Quoted Material',
          ratePerKg: costingInput.materialRatePerKg,
          scrapRatePerKg: costingInput.scrapRecoveryRatePerKg,
          effectiveFrom: capturedAt.toISOString(),
        },
        machines: costingInput.operations.map((op) => ({
          machineCode: op.machineId || 'MACH',
          name: op.machineName,
          hourRate: op.machineHourRate,
          effectiveFrom: capturedAt.toISOString(),
        })),
        labour: costingInput.operations.map((op) => ({
          labourType: 'Machinist',
          hourRate: op.labourRateHr,
        })),
        capturedAt: capturedAt.toISOString(),
      });
      await tx.quoteRateSnapshot.create({
        data: { quoteId: createdQuote.id, ratesData, capturedAt },
      });

      const nextRfqStatus = calculation.requiresSalesHeadApproval ? 'PENDING_APPROVAL' : 'SENT';
      const submission = await tx.rFQ.updateMany({
        where: {
          id: rfqId,
          assignedEstimatorId: userId,
          status: rfq.status,
        },
        data: { status: nextRfqStatus },
      });
      if (submission.count !== 1) {
        throw new Error('RFQ_SUBMISSION_CONFLICT');
      }

      await tx.auditLog.create({
        data: {
          entityType: 'QUOTE',
          entityId: createdQuote.id,
          action: calculation.requiresSalesHeadApproval ? 'SUBMIT_APPROVAL' : 'CREATE',
          userId,
          details: JSON.stringify({
            before: { rfqStatus: rfq.status },
            after: {
              quoteNumber: createdQuote.quoteNumber,
              quoteStatus: createdQuote.status,
              rfqStatus: nextRfqStatus,
              totalAnnualValue: createdQuote.totalAnnualValue,
              requiresApproval: createdQuote.requiresApproval,
            },
          }),
        },
      });

      return createdQuote;
    });

    res.status(201).json({
      quote,
      calculation,
      message: calculation.requiresSalesHeadApproval
        ? 'Quote created and submitted for Sales Head Approval (Exceeds ₹25 Lakhs threshold).'
        : 'Quote released without Sales Head review (within approval limit).',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'RFQ_SUBMISSION_CONFLICT') {
      res.status(409).json({ error: 'RFQ status changed while the quote was being submitted' });
      return;
    }
    console.error('Quote submission failed');
    res.status(500).json({ error: 'Failed to save quote' });
  }
});

// Get quote details with snapshot and volume tiers
router.get('/:quoteId', requireAuth, requirePermission('QUOTE_READ'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { quoteId } = req.params;

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        rfq: {
          include: { customer: true },
        },
        part: {
          include: { material: true, operations: true },
        },
        volumeTiers: {
          orderBy: { volume: 'asc' },
        },
        snapshot: true,
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    if (req.user?.role === 'ESTIMATOR' && quote.createdById !== req.user.id) {
      res.status(403).json({ error: 'Forbidden: Quote is not owned by this estimator' });
      return;
    }

    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

export default router;
