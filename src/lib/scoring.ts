import type { ScenarioConfig, ScreenerRow, ScreenerRowScored } from "@/lib/types"

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const defaultScenario: ScenarioConfig = {
  weights: {
    momentum: 1,
    direction: 1,
    volatility: 1,
    volumeSpike: 1,
    intraday: 1,
  },
  thresholds: {
    volatilityCap: undefined,
  },
}

type ScenarioConfigInput = {
  weights?: Partial<ScenarioConfig["weights"]>
  thresholds?: Partial<ScenarioConfig["thresholds"]>
}

export function applyScenarioDefaults(
  config?: ScenarioConfigInput
): ScenarioConfig {
  return {
    weights: {
      momentum: config?.weights?.momentum ?? defaultScenario.weights.momentum,
      direction: config?.weights?.direction ?? defaultScenario.weights.direction,
      volatility:
        config?.weights?.volatility ?? defaultScenario.weights.volatility,
      volumeSpike:
        config?.weights?.volumeSpike ?? defaultScenario.weights.volumeSpike,
      intraday: config?.weights?.intraday ?? defaultScenario.weights.intraday,
    },
    thresholds: {
      volatilityCap:
        config?.thresholds?.volatilityCap ??
        defaultScenario.thresholds.volatilityCap,
    },
  }
}

export function scoreRows(
  rows: ScreenerRow[],
  _config?: ScenarioConfigInput,
  rangeDays: 14 | 21 | 28 = 28
): ScreenerRowScored[] {
  const safeRangeDays = [14, 21, 28].includes(rangeDays) ? rangeDays : 28
  const pointPerDay = 100 / safeRangeDays

  return rows.map((row) => {
    const upDays =
      typeof row.up_days === "number" && Number.isFinite(row.up_days)
        ? row.up_days
        : 0
    const downDays =
      typeof row.down_days === "number" && Number.isFinite(row.down_days)
        ? row.down_days
        : 0
    const netDirectionDays =
      typeof row.net_direction_days === "number" &&
      Number.isFinite(row.net_direction_days)
        ? row.net_direction_days
        : upDays - downDays

    const upScore = upDays * pointPerDay
    const downPenalty = downDays * pointPerDay
    const downScore = -downPenalty
    const total = 100 + downScore
    const score = clamp(Number(total.toFixed(3)), 0, 100)

    return {
      ...row,
      score,
      score_components: {
        pointPerDay: Number(pointPerDay.toFixed(3)),
        upScore: Number(upScore.toFixed(3)),
        downScore: Number(downScore.toFixed(3)),
        netDirectionDays,
        total: Number(total.toFixed(3)),
      },
      score_inputs: {
        rangeDays: safeRangeDays,
        upDays,
        downDays,
        netDirectionDays,
      },
    }
  })
}
