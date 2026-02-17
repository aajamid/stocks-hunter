# Saudi Stocks Hunter

Production-grade Saudi equity screener and scenario testing app built with Next.js App Router, TypeScript, TailwindCSS, shadcn/ui, Recharts, and PostgreSQL.

## Features

- Dark-first dashboard with filters (date range, company, symbol, sector, market, active-only)
- Per-symbol aggregation (latest close, avg return, momentum, volatility, score)
- Score explanation and scenario testing with live recalculation
- Detail page with price/volume + indicator charts and summary stats
- CSV export for the screener
- Scenario library backed by `app_scenarios` (optional)
- Graceful handling of missing columns

## Tech Stack

- Next.js 16 App Router + TypeScript
- TailwindCSS v4 + shadcn/ui
- Recharts
- node-postgres (`pg`)
- Zod for validation

## Prerequisites

- Node.js 18+ (recommended 20+)
- PostgreSQL 13+

## Environment Setup

Create `.env.local` with your Postgres URL:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
AUTH_SESSION_COOKIE_NAME=stocks_hunter_session
AUTH_CSRF_COOKIE_NAME=stocks_hunter_csrf
AUTH_SESSION_TTL_HOURS=24
AUTH_BCRYPT_ROUNDS=12
AUTH_TOKEN_PEPPER=replace-with-a-long-random-secret
AUTH_COOKIE_SECURE=true
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-now
ADMIN_NAME=Platform Admin
```

See `.env.example` for reference.

## Auth + RBAC (v1.1)

This version adds server-side authentication and role-based access control (RBAC) with secure session cookies.

### Authentication

- Login: `POST /api/auth/login`
- Logout: `POST /api/auth/logout`
- Current user: `GET /api/auth/me`
- Passwords are hashed with bcrypt (`bcryptjs`) and never stored in plaintext.
- Session tokens are random, hashed in DB, and stored in secure HttpOnly cookies.
- Origin checks are enforced on mutating endpoints.
- Login attempts are rate-limited in-memory per `(ip,email)` window.

### Role Model

Default roles:

- `ADMIN`: full access (`admin:*` + investment permissions)
- `MANAGER`: investment read/write
- `ANALYST`: investment read/write
- `VIEWER`: investment read only

Default permissions:

- `investments:read`
- `investments:write`
- `admin:users:read`
- `admin:users:manage`
- `admin:roles:read`
- `admin:roles:manage`
- `admin:permissions:read`
- `admin:audit:read`
- `admin:all`

### Protected Areas

- Page routes are protected by `middleware.ts` and redirect unauthenticated users to `/login`.
- API routes enforce auth + permissions server-side (`requireAuth`, `requirePermission`).
- Admin UI is available at `/admin` and only shown for admin-capable users.

### DB Migrations + Seed

Run migrations:

```
npm run db:migrate
```

Rollback last migration:

```
npm run db:migrate:down
```

Seed default roles/permissions and initial admin user from env:

```
npm run db:seed:auth
```

Migration files:

- `db/migrations/001_auth_rbac_v11.up.sql`
- `db/migrations/001_auth_rbac_v11.down.sql`

Seed script:

- `scripts/seed-auth.ts`

## Run Locally

```
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Production Build

```
npm run build
npm run start
```

## Data Coverage Guard

The API now runs a daily coverage check (cached for 24 hours) to ensure active symbols have data for the last 28 Saudi business days in `public.gold_saudi_equity_daily_features`.

- If gaps are detected, it attempts a backfill from `public.saudi_equity_ohlcv_daily` for missing `(symbol, trade_date)` rows in that window.
- The check runs automatically on:
  - `GET /api/screener`
  - `GET /api/symbol/[symbol]`
- It logs warnings if coverage remains incomplete after backfill.

## Database Tables

Expected tables (schema: `public`):

- `gold_saudi_equity_daily_features`
  - Required columns: `symbol`, `trade_date`
  - Optional columns used if present: `close`, `adjusted_close`, `volume`, `turnover`,
    `daily_return`, `momentum_5d`, `volatility_5d`, `volume_spike_ratio`,
    `intraday_strength`, `direction_signal`
- `saudi_equity_symbols`
  - Required columns: `symbol`
  - Optional columns used if present: `name_en`, `name_ar`, `market`, `sector`, `is_active`

### Verify Tables

```
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gold_saudi_equity_daily_features';
```

```
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'saudi_equity_symbols';
```

### Scenario Table (Optional)

Create the `app_scenarios` table if you want scenario persistence:

```
CREATE TABLE IF NOT EXISTS public.app_scenarios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

- `GET /api/symbols`
- `GET /api/screener`
- `GET /api/symbol/[symbol]`
- `GET/POST/PUT/DELETE /api/scenarios`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET/POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET/POST /api/admin/roles`
- `PATCH /api/admin/roles/:id`
- `GET /api/admin/permissions`
- `POST /api/admin/role-assign`
- `POST /api/admin/role-permissions`
- `GET /api/admin/audit-logs`

## Notes

- All SQL queries are parameterized.
- Scoring uses a 0–10 normalized model with configurable weights and thresholds.
- Missing feature columns are detected and reported in the UI.
## Scoring Calculation

Scores are computed per symbol in `src/lib/scoring.ts` using day-by-day price direction.

```
pointPerDay = 100 / rangeDays
  where rangeDays is one of: 14, 21, 28

for each day in the selected range:
  if close_t > close_(t-1): add pointPerDay
  if close_t < close_(t-1): deduct pointPerDay
  if close_t = close_(t-1): add 0

raw_total = (upDays * pointPerDay) - (downDays * pointPerDay)
score = clamp(round(raw_total, 3), -100, 100)
```

Defaults:

- Default range: `28` business days
- Example:
  - 14-day range => `pointPerDay ≈ 7.143`
  - 21-day range => `pointPerDay ≈ 4.762`
  - 28-day range => `pointPerDay ≈ 3.571`

## Scoring Tests

Run scoring unit tests:

```
npm run test:scoring
```
