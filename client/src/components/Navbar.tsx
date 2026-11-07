import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FileSpreadsheet,
  Calculator,
  Database,
  CheckCircle2,
  Search,
  Sparkles,
  UserCheck,
  Building2,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingApprovalsCount: number;
  onOpenAiIntake: () => void;
  onOpenNewRfq: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingApprovalsCount,
  onOpenAiIntake,
  onOpenNewRfq,
}) => {
  const { user, switchUser, logout } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Isocode identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">ISOCODE</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  sample location
                </span>
              </div>
              <p className="text-[11px] text-slate-400">RFQ Costing & Estimation System</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('rfqs')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'rfqs'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              RFQ Register
            </button>

            <button
              onClick={() => setActiveTab('costing')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'costing'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calculator className="w-4 h-4" />
              Costing Screen
            </button>

            <button
              onClick={() => setActiveTab('rates')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'rates'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Database className="w-4 h-4" />
              Rate Masters
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Approvals
              {pendingApprovalsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('historical')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'historical'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Search className="w-4 h-4" />
              Past Quotes
            </button>
          </nav>

          {/* Quick Actions & Role Switcher */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenAiIntake}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI RFQ Intake
            </button>

            <button
              onClick={onOpenNewRfq}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            >
              + New RFQ
            </button>

            {/* Role switch toggle */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
              <span className="text-[11px] text-slate-400 px-1 hidden sm:inline">Role:</span>
              <button
                onClick={() => switchUser('ESTIMATOR')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                  user?.role === 'ESTIMATOR'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to Estimator (Demo Estimator)"
              >
                Estimator
              </button>
              <button
                onClick={() => switchUser('SALES_HEAD')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                  user?.role === 'SALES_HEAD'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to Sales Head (Demo Sales Head)"
              >
                Sales Head
              </button>
            </div>

            {/* User display */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
              <div className="hidden lg:block text-right">
                <p className="font-semibold text-slate-200">{user?.name || 'Estimator'}</p>
                <p className="text-[10px] text-slate-400 font-mono">{user?.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold border border-slate-700">
                {user?.name ? user.name[0] : 'U'}
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
