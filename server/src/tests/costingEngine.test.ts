import { describe, it, expect } from 'vitest';
import { calculatePartCost, round2 } from '../services/costingEngine.js';

describe('Part Costing Mathematical Engine', () => {
  const sampleRearWheelSpindleInput = {
    grossWeightKg: 0.61,
    netWeightKg: 0.52,
    materialRatePerKg: 78.0, // EN8 @ ₹78/kg
    scrapRecoveryRatePerKg: 32.0, // Scrap @ ₹32/kg
    operations: [
      {
        sequence: 1,
        operationName: 'Facing & Centering',
        machineName: 'CNC Lathe',
        setupTimeMin: 30.0,
        cycleTimeMin: 0.8,
        machineHourRate: 850.0,
        labourRateHr: 160.0,
      },
      {
        sequence: 2,
        operationName: 'Rough & Finish CNC Turning',
        machineName: 'CNC Lathe',
        setupTimeMin: 45.0,
        cycleTimeMin: 2.4,
        machineHourRate: 850.0,
        labourRateHr: 160.0,
      },
    ],
    volumeTiers: [
      { volume: 50000, label: 'Batch 50k' },
      { volume: 100000, label: 'Batch 100k' },
      { volume: 120000, label: 'Batch 180k (Target)' },
    ],
    overheadPct: 12.0,
    packingPerUnit: 5.0,
    freightPerUnit: 8.0,
    marginPct: 15.0,
    gstPct: 18.0,
    annualVolume: 120000,
  };

  it('calculates gross material, scrap recovery, and net material accurately', () => {
    const result = calculatePartCost(sampleRearWheelSpindleInput);
    const tier = result.tiers[0];

    // Gross material = 0.61 * 78 = 47.58
    expect(tier.grossMaterialCost).toBe(47.58);

    // Scrap wt = 0.61 - 0.52 = 0.09 kg
    expect(tier.scrapWeightKg).toBe(0.09);

    // Scrap credit = 0.09 * 32 = 2.88
    expect(tier.scrapCredit).toBe(2.88);

    // Net material = 47.58 - 2.88 = 44.70
    expect(tier.netMaterialCost).toBe(44.70);
  });

  it('amortizes setup time across different production volumes correctly', () => {
    const result = calculatePartCost(sampleRearWheelSpindleInput);
    const tier50k = result.tiers[0];
    const tier180k = result.tiers[2];

    // Setup time per unit at 50k should be higher than at 180k
    expect(tier50k.machiningCost).toBeGreaterThanOrEqual(tier180k.machiningCost);
    expect(tier50k.baseCost).toBeGreaterThan(tier180k.baseCost);
  });

  it('calculates overheads, margins, and separate 18% GST accurately', () => {
    const result = calculatePartCost(sampleRearWheelSpindleInput);
    const tier = result.tiers[2];

    // Direct cost = Net material + Machining + Labour
    expect(tier.directCost).toBe(round2(tier.netMaterialCost + tier.machiningCost + tier.labourCost));

    // Overheads = 12% of direct cost
    expect(tier.overheadCost).toBe(round2(tier.directCost * 0.12));

    // Base cost = Direct + Overhead + Packing + Freight
    expect(tier.baseCost).toBe(round2(tier.directCost + tier.overheadCost + 5.0 + 8.0));

    // GST = 18% of ex-GST price
    expect(tier.gstAmount).toBe(round2(tier.unitPriceExGst * 0.18));

    // Final price with GST = ex-GST + GST
    expect(tier.unitPriceInclGst).toBe(round2(tier.unitPriceExGst + tier.gstAmount));
  });

  it('triggers Sales Head Approval when annual contract value exceeds ₹25 Lakhs', () => {
    const result = calculatePartCost(sampleRearWheelSpindleInput);
    // At 120,000 pcs and ~₹145/unit, annual value is ~₹2.6 Crore, which is > ₹25 Lakhs
    expect(result.requiresSalesHeadApproval).toBe(true);
    expect(result.maxAnnualValue).toBeGreaterThan(2500000);
  });

  it('does NOT trigger approval for smaller volume or lower value contracts', () => {
    const smallVolumeInput = {
      ...sampleRearWheelSpindleInput,
      annualVolume: 5000, // 5,000 pcs * ~145 = ~7.25 Lakhs (< ₹25 Lakhs)
      volumeTiers: [{ volume: 5000, label: 'Batch 5k' }],
    };

    const result = calculatePartCost(smallVolumeInput);
    expect(result.requiresSalesHeadApproval).toBe(false);
    expect(result.maxAnnualValue).toBeLessThan(2500000);
  });
});
