
## 1. Project overview

This project is a web application for recording manufacturing RFQs, estimating the cost of a part at several production volumes, and managing quote review. The application includes illustrative sample records for local development.

The application separates the deterministic costing calculation from RFQ text extraction. Extracted suggestions can help enter details, but do not calculate prices or approve quotes.

## 2. Problem understanding

An estimator receives part, material, quantity, and drawing information and must prepare a quotation using rates and machining operations. Re-entering those values from different records can introduce mistakes. Older quotations can also be difficult to find, and higher-value quotations need a clear approval step.

The application brings these steps into one workflow: register an RFQ, record part details, calculate a quotation, retain the rates used, and route quotations above the annual value threshold to a Sales Head.

## 3. Solution approach

The user interface is a React application and the server is an Express REST API. The API reads and writes data through Prisma to SQLite or PostgreSQL, selected at runtime by the `DATABASE_URL` protocol. SQLite is used for local development and tests; PostgreSQL has its own schema and migration history. The costing engine is a server-side TypeScript module. Rate snapshots and audit events are stored with quotation and administrative operations.

The application has three roles: Estimator, Sales Head, and Admin. The server checks the current database role on protected requests; frontend permission checks only control what is shown in the interface.

## 4. Technology choices and reasons

- **React and TypeScript** provide a component-based user interface with compile-time checks.
- **Vite** runs the development client and builds its static files.
- **Tailwind CSS** provides the responsive layout and shared utility styles already used by the screens.
- **Node.js, Express, and TypeScript** provide the API and server-side validation.
- **Prisma, SQLite, and PostgreSQL** support lightweight local development and a separate PostgreSQL deployment configuration.
- **Vitest and Supertest** test calculation logic and HTTP routes.
- **PDFKit** generates quotation PDFs on the server.
- **Google Generative AI client** is optional for extraction. If no key is set or an AI request fails, a local heuristic parser is used.

## 5. System architecture

```text
Browser
  React + TypeScript + Vite
       | JSON requests with bearer token
       v
  Express API
  - JWT authentication and database-backed role checks
  - RFQ, costing, rates, approval, history, AI and PDF routes
       | Prisma (database selected by DATABASE_URL)
       +------------------+
       v                  v
  SQLite database   PostgreSQL database
```

In development, Vite serves the client on port 5173 and the API normally listens on port 5000. A `file:` `DATABASE_URL` selects the SQLite client; a `postgres://` or `postgresql://` URL selects the separately generated PostgreSQL client. Other protocols are rejected. `JWT_SECRET` is required by the server.

## 6. Database design

The SQLite schema is in `prisma/schema.prisma`; the PostgreSQL schema and its independent migration history are in `prisma/postgresql/`. The schemas represent the same application models. They include:

- `User`, with email, password hash, and role.
- `Customer` and `RFQ`, with assigned estimator, dates, status, and notes.
- `Part` and `PartOperation`, for engineering details and routing.
- `MaterialRate`, `MachineRate`, and `LabourRate`, for costing inputs and effective dates.
- `Quote` and `QuoteVolumeTier`, for a quotation and its calculated volume rows.
- `QuoteRateSnapshot`, for the serialized rates captured for a quote.
- `AiExtraction`, for extraction status and structured extracted values.
- `HistoricalQuote`, for searchable sample past quotations.
- `AuditLog`, for user, RFQ, quote, rate, and approval activity.

The role is stored as a string and accepted values are checked by application code. The current schema already includes approval identity, timestamp, rejection reason, and audit fields, so no additional schema change was needed for the RBAC work.

## 7. Main application workflows

### RFQ entry and editing

An Estimator can create an RFQ with a customer, due date, notes, and primary part details. The assigned Estimator may edit the RFQ and its primary part while its status is `ESTIMATING` and it has no submitted quote. The RFQ number and assignment are not editable through this action. The server rejects edits by other roles or to RFQs outside those conditions.

### Quote preparation

The Estimator selects a part, enters rate and operation inputs, and can request a preview calculation. On submission, the server recalculates the quote, writes quote tiers and a rate snapshot, updates the RFQ when approval is required, and records an audit event.

### Review

A quote that exceeds the annual value limit enters `PENDING_APPROVAL`. A Sales Head can approve or reject it once. A rejection must include a reason. The decision, reviewer, timestamp, prior status, and new status are recorded. An Admin can view administrative audit records but cannot approve or reject quotations.

### Historical search and PDF

Authorized users can search the seeded historical quote records. The API can generate a PDF for an authorized quote. PDFs are generated on request and are not saved as files in the repository.

## 8. RFQ intake and AI extraction

The AI intake screen accepts pasted RFQ text with a selected source type. When `GEMINI_API_KEY` is configured, the server sends text after applying the current email, phone-number, and selected confidentiality-phrase scrubber. If the key is not configured or the service fails, a local regular-expression and keyword parser provides suggestions.

The response includes values, source snippets, confidence information, and suggested operations. The Estimator must review the suggestions. The costing engine does not use AI to produce prices. Stored extraction records omit the original raw text and source snippets.

The scrubber does not identify every company name, drawing number, or proprietary detail. For this reason, only submit information that is authorized for the configured external service. The offline parser is the appropriate choice for restricted input.

## 9. Costing calculation logic

The server-side calculation is in `server/src/services/costingEngine.ts`. For each volume tier, it calculates:

1. Gross material cost = gross weight × material rate per kilogram.
2. Scrap credit = non-negative scrap weight × scrap recovery rate.
3. Net material cost = gross material cost less scrap credit, with a non-negative floor.
4. For each operation, setup minutes are divided by that tier's batch volume and added to cycle minutes. Machine and labour costs use the resulting time and their hourly rates.
5. Direct cost combines net material, machining, and labour cost.
6. Overhead, packing, and freight are added to produce base cost.
7. Ex-GST selling price is calculated from base cost and margin. GST and inclusive price are then shown separately.
8. Annual value uses the tier's ex-GST unit price and the RFQ's annual volume. The highest value across the tiers is compared with ₹25,00,000.

