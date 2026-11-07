import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { calculatePartCost, CostingCalculationInput } from '../services/costingEngine.js';
import { createRateSnapshot } from '../services/rateSnapshotService.js';

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
router.post('/calculate', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const parsed = calculateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const result = calculatePartCost(parsed.data as CostingCalculationInput);
  res.json(result);
});

// Save Quote with Volume Tiers & Immutable Rate Snapshot
router.post('/save-quote', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const saveSchema = z.object({
    rfqId: z.string().min(1),
    partId: z.string().min(1),
    costingInput: calculateSchema,
    quoteNumber: z.string().optional(),
    validityDays: z.number().int().default(30),
  });

  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const { rfqId, partId, costingInput, validityDays } = parsed.data;
  const userId = req.user?.id!;

  try {
    // 1. Calculate deterministic values
    const calculation = calculatePartCost(costingInput as CostingCalculationInput);

    // 2. Determine quote number
    const quoteNumber = parsed.data.quoteNumber || `QT-${Date.now().toString().slice(-6)}`;

    // 3. Status determination: Quotes exceeding ₹25 Lakh annual value require approval
    const status = calculation.requiresSalesHeadApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    // 4. Save Quote record
    const quote = await prisma.quote.create({
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

    // 5. Freeze immutable Rate Snapshot
    await createRateSnapshot(quote.id, {
      material: {
        materialCode: 'ACTIVE_MAT',
        name: 'Quoted Material',
        ratePerKg: costingInput.materialRatePerKg,
        scrapRatePerKg: costingInput.scrapRecoveryRatePerKg,
        effectiveFrom: new Date().toISOString(),
      },
      machines: costingInput.operations.map((op) => ({
        machineCode: op.machineId || 'MACH',
        name: op.machineName,
        hourRate: op.machineHourRate,
        effectiveFrom: new Date().toISOString(),
      })),
      labour: costingInput.operations.map((op) => ({
        labourType: 'Machinist',
        hourRate: op.labourRateHr,
      })),
      capturedAt: new Date().toISOString(),
    });

    // 6. Update RFQ status if approval needed
    if (calculation.requiresSalesHeadApproval) {
      await prisma.rFQ.update({
        where: { id: rfqId },
        data: { status: 'PENDING_APPROVAL' },
      });
    }

    // 7. Audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'QUOTE',
        entityId: quote.id,
        action: 'CREATE',
        userId,
        details: `Quote ${quote.quoteNumber} created. Annual Value: ₹${calculation.maxAnnualValue}. Requires Approval: ${calculation.requiresSalesHeadApproval}`,
      },
    });

    res.status(201).json({
      quote,
      calculation,
      message: calculation.requiresSalesHeadApproval
        ? 'Quote created and submitted for Sales Head Approval (Exceeds ₹25 Lakhs threshold).'
        : 'Quote created successfully.',
    });
  } catch (error) {
    console.error('Error saving quote:', error);
    res.status(500).json({ error: 'Failed to save quote' });
  }
});

// Get quote details with snapshot and volume tiers
router.get('/:quoteId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

export default router;
