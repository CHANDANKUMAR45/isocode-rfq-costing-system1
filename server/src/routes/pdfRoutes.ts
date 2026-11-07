import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { generateQuotationPdf } from '../services/pdfService.js';

const router = Router();

router.get('/quote/:quoteId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { quoteId } = req.params;

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        rfq: {
          include: { customer: true },
        },
        part: true,
        volumeTiers: {
          orderBy: { volume: 'asc' },
        },
        createdBy: true,
        approvedBy: true,
      },
    });

    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const pdfBuffer = await generateQuotationPdf({
      quoteNumber: quote.quoteNumber,
      rfqNumber: quote.rfq.rfqNumber,
      quoteDate: new Date(quote.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      validityDays: quote.validityDays,
      customer: {
        name: quote.rfq.customer.name,
        code: quote.rfq.customer.code,
        contactPerson: quote.rfq.customer.contactPerson,
        email: quote.rfq.customer.email,
        address: quote.rfq.customer.address,
        gstin: quote.rfq.customer.gstin,
      },
      part: {
        partNumber: quote.part.partNumber,
        partName: quote.part.partName,
        materialName: quote.part.materialName,
        grossWeightKg: quote.part.grossWeightKg,
        netWeightKg: quote.part.netWeightKg,
        annualVolume: quote.part.annualVolume,
        drawingNumber: quote.part.drawingNumber,
        drawingRevision: quote.part.drawingRevision,
      },
      tiers: quote.volumeTiers.map((t) => ({
        volume: t.volume,
        label: t.label,
        grossMaterialCost: t.materialCostPerUnit,
        scrapWeightKg: Math.round(Math.max(0, quote.part.grossWeightKg - quote.part.netWeightKg) * 100) / 100,
        scrapCredit: t.scrapCreditPerUnit,
        netMaterialCost: t.netMaterialCostPerUnit,
        machiningCost: t.machiningCostPerUnit,
        labourCost: t.labourCostPerUnit,
        directCost: t.directCostPerUnit,
        overheadCost: t.overheadCostPerUnit,
        packingCost: t.packingPerUnit,
        freightCost: t.freightPerUnit,
        baseCost: t.baseCostPerUnit,
        marginAmount: t.marginPerUnit,
        unitPriceExGst: t.unitPriceExGst,
        gstAmount: t.gstAmountPerUnit,
        unitPriceInclGst: t.unitPriceInclGst,
        totalAnnualValue: t.totalAnnualValue,
        operationBreakdowns: [],
      })),
      estimatorName: quote.createdBy.name,
      salesHeadName: quote.approvedBy?.name || null,
      approvalStatus: quote.status,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quotation_${quote.quoteNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate quotation PDF' });
  }
});

export default router;
