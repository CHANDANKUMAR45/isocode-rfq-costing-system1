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
  if (!isOpen) return null;

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

  // Sample templates from ISOCODE_ASSIGNMENT.md for instant one-click testing
  const sampleEmail = `From: contact-a@example.invalid
To: quotes@example.invalid
Subject: RFQ-DEMO-001 Commercial RFQ - Drive shaft sleeve

Dear Team Isocode,
Please find attached our annual RFQ for the Drive shaft sleeve for our next-gen two-wheeler program.
Customer: Sample Customer A
Part Name: Drive shaft sleeve
Drawing No: DWG-DEMO-001 Rev-02
Material: EN8 medium carbon steel
Gross Wt: 0.61 kg | Net Finished Wt: 0.52 kg
Target Annual Volume: 120,000 units
Estimated Cycle Time: 3.2 min
Target Price: ₹85.00 FOB sample location
Quote validity required: 30 days.

Warm regards,
Sample Contact
Head of Sourcing, Two-Wheeler Division`;

  const sampleDrawingTitleBlock = `DWG TITLE BLOCK - STRICTLY CONFIDENTIAL
CUSTOMER: Sample Customer B
COMPONENT: Linkage bracket
PART NO: ARM-DEMO-002
DRG NO: DWG-DEMO-002 REV: Rev-04
MATERIAL SPEC: 40Cr4 forging
RAW WEIGHT: 4.60 kg
NET FINISHED WEIGHT: 3.95 kg
PROJECTED ANNUAL BATCH: 16,000 PCS
ESTIMATED MACHINING CYCLE TIME: 11.5 min`;

  const sampleExcelRow = `RFQ No\tCustomer\tPart\tMaterial\tGross Wt kg\tAnnual Volume\tCycle Time min\tHour Rate ₹
RFQ-DEMO-003\tSample Customer C\tTransmission Transmission gear blank\t20MnCr5\t1.48\t42000\t4.8\t950`;

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI RFQ Intake & Title Block Extraction
              </h3>
              <p className="text-xs text-slate-500">
                Powered by Gemini Flash (Free Tier) • NDA-Compliant PII Redactor • Field Provenance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* NDA Privacy Safeguard Banner */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-900">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold">Customer NDA & Confidentiality Protection Active</p>
            <p className="text-[11px] text-emerald-700">
              Customer emails, phone numbers, and proprietary drawings are scrubbed locally before analysis. No model training on customer drawings.
            </p>
          </div>
        </div>

        {/* Source Selector & Sample Presets */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setSourceType('EMAIL')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium ${
                sourceType === 'EMAIL' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              <Mail className="w-3 h-3" /> RFQ Email
            </button>
            <button
              onClick={() => setSourceType('DRAWING_TITLE_BLOCK')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium ${
                sourceType === 'DRAWING_TITLE_BLOCK' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              <FileText className="w-3 h-3" /> Drawing Title Block
            </button>
            <button
              onClick={() => setSourceType('EXCEL')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium ${
                sourceType === 'EXCEL' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
              }`}
            >
              <FileSpreadsheet className="w-3 h-3" /> Excel Row
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Load Assignment Sample:</span>
            <button
              onClick={() => handleSelectSample('spindle')}
              className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px] border border-sky-200"
            >
              Rear Spindle
            </button>
            <button
              onClick={() => handleSelectSample('arm')}
              className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px] border border-sky-200"
            >
              Lift Arm
            </button>
            <button
              onClick={() => handleSelectSample('gear')}
              className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium text-[11px] border border-sky-200"
            >
              Transmission gear blank
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
            className="w-full h-32 text-xs font-mono rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-sky-500 bg-slate-50"
          />
        </div>

        {/* Extract Button */}
        <div className="flex justify-between items-center">
          <p className="text-[11px] text-slate-400 italic">
            Deterministic fallback runs automatically if offline or API key is absent.
          </p>
          <button
            onClick={handleExtract}
            disabled={isExtracting || !rawText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isExtracting ? 'Analyzing & Scrubbing...' : 'Extract RFQ Parameters'}
          </button>
        </div>

        {/* EXTRACTION RESULTS WITH PROVENANCE & ACCEPT/REJECT */}
        {extractionResult && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-xs animate-in fade-in">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Extracted Parameters & Provenance Source
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {extractionResult.scrubbedNotice}
              </span>
            </div>

            {/* Field-by-Field Acceptance Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
                    className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                      isAccepted
                        ? 'bg-white border-emerald-300 shadow-2xs'
                        : 'bg-slate-100 border-slate-200 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-500">{label}:</span>
                        <span className="font-bold font-mono text-slate-900">
                          {field.value !== null && field.value !== undefined ? String(field.value) : 'null'}
                        </span>
                      </div>
                      {field.snippet && (
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                          Found in: "{field.snippet}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pl-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
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

            {/* Suggested Routings from Past Parts */}
            {extractionResult.suggestedOperations && extractionResult.suggestedOperations.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-600 uppercase">
                  Suggested Routings (Linked to Past Verified Parts):
                </p>
                <div className="space-y-1">
                  {extractionResult.suggestedOperations.map((op: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-800">
                        OP #{op.sequence}: {op.operationName} ({op.machineType})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sky-700 font-bold">{op.estimatedCycleTimeMin} min</span>
                        {op.sourcePartReference && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Source: {op.sourcePartReference}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-xs"
              >
                Apply Accepted Fields to Costing <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
