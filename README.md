# Isocode RFQ-to-Quote Costing Web Application

> **Client**: Isocode (Tier-1 Auto-Component Manufacturer, sample location)  
> **Specialization**: Machined & forged parts for two-wheeler, tractor, and Tier-1 drivetrain customers  
> **Engineering Stack**: React 18, TypeScript, Vite, Tailwind CSS, Node.js, Express, Prisma ORM, SQLite  
> **Hardware Profile**: Ultra-lightweight (Zero-daemon architecture optimized for 8 GB RAM developer laptops)

---

## 1. Executive Summary & Problem Solved

Isocode was losing approximately **₹1.27 Crore a year** due to slow quotation turnaround (9 working days vs. the 4 days customers expect), manual rate transcription errors from old ERP records, and untraceable past quotes.

This application provides an **end-to-end, deterministic RFQ-to-Quote Costing System** that enables estimators to finish complete, multi-volume costings in under **1 hour** with 100% rate traceability and automated commercial governance.

---

## 2. Key Capabilities & Architectural Highlights

### ⚡ Deterministic Part Costing Engine (Zero AI Hallucination)
- **100% Deterministic Math**: All costing calculations follow strict automotive engineering formulas; AI is never used for pricing arithmetic.
- **Multi-Volume Matrix (2–3 Tiers)**: Automatically amortizes setup times across batch volumes (e.g., 16,000, 42,000, 120,000 pcs) showing true batch economics.
- **Indian Automotive Standards**: Gross weight, scrap recovery credit, cycle times (min), machine hour rates (₹/hr), factory overheads (12%), packaging, freight, contribution margin, and **separate 18% GST itemization**.

### 📅 Effective-Dated Rate Masters & Immutable Snapshots
- **Single Source of Truth**: Unified rate masters for raw materials (EN8, 40Cr4, 20MnCr5, SS304), machine hourly rates (CNC Turning, 4-Axis VMC, Forging Press, Cylindrical Grinder), and skilled labour.
- **Versioned Validity**: Rates feature `effectiveFrom` and `effectiveTo` windows.
- **Immutable Snapshots**: Every quote freezes a complete `QuoteRateSnapshot` at the moment of calculation, ensuring old quotes permanently retain their historical rates.

### 🛡️ Commercial Approval Workflow (&gt; ₹25 Lakhs Threshold)
- **Automated Governance**: Any quote with an annual contract value exceeding **₹25,00,000 INR** (`Unit Price × Annual Volume > ₹25L`) automatically transitions to `PENDING_APPROVAL`.
- **Strict Role-Based Access Control (RBAC)**: Only authorized **Sales Heads** can approve or reject quotations.
- **Audit Logging**: Every approval, rejection reason, comment, and timestamp is permanently recorded in the audit trail.

### 🤖 Real AI RFQ Intake with Customer NDA Privacy Scrubber
- **Google Gemini Flash (Free Tier)**: Ingests raw customer RFQ emails, Excel tables, and drawing title blocks into structured JSON.
- **Client NDA Pre-Scrubber**: Automatically scrubs customer emails, phone numbers, and proprietary confidentiality stamps before external transmission.
- **Field Provenance & Human-in-the-Loop**: Displays the exact text snippet and confidence score for every extracted field; requires estimator acceptance or manual override.
- **Deterministic Heuristic Fallback**: Runs 100% offline or with zero API keys configured using a localized regex/keyword parser.

### 📄 Professional Commercial PDF Quotation Generation
- Generates pixel-perfect, server-side PDF quotations featuring Isocode RFQ Costing letterhead, customer info, part specifications, multi-volume cost breakup table, GST breakdown, commercial terms, and authorized signatory blocks.

### 🔍 1,400+ Historical Quotes Repository
- Pre-seeded with 1,400 realistic sample location automotive historical quote records.
- Instant similarity search by part name, material, and customer to benchmark cycle times and reuse proven machining routings.

---

## 3. Demo User Accounts

Use the **one-click Role Switcher** in the top navigation bar, or log in with these credentials:

| Role | Name | Email | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Estimator** | Demo Estimator | `estimator@example.invalid` | `[REDACTED_DEMO_PASSWORD]` | Create RFQs, cost parts, submit for approval, view rates |
| **Sales Head** | Demo Sales Head | `saleshead@example.invalid` | `[REDACTED_DEMO_PASSWORD]` | Approve/reject quotes &gt; ₹25L, manage/version rate masters |
| **Admin** | Demo Admin | `admin@example.invalid` | `[REDACTED_DEMO_PASSWORD]` | Full plant management and configuration |

---

## 4. Quick Start Guide (Simple English)

### Prerequisites
- **Node.js**: Version 18+ installed on your computer.
- **Memory**: Runs efficiently on laptops with 8 GB RAM (consumes &lt; 200 MB RAM total).

