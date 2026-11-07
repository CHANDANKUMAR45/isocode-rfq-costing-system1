import React, { useState } from 'react';
import { RFQ, RFQStatus } from '../types';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  ArrowUpRight,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface RfqRegisterProps {
  rfqs: RFQ[];
  onSelectRfq: (rfq: RFQ) => void;
  onUpdateStatus: (id: string, status: RFQStatus, lossReason?: string) => Promise<void>;
  onOpenCosting: (rfq: RFQ, partId?: string) => void;
  onOpenPdf: (quoteId: string) => void;
  onOpenAiIntakeForRfq: (rfq: RFQ) => void;
}

export const RfqRegister: React.FC<RfqRegisterProps> = ({
  rfqs,
  onSelectRfq,
  onUpdateStatus,
  onOpenCosting,
  onOpenPdf,
  onOpenAiIntakeForRfq,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRfqForStatus, setSelectedRfqForStatus] = useState<RFQ | null>(null);
  const [newStatus, setNewStatus] = useState<RFQStatus>('WON');
  const [lossReason, setLossReason] = useState('');

  // Filter RFQs
  const filteredRfqs = rfqs.filter((rfq) => {
    const matchesStatus = statusFilter === 'ALL' || rfq.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      rfq.rfqNumber.toLowerCase().includes(searchLower) ||
      rfq.customer.name.toLowerCase().includes(searchLower) ||
      rfq.parts.some((p) => p.partName.toLowerCase().includes(searchLower) || p.partNumber.toLowerCase().includes(searchLower));

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: RFQStatus) => {
    switch (status) {
      case 'ESTIMATING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            Estimating
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            Pending Approval (&gt;₹25L)
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ArrowUpRight className="w-3 h-3" />
            Sent to Customer
          </span>
        );
      case 'WON':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Won Order
          </span>
        );
      case 'LOST':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            Lost
          </span>
        );
    }
  };

  const getDueDateLabel = (dueDateStr: string) => {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="text-rose-600 font-semibold text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Overdue by {Math.abs(diffDays)}d
        </span>
      );
    } else if (diffDays <= 3) {
      return (
        <span className="text-amber-600 font-semibold text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" /> Due in {diffDays}d
        </span>
      );
    }
    return (
      <span className="text-slate-500 text-xs">
        {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active RFQs</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-bold text-slate-900">{rfqs.length}</p>
            <span className="text-xs font-medium text-sky-600">60/month target</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Quotes</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-bold text-amber-600">
              {rfqs.filter((r) => r.status === 'ESTIMATING' || r.status === 'PENDING_APPROVAL').length}
            </p>
            <span className="text-xs text-slate-500">Avg turn: 3.5 days</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Won Orders</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-bold text-emerald-600">
              {rfqs.filter((r) => r.status === 'WON').length}
            </p>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> 72% Win Rate
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Target</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-xl font-bold text-slate-800">4 Working Days</p>
            <span className="text-[11px] text-slate-400">down from 9 days</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search RFQ #, Customer, Part Name..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {['ALL', 'ESTIMATING', 'PENDING_APPROVAL', 'SENT', 'WON', 'LOST'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL'
                ? 'All'
                : status === 'PENDING_APPROVAL'
                ? 'Pending Approval'
                : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main RFQ Register Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">RFQ No</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Part & Specification</th>
                <th className="py-3 px-4">Annual Vol</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Assigned Estimator</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRfqs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No RFQs match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRfqs.map((rfq) => {
                  const part = rfq.parts[0];
                  const hasQuote = part?.quotes && part.quotes.length > 0;
                  const latestQuote = hasQuote ? part.quotes![0] : null;

                  return (
                    <tr
                      key={rfq.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => onSelectRfq(rfq)}
                    >
                      {/* RFQ Number */}
                      <td className="py-3 px-4 font-mono font-medium text-sky-700">
                        {rfq.rfqNumber}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{rfq.customer.name}</p>
                        <p className="text-xs text-slate-400">{rfq.customer.segment}</p>
                      </td>

                      {/* Part Details */}
                      <td className="py-3 px-4">
                        {part ? (
                          <div>
                            <p className="font-medium text-slate-900 flex items-center gap-1.5">
                              {part.partName}
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {part.materialName}
                              </span>
                            </p>
                            <p className="text-xs text-slate-400 font-mono">
                              {part.partNumber} • {part.grossWeightKg}kg gross
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No parts added</span>
                        )}
                      </td>

                      {/* Annual Volume */}
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {part ? `${part.annualVolume.toLocaleString('en-IN')} pcs` : '-'}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4">
                        {getDueDateLabel(rfq.targetDueDate)}
                      </td>

                      {/* Assigned Estimator */}
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {rfq.assignedEstimator?.name || 'Unassigned'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(rfq.status)}
                        {rfq.status === 'LOST' && rfq.lossReason && (
                          <p className="text-[11px] text-rose-500 mt-0.5 italic">
                            Reason: {rfq.lossReason}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Costing Screen button */}
                          <button
                            onClick={() => onOpenCosting(rfq, part?.id)}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors"
                            title="Open detailed costing calculation screen"
                          >
                            Costing
                          </button>

                          {/* AI Intake quick extract button */}
                          <button
                            onClick={() => onOpenAiIntakeForRfq(rfq)}
                            className="p-1 rounded text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
                            title="AI Intake: Extract RFQ data"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          {/* PDF quotation download if quote exists */}
                          {latestQuote && (
                            <button
                              onClick={() => onOpenPdf(latestQuote.id)}
                              className="p-1 rounded text-slate-700 hover:bg-slate-100 border border-slate-200"
                              title="Download Quotation PDF"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Status changer */}
                          <button
                            onClick={() => {
                              setSelectedRfqForStatus(rfq);
                              setNewStatus(rfq.status);
                              setLossReason(rfq.lossReason || '');
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Update status"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Update Modal */}
      {selectedRfqForStatus && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Update RFQ Status: {selectedRfqForStatus.rfqNumber}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Customer: {selectedRfqForStatus.customer.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as RFQStatus)}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="ESTIMATING">Estimating</option>
                  <option value="PENDING_APPROVAL">Pending Approval (&gt;₹25L)</option>
                  <option value="SENT">Sent to Customer</option>
                  <option value="WON">Won Order</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>

              {newStatus === 'LOST' && (
                <div>
                  <label className="block text-xs font-medium text-rose-700 mb-1">
                    Reason for Loss (Competitor price, lead time, tooling, etc.)
                  </label>
                  <input
                    type="text"
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    placeholder="e.g. Quoted 8% higher than sample location competitor"
                    className="w-full text-sm rounded-lg border border-rose-300 p-2 focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedRfqForStatus(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onUpdateStatus(selectedRfqForStatus.id, newStatus, lossReason);
                  setSelectedRfqForStatus(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-xs"
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
