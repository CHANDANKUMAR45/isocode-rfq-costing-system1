import PDFDocument from 'pdfkit';
import { VolumeTierCostBreakdown } from './costingEngine.js';

export interface QuotationPdfData {
  quoteNumber: string;
  rfqNumber: string;
  quoteDate: string;
  validityDays: number;
  customer: {
    name: string;
    code: string;
    contactPerson?: string | null;
    email: string;
    address?: string | null;
    gstin?: string | null;
  };
  part: {
    partNumber: string;
    partName: string;
    materialName: string;
    grossWeightKg: number;
    netWeightKg: number;
    annualVolume: number;
    drawingNumber?: string | null;
    drawingRevision?: string | null;
  };
  tiers: VolumeTierCostBreakdown[];
  estimatorName: string;
  salesHeadName?: string | null;
  approvalStatus: string;
}

export function generateQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header Banner
      doc.rect(40, 40, 515, 65).fill('#0f172a'); // Dark slate header
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('ISOCODE RFQ COSTING', 55, 52);
      doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8').text('Precision Machined & Forged Automotive Components | sample location, Maharashtra 410501', 55, 74);
      doc.text('GSTIN: [REDACTED_TAX_ID] | Email: quotes@example.invalid | Tel: [REDACTED_PHONE]', 55, 87);

      doc.moveDown(2);
      let currentY = 120;

      // Title & Quotation Meta
      doc.fillColor('#0284c7').fontSize(14).font('Helvetica-Bold').text('FORMAL COMMERCIAL QUOTATION', 40, currentY);
      doc.fillColor('#64748b').fontSize(9).font('Helvetica');
      doc.text(`Date: ${data.quoteDate}`, 380, currentY, { align: 'right' });
      doc.text(`Quote Ref: ${data.quoteNumber}`, 380, currentY + 14, { align: 'right' });
      doc.text(`RFQ Ref: ${data.rfqNumber}`, 380, currentY + 28, { align: 'right' });
      doc.text(`Validity: ${data.validityDays} Days`, 380, currentY + 42, { align: 'right' });

      // Customer & Part Details Side-by-Side Boxes
      currentY = 175;

      // Customer Card
      doc.rect(40, currentY, 250, 95).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#334155').fontSize(9.5).font('Helvetica-Bold').text('CUSTOMER INFORMATION', 50, currentY + 8);
      doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
      doc.text(`Company: ${data.customer.name}`, 50, currentY + 24);
      doc.text(`Code: ${data.customer.code}`, 50, currentY + 38);
      doc.text(`Contact: ${data.customer.contactPerson || 'Procurement Team'}`, 50, currentY + 52);
      doc.text(`Email: ${data.customer.email}`, 50, currentY + 66);
      doc.text(`GSTIN: ${data.customer.gstin || '27XXXXX0000X1Z1'}`, 50, currentY + 80);

      // Part Card
      doc.rect(305, currentY, 250, 95).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#334155').fontSize(9.5).font('Helvetica-Bold').text('PART SPECIFICATION', 315, currentY + 8);
      doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');
      doc.text(`Part Name: ${data.part.partName}`, 315, currentY + 24);
      doc.text(`Part Number: ${data.part.partNumber}`, 315, currentY + 38);
      doc.text(`Material Grade: ${data.part.materialName}`, 315, currentY + 52);
      doc.text(`Weights: Gross ${data.part.grossWeightKg.toFixed(2)} kg | Net ${data.part.netWeightKg.toFixed(2)} kg`, 315, currentY + 66);
      doc.text(`Base Annual Volume: ${data.part.annualVolume.toLocaleString('en-IN')} units`, 315, currentY + 80);

      // Pricing & Cost Breakup Table
      currentY = 285;
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('DETAILED COST BREAKUP & MULTI-VOLUME PRICING (INR ₹)', 40, currentY);

      currentY += 18;
      const colWidths = [155, 120, 120, 120];
      const startX = 40;

      // Table Header
      doc.rect(startX, currentY, 515, 22).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Cost Element / Metric', startX + 6, currentY + 6);

      data.tiers.slice(0, 3).forEach((tier, i) => {
        const x = startX + colWidths[0] + i * colWidths[i + 1];
        doc.text(`${tier.label || `Tier ${i + 1}`}`, x, currentY + 6, { width: colWidths[i + 1] - 8, align: 'right' });
      });

      currentY += 22;

      // Rows
      const rows = [
        { label: 'Batch / Tier Volume', getter: (t: VolumeTierCostBreakdown) => `${t.volume.toLocaleString('en-IN')} pcs` },
        { label: 'Raw Material Cost (Gross)', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.grossMaterialCost.toFixed(2)}` },
        { label: 'Scrap Recovery Credit', getter: (t: VolumeTierCostBreakdown) => `- ₹ ${t.scrapCredit.toFixed(2)}` },
        { label: 'Net Material Cost', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.netMaterialCost.toFixed(2)}`, highlight: true },
        { label: 'Machining & Setup (Amortized)', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.machiningCost.toFixed(2)}` },
        { label: 'Direct Labour Cost', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.labourCost.toFixed(2)}` },
        { label: 'Factory Overheads (12%)', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.overheadCost.toFixed(2)}` },
        { label: 'Packaging & Freight', getter: (t: VolumeTierCostBreakdown) => `₹ ${(t.packingCost + t.freightCost).toFixed(2)}` },
        { label: 'Base Manufacturing Cost', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.baseCost.toFixed(2)}`, highlight: true },
        { label: 'Margin / Contribution', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.marginAmount.toFixed(2)}` },
        { label: 'Unit Selling Price (ex-GST)', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.unitPriceExGst.toFixed(2)}`, strong: true },
        { label: 'GST (18% Separately)', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.gstAmount.toFixed(2)}` },
        { label: 'FINAL UNIT PRICE (INCL. GST)', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.unitPriceInclGst.toFixed(2)}`, final: true },
        { label: 'Annual Contract Value (ex-GST)', getter: (t: VolumeTierCostBreakdown) => `₹ ${t.totalAnnualValue.toLocaleString('en-IN')}`, strong: true },
      ];

      rows.forEach((row, idx) => {
        const rowHeight = row.final ? 24 : 18;
        const isEven = idx % 2 === 0;

        if (row.final) {
          doc.rect(startX, currentY, 515, rowHeight).fill('#e0f2fe'); // Light blue highlight
          doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(9);
        } else if (row.highlight) {
          doc.rect(startX, currentY, 515, rowHeight).fill('#f1f5f9');
          doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
        } else {
          doc.rect(startX, currentY, 515, rowHeight).fill(isEven ? '#ffffff' : '#f8fafc');
          doc.fillColor(row.strong ? '#0f172a' : '#334155').font(row.strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
        }

        // Draw border line
        doc.rect(startX, currentY, 515, rowHeight).stroke('#e2e8f0');

        doc.text(row.label, startX + 6, currentY + (row.final ? 7 : 5));

        data.tiers.slice(0, 3).forEach((tier, i) => {
          const x = startX + colWidths[0] + i * colWidths[i + 1];
          doc.text(row.getter(tier), x, currentY + (row.final ? 7 : 5), { width: colWidths[i + 1] - 8, align: 'right' });
        });

        currentY += rowHeight;
      });

      // Commercial Terms & Signatures
      currentY += 15;
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text('COMMERCIAL TERMS & CONDITIONS', 40, currentY);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
      currentY += 12;
      doc.text('1. Payment Terms: 45 days from date of delivery & receipt of GST invoice.', 40, currentY);
      doc.text('2. Delivery Terms: Ex-Works sample location / Door delivery as agreed.', 40, currentY + 10);
      doc.text('3. Raw Material Escalation: Tied to national steel indices (quarterly review).', 40, currentY + 20);
      doc.text('4. Quality Standard: IATF 16949 compliant manufacturing and PPAP Level 3 documentation.', 40, currentY + 30);

      // Signatory Blocks
      const signY = currentY + 50;
      doc.rect(40, signY, 240, 45).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#334155').fontSize(8).font('Helvetica');
      doc.text(`Cost Estimation By: ${data.estimatorName}`, 50, signY + 8);
      doc.text('Engineering & Cost Estimation Dept.', 50, signY + 20);

      doc.rect(315, signY, 240, 45).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.text(`Authorized Signatory: ${data.salesHeadName || 'Sales & Commercial Head'}`, 325, signY + 8);
      doc.text(`Status: ${data.approvalStatus} | Isocode sample location`, 325, signY + 20);

      // End document
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
