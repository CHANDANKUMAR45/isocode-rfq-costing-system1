# Deployment & Operations Guide


---

## 1. Local Environment Setup & Execution

### System Requirements
- **Operating System**: Windows 10/11, macOS, or Linux
- **RAM**: 8 GB RAM (optimized lightweight footprint; consumes &lt; 200 MB RAM total)
- **Node.js**: v18.0.0 or higher (Tested on Node v25.2.1)
- **npm**: v9.0.0 or higher

### Environment Variables
Configure the following environment variables in `server/.env`:

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port on which the Express server listens |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `DATABASE_URL` | `"file:../prisma/dev.db"` | SQLite database connection string |
| `JWT_SECRET` | `"company-a-sample location-rfq-jwt-secret-key-2026"` | Cryptographic key used to sign and verify session JWTs |
| `GEMINI_API_KEY` | *(Optional)* | Google AI Studio free-tier Gemini API key for real AI RFQ intake |

> **Note**: If `GEMINI_API_KEY` is not provided, the system automatically runs the built-in deterministic heuristic parser without errors. Customer NDA privacy is guaranteed in both modes.

### Local Installation Commands (Step-by-Step)

1. **Install Server Dependencies**:
   ```bash
   npm --prefix server install
   ```

2. **Install Client Dependencies**:
   ```bash
   npm --prefix client install
   ```

3. **Initialize the SQLite Database**:
   ```bash
   npm --prefix server run prisma:push
   ```

4. **Seed Demo Data & 1,400 Historical Quotes**:
   ```bash
   npm --prefix server run seed
   ```

5. **Start the Application**:
   - Backend API:
     ```bash
     npm --prefix server run dev
     ```
   - Frontend Client:
     ```bash
     npm --prefix client run dev
     ```

6. **Access Application**:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000/api/health`

---

## 2. Demo User Credentials

The application includes an instant **one-click Role Switcher** in the top navigation bar. You may also log in manually:

| Role | Email | Password | Intended Workflow |
| :--- | :--- | :--- | :--- |
| **Estimator** | `estimator@example.invalid` | `[REDACTED_DEMO_PASSWORD]` | Create RFQs, run costing calculations, submit quotes for approval |
| **Sales Head** | `saleshead@example.invalid` | `[REDACTED_DEMO_PASSWORD]` | Review & approve/reject quotes over ₹25 Lakhs, version rate masters |
| **Admin** | `admin@example.invalid` | `[REDACTED_DEMO_PASSWORD]` | Full system audit and rate configuration |

---

## 3. Production Deployment Guide (Free-Tier Compatible)

To deploy the application to free cloud hosting (e.g., Render, Railway, or Fly.io):

### Architecture in Production
- **Frontend**: Static site build deployed to Vercel / Netlify / Render Static (`npm --prefix client run build`, output: `client/dist`).
- **Backend**: Container or Node.js web service running on Render / Railway free tier.
- **Database**:
  - For single-instance deployment: Persistent SQLite disk (`DATABASE_URL="file:/data/app.db"`).
  - For distributed multi-instance deployment: Point Prisma to Supabase or Neon free-tier PostgreSQL by setting `provider = "postgresql"` in `prisma/schema.prisma`.

### Build Commands for Production
```bash
# Build frontend
cd client && npm install && npm run build

# Build backend
cd ../server && npm install && npm run build

# Start backend in production
npm start
```

---

## 4. Verification & Testing

To execute the automated test suite:
```bash
npm --prefix server test
```

### Test Coverage Checklist:
- [x] Material gross weight, scrap factor & credit calculation
- [x] Machine cycle time & hourly rate calculations
- [x] Setup time amortization across multiple production volumes
- [x] Overheads, packing, freight & margin percentages
- [x] 18% GST separation
- [x] Automated ₹25 Lakhs annual value approval trigger
- [x] Effective-dated rate masters with start/end windows
- [x] Immutable rate snapshot generation
- [x] Role-based access control (RBAC) enforcement
- [x] Customer NDA data scrubber
- [x] Real/Heuristic AI RFQ extraction
- [x] Search across 1,400 historical quotes
- [x] Binary PDF quotation document generation
