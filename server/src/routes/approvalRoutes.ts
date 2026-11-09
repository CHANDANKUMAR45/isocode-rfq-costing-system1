import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';
import { APPROVAL_THRESHOLD_INR, isEligibleForSalesHeadApproval } from '../services/rfqWorkflow.js';

const router = Router();

// Get all quotes pending approval
router.get('/', requireAuth, requirePermission('APPROVAL_VIEW'), async (_req, res) => {
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
        snapshot: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pendingQuotes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

router.post('/:quoteId/approve', requireAuth, requirePermission('APPROVAL_DECIDE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { quoteId } = req.params;
  const parsed = z.object({ comments: z.string().max(2000).optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid approval payload', details: parsed.error.format() });
    return;
  }
  const { comments } = parsed.data;
  const userId = req.user!.id;

  try {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { rfq: true, part: { select: { rfqId: true } } },
    });

    if (!existingQuote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    if (
      !isEligibleForSalesHeadApproval(existingQuote) ||
      existingQuote.rfq.status !== 'PENDING_APPROVAL' ||
      existingQuote.part.rfqId !== existingQuote.rfqId
    ) {
      res.status(400).json({ error: `Quote is not in PENDING_APPROVAL status (Current: ${existingQuote.status})` });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const approvalTime = new Date();
      const claimed = await tx.quote.updateMany({
        where: {
          id: quoteId,
          status: 'PENDING_APPROVAL',
          requiresApproval: true,
          totalAnnualValue: { gt: APPROVAL_THRESHOLD_INR },
        },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: approvalTime,
          approvalComments: comments || 'Approved by Sales Head for formal customer quotation.',
        },
      });
      if (claimed.count !== 1) {
        throw new Error('APPROVAL_STATE_CONFLICT');
      }

      const rfqClaim = await tx.rFQ.updateMany({
        where: { id: existingQuote.rfqId, status: 'PENDING_APPROVAL' },
        data: { status: 'SENT' },
      });
      if (rfqClaim.count !== 1) {
        throw new Error('RFQ_STATE_CONFLICT');
      }
      await tx.auditLog.create({
        data: {
          entityType: 'QUOTE',
          entityId: quoteId,
          action: 'APPROVE',
          userId,
          details: JSON.stringify({
            before: { quoteStatus: existingQuote.status, rfqStatus: existingQuote.rfq.status },
            after: { quoteStatus: 'APPROVED', rfqStatus: 'SENT', approvedById: userId, approvedAt: approvalTime.toISOString() },
            metadata: { totalAnnualValue: existingQuote.totalAnnualValue, comments: comments || null },
          }),
        },
      });

      return tx.quote.findUniqueOrThrow({
        where: { id: quoteId },
        include: { approvedBy: { select: { id: true, name: true } } },
      });
    });

    res.json({
      message: `Quote ${existingQuote.quoteNumber} successfully approved. RFQ marked as SENT to customer.`,
      quote: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'APPROVAL_STATE_CONFLICT') {
      res.status(409).json({ error: 'Quote was already reviewed or is no longer eligible for approval' });
      return;
    }
    if (error instanceof Error && error.message === 'RFQ_STATE_CONFLICT') {
      res.status(409).json({ error: 'RFQ was already reviewed or is no longer awaiting approval' });
      return;
    }
    console.error('Approval action failed');
    res.status(500).json({ error: 'Failed to approve quote' });
  }
});

router.post('/:quoteId/reject', requireAuth, requirePermission('APPROVAL_DECIDE'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { quoteId } = req.params;
  const schema = z.object({
    rejectionReason: z.string().trim().min(3, 'Rejection reason is required').max(2000),
    comments: z.string().max(2000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    return;
  }

  const { rejectionReason, comments } = parsed.data;
  const userId = req.user!.id;

  try {
    const existingQuote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { rfq: true, part: { select: { rfqId: true } } },
    });

    if (!existingQuote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }

    if (
      !isEligibleForSalesHeadApproval(existingQuote) ||
      existingQuote.rfq.status !== 'PENDING_APPROVAL' ||
      existingQuote.part.rfqId !== existingQuote.rfqId
    ) {
      res.status(400).json({ error: `Quote is not eligible for rejection (Current: ${existingQuote.status})` });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reviewTime = new Date();
      const claimed = await tx.quote.updateMany({
        where: {
          id: quoteId,
          status: 'PENDING_APPROVAL',
          requiresApproval: true,
          totalAnnualValue: { gt: APPROVAL_THRESHOLD_INR },
        },
        data: {
          status: 'REJECTED',
          approvedById: userId,
          approvedAt: reviewTime,
          rejectionReason,
          approvalComments: comments,
        },
      });
      if (claimed.count !== 1) {
        throw new Error('APPROVAL_STATE_CONFLICT');
      }

      const rfqClaim = await tx.rFQ.updateMany({
        where: { id: existingQuote.rfqId, status: 'PENDING_APPROVAL' },
        data: { status: 'ESTIMATING' },
      });
      if (rfqClaim.count !== 1) {
        throw new Error('RFQ_STATE_CONFLICT');
      }
      await tx.auditLog.create({
        data: {
          entityType: 'QUOTE',
          entityId: quoteId,
          action: 'REJECT',
          userId,
          details: JSON.stringify({
            before: { quoteStatus: existingQuote.status, rfqStatus: existingQuote.rfq.status },
            after: { quoteStatus: 'REJECTED', rfqStatus: 'ESTIMATING', reviewedById: userId, reviewedAt: reviewTime.toISOString() },
            metadata: { totalAnnualValue: existingQuote.totalAnnualValue, rejectionReason, comments: comments || null },
          }),
        },
      });

      return tx.quote.findUniqueOrThrow({
        where: { id: quoteId },
        include: { approvedBy: { select: { id: true, name: true } } },
      });
    });

    res.json({
      message: `Quote ${existingQuote.quoteNumber} rejected and sent back to estimator for revision.`,
      quote: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'APPROVAL_STATE_CONFLICT') {
      res.status(409).json({ error: 'Quote was already reviewed or is no longer eligible for rejection' });
      return;
    }
    if (error instanceof Error && error.message === 'RFQ_STATE_CONFLICT') {
      res.status(409).json({ error: 'RFQ was already reviewed or is no longer awaiting approval' });
      return;
    }
    console.error('Rejection action failed');
    res.status(500).json({ error: 'Failed to reject quote' });
  }
});

// Audit history of approvals
router.get('/history', requireAuth, requirePermission('AUDIT_READ'), async (_req, res) => {
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
