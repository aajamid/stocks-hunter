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
```

See `.env.example` for reference.

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

## Notes

- All SQL queries are parameterized.
- Scoring uses a 0–10 normalized model with configurable weights and thresholds.
- Missing feature columns are detected and reported in the UI.
