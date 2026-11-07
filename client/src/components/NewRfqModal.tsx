import React, { useState } from 'react';
import { api } from '../services/api';
import { Customer } from '../types';
import { FilePlus, Calendar, Building, Sparkles } from 'lucide-react';

interface NewRfqModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRfqCreated: () => void;
  customers: Customer[];
}

export const NewRfqModal: React.FC<NewRfqModalProps> = ({
  isOpen,
  onClose,
  onRfqCreated,
  customers,
}) => {
  if (!isOpen) return null;

  const [rfqNumber, setRfqNumber] = useState(`RFQ-DEMO-${Math.floor(100 + Math.random() * 900)}`);
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [partName, setPartName] = useState('Shaft coupling');
  const [partNumber, setPartNumber] = useState('FY-2611-01');
  const [materialName, setMaterialName] = useState('EN8');
  const [grossWeightKg, setGrossWeightKg] = useState<number>(1.25);
  const [netWeightKg, setNetWeightKg] = useState<number>(1.05);
  const [annualVolume, setAnnualVolume] = useState<number>(50000);
  const [targetDueDate, setTargetDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createRfq({
        rfqNumber,
        customerId: customerId || customers[0]?.id,
        targetDueDate,
        notes,
        parts: [
          {
            partNumber,
            partName,
            materialName,
            grossWeightKg,
            netWeightKg,
            annualVolume,
            notes,
          },
        ],
      });
      onRfqCreated();
      onClose();
    } catch (err: any) {
      alert(`Failed to create RFQ: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <FilePlus className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Create New Customer RFQ</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">RFQ Number</label>
              <input
                type="text"
                value={rfqNumber}
                onChange={(e) => setRfqNumber(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-sky-700"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Target Due Date</label>
              <input
                type="date"
                value={targetDueDate}
                onChange={(e) => setTargetDueDate(e.target.value)}
                required
                className="w-full p-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg font-medium"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.segment})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-2">
              Primary Part Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Part Name</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Part Number</label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-slate-600 mb-1">Material</label>
                <input
                  type="text"
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Gross Wt (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={grossWeightKg}
                  onChange={(e) => setGrossWeightKg(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Annual Volume</label>
                <input
                  type="number"
                  step="1000"
                  value={annualVolume}
                  onChange={(e) => setAnnualVolume(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">RFQ Notes / Requirements</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. PPAP Level 3 required, prototype samples required within 2 weeks"
              className="w-full p-2 border border-slate-300 rounded-lg h-16"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register RFQ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
