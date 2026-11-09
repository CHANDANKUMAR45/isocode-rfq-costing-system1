import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';
import { extractRfqWithAi } from '../services/aiService.js';

const router = Router();

const extractSchema = z.object({
  rawInput: z.string().min(5, 'Input text too short to extract'),
  sourceType: z.enum(['EMAIL', 'EXCEL', 'DRAWING_TITLE_BLOCK']),
  rfqId: z.string().optional(),
});

router.post('/extract', requireAuth, requirePermission('AI_INTAKE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const { rawInput, sourceType, rfqId } = parsed.data;

  try {
    if (rfqId) {
      const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        select: { assignedEstimatorId: true },
      });
      if (!rfq) {
        res.status(404).json({ error: 'RFQ not found' });
        return;
      }
      if (rfq.assignedEstimatorId !== req.user!.id) {
        res.status(403).json({ error: 'Forbidden: RFQ is not assigned to this estimator' });
        return;
      }
    }

    const extractionResult = await extractRfqWithAi(rawInput, sourceType);
    const storedProvenance = Object.fromEntries(
      Object.entries(extractionResult).map(([key, value]) => [
        key,
        value && typeof value === 'object' && 'snippet' in value
          ? { ...value, snippet: '' }
          : value,
      ]),
    );

    // Persist extraction log for auditability & review tracking
    const record = await prisma.aiExtraction.create({
      data: {
        rfqId: rfqId || null,
        sourceType,
        rawInputSnippet: null,
        extractedData: JSON.stringify({
          partName: extractionResult.partName.value,
          partNumber: extractionResult.partNumber.value,
          material: extractionResult.material.value,
          grossWeightKg: extractionResult.grossWeightKg.value,
          netWeightKg: extractionResult.netWeightKg.value,
          annualVolume: extractionResult.annualVolume.value,
          cycleTimeMin: extractionResult.cycleTimeMin.value,
          drawingNumber: extractionResult.drawingNumber.value,
          revision: extractionResult.revision.value,
        }),
        provenanceMap: JSON.stringify(storedProvenance),
        reviewed: false,
      },
    });

    res.json({
      extractionId: record.id,
      data: extractionResult,
    });
  } catch (error) {
    console.error('AI extraction endpoint failed');
    res.status(500).json({ error: 'Failed to process RFQ text intake' });
  }
});

router.patch('/review/:id', requireAuth, requirePermission('AI_INTAKE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const extraction = await prisma.aiExtraction.findUnique({
      where: { id },
      select: { id: true, rfqId: true },
    });
    if (!extraction) {
      res.status(404).json({ error: 'Extraction not found' });
      return;
    }
    if (!extraction.rfqId) {
      res.status(403).json({ error: 'Only extractions linked to an assigned RFQ can be reviewed' });
      return;
    }
    const rfq = await prisma.rFQ.findUnique({
      where: { id: extraction.rfqId },
      select: { assignedEstimatorId: true },
    });
    if (rfq?.assignedEstimatorId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden: RFQ is not assigned to this estimator' });
      return;
    }
    const updated = await prisma.aiExtraction.update({ where: { id }, data: { reviewed: true } });
    res.json(updated);
  } catch (error) {
    console.error('AI extraction review error:', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

export default router;
