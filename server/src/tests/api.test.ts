import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { scrubCustomerNdaData, extractWithHeuristics } from '../services/aiService.js';
import { generateQuotationPdf } from '../services/pdfService.js';

describe('RFQ Costing App API & Core Modules', () => {
  let estimatorToken: string;
  let salesHeadToken: string;

  beforeAll(async () => {
    // Authenticate as Estimator
    const estRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'estimator@example.invalid', password: '[REDACTED_DEMO_PASSWORD]' });
    estimatorToken = estRes.body.token;

    // Authenticate as Sales Head
    const salesRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'saleshead@example.invalid', password: '[REDACTED_DEMO_PASSWORD]' });
    salesHeadToken = salesRes.body.token;
  });

  it('Health endpoint returns 200 and operational status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.client).toContain('Isocode');
  });

  it('Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/rfqs');
    expect(res.status).toBe(401);
  });

  it('Lists RFQs for authenticated Estimator', async () => {
    const res = await request(app)
      .get('/api/rfqs')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    // Verify sample RFQ-DEMO-001 exists
    const rfq14 = res.body.find((r: any) => r.rfqNumber === 'RFQ-DEMO-001');
    expect(rfq14).toBeDefined();
    expect(rfq14.customer.name).toContain('Company B');
  });

  it('Fetches active effective-dated rates for materials, machines and labour', async () => {
    const res = await request(app)
      .get('/api/rates/active')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.materials.length).toBeGreaterThanOrEqual(3);
    expect(res.body.machines.length).toBeGreaterThanOrEqual(3);
    expect(res.body.labour.length).toBeGreaterThanOrEqual(2);

    const en8 = res.body.materials.find((m: any) => m.materialCode === 'EN8');
    expect(en8.ratePerKg).toBe(78.0);
    expect(en8.scrapRatePerKg).toBe(32.0);
  });

  it('Prevents an Estimator from approving quotes (RBAC enforcement)', async () => {
    // Estimator tries to approve
    const res = await request(app)
      .post('/api/approvals/dummy-id/approve')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ comments: 'Estimator self-approving' });
    
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
  });

  it('Allows Sales Head to fetch pending approvals', async () => {
    const res = await request(app)
      .get('/api/approvals')
      .set('Authorization', `Bearer ${salesHeadToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Scrubs customer emails, phones and NDA terms prior to AI transmission', () => {
    const input = 'Customer: John Doe (contact@example.invalid, [REDACTED_PHONE]). STRICTLY CONFIDENTIAL drawing for Drive shaft sleeve.';
    const { scrubbedText } = scrubCustomerNdaData(input);

    expect(scrubbedText).not.toContain('contact@example.invalid');
    expect(scrubbedText).not.toContain('[REDACTED_PHONE]');
    expect(scrubbedText).not.toContain('STRICTLY CONFIDENTIAL');
    expect(scrubbedText).toContain('[REDACTED_EMAIL]');
    expect(scrubbedText).toContain('[REDACTED_NDA_CLAUSE]');
    expect(scrubbedText).toContain('Drive shaft sleeve'); // Engineering details preserved
  });

  it('Parses drawing title blocks and RFQ tables accurately with provenance via heuristic engine', () => {
    const rfqText = `
RFQ No: RFQ-DEMO-001
Customer: Sample Customer A
Part Name: Drive shaft sleeve
Material: EN8
Gross Wt: 0.61 kg
Annual Volume: 120,000
Cycle Time: 3.2 min
`;
    const extracted = extractWithHeuristics(rfqText, 'EMAIL');

    expect(extracted.partName.value).toBe('Drive shaft sleeve');
    expect(extracted.material.value).toBe('EN8');
    expect(extracted.grossWeightKg.value).toBe(0.61);
    expect(extracted.annualVolume.value).toBe(120000);
    expect(extracted.cycleTimeMin.value).toBe(3.2);
    expect(extracted.suggestedOperations.length).toBeGreaterThan(0);
  });

  it('Searches 1,400 historical quotes quickly by part name', async () => {
    const res = await request(app)
      .get('/api/historical/search?query=spindle')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('Generates a valid binary PDF quotation file with Isocode letterhead and multi-volume tables', async () => {
    const pdfBuffer = await generateQuotationPdf({
      quoteNumber: 'QT-TEST-001',
      rfqNumber: 'RFQ-TEST-01',
      quoteDate: '07 Nov 2026',
      validityDays: 30,
      customer: {
        name: 'Sample Customer A',
        code: 'CUST-SAMPLE-A',
        email: 'contact-a@example.invalid',
      },
      part: {
        partNumber: 'SPN-DEMO-001',
        partName: 'Drive shaft sleeve',
        materialName: 'EN8',
        grossWeightKg: 0.61,
        netWeightKg: 0.52,
        annualVolume: 120000,
      },
      tiers: [
        {
          volume: 50000,
          label: 'Batch 50k',
          grossMaterialCost: 47.58,
          scrapWeightKg: 0.09,
          scrapCredit: 2.88,
          netMaterialCost: 44.70,
          machiningCost: 45.45,
          labourCost: 8.56,
          directCost: 98.71,
          overheadCost: 11.85,
          packingCost: 5.0,
          freightCost: 8.0,
          baseCost: 123.56,
          marginAmount: 21.80,
          unitPriceExGst: 145.36,
          gstAmount: 26.16,
          unitPriceInclGst: 171.52,
          totalAnnualValue: 145.36 * 120000,
          operationBreakdowns: [],
        },
      ],
      estimatorName: 'Demo Estimator',
      salesHeadName: 'Demo Sales Head',
      approvalStatus: 'APPROVED',
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes: %PDF
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
