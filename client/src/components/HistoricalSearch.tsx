import React, { useState, useEffect } from 'react';
import { HistoricalQuoteRecord } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../context/permissions';
import {
  Search,
  FileSpreadsheet,
  Upload,
  ArrowRight,
  TrendingUp,
  Clock,
  Filter,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface HistoricalSearchProps {
  onUseHistoricalPart: (part: HistoricalQuoteRecord) => void;
}

export const HistoricalSearch: React.FC<HistoricalSearchProps> = ({ onUseHistoricalPart }) => {
  const { user } = useAuth();
  const canImport = hasPermission(user?.role, 'USER_MANAGE');
  const canCost = hasPermission(user?.role, 'COSTING');
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<HistoricalQuoteRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const searchQuotes = async () => {
    setLoading(true);
    try {
      const res = await api.searchHistoricalQuotes(searchTerm, materialFilter, undefined, page);
      setRecords(res.records);
      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error('Failed to search quotes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchQuotes();
  }, [searchTerm, materialFilter, page]);

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
            <Search className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Historical Quotes & Similar Parts Repository
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Search available quote history and reuse relevant part details
            </p>
          </div>
        </div>

        {canImport && <button
          onClick={() => setIsImportModalOpen(true)}
          className="self-start sm:self-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Excel Import Info</span>
        </button>}
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72 md:w-80 lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search part name, spindle, arm, gear blank..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-400"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Mat:
            </span>
            <select
              value={materialFilter}
              onChange={(e) => {
                setMaterialFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-slate-300 py-1.5 px-2 bg-white text-slate-800"
            >
              <option value="ALL">All Grades</option>
              <option value="EN8">EN8</option>
              <option value="40Cr4">40Cr4 forging</option>
              <option value="20MnCr5">20MnCr5</option>
            </select>
          </div>

          <span className="text-[11px] sm:text-xs font-mono text-slate-500 whitespace-nowrap">
            {records.length} of {totalCount} records
          </span>
        </div>
      </div>

      {/* DESKTOP & TABLET VIEW (>= 768px): 10-column Table with Scroll Container */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                <th className="py-3 px-3 lg:px-4">Historical RFQ #</th>
                <th className="py-3 px-3 lg:px-4">Part Description</th>
                <th className="py-3 px-3 lg:px-4">Customer</th>
                <th className="py-3 px-3 lg:px-4">Material</th>
                <th className="py-3 px-3 lg:px-4 text-right">Gross Wt</th>
                <th className="py-3 px-3 lg:px-4 text-right">Cycle Time</th>
                <th className="py-3 px-3 lg:px-4 text-right">Quoted Price</th>
                <th className="py-3 px-3 lg:px-4">Quoted Date</th>
                <th className="py-3 px-3 lg:px-4">Status</th>
                <th className="py-3 px-3 lg:px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No historical quotes found matching your search.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 lg:px-4 font-mono font-medium text-sky-700 whitespace-nowrap">{r.rfqNumber}</td>
                    <td className="py-3 px-3 lg:px-4">
                      <p className="font-semibold text-slate-900 whitespace-nowrap">{r.partName}</p>
                      {r.routingsSummary && (
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">
                          {r.routingsSummary}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 lg:px-4 text-slate-700 whitespace-nowrap">{r.customerName}</td>
                    <td className="py-3 px-3 lg:px-4 font-mono font-medium text-slate-800 whitespace-nowrap">{r.material}</td>
                    <td className="py-3 px-3 lg:px-4 text-right font-mono text-slate-600 whitespace-nowrap">{r.grossWeightKg} kg</td>
                    <td className="py-3 px-3 lg:px-4 text-right font-mono font-bold text-sky-700 whitespace-nowrap">{r.cycleTimeMin} min</td>
                    <td className="py-3 px-3 lg:px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      ₹{r.unitPriceInr.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 lg:px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(r.quotedDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </td>
                    <td className="py-3 px-3 lg:px-4 whitespace-nowrap">
                      {r.status === 'WON' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Won
                        </span>
                      ) : r.status === 'LOST' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Lost
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                          Expired
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 lg:px-4 text-right">
                      {canCost && <button
                        onClick={() => onUseHistoricalPart(r)}
                        className="flex items-center gap-1 ml-auto px-2.5 py-1 text-xs font-semibold rounded bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 whitespace-nowrap"
                        title="Copy routing & cycle time into Costing Calculator"
                      >
                        Reuse <ArrowRight className="w-3 h-3" />
                      </button>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE VIEW (< 768px): Responsive Cards */}
      <div className="block md:hidden space-y-2.5">
        {records.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
            No historical quotes found matching your search.
          </div>
        ) : (
          records.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-mono font-bold text-sky-700 text-xs">{r.rfqNumber}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(r.quotedDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </span>
                  {r.status === 'WON' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Won
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {r.status}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-900 text-xs">{r.partName}</p>
                <p className="text-[11px] text-slate-500">{r.customerName}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs font-mono">
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase">Material</span>
                  <span className="font-semibold text-slate-800 truncate block">{r.material}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase">Cycle Time</span>
                  <span className="font-bold text-sky-700 block">{r.cycleTimeMin}m</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase">Quoted Unit</span>
                  <span className="font-bold text-slate-900 block">₹{r.unitPriceInr.toFixed(1)}</span>
                </div>
              </div>

              {r.routingsSummary && (
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  Routing: {r.routingsSummary}
                </p>
              )}

              {canCost && <button
                onClick={() => onUseHistoricalPart(r)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 min-h-[36px]"
              >
                <span>Reuse Routing & Specs in Calculator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>}
            </div>
          ))
        )}
      </div>

      {/* Pagination (Responsive) */}
      <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs text-slate-600">
        <span className="truncate mr-2">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 min-h-[34px] font-medium"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 min-h-[34px] font-medium"
          >
            Next
          </button>
        </div>
      </div>

      {/* Excel Import Modal */}
      {canImport && isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
              Excel Import Status
            </h3>
            <p className="text-xs text-slate-600">
              Spreadsheet import is not implemented in this version. You can search quote records already stored in the application.
            </p>

            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
              Historical search is available for records already in the database. No spreadsheet will be uploaded or changed.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg min-h-[36px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
