import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { RfqRegister } from './components/RfqRegister';
import { CostingCalculator } from './components/CostingCalculator';
import { RateMasters } from './components/RateMasters';
import { ApprovalQueue } from './components/ApprovalQueue';
import { HistoricalSearch } from './components/HistoricalSearch';
import { AiIntakeModal } from './components/AiIntakeModal';
import { NewRfqModal } from './components/NewRfqModal';
import { LoginPage } from './components/LoginPage';
import { AdminConsole } from './components/AdminConsole';
import { useAuth } from './context/AuthContext';
import { hasPermission, Permission } from './context/permissions';
import { RFQ, MaterialRate, MachineRate, LabourRate, HistoricalQuoteRecord, RFQStatus, DashboardSummary } from './types';
import { api } from './services/api';

export const MainAppContent: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('rfqs');
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [activeRates, setActiveRates] = useState<{
    materials: MaterialRate[];
    machines: MachineRate[];
    labour: LabourRate[];
  }>({ materials: [], machines: [], labour: [] });

  const [allMaterialRates, setAllMaterialRates] = useState<MaterialRate[]>([]);
  const [allMachineRates, setAllMachineRates] = useState<MachineRate[]>([]);
  const [allLabourRates, setAllLabourRates] = useState<LabourRate[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isNewRfqModalOpen, setIsNewRfqModalOpen] = useState(false);
  const [rfqToEdit, setRfqToEdit] = useState<RFQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      const [rfqList, activeRatesData, pendingList, allMats, allMachs, allLabour, summary] = await Promise.all([
        api.getRfqs(),
        api.getActiveRates(),
        hasPermission(user?.role, 'APPROVAL_VIEW') ? api.getPendingApprovals() : Promise.resolve([]),
        api.getMaterialRates(),
        api.getMachineRates(),
        api.getLabourRates(),
        api.getDashboardSummary(),
      ]);

      setRfqs(rfqList);
      if (rfqList.length > 0 && !selectedRfq) {
        setSelectedRfq(rfqList[0]);
      }
      setActiveRates(activeRatesData);
      setPendingApprovalsCount(pendingList.length);
      setAllMaterialRates(allMats);
      setAllMachineRates(allMachs);
      setAllLabourRates(allLabour);
      setDashboardSummary(summary);
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load application data:', message);
      setLoadError(`Application data could not be refreshed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [user?.role]);

  const handleUpdateStatus = async (id: string, status: RFQStatus, lossReason?: string) => {
    try {
      await api.updateRfqStatus(id, status, lossReason);
      await loadInitialData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleOpenCosting = (rfq: RFQ) => {
    setSelectedRfq(rfq);
    setActiveTab('costing');
  };

  const handleOpenNewRfq = () => {
    setRfqToEdit(null);
    setIsNewRfqModalOpen(true);
  };

  const handleEditRfq = (rfq: RFQ) => {
    setRfqToEdit(rfq);
    setIsNewRfqModalOpen(false);
  };

  const handleCloseRfqModal = () => {
    setIsNewRfqModalOpen(false);
    setRfqToEdit(null);
  };

  const handleOpenPdf = async (quoteId: string) => {
    if (!hasPermission(user?.role, 'PDF_GENERATE')) return;
    const pdfWindow = window.open('about:blank', '_blank');
    if (!pdfWindow) {
      alert('Allow pop-ups to preview the quotation PDF.');
      return;
    }
    try {
      const pdf = await api.getQuotePdf(quoteId);
      const url = URL.createObjectURL(pdf);
      pdfWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      pdfWindow.close();
      alert(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUseHistoricalPart = (histPart: HistoricalQuoteRecord) => {
    // If we have an active RFQ, update its part details
    setActiveTab('costing');
  };

  const handleApplyExtractedAiData = (data: any) => {
    setActiveTab('costing');
  };

  const customersList = rfqs.map((r) => r.customer).filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
  const activeTabPermission: Partial<Record<string, Permission>> = {
    costing: 'COSTING',
    rates: 'RATE_READ',
    approvals: 'APPROVAL_VIEW',
    historical: 'HISTORICAL_READ',
    admin: 'USER_MANAGE',
  };
  const requiredPermission = activeTabPermission[activeTab];
  const hasActiveTabPermission = !requiredPermission || hasPermission(user?.role, requiredPermission);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wide">Connecting to RFQ Costing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenAiIntake={() => setIsAiModalOpen(true)}
        onOpenNewRfq={handleOpenNewRfq}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loadError && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{loadError}</span>
            <button onClick={loadInitialData} className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800">
              Retry
            </button>
          </div>
        )}
        {!hasActiveTabPermission ? (
          <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <h1 className="text-base font-bold text-amber-950">Access restricted</h1>
            <p className="mt-2 text-sm text-amber-900">
              Your {user?.role?.replace('_', ' ')} role does not have permission to view this section.
            </p>
            <button
              onClick={() => setActiveTab('rfqs')}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Return to RFQ Register
            </button>
          </section>
        ) : activeTab === 'rfqs' ? (
          <RfqRegister
            rfqs={rfqs}
            summary={dashboardSummary}
            onSelectRfq={(rfq) => setSelectedRfq(rfq)}
            onUpdateStatus={handleUpdateStatus}
            onOpenCosting={handleOpenCosting}
            onOpenPdf={handleOpenPdf}
            onOpenAiIntakeForRfq={(rfq) => {
              setSelectedRfq(rfq);
              setIsAiModalOpen(true);
            }}
            onEditRfq={handleEditRfq}
            onOpenApprovals={() => setActiveTab('approvals')}
          />
        ) : null}

        {hasActiveTabPermission && activeTab === 'costing' && (
          <CostingCalculator
            rfqs={rfqs}
            activeRates={activeRates}
            initialRfq={selectedRfq}
            onQuoteSaved={loadInitialData}
            onOpenPdf={handleOpenPdf}
            onOpenAiIntake={() => setIsAiModalOpen(true)}
          />
        )}

        {hasActiveTabPermission && activeTab === 'rates' && (
          <RateMasters
            materialRates={allMaterialRates}
            machineRates={allMachineRates}
            labourRates={allLabourRates}
            onRateUpdated={loadInitialData}
          />
        )}

        {hasActiveTabPermission && activeTab === 'approvals' && (
          <ApprovalQueue
            onQuoteReviewed={loadInitialData}
            onOpenPdf={handleOpenPdf}
          />
        )}

        {hasActiveTabPermission && activeTab === 'historical' && (
          <HistoricalSearch onUseHistoricalPart={handleUseHistoricalPart} />
        )}

        {hasActiveTabPermission && activeTab === 'admin' && <AdminConsole />}
      </main>

      {/* AI RFQ Intake Modal */}
      {hasPermission(user?.role, 'AI_INTAKE') && <AiIntakeModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyExtractedData={handleApplyExtractedAiData}
      />}

      {/* New RFQ Creation Modal */}
      {hasPermission(user?.role, 'RFQ_CREATE') && <NewRfqModal
        isOpen={isNewRfqModalOpen || !!rfqToEdit}
        onClose={handleCloseRfqModal}
        onRfqCreated={loadInitialData}
        customers={customersList}
        rfqToEdit={rfqToEdit}
      />}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>Isocode RFQ-to-Quote Costing</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Deterministic Math Engine</span>
            <span>•</span>
            <span>Versioned Rate Masters</span>
            <span>•</span>
            <span>GST calculated separately</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const AuthenticatedApplication: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wide">Checking your session...</p>
        </div>
      </div>
    );
  }

  return user ? <MainAppContent /> : <LoginPage />;
};

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApplication />
    </AuthProvider>
  );
}
