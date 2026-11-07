import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { extractRfqWithAi } from '../services/aiService.js';

const router = Router();

const extractSchema = z.object({
  rawInput: z.string().min(5, 'Input text too short to extract'),
  sourceType: z.enum(['EMAIL', 'EXCEL', 'DRAWING_TITLE_BLOCK']),
  rfqId: z.string().optional(),
});

router.post('/extract', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const { rawInput, sourceType, rfqId } = parsed.data;

  try {
    const extractionResult = await extractRfqWithAi(rawInput, sourceType);

    // Persist extraction log for auditability & review tracking
    const record = await prisma.aiExtraction.create({
      data: {
        rfqId: rfqId || null,
        sourceType,
        rawInputSnippet: rawInput.slice(0, 300),
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
        provenanceMap: JSON.stringify(extractionResult),
        reviewed: false,
      },
    });

    res.json({
      extractionId: record.id,
      data: extractionResult,
    });
  } catch (error) {
    console.error('AI extraction endpoint error:', error);
    res.status(500).json({ error: 'Failed to process RFQ text intake' });
  }
});

router.patch('/review/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const updated = await prisma.aiExtraction.update({
      where: { id },
      data: { reviewed: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

export default router;
