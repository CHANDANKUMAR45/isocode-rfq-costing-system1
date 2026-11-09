# Local Setup Guide

This guide covers running the application on a development computer. The project is not deployed to a live hosting service.

## Required software

- Windows, macOS, or Linux
- Node.js 18 or later
- npm

The application supports PostgreSQL databases, including Supabase-hosted PostgreSQL. SQLite is available for local development and tests.

## Install dependencies

Open a terminal in the project root and install the locked server and client dependencies:

```powershell
npm --prefix server ci
npm --prefix client ci
```

## Configure the server

Copy the example environment file:

```powershell
Copy-Item .env.example server\.env
```

Edit `server\.env` before starting the server.

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | No | API port; defaults to `5000` in the application. |
| `NODE_ENV` | No | Runtime mode. Use `development` for local work. |
| `DATABASE_URL` | Yes | Prisma URL. A PostgreSQL URL selects the PostgreSQL client; a `file:` URL selects the SQLite client. The checked-in example uses SQLite. |
| `JWT_SECRET` | Yes | Private signing secret. Set a unique random value of at least 32 bytes. There is no default secret. |
| `GEMINI_API_KEY` | No | Optional key for Google Gemini text extraction. Leave blank to use local heuristics. |
| `GEMINI_MODEL` | No | Gemini model used by the direct connection check. Defaults to `gemini-3.6-flash` if unset. |
| `DEMO_USER_PASSWORD` | Required for seeding and API tests | Private password of at least 12 characters used for local sample accounts. Do not use it for production accounts. |

To print a random secret in PowerShell using the installed Node.js runtime:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copy the generated value into `server\.env`. Do not add a real secret or API key to Git. Only send RFQ text to Gemini when its use is allowed by your data-handling requirements; the scrubber cannot remove all possible identifying details.

## Set up a new local database

The repository does not include the local SQLite database. For a fresh local SQLite setup, set `DATABASE_URL` to a `file:` URL in `server\.env`, then run:

```powershell
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
npm --prefix server run seed
```

These commands create/update the SQLite schema and add sample demo data. They are not needed if your database is already initialized. Never run these SQLite `prisma:push` or `seed` commands while `DATABASE_URL` points to PostgreSQL. Do not run them against a database containing data you need without first making a backup.

Existing SQLite databases created before labour rate versioning need the row-preserving migration before multiple versions of one labour category can be saved. Back up the database, confirm `DATABASE_URL` is a `file:` URL, then run:

```powershell
npm --prefix server run prisma:labour-migration
```

The command runs the checked-in SQLite migration in a transaction. The PostgreSQL schema and migration history are separate under `prisma/postgresql/`; the PostgreSQL initial migration already includes the labour-rate index. Never use the SQLite migration command for PostgreSQL.

Generate both Prisma clients after a fresh install or schema change, with the API stopped:

```powershell
npm --prefix server run prisma:generate:all
```

## Start the application

Open one terminal for the API:

```powershell
npm --prefix server run dev
```

Open a second terminal for the client:

```powershell
npm --prefix client run dev
```

Open `http://localhost:5173`. Check the API at `http://localhost:5000/api/health`.

## Demo login

After setting `DEMO_USER_PASSWORD` in `server\.env` and running the seed command on a disposable local database, sign in with one of these sample accounts. Enter the password you set locally.

| Role | Email |
|---|---|
| Estimator | `estimator@example.invalid` |
| Sales Head | `saleshead@example.invalid` |
| Admin | `admin@example.invalid` |

These users and passwords are for a local demonstration database only. Do not use the seed accounts in a deployed environment.

## Build and test

Run the production builds and server tests from the project root:

```powershell
npm --prefix client run build
npm --prefix server run build
npm --prefix server test
```

There is no dedicated client test script configured at present. The API tests use the configured database and can create and remove records. Run them only against a disposable, seeded test database; do not point them at a database containing data you need.

To prepare a fresh, uniquely named SQLite database for the API tests, run these commands from the project root in PowerShell. The generated filename is ignored by Git; do not substitute a database file containing data you need.

```powershell
$env:DATABASE_URL = "file:../prisma/test-$([guid]::NewGuid().ToString('N')).db"
$env:DEMO_USER_PASSWORD = Read-Host "Enter a unique sample-user password (12 or more characters)"
npm --prefix server run prisma:generate
npm --prefix server run prisma:push
npm --prefix server run seed
npm --prefix server test
```

Keep the same shell and environment variables for the commands in this block so the seed and tests use the disposable database. Do not use the test database URL for normal app data.

## Check the Gemini API connection

Set `GEMINI_API_KEY` in `server\.env`. Optionally set `GEMINI_MODEL` to a model available to your API key. From the project root, run:

```powershell
npm --prefix server run test:gemini
```

This command sends only the fixed prompt `Reply with exactly: GEMINI_CONNECTION_SUCCESS` directly to the configured Gemini model using `generateContent`. It does not call RFQ extraction or its local heuristic fallback, and it does not print the API key. A successful response must match the requested text exactly. Failures report a category such as authentication/permission, rate limit, model not found, invalid request, server error, or network/timeout. The Gemini service may incur API usage under your Google account.

## Deployment status

No hosted deployment is configured or verified. Before a production deployment, configure HTTPS, a restricted CORS origin, secure secret storage, a production database and backups, and a reviewed AI data-processing policy. The current local setup is not a production deployment recipe.
