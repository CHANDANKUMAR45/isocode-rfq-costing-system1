import { APPROVAL_THRESHOLD_INR } from './rfqWorkflow.js';

/**
 * Pure Deterministic Part Costing Mathematical Engine
 * Manufacturing quotation calculations for the configured rate inputs.
 * 
 * Rules:
 * 1. Zero AI arithmetic - 100% deterministic, verifiable math.
 * 2. Multi-volume amortization of setup times across batch/annual production tiers.
 * 3. Separate 18% GST calculation.
 * 4. Automatic flagging when annual value exceeds ₹25 Lakhs (approval threshold).
 */

export interface CostingOperationInput {
  sequence: number;
  operationName: string;
  machineId?: string;
  machineName: string;
  setupTimeMin: number;
  cycleTimeMin: number;
  machineHourRate: number; // ₹/hr
  labourRateHr: number;     // ₹/hr
}

export interface CostingCalculationInput {
  grossWeightKg: number;
  netWeightKg: number;
  materialRatePerKg: number;      // ₹/kg
  scrapRecoveryRatePerKg: number; // ₹/kg
  operations: CostingOperationInput[];
  volumeTiers: { volume: number; label?: string }[];
  overheadPct?: number;     // default 12%
  packingPerUnit?: number;  // default ₹8.0
  freightPerUnit?: number;  // default ₹12.0
  marginPct?: number;       // default 15%
  gstPct?: number;          // default 18%
  annualVolume: number;     // customer requested annual volume
}

export interface VolumeTierCostBreakdown {
  volume: number;
  label: string;
  grossMaterialCost: number;
  scrapWeightKg: number;
  scrapCredit: number;
  netMaterialCost: number;
  machiningCost: number;
  labourCost: number;
  directCost: number;
  overheadCost: number;
  packingCost: number;
  freightCost: number;
  baseCost: number;
  marginAmount: number;
  unitPriceExGst: number;
  gstAmount: number;
  unitPriceInclGst: number;
  totalAnnualValue: number;
  operationBreakdowns: {
    sequence: number;
    operationName: string;
    machineName: string;
    setupAmortizedMin: number;
    totalTimeMin: number;
    machineCost: number;
    labourCost: number;
  }[];
}

export interface CostingCalculationResult {
  tiers: VolumeTierCostBreakdown[];
  maxAnnualValue: number;
  requiresSalesHeadApproval: boolean;
  approvalThreshold: number; // 25,00,000 INR
}

/**
 * Rounds a number to two decimal places
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculatePartCost(input: CostingCalculationInput): CostingCalculationResult {
  const {
    grossWeightKg,
    netWeightKg,
    materialRatePerKg,
    scrapRecoveryRatePerKg,
    operations,
    volumeTiers,
    overheadPct = 12.0,
    packingPerUnit = 8.0,
    freightPerUnit = 12.0,
    marginPct = 15.0,
    gstPct = 18.0,
    annualVolume,
  } = input;

  // Material Calculations (constant across volumes, per unit)
  const grossMaterialCost = round2(grossWeightKg * materialRatePerKg);
  const scrapWeightKg = round2(Math.max(0, grossWeightKg - netWeightKg));
  const scrapCredit = round2(scrapWeightKg * scrapRecoveryRatePerKg);
  const netMaterialCost = round2(Math.max(0, grossMaterialCost - scrapCredit));

  let maxAnnualValue = 0;

  const tiers: VolumeTierCostBreakdown[] = volumeTiers.map((tier) => {
    const vol = tier.volume;
    const label = tier.label || `Tier (${vol.toLocaleString('en-IN')} pcs)`;

    // Calculate routing costs amortized at this volume
    let totalMachiningCost = 0;
    let totalLabourCost = 0;

    const opBreakdowns = operations.map((op) => {
      // Setup time amortized per unit: setupTimeMin / batchVolume
      const setupAmortizedMin = vol > 0 ? op.setupTimeMin / vol : 0;
      const totalTimeMin = setupAmortizedMin + op.cycleTimeMin;
      const totalTimeHr = totalTimeMin / 60;

      const machineCost = round2(totalTimeHr * op.machineHourRate);
      const labourCost = round2(totalTimeHr * op.labourRateHr);

      totalMachiningCost += machineCost;
      totalLabourCost += labourCost;

      return {
        sequence: op.sequence,
        operationName: op.operationName,
        machineName: op.machineName,
        setupAmortizedMin: round2(setupAmortizedMin),
        totalTimeMin: round2(totalTimeMin),
        machineCost,
        labourCost,
      };
    });

    totalMachiningCost = round2(totalMachiningCost);
    totalLabourCost = round2(totalLabourCost);

    const directCost = round2(netMaterialCost + totalMachiningCost + totalLabourCost);
    const overheadCost = round2(directCost * (overheadPct / 100));
    const baseCost = round2(directCost + overheadCost + packingPerUnit + freightPerUnit);

    // Selling price: Base Cost / (1 - Margin %)
    const divisor = 1 - (marginPct / 100);
    const unitPriceExGst = divisor > 0 ? round2(baseCost / divisor) : baseCost;
    const marginAmount = round2(unitPriceExGst - baseCost);

    const gstAmount = round2(unitPriceExGst * (gstPct / 100));
    const unitPriceInclGst = round2(unitPriceExGst + gstAmount);

    // Annual value based on base annual volume (or tier volume if annual volume not passed)
    const valuationVolume = annualVolume > 0 ? annualVolume : vol;
    const totalAnnualValue = round2(unitPriceExGst * valuationVolume);

    if (totalAnnualValue > maxAnnualValue) {
      maxAnnualValue = totalAnnualValue;
    }

    return {
      volume: vol,
      label,
      grossMaterialCost,
      scrapWeightKg,
      scrapCredit,
      netMaterialCost,
      machiningCost: totalMachiningCost,
      labourCost: totalLabourCost,
      directCost,
      overheadCost,
      packingCost: packingPerUnit,
      freightCost: freightPerUnit,
      baseCost,
      marginAmount,
      unitPriceExGst,
      gstAmount,
      unitPriceInclGst,
      totalAnnualValue,
      operationBreakdowns: opBreakdowns,
    };
  });

  const requiresSalesHeadApproval = maxAnnualValue > APPROVAL_THRESHOLD_INR;

  return {
    tiers,
    maxAnnualValue,
    requiresSalesHeadApproval,
    approvalThreshold: APPROVAL_THRESHOLD_INR,
  };
}