The approval comparison is strictly greater than ₹25,00,000. The calculation does not call an AI service.

## 10. Rate master and effective dates

Material and machine rates are versioned with effective start and optional end dates. The active-rate endpoint returns the version effective on the current date. New rate versions close an existing open-ended version for the same code. Quote snapshots keep the values supplied for the calculation so later rate changes do not rewrite the saved snapshot.

Rate master write endpoints are restricted to Sales Head and Admin. The current user interface supports material and machine changes; labour rates can be read but do not have a write screen.

## 11. Approval workflow

Only a Sales Head may approve or reject a quote. Both decisions require the quote to be pending, marked as requiring approval, and above ₹25,00,000 annual value. A conditional update prevents two concurrent reviews from both succeeding. Rejection requires a reason. Approval and rejection update the related RFQ and create an audit record in a database transaction.

An Admin does not receive approval-decision permission. Quotes at or below the threshold do not enter this review queue.

## 12. Authentication and role permissions

Login verifies a password hash and issues a signed JWT. The browser stores the bearer token in `localStorage`; on protected API requests the server verifies the token and fetches the user's current role from the database.

| Capability | Estimator | Sales Head | Admin |
|---|---:|---:|---:|
| View assigned/all RFQs | Assigned | Yes | Yes |
| Create and edit eligible RFQs | Yes | No | No |
| Cost and submit quotes | Yes | No | No |
| View rate masters | Yes | Yes | Yes |
| Change material/machine rates | No | Yes | Yes |
| Review pending quotations | No | Yes | View only |
| Approve or reject eligible quotes | No | Yes | No |
| Use AI intake | Yes | No | No |
| Search historical quotes | Yes | Yes | Yes |
| Generate quote PDFs | Own quotes | Yes | No |
| Manage users and roles | No | No | Yes |
| Read audit records | No | Approval history | Yes |

These API permissions are authoritative. Hiding a link or button in the client does not grant or revoke server access.

## 13. API overview

All protected routes use the bearer token returned by login, except `POST /api/auth/login` and `GET /api/health`.

| Route group | Purpose |
|---|---|
| `/api/auth` | Login and current-user profile |
| `/api/dashboard` | RFQ and quote summary counts |
| `/api/rfqs` | List, read, create, edit eligible details, and update allowed statuses |
| `/api/costing` | Calculate, save, and read quotes |
| `/api/rates` | Read rates and create material or machine rate versions |
| `/api/approvals` | Read pending approvals and approval history; Sales Head decisions |
| `/api/ai` | Extract RFQ fields and mark an assigned-RFQ extraction reviewed |
| `/api/historical` | Search and suggest historical records; restricted bulk import endpoint |
| `/api/pdf` | Generate a quote PDF |
| `/api/admin` | Admin user and role management; authorized audit-log read |

The route validation schemas accept selected fields rather than arbitrary database records. Role and ownership checks are performed using the authenticated server identity.

## 14. Testing approach and actual results

The server tests use Vitest and Supertest. They cover pure costing calculations, authentication failures, role restrictions, RFQ ownership and editing, quote submission, approval threshold and duplicate decisions, user management, and PDF generation.

Run the client build, server build, and server test suite using the commands in the README. There is no dedicated client test script. API tests use the configured database, authenticate against seeded demo accounts, and can write and remove records; use only a disposable, seeded test database. Test output should be reported for the specific run rather than treated as a permanent project result.

## 15. Important UI decisions

The RFQ list uses a table at wide desktop widths and cards at smaller widths. KPI cards use four columns on desktop, two on tablet, and one on mobile. The navbar switches to a menu on smaller screens. Costing sections stack on narrower screens and the volume matrix can scroll within its own area. Form and action buttons remain touch-sized on mobile.

Role-based links and actions are hidden in the client for clarity, but the API also checks the relevant permission.

## 16. Limitations and future improvements

- The application has not been deployed; there is no live application URL.
- Browser bearer tokens are stored in `localStorage`, not HttpOnly cookies.
- Production CORS origins, HTTPS, rate limiting, backup policy, and operational monitoring need configuration before deployment.
- AI text scrubbing is not a guarantee that every identifier or confidential engineering detail is removed.
- Spreadsheet import is not available in the user interface. The API has a restricted bulk-import endpoint, but there is no spreadsheet parser.
- Admin functions do not include account deactivation or password reset.
- RFQ editing covers the primary part only and is disabled after a quote is submitted.
- No client-side automated test suite is configured.

Potential future work includes spreadsheet import with validation, account lifecycle controls, and a production deployment review. Those items are not represented as completed features.

## 17. Local setup and deployment instructions

The project is prepared for local development; no hosted deployment is configured or verified. Local setup requires Node.js and npm, installation of the server and client dependencies, a server `.env` file with a unique `JWT_SECRET`, Prisma client generation, and a database configured with `DATABASE_URL`.

For a new local SQLite database, set a private `DEMO_USER_PASSWORD` in `server\.env`, then use `npm --prefix server run prisma:generate`, `npm --prefix server run prisma:push`, and `npm --prefix server run seed`. The SQLite labour-rate migration applies only to an existing SQLite database that needs that schema update. For PostgreSQL, generate both clients and apply the separate migration using `npm --prefix server run prisma:migrate:deploy:postgres`. Start the API with `npm --prefix server run dev` and the client with `npm --prefix client run dev`. The exact commands and environment variables are in [deployment.md](./deployment.md).

Do not run schema or seed commands against a database that contains data you need without first making a backup.
