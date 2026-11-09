# Isocode RFQ-to-Quote Costing App

This is a web application for handling requests for quotation (RFQs) for machined and forged parts. It lets an estimator record part details, calculate a multi-volume quote, and route eligible quotes to a Sales Head for review.

The application is a prototype of a manufacturing quotation workflow. It aims to reduce repeated manual entry and retain the rates and costing used for each quote for later review.

## What it does

- Login for Estimator, Sales Head, and Admin accounts.
- Dashboard summaries and an RFQ register with search, status filters, and responsive cards on smaller screens.
- Create RFQs and edit an assigned RFQ while it is still estimating and has no submitted quote.
- Calculate part costs for several batch volumes using fixed formulas. AI is not used for price calculations.
- Maintain effective-dated material and machine rates, and save a rate snapshot with each quote.
- Require Sales Head review when the calculated annual value is greater than ₹25,00,000.
- Search seeded historical quote records and view generated quotation PDFs.
- Extract fields from pasted RFQ text with Gemini when configured, or use the local heuristic parser.
- Admin tools for creating users, changing other users' roles, and viewing audit records.

The application includes synthetic sample user, customer, RFQ, rate, and historical quote data. It is a prototype, not a production system.

## Technology

- React, TypeScript, Vite, Tailwind CSS
- Node.js, Express, TypeScript
- Prisma ORM with SQLite for local development and tests, plus a separate PostgreSQL schema and migration for PostgreSQL deployments
- Vitest and Supertest
- PDFKit for quotation PDFs
- Optional Google Gemini API integration for text extraction

## Project layout

```text
client/       React application
server/       Express API and tests
prisma/       SQLite and PostgreSQL Prisma schemas and migrations
README.md     Project and local run instructions
TDD.md        Technical design document
deployment.md Local setup and operations guide
```

## Run locally

Use Node.js 18 or later and npm. From PowerShell in the project folder:

```powershell
npm --prefix server ci
npm --prefix client ci
Copy-Item .env.example server\.env
```

Edit `server\.env` and set a unique random `JWT_SECRET`, a `DATABASE_URL` for the database you intend to use, and a private `DEMO_USER_PASSWORD` of at least 12 characters for local seed accounts. PostgreSQL URLs select the PostgreSQL Prisma client; `file:` URLs select the original SQLite client. See [deployment.md](./deployment.md) for database setup and start commands.

Generate both database clients before building or starting the server after a fresh install or schema change:

```powershell
npm --prefix server run prisma:generate:all
```

Stop any running server process before regenerating Prisma clients.

For a new local SQLite database only, keep `DATABASE_URL` set to a SQLite `file:` URL before generating the SQLite schema or loading demo data:

```powershell
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
npm --prefix server run seed
```

These commands are not needed for a database that is already set up. The SQLite schema and migrations remain under `prisma/`; the PostgreSQL schema and migrations are separate under `prisma/postgresql/`. Back up any database you need to keep before running schema or seed commands. Never run SQLite `prisma:push` or `seed` against the migrated PostgreSQL database.

The row-preserving `prisma:labour-migration` command applies only to the original SQLite schema. The separate PostgreSQL schema includes the labour-rate index in its initial migration. Do not run the SQLite migration command against a PostgreSQL URL.

For a PostgreSQL database, set `DATABASE_URL` to its PostgreSQL connection URL, generate both Prisma clients, then deploy the PostgreSQL migration:

```powershell
npm --prefix server run prisma:generate:all
npm --prefix server run prisma:migrate:deploy:postgres
```

The PostgreSQL migration command targets only the schema and migration history under `prisma/postgresql/`. The repository does not include a database file or a live database connection string.

Open two terminals in the project folder:

```powershell
npm --prefix server run dev
```

```powershell
npm --prefix client run dev
```

Then open `http://localhost:5173`. The API health check is at `http://localhost:5000/api/health`.

## Local sample accounts

The seed script creates these local sample users. The password is the private value you set in `DEMO_USER_PASSWORD` in `server\.env`.

