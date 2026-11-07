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

  // New Material Form
  const [matCode, setMatCode] = useState('EN8');
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState('Carbon Steel Bar');
  const [matRate, setMatRate] = useState<number>(82.0);
  const [matScrapRate, setMatScrapRate] = useState<number>(34.0);
  const [matEffectiveFrom, setMatEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);

  // New Machine Form
  const [machCode, setMachCode] = useState('CNC-LATHE-02');
  const [machName, setMachName] = useState('CNC Turning Center Twin Spindle');
  const [machCategory, setMachCategory] = useState('CNC Turning');
  const [machHourRate, setMachHourRate] = useState<number>(950.0);
  const [machEffectiveFrom, setMachEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);

  const canEdit = user?.role === 'SALES_HEAD' || user?.role === 'ADMIN';

  const handleCreateMaterialRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createMaterialRate({
        materialCode: matCode,
        name: matName || `${matCode} Standard`,
        category: matCategory,
        ratePerKg: matRate,
        scrapRatePerKg: matScrapRate,
        density: 7.85,
        effectiveFrom: matEffectiveFrom,
      });
      setIsCreatingMaterial(false);
      onRateUpdated();
    } catch (err: any) {
      alert(`Error creating rate: ${err.message}`);
    }
  };

  const handleCreateMachineRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createMachineRate({
        machineCode: machCode,
        name: machName,
        category: machCategory,
        hourRate: machHourRate,
        effectiveFrom: machEffectiveFrom,
      });
      setIsCreatingMachine(false);
      onRateUpdated();
    } catch (err: any) {
      alert(`Error creating rate: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Effective-Dated Rate Masters
              </h2>
              <p className="text-xs text-slate-500">
                Single Source of Truth • Versioned Validity Windows • Historical Rate Immutability
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab selection */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveSubTab('materials')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'materials'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Raw Materials ({materialRates.length})
          </button>

          <button
            onClick={() => setActiveSubTab('machines')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'machines'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Machine Hour Rates ({machineRates.length})
          </button>

          <button
            onClick={() => setActiveSubTab('labour')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'labour'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Labour ({labourRates.length})
          </button>
        </div>
      </div>

      {/* Permission banner */}
      {!canEdit && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>
              You are currently viewing as <strong>Estimator (Read-Only)</strong>. Switch to <strong>Sales Head</strong> in the top header to version rates.
            </span>
          </div>
        </div>
      )}

      {/* MATERIALS TAB */}
      {activeSubTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Material Price Master with Validity Windows</h3>
            {canEdit && (
              <button
                onClick={() => setIsCreatingMaterial(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add / Version Material Rate
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
                {materialRates.map((mat) => {
                  const isCurrent = mat.isActive && (!mat.effectiveTo || new Date(mat.effectiveTo) >= new Date());
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
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Past Revision
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
      )}

      {/* MACHINES TAB */}
      {activeSubTab === 'machines' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Machine Hourly Rates Master</h3>
            {canEdit && (
              <button
                onClick={() => setIsCreatingMachine(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add / Version Machine Rate
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
                {machineRates.map((mach) => {
                  const isCurrent = mach.isActive && (!mach.effectiveTo || new Date(mach.effectiveTo) >= new Date());
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
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Past Revision
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
      )}

      {/* LABOUR TAB */}
      {activeSubTab === 'labour' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Direct Labour Hourly Rates Master</h3>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
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
                {labourRates.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 px-4 font-medium text-slate-900">{l.labourType}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{l.hourRate.toFixed(2)}/hr
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {new Date(l.effectiveFrom).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {isCreatingMaterial && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateMaterialRate} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Version Material Rate</h3>
            <p className="text-xs text-slate-500">
              Creating a new rate will automatically set the end date on the previous rate, preserving quote history.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Material Code</label>
              <input
                type="text"
                value={matCode}
                onChange={(e) => setMatCode(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Specification Name</label>
              <input
                type="text"
                value={matName}
                onChange={(e) => setMatName(e.target.value)}
                placeholder="e.g. Medium Carbon Steel EN8"
                className="w-full text-xs rounded-lg border border-slate-300 p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Rate (₹/kg)</label>
                <input
                  type="number"
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
                  step="0.5"
                  value={matScrapRate}
                  onChange={(e) => setMatScrapRate(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
                />
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
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs"
              >
                Save Rate Version
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Machine Modal */}
      {isCreatingMachine && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateMachineRate} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Version Machine Hour Rate</h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Machine Code</label>
              <input
                type="text"
                value={machCode}
                onChange={(e) => setMachCode(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-lg border border-slate-300 p-2"
              />
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hour Rate (₹/hr)</label>
                <input
                  type="number"
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
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-500 shadow-xs"
              >
                Save Machine Rate
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
