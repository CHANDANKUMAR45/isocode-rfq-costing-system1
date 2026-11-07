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
import { RFQ, MaterialRate, MachineRate, LabourRate, HistoricalQuoteRecord, RFQStatus } from './types';
import { api } from './services/api';

export const MainAppContent: React.FC = () => {
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
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isNewRfqModalOpen, setIsNewRfqModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadInitialData = async () => {
    try {
      const [rfqList, activeRatesData, pendingList, allMats, allMachs] = await Promise.all([
        api.getRfqs(),
        api.getActiveRates(),
        api.getPendingApprovals(),
        api.getMaterialRates(),
        api.getMachineRates(),
      ]);

      setRfqs(rfqList);
      if (rfqList.length > 0 && !selectedRfq) {
        setSelectedRfq(rfqList[0]);
      }
      setActiveRates(activeRatesData);
      setPendingApprovalsCount(pendingList.length);
      setAllMaterialRates(allMats);
      setAllMachineRates(allMachs);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

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

  const handleOpenPdf = (quoteId: string) => {
    const url = api.getPdfUrl(quoteId);
    window.open(url, '_blank');
  };

  const handleUseHistoricalPart = (histPart: HistoricalQuoteRecord) => {
    // If we have an active RFQ, update its part details
    setActiveTab('costing');
  };

  const handleApplyExtractedAiData = (data: any) => {
    setActiveTab('costing');
  };

  const customersList = rfqs.map((r) => r.customer).filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold tracking-wide">Connecting to Isocode RFQ System...</p>
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
        onOpenNewRfq={() => setIsNewRfqModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'rfqs' && (
          <RfqRegister
            rfqs={rfqs}
            onSelectRfq={(rfq) => setSelectedRfq(rfq)}
            onUpdateStatus={handleUpdateStatus}
            onOpenCosting={handleOpenCosting}
            onOpenPdf={handleOpenPdf}
            onOpenAiIntakeForRfq={(rfq) => {
              setSelectedRfq(rfq);
              setIsAiModalOpen(true);
            }}
          />
        )}

        {activeTab === 'costing' && (
          <CostingCalculator
            rfqs={rfqs}
            activeRates={activeRates}
            initialRfq={selectedRfq}
            onQuoteSaved={loadInitialData}
            onOpenPdf={handleOpenPdf}
            onOpenAiIntake={() => setIsAiModalOpen(true)}
          />
        )}

        {activeTab === 'rates' && (
          <RateMasters
            materialRates={allMaterialRates}
            machineRates={allMachineRates}
            labourRates={activeRates.labour}
            onRateUpdated={loadInitialData}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalQueue
            onQuoteReviewed={loadInitialData}
            onOpenPdf={handleOpenPdf}
          />
        )}

        {activeTab === 'historical' && (
          <HistoricalSearch onUseHistoricalPart={handleUseHistoricalPart} />
        )}
      </main>

      {/* AI RFQ Intake Modal */}
      <AiIntakeModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyExtractedData={handleApplyExtractedAiData}
      />

      {/* New RFQ Creation Modal */}
      <NewRfqModal
        isOpen={isNewRfqModalOpen}
        onClose={() => setIsNewRfqModalOpen(false)}
        onRfqCreated={loadInitialData}
        customers={customersList}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Isocode RFQ Costing, sample location MIDC, sample location.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Deterministic Math Engine</span>
            <span>•</span>
            <span>Versioned Rate Masters</span>
            <span>•</span>
            <span>18% GST Compliance</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
