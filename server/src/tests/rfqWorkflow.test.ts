import { describe, expect, it } from 'vitest';
import { getRfqWorkflowStatus, isEligibleForSalesHeadApproval } from '../services/rfqWorkflow.js';

describe('RFQ workflow status', () => {
  it('uses an eligible pending quotation to set the RFQ approval state', () => {
    expect(getRfqWorkflowStatus('ESTIMATING', [{
      status: 'PENDING_APPROVAL',
      requiresApproval: true,
      totalAnnualValue: 2_500_001,
    }])).toBe('PENDING_APPROVAL');
  });

  it('does not show approval pending for quotes at or below the threshold', () => {
    for (const totalAnnualValue of [1_000_000, 2_500_000]) {
      expect(isEligibleForSalesHeadApproval({
        status: 'PENDING_APPROVAL',
        requiresApproval: true,
        totalAnnualValue,
      })).toBe(false);
    }
  });

  it('repairs a stale pending RFQ display from the latest quote state without writing data', () => {
    expect(getRfqWorkflowStatus('PENDING_APPROVAL', [{
      status: 'REJECTED',
      requiresApproval: true,
      totalAnnualValue: 3_000_000,
    }])).toBe('ESTIMATING');
    expect(getRfqWorkflowStatus('PENDING_APPROVAL', [{
      status: 'APPROVED',
      requiresApproval: true,
      totalAnnualValue: 3_000_000,
    }])).toBe('SENT');
  });

  it('keeps final WON and LOST RFQ statuses final', () => {
    const pending = [{
      status: 'PENDING_APPROVAL',
      requiresApproval: true,
      totalAnnualValue: 3_000_000,
    }];
    expect(getRfqWorkflowStatus('WON', pending)).toBe('WON');
    expect(getRfqWorkflowStatus('LOST', pending)).toBe('LOST');
  });
});
