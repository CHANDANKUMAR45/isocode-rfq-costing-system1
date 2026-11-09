import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  History,
  FileText,
  Building,
  User,
} from 'lucide-react';

interface ApprovalQueueProps {
  onQuoteReviewed: () => void;
  onOpenPdf: (quoteId: string) => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ onQuoteReviewed, onOpenPdf }) => {
  const { user, logout } = useAuth();
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Rejection modal
  const [rejectingQuoteId, setRejectingQuoteId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');

  // Approval modal
  const [approvingQuoteId, setApprovingQuoteId] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState('');

  const isSalesHead = user?.role === 'SALES_HEAD';

  const loadData = async () => {
    setLoading(true);
    try {
      const [pending, history] = await Promise.all([
        api.getPendingApprovals(),
        api.getApprovalHistory(),
      ]);
      setPendingQuotes(pending);
      setHistoryLogs(history);
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load approvals:', message);
      setLoadError(`Approvals could not be refreshed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async () => {
    if (!approvingQuoteId) return;
    try {
      await api.approveQuote(approvingQuoteId, approvalComments);
      setApprovingQuoteId(null);
      setApprovalComments('');
      await loadData();
      onQuoteReviewed();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = async () => {
    if (!rejectingQuoteId || !rejectionReason.trim()) {
      alert('Please state a reason for rejecting the quotation.');
      return;
    }
    try {
      await api.rejectQuote(rejectingQuoteId, rejectionReason, rejectionComments);
      setRejectingQuoteId(null);
      setRejectionReason('');
      setRejectionComments('');
      await loadData();
      onQuoteReviewed();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  const isEligible = (quote: any) => quote.status === 'PENDING_APPROVAL'
    && quote.requiresApproval === true
    && quote.totalAnnualValue > 2500000
    && quote.rfq?.status === 'PENDING_APPROVAL'
    && quote.part?.rfqId === quote.rfqId;

  const getSnapshotSummary = (quote: any): string => {
    if (!quote.snapshot?.ratesData) return 'Rate snapshot is missing';
    try {
      const rates = JSON.parse(quote.snapshot.ratesData);
      const material = rates.material
        ? `${rates.material.name || rates.material.materialCode}: ₹${rates.material.ratePerKg}/kg`
        : 'Material rate unavailable';
      const machines = Array.isArray(rates.machines)
        ? rates.machines.map((rate: any) => `${rate.name || rate.machineCode} ₹${rate.hourRate}/hr`).join(', ')
        : 'Machine rates unavailable';
      const labour = Array.isArray(rates.labour)
        ? rates.labour.map((rate: any) => `${rate.labourType} ₹${rate.hourRate}/hr`).join(', ')
        : 'Labour rates unavailable';
      return `${material} · ${machines} · ${labour}`;
    } catch {
      return 'Rate snapshot could not be read';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-amber-50 text-amber-700 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Commercial Approval Workflow (&gt; ₹25 Lakhs)
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Sales Head Authority • Multi-Tier Margin Review • Audit Trail
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pending ({pendingQuotes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>Audit Trail ({historyLogs.length})</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{loadError}</span>
          <button onClick={loadData} className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800">Retry</button>
        </div>
      )}

      {/* RBAC Notice if viewing as Estimator */}
      {user?.role === 'ESTIMATOR' && (
        <div className="p-3.5 sm:p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              Signed in as <strong>Estimator ({user?.name})</strong>. Quotes over ₹25L require <strong>Sales Head</strong> authorization. Sign in with an authorized account to review them.
            </span>
          </div>
          <button
            onClick={logout}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 text-center"
          >
            Sign out to change account
          </button>
        </div>
      )}

      {/* PENDING QUOTES LIST */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {loading ? (
            <div role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading pending quotations…</div>
          ) : loadError ? null : pendingQuotes.length === 0 ? (
            <div className="bg-white p-8 sm:p-12 rounded-xl border border-slate-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm sm:text-base font-bold text-slate-800">All Quotations Approved</h3>
              <p className="text-xs text-slate-400">
                There are currently no quotations awaiting Sales Head commercial approval.
              </p>
            </div>
          ) : (
            pendingQuotes.map((q) => {
              const eligible = isEligible(q);
              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden"
                >
                  {/* Top Bar */}
                  <div className="p-3.5 sm:p-4 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="font-mono text-sm font-bold text-slate-900">{q.quoteNumber}</span>
                      <span className="text-xs font-mono text-sky-700 px-2 py-0.5 rounded bg-white border border-sky-200">
                        RFQ: {q.rfq.rfqNumber}
                      </span>
                      <span className="text-xs text-slate-700 font-medium">
                        {q.rfq.customer.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] sm:text-xs font-semibold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                        &gt;₹25L Threshold
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-bold text-amber-950">
                        Annual pre-GST ₹{q.totalAnnualValue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    {/* Part & Estimation Specs */}
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Part Details
                      </p>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">{q.part.partName}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        Part No: {q.part.partNumber} • {q.part.materialName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        Weight: {q.part.grossWeightKg}kg gross / {q.part.netWeightKg}kg net
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Annual quantity: <strong>{q.part.annualVolume.toLocaleString('en-IN')} pcs</strong>
                      </p>
                      <p className="text-xs text-slate-600 mt-2">
                        Estimated By: <strong>{q.createdBy?.name || 'Estimator'}</strong>
                      </p>
                      <p className="mt-2 break-words text-[11px] text-slate-500">
                        Frozen rates: {getSnapshotSummary(q)}
                      </p>
                    </div>

                    {/* Commercial Pricing Matrix Summary */}
                    <div>
                      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Pricing Tiers
                      </p>
                      <div className="space-y-1.5 mt-1 text-xs">
                        {q.volumeTiers.map((tier: any) => (
                          <div key={tier.id} className="flex justify-between font-mono p-1.5 bg-slate-50 rounded">
                            <span className="text-slate-600">{tier.label} ({tier.volume.toLocaleString('en-IN')} pcs):</span>
                            <span className="font-bold text-slate-900">₹{tier.unitPriceExGst.toFixed(2)} + 18% GST</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-col justify-between items-stretch md:items-end border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 space-y-3">
                      {!eligible && (
                        <p role="alert" className="text-xs text-rose-700">
                          This pending record fails the approval eligibility checks. Review is disabled; contact an administrator.
                        </p>
                      )}
                      {isSalesHead && <button
                        onClick={() => onOpenPdf(q.id)}
                        className="flex items-center justify-center md:justify-end gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 py-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Preview Commercial PDF Quote
                      </button>}

                      {isSalesHead ? <div className="grid grid-cols-2 gap-2 w-full">
                        <button
                          onClick={() => setRejectingQuoteId(q.id)}
                          disabled={!eligible}
                          className="flex items-center justify-center gap-1 py-2 px-3 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 transition-colors min-h-[38px]"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>

                        <button
                          onClick={() => setApprovingQuoteId(q.id)}
                          disabled={!eligible}
                          className="flex items-center justify-center gap-1 py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs disabled:opacity-40 transition-colors min-h-[38px]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      </div> : (
                        <p className="text-xs text-slate-500 text-right">Read-only approval history</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* APPROVAL AUDIT HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Reviewed By</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Audit Details & Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading approval history…</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={5} className="py-8 text-center text-rose-700">Approval history is unavailable. Use Retry above.</td></tr>
                ) : historyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No approval history recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        {log.action === 'APPROVE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            APPROVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            REJECTED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">{log.user?.name || 'System'}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{log.user?.role || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-700">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approvingQuoteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              Approve Commercial Quotation
            </h3>
            <p className="text-xs text-slate-600">
              As Sales Head, you are authorizing this quotation to be released under its approved commercial terms.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Approval Notes / Commercial Remarks (Optional)
              </label>
              <textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder="e.g. Commercial terms approved with 45 days payment terms. PPAP Level 3 documentation included."
                className="w-full text-xs rounded-lg border border-slate-300 p-2 h-20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setApprovingQuoteId(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg min-h-[36px]"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-xs min-h-[36px]"
              >
                Confirm Approval & Release
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingQuoteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              Reject Quotation
            </h3>
            <p className="text-xs text-slate-600">
              Please specify why this quotation needs revision. The RFQ status will revert to <strong>Estimating</strong> for the engineering team.
            </p>

            <div>
              <label className="block text-xs font-medium text-rose-700 mb-1">
                Rejection Reason (Required)
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Machine cycle time 3.2m too high, or margin exceeds customer target"
                required
                className="w-full text-xs rounded-lg border border-rose-300 p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Detailed Guidance for Estimator
              </label>
              <textarea
                value={rejectionComments}
                onChange={(e) => setRejectionComments(e.target.value)}
                placeholder="Suggest using twin-spindle CNC or renegotiate steel billet rate."
                className="w-full text-xs rounded-lg border border-slate-300 p-2 h-20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingQuoteId(null)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg min-h-[36px]"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-500 shadow-xs min-h-[36px]"
              >
                Confirm Rejection & Revert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
