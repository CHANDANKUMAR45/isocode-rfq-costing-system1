import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../context/permissions';
import {
  FileSpreadsheet,
  Calculator,
  Database,
  CheckCircle2,
  Search,
  Sparkles,
  Building2,
  Menu,
  X,
  Plus,
  LogOut,
  Settings,
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
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      id: 'rfqs',
      label: 'RFQ Register',
      shortLabel: 'RFQs',
      icon: FileSpreadsheet,
    },
    {
      id: 'costing',
      label: 'Costing Screen',
      shortLabel: 'Costing',
      icon: Calculator,
    },
    {
      id: 'rates',
      label: 'Rate Masters',
      shortLabel: 'Rates',
      icon: Database,
    },
    {
      id: 'approvals',
      label: 'Approvals',
      shortLabel: 'Approvals',
      icon: CheckCircle2,
      badge: pendingApprovalsCount,
    },
    {
      id: 'historical',
      label: 'Past Quotes',
      shortLabel: 'Past Quotes',
      icon: Search,
    },
    {
      id: 'admin',
      label: 'Administration',
      shortLabel: 'Admin',
      icon: Settings,
    },
  ].filter((item) => {
    if (item.id === 'costing') return hasPermission(user?.role, 'COSTING');
    if (item.id === 'rates') return hasPermission(user?.role, 'RATE_READ');
    if (item.id === 'approvals') return hasPermission(user?.role, 'APPROVAL_VIEW');
    if (item.id === 'historical') return hasPermission(user?.role, 'HISTORICAL_READ');
    if (item.id === 'admin') return hasPermission(user?.role, 'USER_MANAGE');
    return hasPermission(user?.role, 'RFQ_READ');
  });

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between gap-3 min-h-16 py-2">

          {/* Application identity */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-inner shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
                  ISOCODE
                </span>
                <span className="hidden 2xl:inline-flex text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 shrink-0">
                  RFQ Costing
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 truncate">
                RFQ Costing & Estimation System
              </p>
            </div>
          </div>

          {/* Full navigation on wide desktop */}
          <nav aria-label="Primary navigation" className="hidden xl:flex flex-1 min-w-0 items-center justify-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 2xl:px-3 py-2 rounded-md text-xs 2xl:text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-sky-400 border border-slate-700'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Compact navigation on laptop */}
          <nav aria-label="Primary navigation" className="hidden lg:flex xl:hidden flex-1 min-w-0 items-center justify-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1 px-1.5 xl:px-2 py-2 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-sky-400 border border-slate-700'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.shortLabel}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-0.5 px-1 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            {/* AI RFQ Intake button */}
            {hasPermission(user?.role, 'AI_INTAKE') && (
              <button
                onClick={onOpenAiIntake}
                className="inline-flex items-center justify-center gap-1.5 p-2 xl:px-2.5 xl:py-2 text-xs font-semibold rounded-md bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-xs transition-all"
                title="AI RFQ Intake"
                aria-label="AI RFQ Intake"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">AI RFQ Intake</span>
              </button>
            )}

            {hasPermission(user?.role, 'RFQ_CREATE') && (
              <button
                onClick={onOpenNewRfq}
                className="inline-flex items-center justify-center gap-1.5 p-2 xl:px-2.5 xl:py-2 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
                title="New RFQ"
                aria-label="New RFQ"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">New RFQ</span>
              </button>
            )}

            {/* User display (tablet/desktop) */}
            <div
              className="flex items-center gap-2 pl-1.5 border-l border-slate-800 text-xs"
              title={`${user?.name} · ${user?.role}`}
              aria-label={`Signed in as ${user?.name}, ${user?.role}`}
            >
              <div className="hidden lg:block text-right whitespace-nowrap">
                <p className="font-semibold text-slate-200 leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{user?.role}</p>
              </div>
              <div
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold border border-slate-700 shrink-0"
              >
                {user?.name?.[0]}
              </div>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center justify-center p-2 xl:px-2.5 xl:py-2 rounded-md text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Sign out</span>
            </button>

          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-11 min-h-11"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="responsive-navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Collapsible navigation for tablet and mobile */}
      {mobileMenuOpen && (
        <div id="responsive-navigation" className="lg:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-800 bg-slate-900/98 backdrop-blur-md px-4 pt-3 pb-6 space-y-4 shadow-2xl animate-in slide-in-from-top-2">

          {/* Active User Card */}
          <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-xs">
                  {user?.name?.[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{user?.name}</p>
                  <p className="text-[10px] text-slate-400">{user?.department}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                user?.role === 'SALES_HEAD' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-sky-950 text-sky-300 border border-sky-800'
              }`}>
                {user?.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-700/60 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>

          {/* Navigation Links for Mobile */}
          <nav className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
              Application Screens
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30 font-semibold'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                      {item.badge} pending
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile Quick Action Buttons */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            {hasPermission(user?.role, 'RFQ_CREATE') && (
              <button
                onClick={() => {
                  onOpenNewRfq();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700"
              >
                <Plus className="w-4 h-4" />
                <span>Register New RFQ</span>
              </button>
            )}

            {hasPermission(user?.role, 'AI_INTAKE') && (
              <button
                onClick={() => {
                  onOpenAiIntake();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-xs font-semibold shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch AI RFQ Intake</span>
              </button>
            )}
          </div>

        </div>
      )}
    </header>
  );
};
