import React, { useState } from 'react';
import { MaterialRate, MachineRate, LabourRate } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Database,
  Calendar,
  Layers,
  Cpu,
  Users,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
} from 'lucide-react';

interface RateMastersProps {
  materialRates: MaterialRate[];
  machineRates: MachineRate[];
  labourRates: LabourRate[];
  onRateUpdated: () => void;
}

export const RateMasters: React.FC<RateMastersProps> = ({
  materialRates,
  machineRates,
  labourRates,
  onRateUpdated,
}) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'machines' | 'labour'>('materials');
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [isCreatingMachine, setIsCreatingMachine] = useState(false);
  const [isCreatingLabour, setIsCreatingLabour] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [showRateHistory, setShowRateHistory] = useState(true);
  const [rateMessage, setRateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Material Form
  const [matCode, setMatCode] = useState('');
  const [isNewMaterialCode, setIsNewMaterialCode] = useState(false);
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState('Carbon Steel Bar');
  const [matRate, setMatRate] = useState<number>(82.0);
  const [matScrapRate, setMatScrapRate] = useState<number>(34.0);
  const [matDensity, setMatDensity] = useState<number>(7.85);
  const [matEffectiveFrom, setMatEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);

  // New Machine Form
  const [machCode, setMachCode] = useState('');
  const [isNewMachineCode, setIsNewMachineCode] = useState(false);
  const [machName, setMachName] = useState('');
  const [machCategory, setMachCategory] = useState('');
  const [machHourRate, setMachHourRate] = useState<number>(950.0);
  const [machEffectiveFrom, setMachEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [labourType, setLabourType] = useState('');
  const [isNewLabourType, setIsNewLabourType] = useState(false);
  const [labourHourRate, setLabourHourRate] = useState<number>(160);
  const [labourEffectiveFrom, setLabourEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);

  const canEdit = user?.role === 'SALES_HEAD' || user?.role === 'ADMIN';
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const materialCodes = Array.from(new Set(materialRates.map((rate) => rate.materialCode)));
  const machineCodes = Array.from(new Set(machineRates.map((rate) => rate.machineCode)));
  const labourTypes = Array.from(new Set(labourRates.map((rate) => rate.labourType)));
  const isCurrentRate = (rate: { effectiveFrom: string; effectiveTo?: string | null; isActive: boolean }) => {
    const from = rate.effectiveFrom.slice(0, 10);
    const to = rate.effectiveTo?.slice(0, 10);
    return rate.isActive && from <= todayKey && (!to || to >= todayKey);
  };
  const getRateStatus = (rate: { effectiveFrom: string; effectiveTo?: string | null; isActive: boolean }) => {
    if (isCurrentRate(rate)) return 'Active';
    if (rate.isActive && rate.effectiveFrom.slice(0, 10) > todayKey) return 'Scheduled';
    return 'Past Revision';
  };
  const visibleMaterialRates = showRateHistory ? materialRates : materialRates.filter(isCurrentRate);
  const visibleMachineRates = showRateHistory ? machineRates : machineRates.filter(isCurrentRate);
  const visibleLabourRates = showRateHistory ? labourRates : labourRates.filter(isCurrentRate);

  const openMaterialForm = () => {
    const code = materialCodes[0] || '';
    const latest = materialRates
      .filter((rate) => rate.materialCode === code)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    setMatCode(code);
    setIsNewMaterialCode(!code);
    setMatName(latest?.name || '');
    setMatCategory(latest?.category || 'Carbon Steel Bar');
    setMatRate(latest?.ratePerKg || 82);
    setMatScrapRate(latest?.scrapRatePerKg || 34);
    setMatDensity(latest?.density || 7.85);
    setMatEffectiveFrom(todayKey);
    setRateMessage(null);
    setIsCreatingMaterial(true);
  };

  const openMachineForm = () => {
    const code = machineCodes[0] || '';
    const latest = machineRates
      .filter((rate) => rate.machineCode === code)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    setMachCode(code);
    setIsNewMachineCode(!code);
    setMachName(latest?.name || '');
    setMachCategory(latest?.category || '');
    setMachHourRate(latest?.hourRate || 950);
    setMachEffectiveFrom(todayKey);
    setRateMessage(null);
    setIsCreatingMachine(true);
  };

  const openLabourForm = () => {
    const type = labourTypes[0] || '';
    const latest = labourRates
      .filter((rate) => rate.labourType === type)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    setLabourType(type);
    setIsNewLabourType(!type);
    setLabourHourRate(latest?.hourRate || 160);
    setLabourEffectiveFrom(todayKey);
    setRateMessage(null);
    setIsCreatingLabour(true);
  };

  const handleCreateMaterialRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRate(true);
    setRateMessage(null);
    try {
      await api.createMaterialRate({
        materialCode: matCode,
        name: matName,
        category: matCategory,
        ratePerKg: matRate,
        scrapRatePerKg: matScrapRate,
        density: matDensity,
        effectiveFrom: matEffectiveFrom,
      });
      setIsCreatingMaterial(false);
      setRateMessage({ type: 'success', text: `New ${matCode} material rate version saved.` });
      onRateUpdated();
    } catch (err: unknown) {
      setRateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save material rate version.' });
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleCreateMachineRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRate(true);
    setRateMessage(null);
    try {
      await api.createMachineRate({
        machineCode: machCode,
        name: machName,
        category: machCategory,
        hourRate: machHourRate,
        effectiveFrom: machEffectiveFrom,
      });
      setIsCreatingMachine(false);
      setRateMessage({ type: 'success', text: `New ${machCode} machine rate version saved.` });
      onRateUpdated();
    } catch (err: unknown) {
      setRateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save machine rate version.' });
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleCreateLabourRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRate(true);
    setRateMessage(null);
    try {
      await api.createLabourRate({
        labourType,
        hourRate: labourHourRate,
        effectiveFrom: labourEffectiveFrom,
      });
      setIsCreatingLabour(false);
      setRateMessage({ type: 'success', text: `New ${labourType} labour rate version saved.` });
      onRateUpdated();
    } catch (err: unknown) {
      setRateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save labour rate version.' });
    } finally {
      setIsSavingRate(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0">
            <Database className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Effective-Dated Rate Masters
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Single Source of Truth • Versioned Windows • Immutable Quote Snapshots
            </p>
          </div>
        </div>

        {/* Sub-tab selection (Responsive flex/grid) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('materials')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeSubTab === 'materials'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Materials ({materialRates.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('machines')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeSubTab === 'machines'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>Machines ({machineRates.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('labour')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeSubTab === 'labour'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>Labour ({labourRates.length})</span>
          </button>
        </div>
      </div>

      {rateMessage && (
        <div
          role={rateMessage.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-xs ${
            rateMessage.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {rateMessage.text}
        </div>
      )}

      <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>Rate versions are immutable. Creating a version preserves its historical rate and dated validity.</span>
        <button
          type="button"
          onClick={() => setShowRateHistory((shown) => !shown)}
          className="self-start rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 sm:self-auto"
        >
          {showRateHistory ? 'Show current rates only' : 'View History'}
        </button>
      </div>

      {/* Permission banner */}
      {!canEdit && (
        <div className="p-3 sm:p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Viewing as <strong>{user?.role === 'ESTIMATOR' ? 'Estimator' : 'Read-only user'}</strong>. Previous rate versions are viewable; creating versions is restricted to authorized roles.
            </span>
          </div>
        </div>
      )}

      {/* MATERIALS TAB */}
      {activeSubTab === 'materials' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Material Price Master with Validity Windows
            </h3>
            {canEdit && (
              <button
                onClick={openMaterialForm}
                className="self-start sm:self-auto flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Version Material Rate
              </button>
            )}
          </div>

          {/* Desktop & Tablet Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Material Code</th>
                    <th className="py-3 px-4">Specification / Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Rate (₹/kg)</th>
                    <th className="py-3 px-4 text-right">Scrap Credit (₹/kg)</th>
                    <th className="py-3 px-4">Effective From</th>
                    <th className="py-3 px-4">Effective To</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleMaterialRates.map((mat) => {
                    const status = getRateStatus(mat);
                    const isCurrent = status === 'Active';
                    return (
                      <tr key={mat.id} className={isCurrent ? 'bg-white' : 'bg-slate-50/70 text-slate-400'}>
                        <td className="py-3 px-4 font-mono font-bold text-sky-800">{mat.materialCode}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{mat.name}</td>
                        <td className="py-3 px-4 text-slate-500">{mat.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{mat.ratePerKg.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          ₹{mat.scrapRatePerKg.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {new Date(mat.effectiveFrom).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {mat.effectiveTo ? new Date(mat.effectiveTo).toLocaleDateString('en-IN') : 'Open / Present'}
                        </td>
                        <td className="py-3 px-4">
                          {isCurrent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {status}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                              {status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="block md:hidden space-y-2.5">
            {visibleMaterialRates.map((mat) => {
              const status = getRateStatus(mat);
              const isCurrent = status === 'Active';
              return (
                <div
                  key={mat.id}
                  className={`p-3 rounded-xl border shadow-xs space-y-2 ${
                    isCurrent ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sky-800 text-sm">{mat.materialCode}</span>
                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {status}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                        {status}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-900">{mat.name}</p>
                  <p className="text-[11px] text-slate-500">{mat.category}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2 rounded-lg border border-slate-100 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Raw Material</span>
                      <span className="font-bold text-slate-900 text-sm">₹{mat.ratePerKg.toFixed(2)}/kg</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Scrap Credit</span>
                      <span className="font-bold text-emerald-700 text-sm">₹{mat.scrapRatePerKg.toFixed(2)}/kg</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                    <span>From: {new Date(mat.effectiveFrom).toLocaleDateString('en-IN')}</span>
                    <span>To: {mat.effectiveTo ? new Date(mat.effectiveTo).toLocaleDateString('en-IN') : 'Present'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MACHINES TAB */}
      {activeSubTab === 'machines' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Machine Hourly Rates Master
            </h3>
            {canEdit && (
              <button
                onClick={openMachineForm}
                className="self-start sm:self-auto flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Version Machine Rate
              </button>
            )}
          </div>

          {/* Desktop & Tablet Table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Machine Code</th>
                    <th className="py-3 px-4">Machine Name & Specs</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Hour Rate (₹/hr)</th>
                    <th className="py-3 px-4">Effective From</th>
                    <th className="py-3 px-4">Effective To</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleMachineRates.map((mach) => {
                    const status = getRateStatus(mach);
                    const isCurrent = status === 'Active';
                    return (
                      <tr key={mach.id} className={isCurrent ? 'bg-white' : 'bg-slate-50/70 text-slate-400'}>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">{mach.machineCode}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{mach.name}</td>
                        <td className="py-3 px-4 text-slate-500">{mach.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{mach.hourRate.toFixed(2)}/hr
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {new Date(mach.effectiveFrom).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {mach.effectiveTo ? new Date(mach.effectiveTo).toLocaleDateString('en-IN') : 'Open / Present'}
                        </td>
                        <td className="py-3 px-4">
                          {isCurrent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {status}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                              {status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="block md:hidden space-y-2.5">
            {visibleMachineRates.map((mach) => {
              const status = getRateStatus(mach);
              const isCurrent = status === 'Active';
              return (
                <div
                  key={mach.id}
                  className={`p-3 rounded-xl border shadow-xs space-y-2 ${
                    isCurrent ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-700 text-sm">{mach.machineCode}</span>
                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {status}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                        {status}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-900">{mach.name}</p>
                  <p className="text-[11px] text-slate-500">{mach.category}</p>

                  <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-500">Machine Hourly Rate:</span>
                    <span className="font-bold text-slate-900 text-sm">₹{mach.hourRate.toFixed(2)}/hr</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                    <span>From: {new Date(mach.effectiveFrom).toLocaleDateString('en-IN')}</span>
                    <span>To: {mach.effectiveTo ? new Date(mach.effectiveTo).toLocaleDateString('en-IN') : 'Present'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LABOUR TAB */}
      {activeSubTab === 'labour' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Direct Labour Hourly Rates Master
            </h3>
            {canEdit && (
              <button
                onClick={openLabourForm}
                className="self-start sm:self-auto flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Version Labour Rate
              </button>
            )}
          </div>

          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-4">Labour Category / Skill Grade</th>
                    <th className="py-3 px-4 text-right">Hourly Rate (₹/hr)</th>
                    <th className="py-3 px-4">Effective Date</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleLabourRates.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 px-4 font-medium text-slate-900">{l.labourType}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{l.hourRate.toFixed(2)}/hr
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(l.effectiveFrom).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isCurrentRate(l)
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {getRateStatus(l)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-2 md:hidden">
            {visibleLabourRates.map((rate) => (
              <div key={rate.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{rate.labourType}</span>
                  <span className="text-sm font-bold text-slate-900">₹{rate.hourRate.toFixed(2)}/hr</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>From {new Date(rate.effectiveFrom).toLocaleDateString('en-IN')}</span>
                  <span>{rate.effectiveTo ? `To ${new Date(rate.effectiveTo).toLocaleDateString('en-IN')}` : 'Open / Present'}</span>
                  <span>{getRateStatus(rate)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Material Modal */}
      {isCreatingMaterial && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateMaterialRate}
            className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl border border-slate-200 space-y-3.5 max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Version Material Rate</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              This creates an immutable version. The previous version ends the day before this one starts. Overlapping date ranges are rejected.
            </p>
            {rateMessage?.type === 'error' && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">{rateMessage.text}</p>}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Existing material code</label>
              <select
                value={isNewMaterialCode ? '' : matCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setIsNewMaterialCode(!code);
                  const latest = materialRates
                    .filter((rate) => rate.materialCode === code)
                    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
                  setMatCode(code);
                  setMatName(latest?.name || '');
                  setMatCategory(latest?.category || 'Carbon Steel Bar');
                  setMatRate(latest?.ratePerKg || 82);
                  setMatScrapRate(latest?.scrapRatePerKg || 34);
                  setMatDensity(latest?.density || 7.85);
                }}
                className="w-full text-xs rounded-lg border border-slate-300 p-2"
              >
                <option value="">Create a new material code</option>
                {materialCodes.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
              {isNewMaterialCode && (
                <input
                  type="text"
                  value={matCode}
                  onChange={(e) => setMatCode(e.target.value)}
                  aria-label="New material code"
                  placeholder="New material code"
                  required
                  className="mt-2 w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Specification Name</label>
              <input
                type="text"
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
                required
                placeholder="e.g. Medium Carbon Steel EN8"
                className="w-full text-xs rounded-lg border border-slate-300 p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <input value={matCategory} onChange={(e) => setMatCategory(e.target.value)} required className="w-full text-xs rounded-lg border border-slate-300 p-2" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Rate (₹/kg)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.5"
                  value={matRate}
                  onChange={(e) => setMatRate(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Scrap Credit (₹/kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={matScrapRate}
                  onChange={(e) => setMatScrapRate(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Density (g/cm³)</label>
                <input type="number" min="0.01" step="0.01" value={matDensity} onChange={(e) => setMatDensity(Number(e.target.value))} required className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Effective Start Date</label>
              <input
                type="date"
                value={matEffectiveFrom}
                onChange={(e) => setMatEffectiveFrom(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingMaterial(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingRate}
                className="px-4 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs min-h-[36px]"
              >
                {isSavingRate ? 'Saving…' : 'Save Rate Version'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Machine Modal */}
      {isCreatingMachine && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateMachineRate}
            className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl border border-slate-200 space-y-3.5 max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Version Machine Hour Rate</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              This creates an immutable version. The previous version ends the day before this one starts. Overlapping date ranges are rejected.
            </p>
            {rateMessage?.type === 'error' && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">{rateMessage.text}</p>}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Existing machine code</label>
              <select
                value={isNewMachineCode ? '' : machCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setIsNewMachineCode(!code);
                  const latest = machineRates
                    .filter((rate) => rate.machineCode === code)
                    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
                  setMachCode(code);
                  setMachName(latest?.name || '');
                  setMachCategory(latest?.category || '');
                  setMachHourRate(latest?.hourRate || 950);
                }}
                className="w-full text-xs rounded-lg border border-slate-300 p-2"
              >
                <option value="">Create a new machine code</option>
                {machineCodes.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
              {isNewMachineCode && (
                <input
                  type="text"
                  value={machCode}
                  onChange={(e) => setMachCode(e.target.value)}
                  aria-label="New machine code"
                  placeholder="New machine code"
                  required
                  className="mt-2 w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Machine Description</label>
              <input
                type="text"
                value={machName}
                onChange={(e) => setMachName(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-slate-300 p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <input type="text" value={machCategory} onChange={(e) => setMachCategory(e.target.value)} required className="w-full text-xs rounded-lg border border-slate-300 p-2" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hour Rate (₹/hr)</label>
                <input
                  type="number"
                  min="0.01"
                  step="25"
                  value={machHourRate}
                  onChange={(e) => setMachHourRate(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={machEffectiveFrom}
                  onChange={(e) => setMachEffectiveFrom(e.target.value)}
                  required
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingMachine(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingRate}
                className="px-4 py-2 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs min-h-[36px]"
              >
                {isSavingRate ? 'Saving…' : 'Save Machine Rate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isCreatingLabour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-xs sm:p-4">
          <form
            onSubmit={handleCreateLabourRate}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-3.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6"
          >
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">Version Labour Hour Rate</h3>
            <p className="text-[11px] text-slate-500 sm:text-xs">
              This creates an immutable dated version. Previous rates remain available in history.
            </p>
            {rateMessage?.type === 'error' && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">{rateMessage.text}</p>}
            <label className="block text-xs font-medium text-slate-700">
              Existing labour category
              <select
                value={isNewLabourType ? '' : labourType}
                onChange={(e) => {
                  const type = e.target.value;
                  setIsNewLabourType(!type);
                  const latest = labourRates
                    .filter((rate) => rate.labourType === type)
                    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
                  setLabourType(type);
                  setLabourHourRate(latest?.hourRate || 160);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
              >
                <option value="">Create a new labour category</option>
                {labourTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            {isNewLabourType && (
              <label className="block text-xs font-medium text-slate-700">
                New labour category
                <input
                  value={labourType}
                  onChange={(e) => setLabourType(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </label>
            )}
            <label className="block text-xs font-medium text-slate-700">
              Hour rate (₹/hr)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={labourHourRate}
                onChange={(e) => setLabourHourRate(Number(e.target.value))}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Effective from
              <input
                type="date"
                value={labourEffectiveFrom}
                onChange={(e) => setLabourEffectiveFrom(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCreatingLabour(false)} className="min-h-[36px] rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" disabled={isSavingRate} className="min-h-[36px] rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
                {isSavingRate ? 'Saving…' : 'Save Rate Version'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
