import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Starting database seed for Isocode RFQ Costing...');

  // 1. Clean existing records safely
  await prisma.auditLog.deleteMany();
  await prisma.aiExtraction.deleteMany();
  await prisma.quoteVolumeTier.deleteMany();
  await prisma.quoteRateSnapshot.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.partOperation.deleteMany();
  await prisma.part.deleteMany();
  await prisma.rFQ.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.materialRate.deleteMany();
  await prisma.machineRate.deleteMany();
  await prisma.labourRate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.historicalQuote.deleteMany();

  console.log('🧹 Cleaned existing tables.');

  // 2. Users & Roles
  const passwordHash = await bcrypt.hash('[REDACTED_DEMO_PASSWORD]', 10);

  const estimator = await prisma.user.create({
    data: {
      name: 'Demo Estimator',
      email: 'estimator@example.invalid',
      passwordHash,
      role: 'ESTIMATOR',
      department: 'Cost Estimation & Engineering',
    },
  });

  const salesHead = await prisma.user.create({
    data: {
      name: 'Demo Sales Head',
      email: 'saleshead@example.invalid',
      passwordHash,
      role: 'SALES_HEAD',
      department: 'Sales & Commercial Operations',
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Demo Admin',
      email: 'admin@example.invalid',
      passwordHash,
      role: 'ADMIN',
      department: 'Plant Management',
    },
  });

  console.log('👤 Created demo users: Estimator, Sales Head, Admin.');

  // 3. Customers in sample location Automotive Belt
  const custB = await prisma.customer.create({
    data: {
      name: 'Sample Customer A',
      code: 'CUST-SAMPLE-A',
      segment: 'Two-Wheeler OEM',
      contactPerson: 'Mr. Sample Contact (Head of Sourcing)',
      email: 'contact-a@example.invalid',
      phone: '[REDACTED_PHONE]',
      address: 'MIDC Sample industrial location',
      gstin: '[REDACTED_TAX_ID]',
    },
  });

  const custC = await prisma.customer.create({
    data: {
      name: 'Sample Customer B',
      code: 'CUST-SAMPLE-B',
      segment: 'Tractor & Farm Equipment OEM',
      contactPerson: 'Mr. Sample Contact (Procurement GM)',
      email: 'contact-b@example.invalid',
      phone: '[REDACTED_PHONE]',
      address: 'Sample industrial location',
      gstin: '[REDACTED_TAX_ID]',
    },
  });

  const custD = await prisma.customer.create({
    data: {
      name: 'Sample Customer C',
      code: 'CUST-SAMPLE-C',
      segment: 'Tier-1 Drivetrain Systems',
      contactPerson: 'Ms. Sample Contact (Vendor Development)',
      email: 'contact-c@example.invalid',
      phone: '[REDACTED_PHONE]',
      address: 'Sample industrial location',
      gstin: '[REDACTED_TAX_ID]',
    },
  });

  console.log('🏭 Created Customers: Company B, Company C, Company D.');

  // 4. Rate Masters with Effective Dates
  const effectiveStart = new Date('2026-01-01');
  const pastRateStart = new Date('2025-01-01');
  const pastRateEnd = new Date('2025-12-31');

  // Materials
  const matEN8 = await prisma.materialRate.create({
    data: {
      materialCode: 'EN8',
      name: 'Medium Carbon Steel (EN8 / 080M40)',
      category: 'Carbon Steel Bar',
      ratePerKg: 78.0,
      scrapRatePerKg: 32.0,
      density: 7.85,
      effectiveFrom: effectiveStart,
    },
  });

  // Older version of EN8 for historical testing
  await prisma.materialRate.create({
    data: {
      materialCode: 'EN8',
      name: 'Medium Carbon Steel (EN8 / 080M40) - 2025 Revision',
      category: 'Carbon Steel Bar',
      ratePerKg: 72.0,
      scrapRatePerKg: 28.0,
      density: 7.85,
      effectiveFrom: pastRateStart,
      effectiveTo: pastRateEnd,
      isActive: false,
    },
  });

  const mat40Cr4 = await prisma.materialRate.create({
    data: {
      materialCode: '40Cr4',
      name: '40Cr4 Alloy Steel Closed-Die Forging',
      category: 'Alloy Steel Forging',
      ratePerKg: 112.0,
      scrapRatePerKg: 38.0,
      density: 7.85,
      effectiveFrom: effectiveStart,
    },
  });

  const mat20MnCr5 = await prisma.materialRate.create({
    data: {
      materialCode: '20MnCr5',
      name: '20MnCr5 Case Hardening Gear Steel',
      category: 'Case Hardening Steel',
      ratePerKg: 96.0,
      scrapRatePerKg: 34.0,
      density: 7.85,
      effectiveFrom: effectiveStart,
    },
  });

  await prisma.materialRate.create({
    data: {
      materialCode: 'SS304',
      name: 'Austenitic Stainless Steel (AISI 304)',
      category: 'Stainless Steel',
      ratePerKg: 245.0,
      scrapRatePerKg: 95.0,
      density: 8.0,
      effectiveFrom: effectiveStart,
    },
  });

  // Machines
  const machCncLathe = await prisma.machineRate.create({
    data: {
      machineCode: 'CNC-LATHE-01',
      name: 'CNC Turning Center 2-Axis (Sample Model A)',
      category: 'CNC Turning',
      hourRate: 850.0,
      effectiveFrom: effectiveStart,
    },
  });

  const machVmc = await prisma.machineRate.create({
    data: {
      machineCode: 'VMC-4AX-01',
      name: 'VMC 4-Axis Heavy Duty (Sample Model B)',
      category: 'VMC Milling',
      hourRate: 1250.0,
      effectiveFrom: effectiveStart,
    },
  });

  const machForge = await prisma.machineRate.create({
    data: {
      machineCode: 'FORGE-PRESS-1000T',
      name: '1000-Ton Closed Die Mechanical Forging Press',
      category: 'Forging Press',
      hourRate: 1450.0,
      effectiveFrom: effectiveStart,
    },
  });

  const machCylGrind = await prisma.machineRate.create({
    data: {
      machineCode: 'CYL-GRIND-01',
      name: 'CNC High-Precision Cylindrical Grinder (Sample Model C)',
      category: 'Cylindrical Grinding',
      hourRate: 950.0,
      effectiveFrom: effectiveStart,
    },
  });

  // Labour
  await prisma.labourRate.createMany({
    data: [
      { labourType: 'Skilled Machinist', hourRate: 160.0, effectiveFrom: effectiveStart },
      { labourType: 'Semi-Skilled Operator', hourRate: 110.0, effectiveFrom: effectiveStart },
      { labourType: 'Quality Inspector', hourRate: 180.0, effectiveFrom: effectiveStart },
      { labourType: 'Setup Specialist', hourRate: 220.0, effectiveFrom: effectiveStart },
    ],
  });

  console.log('⚙️ Seeded Effective-Dated Rate Masters: Materials, Machines, Labour.');

  // 5. Seed Core Sample RFQs from ISOCODE_ASSIGNMENT.md
  // RFQ 1: RFQ-DEMO-001 (Drive shaft sleeve)
  const rfq1 = await prisma.rFQ.create({
    data: {
      rfqNumber: 'RFQ-DEMO-001',
      customerId: custB.id,
      assignedEstimatorId: estimator.id,
      status: 'ESTIMATING',
      targetDueDate: new Date('2026-11-20'),
      notes: 'High-volume two-wheeler rear spindle RFQ. Drawing ref: DWG-DEMO-001. Annual requirement 120,000 units.',
      parts: {
        create: [
          {
            partNumber: 'SPN-DEMO-001',
            partName: 'Drive shaft sleeve',
            materialId: matEN8.id,
            materialName: 'EN8',
            grossWeightKg: 0.61,
            netWeightKg: 0.52,
            annualVolume: 120000,
            targetPrice: 85.0,
            drawingNumber: 'DWG-DEMO-001',
            drawingRevision: 'Rev-02',
            operations: {
              create: [
                {
                  sequence: 1,
                  operationName: 'Facing & Centering',
                  machineId: machCncLathe.id,
                  machineName: machCncLathe.name,
                  setupTimeMin: 30.0,
                  cycleTimeMin: 0.8,
                  labourType: 'Skilled Machinist',
                  labourRateHr: 160.0,
                },
                {
                  sequence: 2,
                  operationName: 'Rough & Finish CNC Turning & Threading',
                  machineId: machCncLathe.id,
                  machineName: machCncLathe.name,
                  setupTimeMin: 45.0,
                  cycleTimeMin: 2.4, // Total cycle time 0.8 + 2.4 = 3.2 min matching sample
                  labourType: 'Skilled Machinist',
                  labourRateHr: 160.0,
                },
              ],
            },
          },
        ],
      },
    },
    include: { parts: { include: { operations: true } } },
  });

  // RFQ 2: RFQ-DEMO-002 (Linkage bracket)
  await prisma.rFQ.create({
    data: {
      rfqNumber: 'RFQ-DEMO-002',
      customerId: custC.id,
      assignedEstimatorId: estimator.id,
      status: 'ESTIMATING',
      targetDueDate: new Date('2026-11-25'),
      notes: 'Tractor hydraulic linkage arm in 40Cr4 forging. Annual volume 16,000 units.',
      parts: {
        create: [
          {
            partNumber: 'ARM-DEMO-002',
            partName: 'Linkage bracket',
            materialId: mat40Cr4.id,
            materialName: '40Cr4 forging',
            grossWeightKg: 4.60,
            netWeightKg: 3.95,
            annualVolume: 16000,
            targetPrice: 780.0,
            drawingNumber: 'DWG-DEMO-002',
            drawingRevision: 'Rev-04',
            operations: {
              create: [
                {
                  sequence: 1,
                  operationName: 'Forging & Trimming',
                  machineId: machForge.id,
                  machineName: machForge.name,
                  setupTimeMin: 60.0,
                  cycleTimeMin: 4.5,
                  labourType: 'Skilled Machinist',
                  labourRateHr: 160.0,
                },
                {
                  sequence: 2,
                  operationName: 'VMC Pivot Hole Milling & Reaming',
                  machineId: machVmc.id,
                  machineName: machVmc.name,
                  setupTimeMin: 45.0,
                  cycleTimeMin: 7.0, // Total cycle time 4.5 + 7.0 = 11.5 min matching sample
                  labourType: 'Skilled Machinist',
                  labourRateHr: 160.0,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // RFQ 3: RFQ-DEMO-003 (Transmission Transmission gear blank)
  await prisma.rFQ.create({
    data: {
      rfqNumber: 'RFQ-DEMO-003',
      customerId: custD.id,
      assignedEstimatorId: estimator.id,
      status: 'ESTIMATING',
      targetDueDate: new Date('2026-11-28'),
      notes: 'Transmission Transmission gear blank for transmission sub-assembly in 20MnCr5. Annual volume 42,000 units.',
      parts: {
        create: [
          {
            partNumber: 'GB-DEMO-003',
            partName: 'Transmission Transmission gear blank',
            materialId: mat20MnCr5.id,
            materialName: '20MnCr5',
            grossWeightKg: 1.48,
            netWeightKg: 1.22,
            annualVolume: 42000,
            targetPrice: 220.0,
            drawingNumber: 'DWG-DEMO-003',
            drawingRevision: 'Rev-01',
            operations: {
              create: [
                {
                  sequence: 1,
                  operationName: 'CNC Blank Turning OP-10',
                  machineId: machCncLathe.id,
                  machineName: machCncLathe.name,
                  setupTimeMin: 40.0,
                  cycleTimeMin: 2.8,
                  labourType: 'Skilled Machinist',
                  labourRateHr: 160.0,
                },
                {
                  sequence: 2,
                  operationName: 'Finish Cylindrical Grinding & Bore OP-20',
                  machineId: machCylGrind.id,
                  machineName: machCylGrind.name,
                  setupTimeMin: 30.0,
                  cycleTimeMin: 2.0, // Total cycle time 2.8 + 2.0 = 4.8 min matching sample
                  labourType: 'Skilled Machinist',
                  labourRateHr: 160.0,
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log('📋 Seeded the 3 core sample RFQs from assignment.');

  // 6. Pre-calculate and seed a Quotation for RFQ-DEMO-001 showing Approval Workflow (> ₹25L)
  const part1 = rfq1.parts[0];
  const quote1 = await prisma.quote.create({
    data: {
      quoteNumber: 'QT-2026-001',
      rfqId: rfq1.id,
      partId: part1.id,
      createdById: estimator.id,
      version: 1,
      status: 'PENDING_APPROVAL', // Pending Sales Head approval because > ₹25 Lakh
      overheadPct: 12.0,
      packingPerUnit: 5.0,
      freightPerUnit: 8.0,
      marginPct: 15.0,
      gstPct: 18.0,
      requiresApproval: true,
      totalAnnualValue: 120000 * 87.50, // ₹1,57,50,000 (> ₹25 Lakhs)
      validityDays: 30,
      volumeTiers: {
        create: [
          {
            volume: 50000,
            label: 'Batch 50k pcs',
            materialCostPerUnit: 47.58,
            scrapCreditPerUnit: 2.88,
            netMaterialCostPerUnit: 44.70,
            machiningCostPerUnit: 45.45,
            labourCostPerUnit: 8.56,
            directCostPerUnit: 98.71,
            overheadCostPerUnit: 11.85,
            packingPerUnit: 5.0,
            freightPerUnit: 8.0,
            baseCostPerUnit: 123.56,
            marginPerUnit: 21.80,
            unitPriceExGst: 145.36,
            gstAmountPerUnit: 26.16,
            unitPriceInclGst: 171.52,
            totalAnnualValue: 145.36 * 120000,
          },
          {
            volume: 100000,
            label: 'Batch 100k pcs',
            materialCostPerUnit: 47.58,
            scrapCreditPerUnit: 2.88,
            netMaterialCostPerUnit: 44.70,
            machiningCostPerUnit: 45.37,
            labourCostPerUnit: 8.54,
            directCostPerUnit: 98.61,
            overheadCostPerUnit: 11.83,
            packingPerUnit: 5.0,
            freightPerUnit: 8.0,
            baseCostPerUnit: 123.44,
            marginPerUnit: 21.78,
            unitPriceExGst: 145.22,
            gstAmountPerUnit: 26.14,
            unitPriceInclGst: 171.36,
            totalAnnualValue: 145.22 * 120000,
          },
          {
            volume: 120000,
            label: 'Batch 180k pcs (Recommended)',
            materialCostPerUnit: 47.58,
            scrapCreditPerUnit: 2.88,
            netMaterialCostPerUnit: 44.70,
            machiningCostPerUnit: 45.34,
            labourCostPerUnit: 8.53,
            directCostPerUnit: 98.57,
            overheadCostPerUnit: 11.83,
            packingPerUnit: 5.0,
            freightPerUnit: 8.0,
            baseCostPerUnit: 123.40,
            marginPerUnit: 21.78,
            unitPriceExGst: 145.18,
            gstAmountPerUnit: 26.13,
            unitPriceInclGst: 171.31,
            totalAnnualValue: 145.18 * 120000,
          },
        ],
      },
      snapshot: {
        create: {
          ratesData: JSON.stringify({
            material: { code: 'EN8', ratePerKg: 78.0, scrapRatePerKg: 32.0 },
            machines: [{ code: 'CNC-LATHE-01', hourRate: 850.0 }],
            labour: [{ type: 'Skilled Machinist', hourRate: 160.0 }],
            capturedAt: new Date().toISOString(),
          }),
        },
      },
    },
  });

  // RFQ status moves to PENDING_APPROVAL
  await prisma.rFQ.update({
    where: { id: rfq1.id },
    data: { status: 'PENDING_APPROVAL' },
  });

  console.log(`💼 Seeded Quote ${quote1.quoteNumber} (Pending Approval > ₹25L).`);

  // 7. Seed 1,400 Realistic Historical Quotes for Search & Similarity
  console.log('📚 Generating 1,400 realistic historical quotes for sample location manufacturing base...');
  const partTypes = [
    { name: 'Drive shaft sleeve', mat: 'EN8', wt: 0.61, ct: 3.2, hr: 850, rate: 145.0, rout: 'Facing, CNC Turning, Threading' },
    { name: 'Pivot shaft', mat: 'EN8', wt: 0.75, ct: 3.8, hr: 850, rate: 168.0, rout: 'Facing, CNC Turning, Cylindrical Grinding' },
    { name: 'Linkage bracket', mat: '40Cr4 forging', wt: 4.60, ct: 11.5, hr: 1450, rate: 790.0, rout: 'Forging, VMC Milling, Hole Reaming' },
    { name: 'Steering support', mat: '40Cr4 forging', wt: 3.20, ct: 8.5, hr: 1250, rate: 640.0, rout: 'Rough Milling, Drilling, Bore Finish' },
    { name: 'Transmission Transmission gear blank', mat: '20MnCr5', wt: 1.48, ct: 4.8, hr: 950, rate: 225.0, rout: 'CNC Blank Turning, Bore Grinding' },
    { name: 'Drive pinion', mat: '20MnCr5', wt: 2.10, ct: 6.2, hr: 950, rate: 310.0, rout: 'Turning, Spline Hobbing, Heat Treatment' },
    { name: 'Shaft coupling', mat: 'Forged Steel', wt: 1.85, ct: 5.4, hr: 1100, rate: 295.0, rout: 'Forging, 4-Axis VMC Milling' },
    { name: 'Linkage rod', mat: 'Micro-alloyed Forging', wt: 0.95, ct: 7.2, hr: 1350, rate: 380.0, rout: 'Fracture Split, Big End Boring, Serration' },
    { name: 'Actuator shaft', mat: 'EN8', wt: 0.42, ct: 2.6, hr: 850, rate: 98.0, rout: 'Centerless Grinding, Oil Hole Gun Drilling' },
    { name: 'Brake mounting bracket', mat: 'Ductile Iron SG450', wt: 2.40, ct: 5.0, hr: 1150, rate: 340.0, rout: 'VMC Face Milling, Tapping M12' },
  ];

  const customersList = [
    'Sample Customer A',
    'Sample Customer B',
    'Sample Customer C',
    'Sample Customer D',
    'Sample Customer E',
    'Sample Customer F',
    'Sample Customer G',
    'Sample Customer H',
  ];

  const historicalData = [];
  const baseDate = new Date('2024-01-01').getTime();
  const endDate = new Date('2026-10-31').getTime();

  for (let i = 1; i <= 1400; i++) {
    const p = partTypes[i % partTypes.length];
    const cust = customersList[i % customersList.length];
    const randTime = baseDate + Math.random() * (endDate - baseDate);
    const date = new Date(randTime);
    const variance = 0.9 + Math.random() * 0.2; // +/- 10%

    historicalData.push({
      rfqNumber: `RFQ-HIST-${2400 + Math.floor(i / 3)}-${(i % 3) + 1}`,
      customerName: cust,
      partName: p.name,
      material: p.mat,
      grossWeightKg: Math.round(p.wt * variance * 100) / 100,
      annualVolume: Math.floor((10000 + Math.random() * 150000) / 1000) * 1000,
      cycleTimeMin: Math.round(p.ct * variance * 10) / 10,
      machineHourRate: p.hr,
      unitPriceInr: Math.round(p.rate * variance * 10) / 10,
      quotedDate: date,
      status: i % 5 === 0 ? 'LOST' : (i % 3 === 0 ? 'EXPIRED' : 'WON'),
      routingsSummary: p.rout,
    });
  }

  // Batch insert historical quotes in chunks of 500
  for (let i = 0; i < historicalData.length; i += 500) {
    const chunk = historicalData.slice(i, i + 500);
    await prisma.historicalQuote.createMany({ data: chunk });
  }

  console.log('✅ Successfully seeded 1,400 Historical Quotes!');
  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