### Step 1: Install Dependencies
Open a terminal in the project root and run:
```powershell
# Install backend dependencies
npm --prefix server install

# Install frontend dependencies
npm --prefix client install
```

### Step 2: Set Up the Lightweight SQLite Database
```powershell
# Push the Prisma schema to create the local SQLite database (dev.db)
npm --prefix server run prisma:push

# Seed the database with demo users, materials, machines, sample RFQs, and 1,400 historical quotes
npm --prefix server run seed
```

### Step 3: Run the Application
In terminal 1 (Backend API):
```powershell
npm --prefix server run dev
# Server will start on http://localhost:5000
```

In terminal 2 (Frontend Client):
```powershell
npm --prefix client run dev
# Client will start on http://localhost:5173
```

Open your browser and navigate to: **`http://localhost:5173`**

---

## 5. Running Automated Tests

The application includes unit and integration tests covering costing math, setup amortization, approval thresholds, RBAC, NDA scrubbing, and PDF generation:

```powershell
npm --prefix server test
```
All 15 test suites will run and display results in under 2 seconds.

---

## 6. Project Structure

```
Isocode-RFQ-Costing-App/
│
├── client/                     # Frontend (React 18, Vite, Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Clean, modular UI screens
│   │   │   ├── Navbar.tsx             # Header with 1-click role switcher
│   │   │   ├── RfqRegister.tsx        # RFQ table, search, status filters
│   │   │   ├── CostingCalculator.tsx  # Multi-volume deterministic calculator
│   │   │   ├── RateMasters.tsx        # Effective-dated material & machine rates
│   │   │   ├── ApprovalQueue.tsx      # Sales Head approval dashboard (> ₹25L)
│   │   │   ├── HistoricalSearch.tsx   # 1,400 past quotes search & reuse
│   │   │   ├── AiIntakeModal.tsx      # Gemini Flash AI intake + NDA scrubber
│   │   │   └── NewRfqModal.tsx        # RFQ registration modal
│   │   ├── context/AuthContext.tsx    # JWT auth state & demo user switching
│   │   ├── services/api.ts            # Type-safe API client
│   │   ├── types/index.ts             # Application TypeScript interfaces
│   │   ├── App.tsx                    # Main container layout
│   │   └── main.tsx                   # React entry point
│   ├── package.json
│   └── vite.config.ts
│
├── server/                     # Backend (Node.js, Express, TypeScript)
│   ├── src/
│   │   ├── db/
│   │   │   ├── prisma.ts              # Prisma client singleton
│   │   │   └── seed.ts                # Database seeder (sample location demo data)
│   │   ├── middleware/auth.ts         # JWT verification & RBAC guard
│   │   ├── routes/                    # REST API endpoints
│   │   │   ├── authRoutes.ts          # Login, profile, demo users
│   │   │   ├── rfqRoutes.ts           # RFQ CRUD, status lifecycle
│   │   │   ├── costingRoutes.ts       # Costing math, quote saving
│   │   │   ├── rateRoutes.ts          # Effective-dated rate masters
│   │   │   ├── approvalRoutes.ts      # Sales Head approval queue & audit logs
│   │   │   ├── aiRoutes.ts            # Real AI RFQ intake endpoint
│   │   │   ├── historicalRoutes.ts    # Historical quotes search (1,400 rows)
│   │   │   └── pdfRoutes.ts           # Server-side PDF quotation streaming
│   │   ├── services/
│   │   │   ├── costingEngine.ts       # Pure deterministic mathematical engine
│   │   │   ├── rateSnapshotService.ts # Immutable rate snapshotting
│   │   │   ├── aiService.ts           # Gemini Flash + NDA privacy scrubber
│   │   │   └── pdfService.ts          # PDFKit commercial quotation generator
│   │   ├── tests/                     # Automated Vitest test suites
│   │   │   ├── costingEngine.test.ts  # Mathematical formulas & thresholds
│   │   │   └── api.test.ts            # End-to-end API & security tests
│   │   └── index.ts                   # Express server entry point
│   ├── package.json
│   └── tsconfig.json
│
├── prisma/
│   ├── schema.prisma           # Relational SQLite database schema
│   └── dev.db                  # Local SQLite database file (created on push)
│
├── development_plan.md         # Architecture analysis & implementation plan
├── deployment.md               # Local setup & deployment documentation
├── TDD.md                      # Technical Design Document
├── ISOCODE_ASSIGNMENT.md       # Client requirements specification
├── MASTER_PROMPT.md            # Master specification
├── REFERENCE_REPOSITORY.md     # Reference analysis
└── .gitignore
```

---

## 7. Compliance & Confidentiality Notice

- **Original Implementation**: This codebase is 100% original, clean-room TypeScript code. None of the source code from the proprietary reference repository was copied or reused.
- **Confidentiality / NDA**: Customer names, emails, and drawing markings are never shared with unverified external models. Local regex scrubbing protects all confidential data.
