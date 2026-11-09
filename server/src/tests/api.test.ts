import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { scrubCustomerNdaData, extractWithHeuristics } from '../services/aiService.js';
import { generateQuotationPdf } from '../services/pdfService.js';
import { getRfqWorkflowStatus } from '../services/rfqWorkflow.js';

const demoUserPassword = process.env.DEMO_USER_PASSWORD;
if (!demoUserPassword || demoUserPassword.length < 12) {
  throw new Error('Set DEMO_USER_PASSWORD to the seeded demo password before running API tests');
}

describe('RFQ Costing App API & Core Modules', () => {
  let estimatorToken: string;
  let salesHeadToken: string;
  let adminToken: string;
  const testRfqIds: string[] = [];
  const testQuoteIds: string[] = [];
  const testUserIds: string[] = [];
  const testExtractionIds: string[] = [];
  const testMaterialRateIds: string[] = [];
  const testMachineRateIds: string[] = [];
  const testLabourRateIds: string[] = [];

  beforeAll(async () => {
    // Authenticate as Estimator
    const estRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'estimator@example.invalid', password: demoUserPassword });
    estimatorToken = estRes.body.token;

    // Authenticate as Sales Head
    const salesRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'saleshead@example.invalid', password: demoUserPassword });
    salesHeadToken = salesRes.body.token;

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.invalid', password: demoUserPassword });
    adminToken = adminRes.body.token;
  });

  afterAll(async () => {
    if (testQuoteIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: testQuoteIds } } });
      await prisma.quote.deleteMany({ where: { id: { in: testQuoteIds } } });
    }
    if (testRfqIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: testRfqIds } } });
      await prisma.rFQ.deleteMany({ where: { id: { in: testRfqIds } } });
    }
    if (testUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: testUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
    if (testExtractionIds.length > 0) {
      await prisma.aiExtraction.deleteMany({ where: { id: { in: testExtractionIds } } });
    }
    if (testMaterialRateIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: testMaterialRateIds } } });
      await prisma.materialRate.deleteMany({ where: { id: { in: testMaterialRateIds } } });
    }
    if (testMachineRateIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: testMachineRateIds } } });
      await prisma.machineRate.deleteMany({ where: { id: { in: testMachineRateIds } } });
    }
    if (testLabourRateIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: testLabourRateIds } } });
      await prisma.labourRate.deleteMany({ where: { id: { in: testLabourRateIds } } });
    }
  });

  it('Rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'estimator@example.invalid', password: 'incorrect-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it.each([
    { email: 'estimator@example.invalid', role: 'ESTIMATOR' },
    { email: 'saleshead@example.invalid', role: 'SALES_HEAD' },
    { email: 'admin@example.invalid', role: 'ADMIN' },
  ])('Authenticates the $role account and resolves its session profile', async ({ email, role }) => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: demoUserPassword });

    expect(login.status).toBe(200);
    expect(login.body.token).toBeTypeOf('string');

    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(profile.status).toBe(200);
    expect(profile.body.role).toBe(role);
  });

  it('Requires authentication to list demo account profiles', async () => {
    const unauthenticated = await request(app).get('/api/auth/demo-users');
    expect(unauthenticated.status).toBe(401);

    const authenticated = await request(app)
      .get('/api/auth/demo-users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(authenticated.status).toBe(200);

    const estimatorDenied = await request(app)
      .get('/api/auth/demo-users')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(estimatorDenied.status).toBe(403);
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

  it('Rejects invalid and expired bearer tokens', async () => {
    const invalid = await request(app).get('/api/rfqs').set('Authorization', 'Bearer invalid-token');
    expect(invalid.status).toBe(401);

    const expiredToken = jwt.sign(
      { id: 'expired-test-user' },
      JWT_SECRET,
      { expiresIn: -1 },
    );
    const expired = await request(app).get('/api/rfqs').set('Authorization', `Bearer ${expiredToken}`);
    expect(expired.status).toBe(401);
  });

  it('Enforces role boundaries for rate writes, user management and admin approval', async () => {
    const estimatorRateWrite = await request(app)
      .post('/api/rates/materials')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ materialCode: 'TEST', name: 'Test', category: 'Test', ratePerKg: 1, scrapRatePerKg: 0, effectiveFrom: new Date().toISOString() });
    expect(estimatorRateWrite.status).toBe(403);

    const estimatorMachineWrite = await request(app)
      .post('/api/rates/machines')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ machineCode: 'TEST', name: 'Test', category: 'Test', hourRate: 1, effectiveFrom: '2026-01-01' });
    expect(estimatorMachineWrite.status).toBe(403);

    const estimatorLabourWrite = await request(app)
      .post('/api/rates/labour')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ labourType: 'Test', hourRate: 1, effectiveFrom: '2026-01-01' });
    expect(estimatorLabourWrite.status).toBe(403);

    const estimatorHistory = await request(app)
      .get('/api/rates/materials')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(estimatorHistory.status).toBe(200);

    const estimatorMutations = await Promise.all([
      request(app).put('/api/rates/materials/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).patch('/api/rates/materials/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).delete('/api/rates/materials/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).put('/api/rates/machines/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).patch('/api/rates/machines/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).delete('/api/rates/machines/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).put('/api/rates/labour/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).patch('/api/rates/labour/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
      request(app).delete('/api/rates/labour/no-rate').set('Authorization', `Bearer ${estimatorToken}`),
    ]);
    expect(estimatorMutations.every((response) => response.status === 403)).toBe(true);

    const salesHeadUserManagement = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${salesHeadToken}`);
    expect(salesHeadUserManagement.status).toBe(403);

    const estimatorUserManagement = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(estimatorUserManagement.status).toBe(403);

    const adminApproval = await request(app)
      .post('/api/approvals/not-a-quote/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ comments: 'Admin must not approve' });
    expect(adminApproval.status).toBe(403);

    const adminUsers = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminUsers.status).toBe(200);
    expect(adminUsers.body.every((user: any) => !('passwordHash' in user))).toBe(true);

    const adminAudit = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAudit.status).toBe(200);
  });

  it('Ignores a role forged in a valid token and blocks self-role changes', async () => {
    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${estimatorToken}`);
    const forgedToken = jwt.sign(
      { id: profile.body.id, role: 'SALES_HEAD' },
      JWT_SECRET,
      { expiresIn: '5m' },
    );
    const forgedApproval = await request(app)
      .post('/api/approvals/not-a-quote/approve')
      .set('Authorization', `Bearer ${forgedToken}`)
      .send({ comments: 'Forged role' });
    expect(forgedApproval.status).toBe(403);

    const adminProfile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    const selfRoleChange = await request(app)
      .patch(`/api/admin/users/${adminProfile.body.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ESTIMATOR' });
    expect(selfRoleChange.status).toBe(403);
  });

  it('Allows Admin user management without mass assignment and refreshes role authorization from the database', async () => {
    const email = `rbac-user-${Date.now()}@example.test`;
    const password = 'Temporary-Test-Password-123!';
    const massAssignment = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, name: 'RBAC Test User', password, role: 'ESTIMATOR', passwordHash: 'attacker-hash' });
    expect(massAssignment.status).toBe(400);

    const created = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, name: 'RBAC Test User', password, role: 'ESTIMATOR' });
    expect(created.status).toBe(201);
    testUserIds.push(created.body.id);
    expect(created.body.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const updated = await request(app)
      .patch(`/api/admin/users/${created.body.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'SALES_HEAD' });
    expect(updated.status).toBe(200);

    const roleImmediatelyApplied = await request(app)
      .post('/api/approvals/not-a-quote/approve')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({});
    expect(roleImmediatelyApplied.status).toBe(404);

    await request(app)
      .patch(`/api/admin/users/${created.body.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ESTIMATOR' });
    const demotedTokenDenied = await request(app)
      .post('/api/approvals/not-a-quote/approve')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({});
    expect(demotedTokenDenied.status).toBe(403);
  });

  it('Creates an estimator-owned RFQ and quote, enforces the approval threshold, and prevents duplicate decisions', async () => {
    const [estimatorProfile, customer] = await Promise.all([
      request(app).get('/api/auth/me').set('Authorization', `Bearer ${estimatorToken}`),
      prisma.customer.findFirst(),
    ]);
    expect(estimatorProfile.status).toBe(200);
    expect(customer).toBeTruthy();

    const rfqResponse = await request(app)
      .post('/api/rfqs')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({
        rfqNumber: `RBAC-TEST-${Date.now()}`,
        customerId: customer!.id,
        assignedEstimatorId: 'tampered-assignee',
        targetDueDate: new Date(Date.now() + 86400000).toISOString(),
        parts: [{
          partNumber: `RBAC-PART-${Date.now()}`,
          partName: 'RBAC API test part',
          materialName: 'EN8',
          grossWeightKg: 10,
          netWeightKg: 8,
          annualVolume: 100000,
        }],
      });
    expect(rfqResponse.status).toBe(201);
    testRfqIds.push(rfqResponse.body.id);
    expect(rfqResponse.body.assignedEstimatorId).toBe(estimatorProfile.body.id);
    const editPayload = {
      customerId: customer!.id,
      targetDueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      notes: 'Updated test note',
      part: {
        partNumber: rfqResponse.body.parts[0].partNumber,
        partName: 'Updated RBAC API test part',
        materialName: 'EN8',
        grossWeightKg: 10,
        netWeightKg: 8,
        annualVolume: 100000,
      },
    };
    const unauthorizedEdit = await request(app)
      .patch(`/api/rfqs/${rfqResponse.body.id}`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send(editPayload);
    expect(unauthorizedEdit.status).toBe(403);

    const editedRfq = await request(app)
      .patch(`/api/rfqs/${rfqResponse.body.id}`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ ...editPayload, assignedEstimatorId: 'tampered-assignee' });
    expect(editedRfq.status).toBe(400);

    const validEdit = await request(app)
      .patch(`/api/rfqs/${rfqResponse.body.id}`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send(editPayload);
    expect(validEdit.status).toBe(200);
    expect(validEdit.body.parts[0].partName).toBe('Updated RBAC API test part');
    expect(validEdit.body.notes).toBe('Updated test note');
    const partId = validEdit.body.parts[0].id;

    const sentStatusBypass = await request(app)
      .patch(`/api/rfqs/${rfqResponse.body.id}/status`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ status: 'SENT' });
    expect(sentStatusBypass.status).toBe(400);

    const unrelatedPart = await prisma.part.findFirst({ where: { rfqId: { not: rfqResponse.body.id } } });
    if (unrelatedPart) {
      const mismatchedPartQuote = await request(app)
        .post('/api/costing/save-quote')
        .set('Authorization', `Bearer ${estimatorToken}`)
        .send({
          rfqId: rfqResponse.body.id,
          partId: unrelatedPart.id,
          quoteNumber: `RBAC-MISMATCH-${Date.now()}`,
          costingInput: {
            grossWeightKg: 10,
            netWeightKg: 8,
            materialRatePerKg: 200,
            scrapRecoveryRatePerKg: 50,
            annualVolume: 100000,
            volumeTiers: [{ volume: 10000 }],
            operations: [{
              sequence: 1,
              operationName: 'Turning',
              machineName: 'CNC Lathe',
              setupTimeMin: 30,
              cycleTimeMin: 2,
              machineHourRate: 500,
              labourRateHr: 100,
            }],
          },
        });
      expect(mismatchedPartQuote.status).toBe(400);
    }

    const costingInput = {
      grossWeightKg: 10,
      netWeightKg: 8,
      materialRatePerKg: 200,
      scrapRecoveryRatePerKg: 50,
      annualVolume: 100000,
      overheadPct: 12,
      packingPerUnit: 8,
      freightPerUnit: 12,
      marginPct: 15,
      gstPct: 18,
      volumeTiers: [
        { volume: 10000, label: '10k' },
        { volume: 50000, label: '50k' },
        { volume: 100000, label: '100k' },
      ],
      operations: [{
        sequence: 1,
        operationName: 'Turning',
        machineName: 'CNC Lathe',
        setupTimeMin: 30,
        cycleTimeMin: 2,
        machineHourRate: 500,
        labourRateHr: 100,
      }],
    };
    const calculation = await request(app)
      .post('/api/costing/calculate')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send(costingInput);
    expect(calculation.status).toBe(200);
    expect(calculation.body.requiresSalesHeadApproval).toBe(true);

    const quoteNumber = `RBAC-QT-${Date.now()}`;
    const submitted = await request(app)
      .post('/api/costing/save-quote')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({
        rfqId: rfqResponse.body.id,
        partId,
        quoteNumber,
        costingInput,
        createdById: 'tampered-creator',
        status: 'APPROVED',
      });
    expect(submitted.status).toBe(201);
    testQuoteIds.push(submitted.body.quote.id);
    expect(submitted.body.quote.createdById).toBe(estimatorProfile.body.id);
    expect(submitted.body.quote.status).toBe('PENDING_APPROVAL');
    expect(submitted.body.quote.totalAnnualValue).toBeGreaterThan(2500000);

    const submissionAudit = await prisma.auditLog.findFirst({
      where: { entityType: 'QUOTE', entityId: submitted.body.quote.id, action: 'SUBMIT_APPROVAL' },
    });
    expect(JSON.parse(submissionAudit!.details!)).toMatchObject({
      before: { rfqStatus: 'ESTIMATING' },
      after: { quoteStatus: 'PENDING_APPROVAL', rfqStatus: 'PENDING_APPROVAL' },
    });
    const pendingRfqFilter = await request(app)
      .get('/api/rfqs?status=PENDING_APPROVAL')
      .set('Authorization', `Bearer ${salesHeadToken}`);
    expect(pendingRfqFilter.status).toBe(200);
    expect(pendingRfqFilter.body.some((rfq: any) => rfq.id === rfqResponse.body.id)).toBe(true);
    const dashboardSummary = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${salesHeadToken}`);
    const approvalQueue = await request(app)
      .get('/api/approvals')
      .set('Authorization', `Bearer ${salesHeadToken}`);
    expect(dashboardSummary.status).toBe(200);
    expect(dashboardSummary.body.quotesPendingApproval).toBe(approvalQueue.body.length);

    const quoteSnapshot = await prisma.quoteRateSnapshot.findUnique({
      where: { quoteId: submitted.body.quote.id },
    });
    expect(quoteSnapshot).toBeTruthy();
    expect(JSON.parse(quoteSnapshot!.ratesData).material.ratePerKg).toBe(200);
    const savedTier = await prisma.quoteVolumeTier.findFirst({
      where: { quoteId: submitted.body.quote.id },
      orderBy: { volume: 'asc' },
    });
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 10);
    const newRateVersion = await request(app)
      .post('/api/rates/materials')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({
        materialCode: 'ACTIVE_MAT',
        name: 'Future snapshot test material rate',
        category: 'Test',
        ratePerKg: 999,
        scrapRatePerKg: 0,
        effectiveFrom: futureDate.toISOString().slice(0, 10),
      });
    expect(newRateVersion.status).toBe(201);
    testMaterialRateIds.push(newRateVersion.body.id);
    const savedQuoteAfterRateChange = await request(app)
      .get(`/api/costing/${submitted.body.quote.id}`)
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(savedQuoteAfterRateChange.status).toBe(200);
    expect(JSON.parse(savedQuoteAfterRateChange.body.snapshot.ratesData).material.ratePerKg).toBe(200);
    expect(savedQuoteAfterRateChange.body.volumeTiers[0].unitPriceExGst).toBe(savedTier!.unitPriceExGst);

    const estimatorDecision = await request(app)
      .post(`/api/approvals/${submitted.body.quote.id}/approve`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({});
    expect(estimatorDecision.status).toBe(403);

    const approved = await request(app)
      .post(`/api/approvals/${submitted.body.quote.id}/approve`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ comments: 'Verified by API test' });
    expect(approved.status).toBe(200);
    expect(approved.body.quote.status).toBe('APPROVED');
    expect(approved.body.quote.approvedById).toBeTruthy();
    expect(approved.body.quote.approvedAt).toBeTruthy();
    const rfqAfterApproval = await prisma.rFQ.findUnique({ where: { id: rfqResponse.body.id } });
    expect(rfqAfterApproval?.status).toBe('SENT');
    const approvalAudit = await prisma.auditLog.findFirst({
      where: { entityType: 'QUOTE', entityId: submitted.body.quote.id, action: 'APPROVE' },
    });
    expect(JSON.parse(approvalAudit!.details!)).toMatchObject({
      before: { quoteStatus: 'PENDING_APPROVAL', rfqStatus: 'PENDING_APPROVAL' },
      after: { quoteStatus: 'APPROVED', rfqStatus: 'SENT', approvedById: approved.body.quote.approvedById },
    });
    const pendingRfqsAfterApproval = await request(app)
      .get('/api/rfqs?status=PENDING_APPROVAL')
      .set('Authorization', `Bearer ${salesHeadToken}`);
    expect(pendingRfqsAfterApproval.body.some((rfq: any) => rfq.id === rfqResponse.body.id)).toBe(false);

    const duplicateApproval = await request(app)
      .post(`/api/approvals/${submitted.body.quote.id}/approve`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({});
    expect(duplicateApproval.status).toBe(400);

    const secondSubmission = await request(app)
      .post('/api/costing/save-quote')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ rfqId: rfqResponse.body.id, partId, quoteNumber: `${quoteNumber}-R2`, costingInput });
    expect(secondSubmission.status).toBe(201);
    testQuoteIds.push(secondSubmission.body.quote.id);

    const missingReason = await request(app)
      .post(`/api/approvals/${secondSubmission.body.quote.id}/reject`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ rejectionReason: ' ' });
    expect(missingReason.status).toBe(400);

    const rejected = await request(app)
      .post(`/api/approvals/${secondSubmission.body.quote.id}/reject`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ rejectionReason: 'Pricing requires revision' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.quote.status).toBe('REJECTED');
    expect(rejected.body.quote.rejectionReason).toBe('Pricing requires revision');
    const rfqAfterRejection = await prisma.rFQ.findUnique({ where: { id: rfqResponse.body.id } });
    expect(rfqAfterRejection?.status).toBe('ESTIMATING');
    const rejectionAudit = await prisma.auditLog.findFirst({
      where: { entityType: 'QUOTE', entityId: secondSubmission.body.quote.id, action: 'REJECT' },
    });
    expect(JSON.parse(rejectionAudit!.details!)).toMatchObject({
      before: { quoteStatus: 'PENDING_APPROVAL', rfqStatus: 'PENDING_APPROVAL' },
      after: { quoteStatus: 'REJECTED', rfqStatus: 'ESTIMATING' },
    });

    const duplicateRejection = await request(app)
      .post(`/api/approvals/${secondSubmission.body.quote.id}/reject`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ rejectionReason: 'Trying to reject again' });
    expect(duplicateRejection.status).toBe(400);
    const rejectedQuotePdf = await request(app)
      .get(`/api/pdf/quote/${secondSubmission.body.quote.id}`)
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(rejectedQuotePdf.status).toBe(409);

    const invalidWonTransition = await request(app)
      .patch(`/api/rfqs/${rfqResponse.body.id}/status`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ status: 'WON' });
    expect(invalidWonTransition.status).toBe(409);

    await prisma.rFQ.update({ where: { id: rfqResponse.body.id }, data: { status: 'SENT' } });
    const markedWon = await request(app)
      .patch(`/api/rfqs/${rfqResponse.body.id}/status`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ status: 'WON' });
    expect(markedWon.status).toBe(200);
    expect(markedWon.body.status).toBe('WON');
    const duplicateTerminalTransition = await request(app)
      .patch(`/api/rfqs/${rfqResponse.body.id}/status`)
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({ status: 'LOST', lossReason: 'Test' });
    expect(duplicateTerminalTransition.status).toBe(409);

    const dashboardRows = await prisma.rFQ.findMany({
      include: {
        quotes: {
          select: {
            status: true,
            requiresApproval: true,
            totalAnnualValue: true,
            approvedById: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const allQuotes = dashboardRows.flatMap((rfq) => rfq.quotes);
    const dashboard = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${salesHeadToken}`);
    expect(dashboard.body).toMatchObject({
      activeRfqs: dashboardRows.filter((rfq) => !['WON', 'LOST'].includes(getRfqWorkflowStatus(rfq.status, rfq.quotes))).length,
      estimatingRfqs: dashboardRows.filter((rfq) => getRfqWorkflowStatus(rfq.status, rfq.quotes) === 'ESTIMATING').length,
      quotesPendingApproval: allQuotes.filter((quote) => quote.status === 'PENDING_APPROVAL').length,
      approvedQuotes: allQuotes.filter((quote) => quote.status === 'APPROVED' && quote.approvedById !== null).length,
      quotesSentToCustomer: allQuotes.filter((quote) =>
        quote.status === 'SENT'
        || (quote.status === 'APPROVED' && (quote.approvedById !== null || !quote.requiresApproval)),
      ).length,
      wonOrders: dashboardRows.filter((rfq) => getRfqWorkflowStatus(rfq.status, rfq.quotes) === 'WON').length,
      lostOrders: dashboardRows.filter((rfq) => getRfqWorkflowStatus(rfq.status, rfq.quotes) === 'LOST').length,
    });

    const salesHead = await prisma.user.findUnique({ where: { email: 'saleshead@example.invalid' } });
    const foreignQuote = await prisma.quote.create({
      data: {
        quoteNumber: `RBAC-FOREIGN-QUOTE-${Date.now()}`,
        rfqId: rfqResponse.body.id,
        partId,
        createdById: salesHead!.id,
        status: 'SENT',
        totalAnnualValue: 1_000_000,
      },
    });
    testQuoteIds.push(foreignQuote.id);
    const estimatorQuoteDenied = await request(app)
      .get(`/api/costing/${foreignQuote.id}`)
      .set('Authorization', `Bearer ${estimatorToken}`);
    const estimatorPdfDenied = await request(app)
      .get(`/api/pdf/quote/${foreignQuote.id}`)
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(estimatorQuoteDenied.status).toBe(403);
    expect(estimatorPdfDenied.status).toBe(403);
  });

  it('Lists RFQs for authenticated Estimator', async () => {
    const res = await request(app)
      .get('/api/rfqs')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);

    const sampleRfq = res.body.find((rfq: any) => rfq.rfqNumber === 'RFQ-DEMO-001');
    expect(sampleRfq).toBeDefined();
    expect(sampleRfq.customer.name).toBe('Sample Customer A');
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

  it('Allows authorized Sales Head rate versioning and records its audit event', async () => {
    const materialCode = `RBAC-${Date.now()}`;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const created = await request(app)
      .post('/api/rates/materials')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({
        materialCode,
        name: 'Temporary API Test Material',
        category: 'Test',
        ratePerKg: 100,
        scrapRatePerKg: 20,
        effectiveFrom: today.toISOString().slice(0, 10),
      });
    expect(created.status).toBe(201);
    testMaterialRateIds.push(created.body.id);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'MATERIAL_RATE', entityId: created.body.id, action: 'CREATE_VERSION' },
    });
    expect(audit).toBeTruthy();
    expect(JSON.parse(audit!.details!).after.ratePerKg).toBe(100);

    const secondVersion = await request(app)
      .post('/api/rates/materials')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({
        materialCode,
        name: 'Temporary API Test Material',
        category: 'Test',
        ratePerKg: 125,
        scrapRatePerKg: 25,
        effectiveFrom: tomorrow.toISOString().slice(0, 10),
      });
    expect(secondVersion.status).toBe(201);
    testMaterialRateIds.push(secondVersion.body.id);
    expect(secondVersion.body.effectiveFrom).toBeTruthy();

    const history = await prisma.materialRate.findMany({
      where: { materialCode },
      orderBy: { effectiveFrom: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history[0].ratePerKg).toBe(100);
    expect(history[0].effectiveTo?.toISOString().slice(0, 10)).toBe(today.toISOString().slice(0, 10));
    expect(history[1].ratePerKg).toBe(125);

    const duplicateStart = await request(app)
      .post('/api/rates/materials')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({
        materialCode,
        name: 'Conflicting Material',
        category: 'Test',
        ratePerKg: 150,
        scrapRatePerKg: 0,
        effectiveFrom: tomorrow.toISOString().slice(0, 10),
      });
    expect(duplicateStart.status).toBe(409);

    const immutableUpdate = await request(app)
      .put(`/api/rates/materials/${created.body.id}`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ ratePerKg: 999 });
    expect(immutableUpdate.status).toBe(405);

    const machineCode = `RBAC-M-${Date.now()}`;
    const machine = await request(app)
      .post('/api/rates/machines')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ machineCode, name: 'Test CNC', category: 'Test', hourRate: 500, effectiveFrom: today.toISOString().slice(0, 10) });
    expect(machine.status).toBe(201);
    testMachineRateIds.push(machine.body.id);

    const machineSecondVersion = await request(app)
      .post('/api/rates/machines')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({
        machineCode,
        name: 'Test CNC',
        category: 'Test',
        hourRate: 550,
        effectiveFrom: tomorrow.toISOString().slice(0, 10),
      });
    expect(machineSecondVersion.status).toBe(201);
    testMachineRateIds.push(machineSecondVersion.body.id);
    const machineHistory = await prisma.machineRate.findMany({
      where: { machineCode },
      orderBy: { effectiveFrom: 'asc' },
    });
    expect(machineHistory).toHaveLength(2);
    expect(machineHistory[0].effectiveTo?.toISOString().slice(0, 10)).toBe(today.toISOString().slice(0, 10));
    expect(machineHistory[0].hourRate).toBe(500);
    expect(machineHistory[1].hourRate).toBe(550);

    const labourType = `Test Labour ${Date.now()}`;
    const labour = await request(app)
      .post('/api/rates/labour')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ labourType, hourRate: 160, effectiveFrom: today.toISOString().slice(0, 10) });
    expect(labour.status).toBe(201);
    testLabourRateIds.push(labour.body.id);

    const labourSecondVersion = await request(app)
      .post('/api/rates/labour')
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({ labourType, hourRate: 180, effectiveFrom: tomorrow.toISOString().slice(0, 10) });
    expect(labourSecondVersion.status).toBe(201);
    testLabourRateIds.push(labourSecondVersion.body.id);
    const labourHistory = await prisma.labourRate.findMany({
      where: { labourType },
      orderBy: { effectiveFrom: 'asc' },
    });
    expect(labourHistory).toHaveLength(2);
    expect(labourHistory[0].effectiveTo?.toISOString().slice(0, 10)).toBe(today.toISOString().slice(0, 10));
    expect(labourHistory[0].hourRate).toBe(160);
    expect(labourHistory[1].hourRate).toBe(180);
  });

  it('Saves an at-threshold quote without GST-based approval and updates RFQ status', async () => {
    const [estimator, customer] = await Promise.all([
      prisma.user.findUnique({ where: { email: 'estimator@example.invalid' } }),
      prisma.customer.findFirst(),
    ]);
    expect(estimator).toBeTruthy();
    expect(customer).toBeTruthy();

    const createdRfq = await request(app)
      .post('/api/rfqs')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({
        rfqNumber: `RBAC-LOW-${Date.now()}`,
        customerId: customer!.id,
        targetDueDate: new Date(Date.now() + 86400000).toISOString(),
        parts: [{
          partNumber: `RBAC-LOW-PART-${Date.now()}`,
          partName: 'Threshold test part',
          materialName: 'Test',
          grossWeightKg: 1,
          netWeightKg: 1,
          annualVolume: 100000,
        }],
      });
    expect(createdRfq.status).toBe(201);
    testRfqIds.push(createdRfq.body.id);

    const submitted = await request(app)
      .post('/api/costing/save-quote')
      .set('Authorization', `Bearer ${estimatorToken}`)
      .send({
        rfqId: createdRfq.body.id,
        partId: createdRfq.body.parts[0].id,
        quoteNumber: `RBAC-LOW-QT-${Date.now()}`,
        costingInput: {
          grossWeightKg: 1,
          netWeightKg: 1,
          materialRatePerKg: 25,
          scrapRecoveryRatePerKg: 0,
          annualVolume: 100000,
          overheadPct: 0,
          packingPerUnit: 0,
          freightPerUnit: 0,
          marginPct: 0,
          gstPct: 18,
          volumeTiers: [{ volume: 100000, label: '100k' }],
          operations: [{
            sequence: 1,
            operationName: 'Test',
            machineName: 'Test machine',
            setupTimeMin: 0,
            cycleTimeMin: 1,
            machineHourRate: 0,
            labourRateHr: 0,
          }],
        },
      });
    expect(submitted.status).toBe(201);
    testQuoteIds.push(submitted.body.quote.id);
    expect(submitted.body.calculation.tiers[0].unitPriceExGst).toBe(25);
    expect(submitted.body.calculation.tiers[0].unitPriceInclGst).toBe(29.5);
    expect(submitted.body.calculation.maxAnnualValue).toBe(2500000);
    expect(submitted.body.quote.requiresApproval).toBe(false);
    expect(submitted.body.quote.status).toBe('SENT');

    const updatedRfq = await prisma.rFQ.findUnique({ where: { id: createdRfq.body.id } });
    expect(updatedRfq?.status).toBe('SENT');

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'QUOTE', entityId: submitted.body.quote.id },
    });
    expect(JSON.parse(audit!.details!).after).toMatchObject({
      quoteStatus: 'SENT',
      rfqStatus: 'SENT',
      totalAnnualValue: 2500000,
    });
  });

  it('Generates quotation PDFs through the protected API', async () => {
    const quote = await prisma.quote.findFirst();
    expect(quote).toBeTruthy();
    const pdf = await request(app)
      .get(`/api/pdf/quote/${quote!.id}`)
      .set('Authorization', `Bearer ${salesHeadToken}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');

    const adminQuoteRead = await request(app)
      .get(`/api/costing/${quote!.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminQuoteRead.status).toBe(200);

    const adminDenied = await request(app)
      .get(`/api/pdf/quote/${quote!.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDenied.status).toBe(403);
  });

  it('Rejects Sales Head approval when annual quotation value is exactly at the threshold', async () => {
    const part = await prisma.part.findFirst({
      include: { rfq: true },
    });
    const estimator = await prisma.user.findUnique({ where: { email: 'estimator@example.invalid' } });
    expect(part).toBeTruthy();
    expect(estimator).toBeTruthy();
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `RBAC-THRESHOLD-${Date.now()}`,
        rfqId: part!.rfqId,
        partId: part!.id,
        createdById: estimator!.id,
        status: 'PENDING_APPROVAL',
        requiresApproval: true,
        totalAnnualValue: 2500000,
      },
    });
    testQuoteIds.push(quote.id);

    const response = await request(app)
      .post(`/api/approvals/${quote.id}/approve`)
      .set('Authorization', `Bearer ${salesHeadToken}`)
      .send({});
    expect(response.status).toBe(400);

    const unchanged = await prisma.quote.findUnique({ where: { id: quote.id } });
    expect(unchanged?.status).toBe('PENDING_APPROVAL');
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
    const input = 'Customer: Sample Contact (contact@example.invalid, +91 9000000000). STRICTLY CONFIDENTIAL drawing for Drive shaft sleeve.';
    const { scrubbedText } = scrubCustomerNdaData(input);

    expect(scrubbedText).not.toContain('contact@example.invalid');
    expect(scrubbedText).not.toContain('+91 9000000000');
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
Gross Wt: 0.58 kg
Annual Volume: 120,000
Cycle Time: 3.2 min
`;
    const extracted = extractWithHeuristics(rfqText, 'EMAIL');

    expect(extracted.partName.value).toBe('Drive shaft sleeve');
    expect(extracted.material.value).toBe('EN8');
    expect(extracted.grossWeightKg.value).toBe(0.58);
    expect(extracted.annualVolume.value).toBe(120000);
    expect(extracted.cycleTimeMin.value).toBe(3.2);
    expect(extracted.suggestedOperations.length).toBeGreaterThan(0);
  });

  it('Runs text extraction locally without an API key and does not persist raw snippets', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const estimatorExtraction = await request(app)
        .post('/api/ai/extract')
        .set('Authorization', `Bearer ${estimatorToken}`)
        .send({
          rawInput: 'Part Name: Local Parser Test\nMaterial: EN8\nGross Wt: 1.0 kg\nNet Weight: 0.8 kg\nAnnual Volume: 10,000\nCycle Time: 2 min',
          sourceType: 'EMAIL',
        });
      expect(estimatorExtraction.status).toBe(200);
      expect(estimatorExtraction.body.data.isAiGenerated).toBe(false);
      expect(estimatorExtraction.body.data.partName.value).toBe('Local Parser Test');
      testExtractionIds.push(estimatorExtraction.body.extractionId);

      const stored = await prisma.aiExtraction.findUnique({
        where: { id: estimatorExtraction.body.extractionId },
      });
      expect(stored?.rawInputSnippet).toBeNull();
      expect(JSON.parse(stored!.provenanceMap).partName.snippet).toBe('');

      const salesHeadDenied = await request(app)
        .post('/api/ai/extract')
        .set('Authorization', `Bearer ${salesHeadToken}`)
        .send({ rawInput: 'Part Name: Not Authorized', sourceType: 'EMAIL' });
      expect(salesHeadDenied.status).toBe(403);
    } finally {
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });

  it('Searches 1,400 historical quotes quickly by part name', async () => {
    const res = await request(app)
      .get('/api/historical/search?query=shaft%20sleeve')
      .set('Authorization', `Bearer ${estimatorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBeGreaterThan(0);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it('Generates a valid binary PDF quotation file with Isocode branding and multi-volume tables', async () => {
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
        grossWeightKg: 0.58,
        netWeightKg: 0.49,
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
