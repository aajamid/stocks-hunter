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
## Scoring Calculation

Scores are computed per symbol in `src/lib/scoring.ts` using a base score and additive components:

```
raw_total =
  5
  + momentumComponent
  + directionComponent
  + volatilityComponent
  + volumeSpikeComponent
  + intradayComponent
  + capPenalty

score = clamp(round(raw_total, 3), 0, 10)
```

Component formulas:

- `momentumComponent = clamp(z(avg_momentum_5d), -2, 2) * weight.momentum`
- `directionComponent = clamp((fraction_up - 0.5) * 3, -1.5, 1.5) * weight.direction`
- `volatilityComponent = -clamp(z(avg_volatility_5d), 0, 2) * weight.volatility`
- `volumeSpikeComponent = (clamp(z(avg_volume_spike_ratio), 0, 2) / 2) * weight.volumeSpike`
- `intradayComponent = clamp(z(avg_intraday_strength), -2, 2) * 0.25 * weight.intraday`

Volatility cap penalty (optional):

- If `avg_volatility_5d > volatilityCap`, then:
  - `capPenalty = -clamp((avg_volatility_5d - volatilityCap) / volatilityCap, 0, 1) * 0.5`

How normalization works:

- `z(x)` is a z-score computed from the currently filtered universe:
  - `z(x) = (x - mean(filtered_values)) / stdDev(filtered_values)`
- If standard deviation is `0`, z-score is treated as `0`.

Defaults:

- Base score: `5`
- Weights: momentum `1`, direction `1`, volatility `1`, volumeSpike `1`, intraday `1`
- `volatilityCap`: disabled unless provided
