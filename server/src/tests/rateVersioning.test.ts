import { describe, expect, it } from 'vitest';
import { parseEffectiveDate, planRateVersion, RateVersionConflictError } from '../services/rateVersioning.js';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('effective-dated rate version planning', () => {
  it('parses valid calendar dates and rejects impossible dates', () => {
    expect(parseEffectiveDate('2026-03-31')?.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    expect(parseEffectiveDate('2026-02-30')).toBeNull();
  });

  it('ends an open previous version the day before the next version starts', () => {
    const plan = planRateVersion(
      [{ id: 'old', effectiveFrom: date('2026-01-01'), effectiveTo: null }],
      date('2026-04-01'),
      null,
    );

    expect(plan.closePrevious).toEqual({ id: 'old', effectiveTo: date('2026-03-31') });
    expect(plan.effectiveTo).toBeNull();
  });

  it('caps a newly inserted historical version before a later version', () => {
    const plan = planRateVersion(
      [{ id: 'later', effectiveFrom: date('2026-06-01'), effectiveTo: null }],
      date('2026-04-01'),
      null,
    );

    expect(plan.closePrevious).toBeNull();
    expect(plan.effectiveTo).toEqual(date('2026-05-31'));
  });

  it.each([
    {
      label: 'same-day duplicate',
      periods: [{ id: 'old', effectiveFrom: date('2026-04-01'), effectiveTo: null }],
      from: '2026-04-01',
      to: null,
    },
    {
      label: 'overlapping requested range',
      periods: [{ id: 'old', effectiveFrom: date('2026-06-01'), effectiveTo: null }],
      from: '2026-04-01',
      to: '2026-06-01',
    },
    {
      label: 'invalid date range',
      periods: [],
      from: '2026-04-02',
      to: '2026-04-01',
    },
  ])('rejects $label', ({ periods, from, to }) => {
    expect(() => planRateVersion(periods, date(from), to ? date(to) : null))
      .toThrow(RateVersionConflictError);
  });
});
