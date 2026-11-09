import { Router, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.js';
import { getRfqWorkflowStatus } from '../services/rfqWorkflow.js';

const router = Router();

router.get('/summary', requireAuth, requirePermission('RFQ_READ'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rfqs = await prisma.rFQ.findMany({
      where: req.user?.role === 'ESTIMATOR'
        ? { assignedEstimatorId: req.user.id }
        : undefined,
      select: {
        status: true,
        quotes: {
          select: {
            status: true,
            requiresApproval: true,
            totalAnnualValue: true,
            approvedById: true,
            createdAt: true,
          },
        },
      },
    });

    const rfqStatuses = rfqs.map((rfq) => getRfqWorkflowStatus(rfq.status, rfq.quotes));
    const quotes = rfqs.flatMap((rfq) => rfq.quotes);
    res.json({
      activeRfqs: rfqStatuses.filter((status) => status !== 'WON' && status !== 'LOST').length,
      estimatingRfqs: rfqStatuses.filter((status) => status === 'ESTIMATING').length,
      quotesPendingApproval: quotes.filter((quote) => quote.status === 'PENDING_APPROVAL').length,
      approvedQuotes: quotes.filter((quote) => quote.status === 'APPROVED' && quote.approvedById !== null).length,
      quotesSentToCustomer: quotes.filter((quote) =>
        quote.status === 'SENT'
        || (quote.status === 'APPROVED' && (quote.approvedById !== null || !quote.requiresApproval)),
      ).length,
      wonOrders: rfqStatuses.filter((status) => status === 'WON').length,
      lostOrders: rfqStatuses.filter((status) => status === 'LOST').length,
    });
  } catch (error) {
    console.error('Dashboard summary query failed:', error);
    res.status(500).json({ error: 'Failed to load dashboard summary' });
  }
});

export default router;
