import type { ScenarioConfig, ScreenerRow, ScreenerRowScored } from "@/lib/types"

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const mean = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, v) => sum + v, 0) / values.length

const stdDev = (values: number[], avg: number) => {
  if (values.length === 0) return 0
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  return Math.sqrt(variance)
}

const zScore = (value: number, avg: number, std: number) =>
  std === 0 ? 0 : (value - avg) / std

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

export function applyScenarioDefaults(
  config?: Partial<ScenarioConfig>
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
  config?: Partial<ScenarioConfig>
): ScreenerRowScored[] {
  const scenario = applyScenarioDefaults(config)

  const momentumValues = rows
    .map((row) => row.avg_momentum_5d)
    .filter((v): v is number => typeof v === "number")
  const volatilityValues = rows
    .map((row) => row.avg_volatility_5d)
    .filter((v): v is number => typeof v === "number")
  const volumeSpikeValues = rows
    .map((row) => row.avg_volume_spike_ratio)
    .filter((v): v is number => typeof v === "number")
  const intradayValues = rows
    .map((row) => row.avg_intraday_strength)
    .filter((v): v is number => typeof v === "number")

  const momentumAvg = mean(momentumValues)
  const momentumStd = stdDev(momentumValues, momentumAvg)
  const volatilityAvg = mean(volatilityValues)
  const volatilityStd = stdDev(volatilityValues, volatilityAvg)
  const volumeSpikeAvg = mean(volumeSpikeValues)
  const volumeSpikeStd = stdDev(volumeSpikeValues, volumeSpikeAvg)
  const intradayAvg = mean(intradayValues)
  const intradayStd = stdDev(intradayValues, intradayAvg)

  return rows.map((row) => {
    const base = 5

    const momentumZ =
      typeof row.avg_momentum_5d === "number"
        ? zScore(row.avg_momentum_5d, momentumAvg, momentumStd)
        : 0
    const momentumComponent =
      clamp(momentumZ, -2, 2) * scenario.weights.momentum

    const fractionUp =
      typeof row.fraction_up === "number" ? row.fraction_up : 0.5
    const directionComponent =
      clamp((fractionUp - 0.5) * 3, -1.5, 1.5) *
      scenario.weights.direction

    const volatilityZ =
      typeof row.avg_volatility_5d === "number"
        ? zScore(row.avg_volatility_5d, volatilityAvg, volatilityStd)
        : 0
    const volatilityComponent =
      -clamp(volatilityZ, 0, 2) * scenario.weights.volatility

    const volumeSpikeZ =
      typeof row.avg_volume_spike_ratio === "number"
        ? zScore(row.avg_volume_spike_ratio, volumeSpikeAvg, volumeSpikeStd)
        : 0
    const volumeSpikeComponent =
      (clamp(volumeSpikeZ, 0, 2) / 2) * scenario.weights.volumeSpike

    const intradayZ =
      typeof row.avg_intraday_strength === "number"
        ? zScore(row.avg_intraday_strength, intradayAvg, intradayStd)
        : 0
    const intradayComponent =
      clamp(intradayZ, -2, 2) * 0.25 * scenario.weights.intraday

    let capPenalty = 0
    if (
      typeof scenario.thresholds.volatilityCap === "number" &&
      typeof row.avg_volatility_5d === "number" &&
      scenario.thresholds.volatilityCap > 0 &&
      row.avg_volatility_5d > scenario.thresholds.volatilityCap
    ) {
      const overage =
        (row.avg_volatility_5d - scenario.thresholds.volatilityCap) /
        scenario.thresholds.volatilityCap
      capPenalty = -clamp(overage, 0, 1) * 0.5
    }

    const total =
      base +
      momentumComponent +
      directionComponent +
      volatilityComponent +
      volumeSpikeComponent +
      intradayComponent +
      capPenalty

    const score = clamp(Number(total.toFixed(3)), 0, 10)

    return {
      ...row,
      score,
      score_components: {
        base,
        momentum: Number(momentumComponent.toFixed(3)),
        direction: Number(directionComponent.toFixed(3)),
        volatility: Number(volatilityComponent.toFixed(3)),
        volumeSpike: Number(volumeSpikeComponent.toFixed(3)),
        intraday: Number(intradayComponent.toFixed(3)),
        capPenalty: Number(capPenalty.toFixed(3)),
        total: Number(total.toFixed(3)),
      },
      score_inputs: {
        avg_momentum_5d: row.avg_momentum_5d ?? null,
        avg_volatility_5d: row.avg_volatility_5d ?? null,
        avg_volume_spike_ratio: row.avg_volume_spike_ratio ?? null,
        avg_intraday_strength: row.avg_intraday_strength ?? null,
        fraction_up: row.fraction_up ?? null,
      },
    }
  })
}
