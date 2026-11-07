import { prisma } from '../db/prisma.js';

export interface RateSnapshotPayload {
  material: {
    id?: string;
    materialCode: string;
    name: string;
    ratePerKg: number;
    scrapRatePerKg: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
  };
  machines: {
    machineId?: string;
    machineCode: string;
    name: string;
    hourRate: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }[];
  labour: {
    labourType: string;
    hourRate: number;
  }[];
  capturedAt: string;
}

export async function createRateSnapshot(quoteId: string, payload: RateSnapshotPayload) {
  const snapshotJson = JSON.stringify(payload);
  return await prisma.quoteRateSnapshot.upsert({
    where: { quoteId },
    update: {
      ratesData: snapshotJson,
      capturedAt: new Date(),
    },
    create: {
      quoteId,
      ratesData: snapshotJson,
      capturedAt: new Date(),
    },
  });
}

export async function getRateSnapshot(quoteId: string): Promise<RateSnapshotPayload | null> {
  const record = await prisma.quoteRateSnapshot.findUnique({
    where: { quoteId },
  });
  if (!record) return null;
  try {
    return JSON.parse(record.ratesData) as RateSnapshotPayload;
  } catch {
    return null;
  }
}