| Role | Email |
|---|---|
| Estimator | `estimator@example.invalid` |
| Sales Head | `saleshead@example.invalid` |
| Admin | `admin@example.invalid` |

These accounts and records are for a local disposable database only. Do not use the seed script or sample credentials with production data.

## Main workflow

1. An Estimator signs in and creates an RFQ or edits an eligible assigned RFQ.
2. The Estimator enters part and routing details manually or reviews suggestions from RFQ text extraction.
3. The application calculates the costs at each configured volume and saves the values with a snapshot of the rates.
4. The server compares the annual pre-GST quotation value with ₹25,00,000. Quotes above the threshold enter `PENDING_APPROVAL`; quotes at or below it are sent without Sales Head review.
5. Only a Sales Head can approve or reject an eligible pending quote. Approval releases it to the customer workflow; rejection requires a reason and returns its RFQ to `ESTIMATING`.
6. RFQ status transitions: `ESTIMATING` → `SENT` directly for a quote at or below the threshold; `ESTIMATING` → `PENDING_APPROVAL` → `SENT` after approval for a quote above it; rejection returns the RFQ to `ESTIMATING`. A Sent RFQ can become `WON` or `LOST`; those outcomes are final. Only an Estimator may record Won/Lost, and only for a Sent RFQ.
7. Dashboard counts come from RFQ and quote records independently. Approval-pending counts match the approval queue; the RFQ Pending Approval filter includes RFQs with a genuinely eligible pending quote.
8. Authorized users can preview a generated quote PDF. Sales Heads can update material and machine rate versions.
9. Users with access can search seeded past quote records. Admins can manage user roles, read quotation details, and inspect audit records; Admin does not have approval-decision permission.

The current application records quote release as a workflow state; it does not send email or otherwise dispatch a quotation to a customer.

```text
RFQ:   ESTIMATING ──(≤ ₹25L)──────────────────> SENT ──> WON or LOST
       ESTIMATING ──(> ₹25L)──> PENDING_APPROVAL ──approve──> SENT
                                      └──reject──> ESTIMATING

Quote: DRAFT ──(≤ ₹25L)────────────────────────> SENT
       DRAFT ──(> ₹25L)──> PENDING_APPROVAL ──approve──> APPROVED
                                      └──reject──> REJECTED
```

For approval-based release, the quote remains `APPROVED` with its approver and timestamp; its RFQ is `SENT`. The dashboard distinguishes approved quotes from released quotes using the saved quote status and approval metadata.

## Tests and builds

```powershell
npm --prefix client run build
npm --prefix server run build
npm --prefix server test
```

The server test suite covers costing calculations and API behavior, including authentication, role boundaries, quote submission, approval rules, user management, rate versioning, RFQ workflows, and PDF generation. There is no separate client test script in the current project. API tests use the configured database and can create and remove records; run them only against a disposable, seeded test database. Do not point the test suite at a database containing data you need.

See [deployment.md](./deployment.md#build-and-test) for PowerShell commands that create a uniquely named disposable SQLite test database before running the API tests.

To test a real Gemini API connection independently of RFQ extraction, configure `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in `server\.env`, then run:

```powershell
npm --prefix server run test:gemini
```

This sends a fixed, non-customer test prompt directly to Gemini. It does not use the local extraction fallback.

## Screenshots

No screenshot files are included in this repository. Screenshots can be captured locally after starting the application.

## Known limitations

- The application has not been deployed; it is intended to run locally.
- Login uses a bearer token in browser `localStorage`, rather than an HttpOnly cookie.
- Gemini is optional. Only use it with information that is authorized for external processing; the text scrubber does not remove every possible customer or drawing identifier.
- Spreadsheet import is not available in the user interface. Historical search works with records already stored in the database.
- Admin user management supports account creation and role changes, but not account deactivation or password reset.
- The editable RFQ form updates the primary part only, and is restricted to estimating RFQs with no submitted quote.
- The sample data and credentials are not suitable for production use.
