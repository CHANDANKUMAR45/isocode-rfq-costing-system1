import React, { useState, useEffect, useMemo } from 'react';
import { RFQ, Part, MaterialRate, MachineRate, LabourRate, PartOperation, CalculationResult } from '../types';
import { api } from '../services/api';
import {
  Calculator,
  Plus,
  Trash2,
  Save,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface CostingCalculatorProps {
  rfqs: RFQ[];
  activeRates: {
    materials: MaterialRate[];
    machines: MachineRate[];
    labour: LabourRate[];
  };
  initialRfq?: RFQ | null;
  onQuoteSaved: () => void;
  onOpenPdf: (quoteId: string) => void;
  onOpenAiIntake: () => void;
}

export const CostingCalculator: React.FC<CostingCalculatorProps> = ({
  rfqs,
  activeRates,
  initialRfq,
  onQuoteSaved,
  onOpenPdf,
  onOpenAiIntake,
}) => {
  const [selectedRfqId, setSelectedRfqId] = useState<string>(
    initialRfq?.id || (rfqs.length > 0 ? rfqs[0].id : '')
  );

  const currentRfq = useMemo(
    () => rfqs.find((r) => r.id === selectedRfqId) || rfqs[0] || null,
    [rfqs, selectedRfqId]
  );

  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [materialCode, setMaterialCode] = useState('EN8');
  const [grossWeightKg, setGrossWeightKg] = useState<number>(0.61);
  const [netWeightKg, setNetWeightKg] = useState<number>(0.52);
  const [annualVolume, setAnnualVolume] = useState<number>(180000);

  // Costing Parameters
  const [overheadPct, setOverheadPct] = useState<number>(12.0);
  const [packingPerUnit, setPackingPerUnit] = useState<number>(8.0);
  const [freightPerUnit, setFreightPerUnit] = useState<number>(12.0);
  const [marginPct, setMarginPct] = useState<number>(15.0);
  const [gstPct] = useState<number>(18.0);

  // Volume Tiers for comparison
  const [tiers, setTiers] = useState<number[]>([50000, 100000, 180000]);

  // Operations Routing
  const [operations, setOperations] = useState<PartOperation[]>([
    {
      sequence: 1,
      operationName: 'Facing & Centering',
      machineName: 'CNC-LATHE-01',
      setupTimeMin: 30.0,
      cycleTimeMin: 0.8,
      labourRateHr: 160.0,
      machineHourRate: 850.0,
    },
    {
      sequence: 2,
      operationName: 'Rough & Finish CNC Turning',
      machineName: 'CNC-LATHE-01',
      setupTimeMin: 45.0,
      cycleTimeMin: 2.4,
      labourRateHr: 160.0,
      machineHourRate: 850.0,
    },
  ]);

  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Active Material Rate
  const activeMaterial = useMemo(() => {
    return (
      activeRates.materials.find((m) => m.materialCode === materialCode) ||
      activeRates.materials[0] || {
        ratePerKg: 78.0,
        scrapRatePerKg: 32.0,
      }
    );
  }, [activeRates.materials, materialCode]);

  // Initialize from current RFQ when changed
  useEffect(() => {
    if (currentRfq && currentRfq.parts.length > 0) {
      const p = currentRfq.parts[0];
      setPartName(p.partName);
      setPartNumber(p.partNumber);
      setMaterialCode(p.materialName || 'EN8');
      setGrossWeightKg(p.grossWeightKg);
      setNetWeightKg(p.netWeightKg);
      setAnnualVolume(p.annualVolume);

      const baseVol = p.annualVolume;
      const t1 = Math.round((baseVol * 0.4) / 1000) * 1000;
      const t2 = Math.round((baseVol * 0.7) / 1000) * 1000;
      setTiers([Math.max(1000, t1), Math.max(2000, t2), baseVol]);

      if (p.operations && p.operations.length > 0) {
        setOperations(
          p.operations.map((op) => ({
            sequence: op.sequence,
            operationName: op.operationName,
            machineName: op.machineName,
            setupTimeMin: op.setupTimeMin,
            cycleTimeMin: op.cycleTimeMin,
            labourRateHr: op.labourRateHr,
            machineHourRate: op.machine?.hourRate || 850.0,
          }))
        );
      }
    }
  }, [currentRfq]);

  // Trigger live calculation on parameter changes
  useEffect(() => {
    const payload = {
      grossWeightKg,
      netWeightKg,
      materialRatePerKg: activeMaterial.ratePerKg,
      scrapRecoveryRatePerKg: activeMaterial.scrapRatePerKg,
      annualVolume,
      overheadPct,
      packingPerUnit,
      freightPerUnit,
      marginPct,
      gstPct,
      volumeTiers: tiers.map((v, i) => ({
        volume: v,
        label: i === tiers.length - 1 ? `${v.toLocaleString('en-IN')} pcs (Target)` : `${v.toLocaleString('en-IN')} pcs`,
      })),
      operations: operations.map((op) => {
        const machRate =
          op.machineHourRate ||
          activeRates.machines.find((m) => m.machineCode === op.machineName || m.name === op.machineName)?.hourRate ||
          850.0;
        return {
          sequence: op.sequence,
          operationName: op.operationName,
          machineName: op.machineName,
          setupTimeMin: op.setupTimeMin,
          cycleTimeMin: op.cycleTimeMin,
          machineHourRate: machRate,
          labourRateHr: op.labourRateHr || 160.0,
        };
      }),
    };

    api
      .calculateCost(payload)
      .then((res) => setCalcResult(res))
      .catch((err) => console.error('Calculation preview error:', err));
  }, [
    grossWeightKg,
    netWeightKg,
    activeMaterial,
    annualVolume,
    overheadPct,
    packingPerUnit,
    freightPerUnit,
    marginPct,
    gstPct,
    tiers,
    operations,
    activeRates.machines,
  ]);

  const handleAddOperation = () => {
    const newSeq = operations.length + 1;
    const defaultMach = activeRates.machines[0]?.machineCode || 'CNC-LATHE-01';
    const defaultRate = activeRates.machines[0]?.hourRate || 850.0;

    setOperations([
      ...operations,
      {
        sequence: newSeq,
        operationName: 'VMC Keyway Milling',
        machineName: defaultMach,
        setupTimeMin: 30.0,
        cycleTimeMin: 1.5,
        labourRateHr: 160.0,
        machineHourRate: defaultRate,
      },
    ]);
  };

  const handleRemoveOperation = (index: number) => {
    if (operations.length <= 1) return;
    const filtered = operations.filter((_, idx) => idx !== index).map((op, i) => ({ ...op, sequence: i + 1 }));
    setOperations(filtered);
  };

  const handleUpdateOperation = (index: number, field: keyof PartOperation, value: any) => {
    const updated = [...operations];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'machineName') {
      const mach = activeRates.machines.find((m) => m.machineCode === value || m.name === value);
      if (mach) {
        updated[index].machineHourRate = mach.hourRate;
      }
    }

    setOperations(updated);
  };

  const handleSaveQuotation = async () => {
    if (!currentRfq || currentRfq.parts.length === 0) return;
    setIsSaving(true);
    setNoticeMessage(null);

    const part = currentRfq.parts[0];
    const costingPayload = {
      grossWeightKg,
      netWeightKg,
      materialRatePerKg: activeMaterial.ratePerKg,
      scrapRecoveryRatePerKg: activeMaterial.scrapRatePerKg,
      annualVolume,
      overheadPct,
      packingPerUnit,
      freightPerUnit,
      marginPct,
      gstPct,
      volumeTiers: tiers.map((v, i) => ({
        volume: v,
        label: i === tiers.length - 1 ? `${v.toLocaleString('en-IN')} pcs (Target)` : `${v.toLocaleString('en-IN')} pcs`,
      })),
      operations: operations.map((op) => ({
        sequence: op.sequence,
        operationName: op.operationName,
        machineName: op.machineName,
        setupTimeMin: op.setupTimeMin,
        cycleTimeMin: op.cycleTimeMin,
        machineHourRate: op.machineHourRate || 850.0,
        labourRateHr: op.labourRateHr || 160.0,
      })),
    };

    try {
      const res = await api.saveQuote({
        rfqId: currentRfq.id,
        partId: part.id,
        costingInput: costingPayload,
        validityDays: 30,
      });

      setSavedQuoteId(res.quote.id);
      setNoticeMessage(res.message);
      onQuoteSaved();
    } catch (err: any) {
      alert(`Failed to save quote: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Header bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0">
            <Calculator className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Deterministic Costing Engine & Part Routing
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Configured Rates • Multi-Volume Matrix • Versioned Snapshots
            </p>
          </div>
        </div>

        {/* RFQ Selector & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex-1 sm:flex-initial text-left sm:text-right min-w-0">
            <label className="block text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase truncate">
              Select RFQ
            </label>
            <select
              value={selectedRfqId}
              onChange={(e) => setSelectedRfqId(e.target.value)}
              className="w-full sm:w-auto text-xs sm:text-sm font-mono font-medium rounded-lg border border-slate-300 py-1.5 px-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-sky-500 truncate"
            >
              {rfqs.map((rfq) => (
                <option key={rfq.id} value={rfq.id}>
                  {rfq.rfqNumber} - {rfq.customer.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenAiIntake}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shrink-0 self-end"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">AI Pre-Fill</span>
          </button>
        </div>
      </div>

      {/* Approval Threshold Alert Banner */}
      {calcResult && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 ${
            calcResult.requiresSalesHeadApproval
              ? 'bg-amber-50/90 border-amber-300 text-amber-900'
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
            {calcResult.requiresSalesHeadApproval ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold">
                {calcResult.requiresSalesHeadApproval
                  ? `Annual Value: ₹${(calcResult.maxAnnualValue / 100000).toFixed(2)} Lakhs — Exceeds ₹25 Lakhs Threshold`
                  : `Annual Value: ₹${(calcResult.maxAnnualValue / 100000).toFixed(2)} Lakhs — Standard Approval Limit`}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                {calcResult.requiresSalesHeadApproval
                  ? 'Requires Sales Head approval before release to customer.'
                  : 'Quote is within standard estimator approval limit.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            {savedQuoteId && (
              <button
                onClick={() => onOpenPdf(savedQuoteId)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Quote</span>
              </button>
            )}

            <button
              onClick={handleSaveQuotation}
              disabled={isSaving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors disabled:opacity-50 min-h-[38px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Freezing...' : 'Freeze & Save Quote'}</span>
            </button>
          </div>
        </div>
      )}

      {noticeMessage && (
        <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-800 font-medium animate-in fade-in">
          ✓ {noticeMessage}
        </div>
      )}

      {/* Main Grid: Left Column (Inputs) & Right Column (Multi-Volume Matrix) */}
      <div className="grid min-w-0 grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">

        {/* LEFT COLUMN: Inputs (5 cols on desktop, full width on mobile/tablet) */}
        <div className="min-w-0 xl:col-span-5 space-y-4 sm:space-y-6">

          {/* Card 1: Part & Material Master */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Part & Material Master
              </h3>
              <span className="text-[11px] font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Rate: ₹{activeMaterial.ratePerKg}/kg
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Part Name</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Part Number</label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Material Grade</label>
              <select
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-300 p-2 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-sky-500"
              >
                {activeRates.materials.map((m) => (
                  <option key={m.id} value={m.materialCode}>
                    {m.materialCode} - {m.name} (₹{m.ratePerKg}/kg)
                  </option>
                ))}
              </select>
            </div>

            {/* Weights: responsive 2-column or 3-column layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                  Gross Wt (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={grossWeightKg}
                  onChange={(e) => setGrossWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono font-semibold rounded-lg border border-slate-300 p-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                  Net Wt (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={netWeightKg}
                  onChange={(e) => setNetWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                  Scrap Recv (₹/kg)
                </label>
                <input
                  type="number"
                  step="1"
                  disabled
                  value={activeMaterial.scrapRatePerKg}
                  className="w-full text-xs font-mono bg-slate-100 rounded-lg border border-slate-200 p-2 text-slate-500"
                />
              </div>
            </div>

            {/* Scrap recovery preview */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-500 truncate mr-2">
                Scrap Loss: {Math.max(0, grossWeightKg - netWeightKg).toFixed(2)} kg
              </span>
              <span className="font-semibold text-emerald-700 whitespace-nowrap">
                Credit: ₹{(Math.max(0, grossWeightKg - netWeightKg) * activeMaterial.scrapRatePerKg).toFixed(2)}/pc
              </span>
            </div>
          </div>

          {/* Commercial Overheads & Margins */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Commercial Overheads & Margin
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Overhead (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={overheadPct}
                  onChange={(e) => setOverheadPct(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Profit Margin (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={marginPct}
                  onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Packing (₹/pc)</label>
                <input
                  type="number"
                  step="0.5"
                  value={packingPerUnit}
                  onChange={(e) => setPackingPerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Freight (₹/pc)</label>
                <input
                  type="number"
                  step="0.5"
                  value={freightPerUnit}
                  onChange={(e) => setFreightPerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Multi-Volume Costing Matrix Table (7 cols on desktop) */}
        <div className="min-w-0 xl:col-span-7">
          <div className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold tracking-tight">Multi-Volume Costing Matrix (INR ₹)</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  Fixed formulas • Setup amortized by volume • GST 18% itemized
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-400 border border-sky-800 shrink-0">
                Deterministic
              </span>
            </div>

            {/* Matrix Table with Horizontal Scroll */}
            <p className="px-3 py-2 text-[10px] text-slate-500 sm:hidden">
              Scroll horizontally to view every volume and cost.
            </p>
            <div
              className="max-w-full overflow-x-auto overscroll-x-contain"
              role="region"
              aria-label="Multi-volume costing matrix"
              tabIndex={0}
            >
              <table className="w-full text-xs text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                    <th className="py-2.5 px-3">Cost Breakdown Element</th>
                    {calcResult?.tiers.map((tier, i) => (
                      <th key={i} className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        {tier.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* Raw Material Cost */}
                  <tr>
                    <td className="py-2 px-3 text-slate-600">Gross Raw Material</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        ₹{t.grossMaterialCost.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Scrap Credit */}
                  <tr>
                    <td className="py-2 px-3 text-emerald-600">Less: Scrap Recovery Credit</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-emerald-600 whitespace-nowrap">
                        - ₹{t.scrapCredit.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Net Material Cost */}
                  <tr className="bg-slate-50 font-medium">
                    <td className="py-2 px-3 text-slate-800">Net Material Cost</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-900 font-bold whitespace-nowrap">
                        ₹{t.netMaterialCost.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Machining (amortized) */}
                  <tr>
                    <td className="py-2 px-3 text-slate-600">Machining & Setup (Amortized)</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        ₹{t.machiningCost.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Labour */}
                  <tr>
                    <td className="py-2 px-3 text-slate-600">Direct Labour</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        ₹{t.labourCost.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Direct Cost */}
                  <tr className="bg-slate-50 font-medium">
                    <td className="py-2 px-3 text-slate-800">Total Direct Cost</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-900 font-bold whitespace-nowrap">
                        ₹{t.directCost.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Overhead */}
                  <tr>
                    <td className="py-2 px-3 text-slate-600">Factory Overheads ({overheadPct}%)</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        ₹{t.overheadCost.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Packaging & Freight */}
                  <tr>
                    <td className="py-2 px-3 text-slate-600">Packing & Freight</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        ₹{(t.packingCost + t.freightCost).toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Base Cost */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="py-2 px-3 text-slate-900">Base Manufacturing Cost</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-900 font-bold whitespace-nowrap">
                        ₹{t.baseCost.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Margin */}
                  <tr>
                    <td className="py-2 px-3 text-emerald-700">Profit Margin ({marginPct}%)</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-emerald-700 font-medium whitespace-nowrap">
                        + ₹{t.marginAmount.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Unit Selling Price (ex GST) */}
                  <tr className="bg-sky-50 font-bold">
                    <td className="py-2.5 px-3 text-sky-950 font-bold">Quoted Unit Price (ex-GST)</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2.5 px-3 text-right font-mono text-sky-800 text-sm font-bold whitespace-nowrap">
                        ₹{t.unitPriceExGst.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* GST */}
                  <tr>
                    <td className="py-2 px-3 text-slate-500">GST (18% Separately)</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        ₹{t.gstAmount.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Final Unit Price (incl GST) */}
                  <tr className="bg-sky-100/80 border-t-2 border-sky-400 font-bold">
                    <td className="py-3 px-3 text-sky-950 font-bold uppercase tracking-tight">
                      Final Quoted Price (incl. GST)
                    </td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-3 px-3 text-right font-mono text-sky-950 text-base font-extrabold whitespace-nowrap">
                        ₹{t.unitPriceInclGst.toFixed(2)}
                      </td>
                    ))}
                  </tr>

                  {/* Annual Contract Value */}
                  <tr className="bg-slate-900 text-white">
                    <td className="py-2.5 px-3 font-semibold">Total Annual Contract Value</td>
                    {calcResult?.tiers.map((t, i) => (
                      <td key={i} className="py-2.5 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">
                        ₹{t.totalAnnualValue.toLocaleString('en-IN')}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom summary and notes */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
              <p>• GST is shown separately • Rates are frozen in a snapshot when saved.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Operations routing spans the full layout below the part and pricing sections. */}
      <section className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Operations Routing & Cycle Times
          </h3>
          <button
            onClick={handleAddOperation}
            className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 py-1 px-1.5 rounded hover:bg-sky-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add Step
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {operations.map((op, idx) => (
            <div key={idx} className="min-w-0 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">OP #{op.sequence}</span>
                <button
                  onClick={() => handleRemoveOperation(idx)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded"
                  title="Remove operation"
                  aria-label={`Remove operation ${op.sequence}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={op.operationName}
                  onChange={(e) => handleUpdateOperation(idx, 'operationName', e.target.value)}
                  placeholder="Operation name"
                  aria-label={`Operation ${op.sequence} name`}
                  className="min-w-0 text-xs rounded border border-slate-300 p-2 bg-white"
                />

                <select
                  value={op.machineName}
                  onChange={(e) => handleUpdateOperation(idx, 'machineName', e.target.value)}
                  aria-label={`Operation ${op.sequence} machine`}
                  className="min-w-0 text-xs rounded border border-slate-300 p-2 bg-white font-mono"
                >
                  {activeRates.machines.map((m) => (
                    <option key={m.id} value={m.machineCode}>
                      {m.machineCode} (₹{m.hourRate}/hr)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 block truncate">Cycle (min)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={op.cycleTimeMin}
                    onChange={(e) => handleUpdateOperation(idx, 'cycleTimeMin', parseFloat(e.target.value) || 0)}
                    aria-label={`Operation ${op.sequence} cycle time`}
                    className="w-full min-w-0 p-1.5 border border-slate-300 rounded font-mono text-center font-bold text-sky-700"
                  />
                </div>

                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 block truncate">Setup (min)</span>
                  <input
                    type="number"
                    step="5"
                    value={op.setupTimeMin}
                    onChange={(e) => handleUpdateOperation(idx, 'setupTimeMin', parseFloat(e.target.value) || 0)}
                    aria-label={`Operation ${op.sequence} setup time`}
                    className="w-full min-w-0 p-1.5 border border-slate-300 rounded font-mono text-center"
                  />
                </div>

                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 block truncate">Hour Rate (₹)</span>
                  <input
                    type="number"
                    value={op.machineHourRate || 850}
                    onChange={(e) => handleUpdateOperation(idx, 'machineHourRate', parseFloat(e.target.value) || 0)}
                    aria-label={`Operation ${op.sequence} machine hourly rate`}
                    className="w-full min-w-0 p-1.5 border border-slate-300 rounded font-mono text-center"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 flex justify-between gap-2 text-xs font-semibold text-slate-700">
          <span>Total Cycle Time:</span>
          <span className="font-mono text-sky-700 text-right">
            {operations.reduce((acc, o) => acc + (o.cycleTimeMin || 0), 0).toFixed(1)} mins/pc
          </span>
        </div>
      </section>
    </div>
  );
};
