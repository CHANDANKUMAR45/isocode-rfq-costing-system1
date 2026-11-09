export const APPROVAL_THRESHOLD_INR = 2_500_000;

export interface WorkflowQuote {
  status: string;
  requiresApproval: boolean;
  totalAnnualValue: number;
  createdAt?: Date | string;
}

export function isEligibleForSalesHeadApproval(quote: WorkflowQuote): boolean {
  return quote.status === 'PENDING_APPROVAL'
    && quote.requiresApproval
    && quote.totalAnnualValue > APPROVAL_THRESHOLD_INR;
}

export function getRfqWorkflowStatus(
  status: string,
  quotes: WorkflowQuote[],
): string {
  if (status === 'WON' || status === 'LOST') return status;
  if (quotes.some(isEligibleForSalesHeadApproval)) return 'PENDING_APPROVAL';
  if (status === 'PENDING_APPROVAL') {
    const latestQuote = [...quotes].sort((left, right) =>
      new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime(),
    )[0];
    return latestQuote?.status === 'APPROVED' || latestQuote?.status === 'SENT'
      ? 'SENT'
      : 'ESTIMATING';
  }
  return status;
}
