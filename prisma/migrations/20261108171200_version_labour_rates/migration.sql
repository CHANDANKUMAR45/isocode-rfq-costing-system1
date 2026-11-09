BEGIN IMMEDIATE;

CREATE TABLE "new_LabourRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labourType" TEXT NOT NULL,
    "hourRate" REAL NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_LabourRate" (
    "id",
    "labourType",
    "hourRate",
    "effectiveFrom",
    "effectiveTo",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "labourType",
    "hourRate",
    "effectiveFrom",
    "effectiveTo",
    "isActive",
    "createdAt",
    "updatedAt"
FROM "LabourRate";

DROP TABLE "LabourRate";
ALTER TABLE "new_LabourRate" RENAME TO "LabourRate";
CREATE INDEX IF NOT EXISTS "LabourRate_labourType_idx" ON "LabourRate"("labourType");

COMMIT;
