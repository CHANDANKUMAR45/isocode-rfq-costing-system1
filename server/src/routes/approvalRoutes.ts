import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Get all quotes pending approval
router.get('/', requireAuth, async (_req, res) => {
  try {
    const pendingQuotes = await prisma.quote.findMany({
      where: {
        status: 'PENDING_APPROVAL',
      },
      include: {
        rfq: {
          include: { customer: true },
        },
        part: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        volumeTiers: {
          orderBy: { volume: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pendingQuotes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// Approve Quote (Restricted to SALES_HEAD or ADMIN)
router.post('/:quoteId/approve', requireAuth, requireRole(['SALES_HEAD', 'ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { quoteId } = req.params;
  const { comments } = req.body;
  const userId = req.user?.id!;

  try {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { rfq: true },
    });

    if (!existingQuote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    if (existingQuote.status !== 'PENDING_APPROVAL') {
      res.status(400).json({ error: `Quote is not in PENDING_APPROVAL status (Current: ${existingQuote.status})` });
      return;
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        approvalComments: comments || 'Approved by Sales Head for formal customer quotation.',
      },
      include: {
        approvedBy: { select: { id: true, name: true } },
      },
    });

    // Update RFQ status to SENT or ESTIMATING
    await prisma.rFQ.update({
      where: { id: existingQuote.rfqId },
      data: { status: 'SENT' },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        entityType: 'QUOTE',
        entityId: quoteId,
        action: 'APPROVE',
        userId,
        details: `Quote ${existingQuote.quoteNumber} (Annual Value: ₹${existingQuote.totalAnnualValue}) approved by ${req.user?.name}. Comments: ${comments || 'None'}`,
      },
    });

    res.json({
      message: `Quote ${existingQuote.quoteNumber} successfully approved. RFQ marked as SENT to customer.`,
      quote: updated,
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve quote' });
  }
});

// Reject Quote (Restricted to SALES_HEAD or ADMIN)
router.post('/:quoteId/reject', requireAuth, requireRole(['SALES_HEAD', 'ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { quoteId } = req.params;
  const schema = z.object({
    rejectionReason: z.string().min(3, 'Rejection reason is required'),
    comments: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const { rejectionReason, comments } = parsed.data;
  const userId = req.user?.id!;

  try {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
    });

    if (!existingQuote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'REJECTED',
        approvedById: userId,
        approvedAt: new Date(),
        rejectionReason,
        approvalComments: comments,
      },
      include: {
        approvedBy: { select: { id: true, name: true } },
      },
    });

    // Revert RFQ status back to ESTIMATING for revision
    await prisma.rFQ.update({
      where: { id: existingQuote.rfqId },
      data: { status: 'ESTIMATING' },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        entityType: 'QUOTE',
        entityId: quoteId,
        action: 'REJECT',
        userId,
        details: `Quote ${existingQuote.quoteNumber} rejected by ${req.user?.name}. Reason: ${rejectionReason}`,
      },
    });

    res.json({
      message: `Quote ${existingQuote.quoteNumber} rejected and sent back to estimator for revision.`,
      quote: updated,
    });
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: 'Failed to reject quote' });
  }
});

// Audit history of approvals
router.get('/history', requireAuth, async (_req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'QUOTE',
        action: { in: ['APPROVE', 'REJECT'] },
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch approval history' });
  }
});

export default router;
