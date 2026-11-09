export type UserRole = 'ESTIMATOR' | 'SALES_HEAD' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
}

export type RFQStatus = 'ESTIMATING' | 'PENDING_APPROVAL' | 'SENT' | 'WON' | 'LOST';

export interface Customer {
  id: string;
  name: string;
  code: string;
  segment: string;
  contactPerson?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
}

export interface PartOperation {
  id?: string;
  sequence: number;
  operationName: string;
  machineId?: string;
  machineName: string;
  setupTimeMin: number;
  cycleTimeMin: number;
  labourType?: string;
  labourRateHr: number;
  machineHourRate?: number;
  machine?: MachineRate;
}

export interface Part {
  id: string;
  rfqId: string;
  partNumber: string;
  partName: string;
  materialId?: string | null;
  materialName: string;
  grossWeightKg: number;
  netWeightKg: number;
  annualVolume: number;
  targetPrice?: number | null;
  drawingNumber?: string | null;
  drawingRevision?: string | null;
  notes?: string | null;
  operations?: PartOperation[];
  quotes?: QuoteSummary[];
}

export interface QuoteSummary {
  id: string;
  quoteNumber: string;
  status: string;
  totalAnnualValue: number;
  requiresApproval: boolean;
}

export interface RFQ {
  id: string;
  rfqNumber: string;
  customerId: string;
  customer: Customer;
  assignedEstimatorId?: string | null;
  assignedEstimator?: User | null;
  status: RFQStatus;
  lossReason?: string | null;
  targetDueDate: string;
  receivedDate: string;
  notes?: string | null;
  parts: Part[];
  _count?: {
    quotes: number;
    parts: number;
  };
}

export interface DashboardSummary {
  activeRfqs: number;
  estimatingRfqs: number;
  quotesPendingApproval: number;
  approvedQuotes: number;
  quotesSentToCustomer: number;
  wonOrders: number;
  lostOrders: number;
}

export interface VolumeTierBreakdown {
  id?: string;
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
}

export interface CalculationResult {
  tiers: VolumeTierBreakdown[];
  maxAnnualValue: number;
  requiresSalesHeadApproval: boolean;
  approvalThreshold: number;
}

export interface MaterialRate {
  id: string;
  materialCode: string;
  name: string;
  category: string;
  ratePerKg: number;
  scrapRatePerKg: number;
  density: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface MachineRate {
  id: string;
  machineCode: string;
  name: string;
  category: string;
  hourRate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface LabourRate {
  id: string;
  labourType: string;
  hourRate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface HistoricalQuoteRecord {
  id: string;
  rfqNumber: string;
  customerName: string;
  partName: string;
  material: string;
  grossWeightKg: number;
  annualVolume: number;
  cycleTimeMin: number;
  machineHourRate: number;
  unitPriceInr: number;
  quotedDate: string;
  status: string;
  routingsSummary?: string | null;
}
