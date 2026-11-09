import React, { useState } from 'react';
import { DashboardSummary, RFQ, RFQStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../context/permissions';
import {
  Search,
  Filter,
  Clock,
  ArrowUpRight,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronRight,
  User,
} from 'lucide-react';

interface RfqRegisterProps {
  rfqs: RFQ[];
  onSelectRfq: (rfq: RFQ) => void;
  onUpdateStatus: (id: string, status: RFQStatus, lossReason?: string) => Promise<void>;
  onOpenCosting: (rfq: RFQ, partId?: string) => void;
  onOpenPdf: (quoteId: string) => void;
  onOpenAiIntakeForRfq: (rfq: RFQ) => void;
  onEditRfq: (rfq: RFQ) => void;
  onOpenApprovals: () => void;
  summary: DashboardSummary | null;
}

export const RfqRegister: React.FC<RfqRegisterProps> = ({
  rfqs,
  onSelectRfq,
  onUpdateStatus,
  onOpenCosting,
  onOpenPdf,
  onOpenAiIntakeForRfq,
  onEditRfq,
  onOpenApprovals,
  summary,
}) => {
  const { user } = useAuth();
  const canCost = hasPermission(user?.role, 'COSTING');
  const canUseAi = hasPermission(user?.role, 'AI_INTAKE');
  const canGeneratePdf = hasPermission(user?.role, 'PDF_GENERATE');
  const canUpdateStatus = hasPermission(user?.role, 'RFQ_STATUS_UPDATE');
  const canEditRfq = hasPermission(user?.role, 'RFQ_EDIT');
  const canViewApprovals = hasPermission(user?.role, 'APPROVAL_VIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRfqForStatus, setSelectedRfqForStatus] = useState<RFQ | null>(null);
  const [newStatus, setNewStatus] = useState<RFQStatus>('WON');
  const [lossReason, setLossReason] = useState('');
  const [viewingRfq, setViewingRfq] = useState<RFQ | null>(null);

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
          <span className="inline-flex max-w-full items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            Estimating
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex max-w-full items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            Pending Approval
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex max-w-full items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ArrowUpRight className="w-3 h-3" />
            Sent to Customer
          </span>
        );
      case 'WON':
        return (
          <span className="inline-flex max-w-full items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Won Order
          </span>
        );
      case 'LOST':
        return (
          <span className="inline-flex max-w-full items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
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
        <span className="text-rose-600 font-semibold text-xs flex flex-wrap items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" /> Overdue by {Math.abs(diffDays)}d
        </span>
      );
    } else if (diffDays <= 3) {
      return (
        <span className="text-amber-600 font-semibold text-xs flex flex-wrap items-center gap-1">
          <Clock className="w-3 h-3 shrink-0" /> Due in {diffDays}d
        </span>
      );
    }
    return (
      <span className="text-slate-500 text-xs">
        Due {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {([
          ['Active RFQs', summary?.activeRfqs, 'text-slate-900'],
          ['RFQs in Estimating', summary?.estimatingRfqs, 'text-blue-700'],
          ['Quotes Pending Approval', summary?.quotesPendingApproval, 'text-amber-600'],
          ['Approved Quotes', summary?.approvedQuotes, 'text-emerald-700'],
          ['Quotes Sent to Customer', summary?.quotesSentToCustomer, 'text-indigo-700'],
          ['Won Orders', summary?.wonOrders, 'text-emerald-700'],
          ['Lost Orders', summary?.lostOrders, 'text-rose-700'],
        ] as const).map(([label, count, color]) => (
          <div key={label} className="min-h-[92px] bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            <p className={`mt-2 text-xl sm:text-2xl font-bold ${color}`} aria-label={`${label} count`}>
              {count ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80 lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search RFQ #, Customer, Part Name..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder:text-slate-400"
          />
        </div>

        {/* Status Filter Chips (horizontal scroll on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
          <span className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Status:</span>
          </span>
          {['ALL', 'ESTIMATING', 'PENDING_APPROVAL', 'SENT', 'WON', 'LOST'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === status
                  ? 'bg-slate-900 text-white font-semibold'
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

      {/* Laptop and desktop table */}
      <div className="hidden xl:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="w-full min-w-0">
          <table className="w-full table-fixed text-left border-collapse text-xs lg:text-sm">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[21%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[10px] font-semibold uppercase tracking-wide">
                <th className="py-3 px-2">RFQ No</th>
                <th className="py-3 px-2">Customer</th>
                <th className="py-3 px-2">Part & Specification</th>
                <th className="py-3 px-2">Annual Vol</th>
                <th className="py-3 px-2">Due Date</th>
                <th className="py-3 px-2">Estimator</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRfqs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {statusFilter === 'PENDING_APPROVAL'
                      ? 'No RFQs currently have an eligible quotation awaiting Sales Head approval.'
                      : 'No RFQs match your search and filter criteria.'}
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
                      <td className="break-words py-3 px-2 font-mono font-medium text-sky-700">
                        {rfq.rfqNumber}
                      </td>

                      {/* Customer */}
                      <td className="break-words py-3 px-2">
                        <p className="font-medium text-slate-900">{rfq.customer.name}</p>
                        <p className="text-[11px] text-slate-400">{rfq.customer.segment}</p>
                      </td>

                      {/* Part Details */}
                      <td className="break-words py-3 px-2">
                        {part ? (
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                              {part.partName}
                              <span className="break-words rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
                                {part.materialName}
                              </span>
                            </p>
                            <p className="break-words font-mono text-[11px] text-slate-400">
                              {part.partNumber} • {part.grossWeightKg}kg gross
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No parts added</span>
                        )}
                      </td>

                      {/* Annual Volume */}
                      <td className="break-words py-3 px-2 font-mono text-slate-700">
                        {part ? `${part.annualVolume.toLocaleString('en-IN')} pcs` : '-'}
                      </td>

                      {/* Due Date */}
                      <td className="break-words py-3 px-2">
                        {getDueDateLabel(rfq.targetDueDate)}
                      </td>

                      {/* Assigned Estimator */}
                      <td className="break-words py-3 px-2 text-xs text-slate-600">
                        {rfq.assignedEstimator?.name || 'Unassigned'}
                      </td>

                      {/* Status */}
                      <td className="break-words py-3 px-2">
                        {getStatusBadge(rfq.status)}
                        {rfq.status === 'LOST' && rfq.lossReason && (
                          <p className="text-[11px] text-rose-500 mt-0.5 italic">
                            Reason: {rfq.lossReason}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setViewingRfq(rfq);
                              onSelectRfq(rfq);
                            }}
                            className="shrink-0 px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
                            title="View RFQ and quotation details"
                          >
                            Details
                          </button>
                          {canEditRfq && rfq.status === 'ESTIMATING' && rfq._count?.quotes === 0 && (
                            <button
                              onClick={() => onEditRfq(rfq)}
                              className="shrink-0 px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
                              title="Edit RFQ details"
                            >
                              Edit
                            </button>
                          )}
                          {canCost && <button
                            onClick={() => onOpenCosting(rfq, part?.id)}
                            className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors whitespace-nowrap"
                            title="Open detailed costing calculation screen"
                          >
                            Costing
                          </button>}

                          {canUseAi && <button
                            onClick={() => onOpenAiIntakeForRfq(rfq)}
                            className="shrink-0 p-1 rounded text-indigo-600 hover:bg-indigo-50 border border-indigo-200"
                            title="AI Intake: Extract RFQ data"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>}

                          {canViewApprovals && rfq.status === 'PENDING_APPROVAL' && (
                            <button
                              onClick={onOpenApprovals}
                              className="shrink-0 px-2 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 whitespace-nowrap"
                              title="Open the pending quotation approval queue"
                            >
                              Open Approvals
                            </button>
                          )}

                          {latestQuote && canGeneratePdf && ['PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(latestQuote.status) && (
                            <button
                              onClick={() => onOpenPdf(latestQuote.id)}
                              className="shrink-0 px-2 py-1 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 whitespace-nowrap"
                              title="Download quotation PDF"
                            >
                              <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> PDF</span>
                            </button>
                          )}

                          {canUpdateStatus && rfq.status === 'SENT' && <button
                            onClick={() => {
                              setSelectedRfqForStatus(rfq);
                              setNewStatus('WON');
                              setLossReason(rfq.lossReason || '');
                            }}
                            className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Update status"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>}
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

      {/* Tablet and mobile cards */}
      <div className="block xl:hidden space-y-3">
        {filteredRfqs.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
            {statusFilter === 'PENDING_APPROVAL'
              ? 'No RFQs currently have an eligible quotation awaiting Sales Head approval.'
              : 'No RFQs match your search and filter criteria.'}
          </div>
        ) : (
          filteredRfqs.map((rfq) => {
            const part = rfq.parts[0];
            const hasQuote = part?.quotes && part.quotes.length > 0;
            const latestQuote = hasQuote ? part.quotes![0] : null;

            return (
              <div
                key={rfq.id}
                className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3"
              >
                {/* Card Top: RFQ Number, Due Date & Status */}
                <div className="border-b border-slate-100 pb-2 space-y-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-sky-700 text-sm">
                      {rfq.rfqNumber}
                    </span>
                    <p className="text-xs font-semibold text-slate-900 mt-0.5 break-words">
                      {rfq.customer.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    {getStatusBadge(rfq.status)}
                    {getDueDateLabel(rfq.targetDueDate)}
                  </div>
                </div>

                {/* Part Specs & Metrics */}
                {part ? (
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Part</p>
                      <p className="font-bold text-slate-800 break-words">{part.partName}</p>
                      <p className="text-[10px] font-mono text-slate-500 truncate">
                        {part.partNumber}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Specification</p>
                      <p className="font-mono text-slate-800">
                        <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-bold">
                          {part.materialName}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {part.grossWeightKg}kg • {part.annualVolume.toLocaleString('en-IN')} pcs/yr
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No parts added yet</p>
                )}

                {/* Estimator & Loss reason info */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span className="flex min-w-0 items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="break-words">{rfq.assignedEstimator?.name || 'Unassigned'}</span>
                  </span>
                  {rfq.status === 'LOST' && rfq.lossReason && (
                    <span className="text-rose-500 font-medium truncate max-w-[180px]">
                      Lost: {rfq.lossReason}
                    </span>
                  )}
                </div>

                {/* Mobile Action Buttons Bar */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setViewingRfq(rfq);
                      onSelectRfq(rfq);
                    }}
                    className="py-2 px-3 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs min-h-[44px]"
                    title="View RFQ and quotation details"
                  >
                    RFQ Details
                  </button>
                  {canEditRfq && rfq.status === 'ESTIMATING' && rfq._count?.quotes === 0 && (
                    <button
                      onClick={() => onEditRfq(rfq)}
                      className="col-span-2 py-2 px-3 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs min-h-[44px]"
                    >
                      Edit RFQ
                    </button>
                  )}
                  {/* Primary Costing button */}
                  {canCost && <button
                    onClick={() => onOpenCosting(rfq, part?.id)}
                    className="col-span-2 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1 shadow-xs min-h-[44px]"
                  >
                    Costing Screen
                  </button>}

                  {/* AI Intake */}
                  {canUseAi && <button
                    onClick={() => onOpenAiIntakeForRfq(rfq)}
                    className="py-2 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs flex items-center justify-center min-h-[44px]"
                    title="AI RFQ Intake"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" /> AI
                  </button>}

                  {/* PDF quotation */}
                  {latestQuote && canGeneratePdf && ['PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(latestQuote.status) ? (
                    <button
                      onClick={() => onOpenPdf(latestQuote.id)}
                      className="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs flex items-center justify-center min-h-[44px]"
                      title="Download quotation PDF"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" /> Download PDF
                    </button>
                  ) : null}

                  {canViewApprovals && rfq.status === 'PENDING_APPROVAL' && (
                    <button
                      onClick={onOpenApprovals}
                      className="py-2 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-center min-h-[44px]"
                    >
                      Open Approval Queue
                    </button>
                  )}

                  {canUpdateStatus && rfq.status === 'SENT' && <button
                    onClick={() => {
                      setSelectedRfqForStatus(rfq);
                      setNewStatus('WON');
                      setLossReason(rfq.lossReason || '');
                    }}
                    className="py-2 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs flex items-center justify-center min-h-[44px]"
                    title="Update Status"
                  >
                    Status
                  </button>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {viewingRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-xs sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="rfq-details-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 id="rfq-details-title" className="text-base font-bold text-slate-900">RFQ Details</h2>
                <p className="mt-1 font-mono text-sm text-sky-700">{viewingRfq.rfqNumber}</p>
              </div>
              <button onClick={() => setViewingRfq(null)} className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Close</button>
            </header>
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <p><span className="text-slate-500">Customer:</span> <strong>{viewingRfq.customer.name}</strong></p>
              <p><span className="text-slate-500">RFQ status:</span> <strong>{viewingRfq.status.replace(/_/g, ' ')}</strong></p>
              <p><span className="text-slate-500">Estimator:</span> <strong>{viewingRfq.assignedEstimator?.name || 'Unassigned'}</strong></p>
              <p><span className="text-slate-500">Due:</span> <strong>{new Date(viewingRfq.targetDueDate).toLocaleDateString('en-IN')}</strong></p>
            </div>
            <div className="space-y-3">
              {viewingRfq.parts.map((part) => (
                <article key={part.id} className="rounded-lg border border-slate-200 p-3">
                  <h3 className="font-semibold text-slate-900">{part.partName} <span className="font-mono text-xs text-slate-500">({part.partNumber})</span></h3>
                  <p className="mt-1 text-xs text-slate-600">{part.materialName} · {part.annualVolume.toLocaleString('en-IN')} pcs/year</p>
                  {part.quotes?.length ? (
                    <ul className="mt-3 space-y-2">
                      {part.quotes.map((quote) => (
                        <li key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 p-2 text-xs">
                          <span><strong className="font-mono">{quote.quoteNumber}</strong> · {quote.status.replace(/_/g, ' ')} · Annual pre-GST ₹{quote.totalAnnualValue.toLocaleString('en-IN')}</span>
                          {canGeneratePdf && ['PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(quote.status) && (
                            <button onClick={() => onOpenPdf(quote.id)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100">
                              Download PDF
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-xs text-slate-500">No quotations submitted.</p>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Status Update Modal */}
      {selectedRfqForStatus && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl border border-slate-200 max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in fade-in zoom-in-95">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
              Update RFQ Status: {selectedRfqForStatus.rfqNumber}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Customer: {selectedRfqForStatus.customer.name}
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as RFQStatus)}
                  className="w-full text-xs sm:text-sm rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-sky-500"
                >
                  <option value="WON">Won Order</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>

              {newStatus === 'LOST' && (
                <div>
                  <label className="block font-medium text-rose-700 mb-1">
                    Reason for Loss (Competitor price, lead time, tooling, etc.)
                  </label>
                  <input
                    type="text"
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    placeholder="e.g. Quote is 8% above the target price"
                    className="w-full text-xs sm:text-sm rounded-lg border border-rose-300 p-2 focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedRfqForStatus(null)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg min-h-[36px]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onUpdateStatus(selectedRfqForStatus.id, newStatus, lossReason);
                  setSelectedRfqForStatus(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-xs min-h-[36px]"
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
