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
} from 'lucide-react';

interface ApprovalQueueProps {
  onQuoteReviewed: () => void;
  onOpenPdf: (quoteId: string) => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ onQuoteReviewed, onOpenPdf }) => {
  const { user, switchUser } = useAuth();
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [loading, setLoading] = useState(true);

  // Rejection modal
  const [rejectingQuoteId, setRejectingQuoteId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');

  // Approval modal
  const [approvingQuoteId, setApprovingQuoteId] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState('');

  const isSalesHead = user?.role === 'SALES_HEAD' || user?.role === 'ADMIN';

  const loadData = async () => {
    setLoading(true);
    try {
      const [pending, history] = await Promise.all([
        api.getPendingApprovals(),
        api.getApprovalHistory(),
      ]);
      setPendingQuotes(pending);
      setHistoryLogs(history);
    } catch (err) {
      console.error('Failed to load approvals:', err);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Commercial Approval Workflow (&gt; ₹25 Lakhs)
              </h2>
              <p className="text-xs text-slate-500">
                Sales Head Commercial Authority • Multi-Tier Margin Review • Audit Trail
              </p>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Approval ({pendingQuotes.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Approval Audit Trail ({historyLogs.length})
          </button>
        </div>
      </div>

      {/* RBAC Notice if viewing as Estimator */}
      {!isSalesHead && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You are signed in as <strong>Estimator ({user?.name})</strong>. Quotations over ₹25 Lakhs can only be approved or rejected by the <strong>Sales Head</strong>.
            </span>
          </div>
          <button
            onClick={() => switchUser('SALES_HEAD')}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors shrink-0"
          >
            Switch to Sales Head Role
          </button>
        </div>
      )}

      {/* PENDING QUOTES LIST */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingQuotes.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">All Quotations Approved</h3>
              <p className="text-xs text-slate-400">
                There are currently no quotations awaiting Sales Head commercial approval.
              </p>
            </div>
          ) : (
            pendingQuotes.map((q) => {
              const recommendedTier = q.volumeTiers && q.volumeTiers.length > 0 ? q.volumeTiers[q.volumeTiers.length - 1] : null;

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden"
                >
                  {/* Top Bar */}
                  <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-slate-900">{q.quoteNumber}</span>
                      <span className="text-xs font-mono text-sky-700 px-2 py-0.5 rounded bg-white border border-sky-200">
                        RFQ: {q.rfq.rfqNumber}
                      </span>
                      <span className="text-xs text-slate-600">
                        Customer: <strong>{q.rfq.customer.name}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                        Exceeds ₹25L Threshold
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-950">
                        Annual Value: ₹{(q.totalAnnualValue / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Part & Estimation Specs */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">Part Details</p>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{q.part.partName}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        Part No: {q.part.partNumber} • {q.part.materialName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        Weight: {q.part.grossWeightKg}kg gross / {q.part.netWeightKg}kg net
                      </p>
                      <p className="text-xs text-slate-600 mt-2">
                        Estimated By: <strong>{q.createdBy?.name || 'Estimator'}</strong>
                      </p>
                    </div>

                    {/* Commercial Pricing Matrix Summary */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase">Pricing Tiers</p>
                      <div className="space-y-1.5 mt-1 text-xs">
                        {q.volumeTiers.map((tier: any) => (
                          <div key={tier.id} className="flex justify-between font-mono p-1 bg-slate-50 rounded">
                            <span className="text-slate-600">{tier.label}:</span>
                            <span className="font-bold text-slate-900">₹{tier.unitPriceExGst.toFixed(2)} + 18% GST</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-col justify-between items-end border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6">
                      <button
                        onClick={() => onOpenPdf(q.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-sky-700 mb-3"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Preview Commercial PDF Quote
                      </button>

                      <div className="flex items-center gap-2 w-full justify-end">
                        <button
                          onClick={() => setRejectingQuoteId(q.id)}
                          disabled={!isSalesHead}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject Quote
                        </button>

                        <button
                          onClick={() => setApprovingQuoteId(q.id)}
                          disabled={!isSalesHead}
                          className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs disabled:opacity-40 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve Commercial Quote
                        </button>
                      </div>
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
              {historyLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No approval history recorded yet.
                  </td>
                </tr>
              ) : (
                historyLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 px-4 font-mono text-slate-600">
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
                    <td className="py-3 px-4 font-semibold text-slate-900">{log.user?.name || 'System'}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{log.user?.role || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-700">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve Modal */}
      {approvingQuoteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Approve Commercial Quotation
            </h3>
            <p className="text-xs text-slate-600">
              As Sales Head, you are authorizing this quotation to be formally sent to the customer with Isocode commercial backing.
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
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-xs"
              >
                Confirm Approval & Release Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingQuoteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
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
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-500 shadow-xs"
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
