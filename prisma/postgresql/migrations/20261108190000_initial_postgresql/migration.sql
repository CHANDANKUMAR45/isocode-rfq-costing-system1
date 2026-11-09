-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ESTIMATOR',
    "department" TEXT DEFAULT 'Cost Estimation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRate" (
    "id" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ratePerKg" DOUBLE PRECISION NOT NULL,
    "scrapRatePerKg" DOUBLE PRECISION NOT NULL,
    "density" DOUBLE PRECISION NOT NULL DEFAULT 7.85,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineRate" (
    "id" TEXT NOT NULL,
    "machineCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hourRate" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourRate" (
    "id" TEXT NOT NULL,
    "labourType" TEXT NOT NULL,
    "hourRate" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabourRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQ" (
    "id" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedEstimatorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ESTIMATING',
    "lossReason" TEXT,
    "targetDueDate" TIMESTAMP(3) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "materialId" TEXT,
    "materialName" TEXT NOT NULL,
    "grossWeightKg" DOUBLE PRECISION NOT NULL,
    "netWeightKg" DOUBLE PRECISION NOT NULL,
    "annualVolume" INTEGER NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "drawingNumber" TEXT,
    "drawingRevision" TEXT DEFAULT 'Rev-A',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartOperation" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operationName" TEXT NOT NULL,
    "machineId" TEXT,
    "machineName" TEXT NOT NULL,
    "setupTimeMin" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "cycleTimeMin" DOUBLE PRECISION NOT NULL,
    "labourType" TEXT DEFAULT 'Skilled Machinist',
    "labourRateHr" DOUBLE PRECISION NOT NULL DEFAULT 150.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "overheadPct" DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    "packingPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    "freightPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    "marginPct" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "gstPct" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "totalAnnualValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "approvalComments" TEXT,
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVolumeTier" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "materialCostPerUnit" DOUBLE PRECISION NOT NULL,
    "scrapCreditPerUnit" DOUBLE PRECISION NOT NULL,
    "netMaterialCostPerUnit" DOUBLE PRECISION NOT NULL,
    "machiningCostPerUnit" DOUBLE PRECISION NOT NULL,
    "labourCostPerUnit" DOUBLE PRECISION NOT NULL,
    "directCostPerUnit" DOUBLE PRECISION NOT NULL,
    "overheadCostPerUnit" DOUBLE PRECISION NOT NULL,
    "packingPerUnit" DOUBLE PRECISION NOT NULL,
    "freightPerUnit" DOUBLE PRECISION NOT NULL,
    "baseCostPerUnit" DOUBLE PRECISION NOT NULL,
    "marginPerUnit" DOUBLE PRECISION NOT NULL,
    "unitPriceExGst" DOUBLE PRECISION NOT NULL,
    "gstAmountPerUnit" DOUBLE PRECISION NOT NULL,
    "unitPriceInclGst" DOUBLE PRECISION NOT NULL,
    "totalAnnualValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteVolumeTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRateSnapshot" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "ratesData" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiExtraction" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT,
    "sourceType" TEXT NOT NULL,
    "rawInputSnippet" TEXT,
    "extractedData" TEXT NOT NULL,
    "provenanceMap" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalQuote" (
    "id" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "grossWeightKg" DOUBLE PRECISION NOT NULL,
    "annualVolume" INTEGER NOT NULL,
    "cycleTimeMin" DOUBLE PRECISION NOT NULL,
    "machineHourRate" DOUBLE PRECISION NOT NULL,
    "unitPriceInr" DOUBLE PRECISION NOT NULL,
    "quotedDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "routingsSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "LabourRate_labourType_idx" ON "LabourRate"("labourType");

-- CreateIndex
CREATE UNIQUE INDEX "RFQ_rfqNumber_key" ON "RFQ"("rfqNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRateSnapshot_quoteId_key" ON "QuoteRateSnapshot"("quoteId");

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_assignedEstimatorId_fkey" FOREIGN KEY ("assignedEstimatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOperation" ADD CONSTRAINT "PartOperation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOperation" ADD CONSTRAINT "PartOperation_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVolumeTier" ADD CONSTRAINT "QuoteVolumeTier_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRateSnapshot" ADD CONSTRAINT "QuoteRateSnapshot_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtraction" ADD CONSTRAINT "AiExtraction_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

