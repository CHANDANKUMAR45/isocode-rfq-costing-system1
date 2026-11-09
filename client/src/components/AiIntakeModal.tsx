import React, { useState } from 'react';
import { api } from '../services/api';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Mail,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

interface AiIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedData: (data: any) => void;
}

export const AiIntakeModal: React.FC<AiIntakeModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedData,
}) => {
  const [sourceType, setSourceType] = useState<'EMAIL' | 'EXCEL' | 'DRAWING_TITLE_BLOCK'>('EMAIL');
  const [rawText, setRawText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any | null>(null);
  const [acceptedFields, setAcceptedFields] = useState<Record<string, boolean>>({
    partName: true,
    partNumber: true,
    material: true,
    grossWeightKg: true,
    netWeightKg: true,
    annualVolume: true,
    cycleTimeMin: true,
    drawingNumber: true,
    revision: true,
  });

  if (!isOpen) return null;

  // Synthetic examples for exercising the extraction workflow
  const sampleEmail = `From: contact@example.invalid
To: quotes@example.invalid
Subject: RFQ-DEMO-001 - Drive shaft sleeve

Hello,
Please review this sample quotation request for a drive shaft sleeve.
Customer: Sample Customer A
Part Name: Drive shaft sleeve
Drawing No: DWG-DEMO-001 Revision A
Material: EN8 medium carbon steel
Gross Weight: 0.58 kg | Net Finished Weight: 0.49 kg
Target Annual Volume: 120,000 units
Estimated Cycle Time: 3.2 min
Target Price: ₹92.00
Quote validity required: 30 days.

Regards,
Sample Contact`;

  const sampleDrawingTitleBlock = `SAMPLE DRAWING TITLE BLOCK
CUSTOMER: Sample Customer B
COMPONENT: Linkage bracket
PART NO: ARM-DEMO-002
DRG NO: DWG-DEMO-002 REV: A
MATERIAL SPEC: 40Cr4 forging
RAW WEIGHT: 3.9 kg
NET FINISHED WEIGHT: 3.3 kg
PROJECTED ANNUAL BATCH: 16,000 PCS
ESTIMATED MACHINING CYCLE TIME: 10.5 min`;

  const sampleExcelRow = `RFQ No\tCustomer\tPart\tMaterial\tGross Wt kg\tAnnual Volume\tCycle Time min\tHour Rate ₹
RFQ-DEMO-003\tSample Customer C\tTransmission gear blank\t20MnCr5\t1.3\t42000\t4.5\t950`;

  const handleSelectSample = (type: 'spindle' | 'arm' | 'gear') => {
    if (type === 'spindle') {
      setSourceType('EMAIL');
      setRawText(sampleEmail);
    } else if (type === 'arm') {
      setSourceType('DRAWING_TITLE_BLOCK');
      setRawText(sampleDrawingTitleBlock);
    } else {
      setSourceType('EXCEL');
      setRawText(sampleExcelRow);
    }
    setExtractionResult(null);
  };

  const handleExtract = async () => {
    if (!rawText.trim()) return;
    setIsExtracting(true);
    try {
      const res = await api.extractAi(rawText, sourceType);
      setExtractionResult(res.data);
    } catch (err: any) {
      alert(`AI Intake extraction error: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleToggleAccept = (field: string) => {
    setAcceptedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleApply = () => {
    if (!extractionResult) return;
    const finalData: any = {};
    Object.keys(acceptedFields).forEach((key) => {
      if (acceptedFields[key] && extractionResult[key]) {
        finalData[key] = extractionResult[key].value;
      }
    });
    finalData.suggestedOperations = extractionResult.suggestedOperations;
    onApplyExtractedData(finalData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="p-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xs shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                AI RFQ Intake & Title Block Extraction
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                Gemini Flash (Free Tier) • NDA-Compliant Redactor • Provenance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* NDA Privacy Safeguard Banner */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start sm:items-center gap-2.5 text-xs text-emerald-900">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <p className="font-bold">Customer NDA & Confidentiality Protection Active</p>
            <p className="text-[10px] sm:text-[11px] text-emerald-700 mt-0.5">
              Emails, phone numbers, and selected confidentiality phrases are scrubbed locally before analysis.
            </p>
          </div>
        </div>

        {/* Source Selector & Sample Presets */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSourceType('EMAIL')}
              className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded font-medium whitespace-nowrap ${
                sourceType === 'EMAIL' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              <Mail className="w-3 h-3" /> Email
            </button>
            <button
              onClick={() => setSourceType('DRAWING_TITLE_BLOCK')}
              className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded font-medium whitespace-nowrap ${
                sourceType === 'DRAWING_TITLE_BLOCK' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              <FileText className="w-3 h-3" /> Drawing Block
            </button>
            <button
              onClick={() => setSourceType('EXCEL')}
              className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded font-medium whitespace-nowrap ${
                sourceType === 'EXCEL' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              <FileSpreadsheet className="w-3 h-3" /> Excel Row
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0">Sample:</span>
            <button
              onClick={() => handleSelectSample('spindle')}
              className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px] border border-sky-200 whitespace-nowrap"
            >
              Spindle
            </button>
            <button
              onClick={() => handleSelectSample('arm')}
              className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px] border border-sky-200 whitespace-nowrap"
            >
              Lift Arm
            </button>
            <button
              onClick={() => handleSelectSample('gear')}
              className="px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px] border border-sky-200 whitespace-nowrap"
            >
              Gear Blank
            </button>
          </div>
        </div>

        {/* Input Textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Raw Customer Input ({sourceType}):
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste customer RFQ email text, Excel table line, or drawing title block notes here..."
            className="w-full h-28 sm:h-32 text-xs font-mono rounded-xl border border-slate-300 p-2.5 sm:p-3 focus:ring-2 focus:ring-sky-500 bg-slate-50"
          />
        </div>

        {/* Extract Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] text-slate-400 italic">
            Deterministic fallback runs automatically if offline or API key is absent.
          </p>
          <button
            onClick={handleExtract}
            disabled={isExtracting || !rawText.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-all disabled:opacity-50 min-h-[38px]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isExtracting ? 'Analyzing...' : 'Extract RFQ Parameters'}</span>
          </button>
        </div>

        {/* EXTRACTION RESULTS WITH PROVENANCE & ACCEPT/REJECT */}
        {extractionResult && (
          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 text-xs animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Extracted Parameters & Provenance Source
              </h4>
              <div className="flex flex-col items-start sm:items-end gap-1">
                <span
                  className={`text-[10px] sm:text-[11px] font-semibold ${
                    extractionResult.provider === 'gemini' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  Provider: {extractionResult.provider === 'gemini' ? 'Gemini' : 'Local fallback'}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                  {extractionResult.scrubbedNotice}
                </span>
              </div>
            </div>

            {/* Field-by-Field Acceptance Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { label: 'Part Name', key: 'partName' },
                { label: 'Part Number', key: 'partNumber' },
                { label: 'Material Grade', key: 'material' },
                { label: 'Gross Weight (kg)', key: 'grossWeightKg' },
                { label: 'Net Weight (kg)', key: 'netWeightKg' },
                { label: 'Annual Volume', key: 'annualVolume' },
                { label: 'Cycle Time (min)', key: 'cycleTimeMin' },
                { label: 'Drawing Number', key: 'drawingNumber' },
                { label: 'Revision', key: 'revision' },
              ].map(({ label, key }) => {
                const field = extractionResult[key];
                if (!field) return null;
                const isAccepted = acceptedFields[key];

                return (
                  <div
                    key={key}
                    onClick={() => handleToggleAccept(key)}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isAccepted
                        ? 'bg-white border-emerald-300 shadow-2xs'
                        : 'bg-slate-100 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-500 text-[11px]">{label}:</span>
                        <span className="font-bold font-mono text-slate-900 text-xs truncate">
                          {field.value !== null && field.value !== undefined ? String(field.value) : 'null'}
                        </span>
                      </div>
                      {field.snippet && (
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate mt-0.5">
                          "{field.snippet}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 text-slate-600">
                        {Math.round(field.confidence * 100)}%
                      </span>
                      {isAccepted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Suggested Routings */}
            {extractionResult.suggestedOperations && extractionResult.suggestedOperations.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Suggested Routings (Linked to Past Verified Parts):
                </p>
                <div className="space-y-1">
                  {extractionResult.suggestedOperations.map((op: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-slate-800 truncate">
                        OP #{op.sequence}: {op.operationName} ({op.machineType})
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sky-700 font-bold">{op.estimatedCycleTimeMin}m</span>
                        {op.sourcePartReference && (
                          <span className="text-[9px] font-mono text-slate-400 hidden xs:inline">
                            {op.sourcePartReference}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-3 py-2 text-xs text-slate-600 hover:bg-slate-200 rounded-lg min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-xs min-h-[36px]"
              >
                <span>Apply Accepted Fields to Costing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
