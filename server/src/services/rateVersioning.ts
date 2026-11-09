export interface RateVersionPeriod {
  id: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

export class RateVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateVersionConflictError';
  }
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseEffectiveDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && parsed.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return utcDay(parsed);
}

function dayBefore(date: Date): Date {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

function rangesOverlap(
  firstFrom: Date,
  firstTo: Date | null,
  secondFrom: Date,
  secondTo: Date | null,
): boolean {
  return (firstTo === null || firstTo >= secondFrom) &&
    (secondTo === null || secondTo >= firstFrom);
}

export function planRateVersion(
  periods: RateVersionPeriod[],
  effectiveFrom: Date,
  requestedEffectiveTo: Date | null,
): { effectiveTo: Date | null; closePrevious: { id: string; effectiveTo: Date } | null } {
  const from = utcDay(effectiveFrom);
  const requestedTo = requestedEffectiveTo ? utcDay(requestedEffectiveTo) : null;

  if (requestedTo && requestedTo < from) {
    throw new RateVersionConflictError('Effective end date must be on or after the start date');
  }

  const ordered = [...periods].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (rangesOverlap(previous.effectiveFrom, previous.effectiveTo, current.effectiveFrom, current.effectiveTo)) {
      throw new RateVersionConflictError('Existing rate history contains overlapping versions; resolve it before adding a version');
    }
  }

  const covering = ordered.filter((period) =>
    period.effectiveFrom <= from && (period.effectiveTo === null || period.effectiveTo >= from),
  );
  if (covering.length > 1) {
    throw new RateVersionConflictError('Existing rate history contains conflicting versions');
  }

  const previous = covering[0];
  if (previous && previous.effectiveTo !== null) {
    throw new RateVersionConflictError('The selected effective date overlaps an existing rate version');
  }
  if (previous && utcDay(previous.effectiveFrom).getTime() === from.getTime()) {
    throw new RateVersionConflictError('A rate version already starts on the selected effective date');
  }

  const next = ordered.find((period) => period.effectiveFrom > from);
  let effectiveTo = requestedTo;

  if (effectiveTo === null && next) {
    effectiveTo = dayBefore(utcDay(next.effectiveFrom));
  } else if (effectiveTo && next && effectiveTo >= utcDay(next.effectiveFrom)) {
    throw new RateVersionConflictError('The requested effective period overlaps a later rate version');
  }

  for (const period of ordered) {
    if (previous && period.id === previous.id) continue;
    if (rangesOverlap(from, effectiveTo, utcDay(period.effectiveFrom), period.effectiveTo && utcDay(period.effectiveTo))) {
      throw new RateVersionConflictError('The requested effective period overlaps an existing rate version');
    }
  }

  return {
    effectiveTo,
    closePrevious: previous
      ? { id: previous.id, effectiveTo: dayBefore(from) }
      : null,
  };
}
