"use client"

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { defaultScenario } from "@/lib/scoring"
import type { ScenarioConfig } from "@/lib/types"

type ScenarioPanelProps = {
  scenario: ScenarioConfig
  onChange: (scenario: ScenarioConfig) => void
  onSave?: () => void
}

const weightConfigs = [
  { key: "momentum", label: "Momentum impact" },
  { key: "direction", label: "Direction consistency" },
  { key: "volatility", label: "Volatility penalty" },
  { key: "volumeSpike", label: "Volume spike bonus" },
  { key: "intraday", label: "Intraday strength" },
] as const

export function ScenarioPanel({ scenario, onChange, onSave }: ScenarioPanelProps) {
  const handleWeightChange = (key: (typeof weightConfigs)[number]["key"], value: number) => {
    onChange({
      ...scenario,
      weights: { ...scenario.weights, [key]: value },
    })
  }

  const handleVolatilityCap = (value: string) => {
    const parsed = value === "" ? undefined : Number(value)
    onChange({
      ...scenario,
      thresholds: {
        ...scenario.thresholds,
        volatilityCap: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
      },
    })
  }

  const hasChanges = useMemo(() => {
    return JSON.stringify(scenario) !== JSON.stringify(defaultScenario)
  }, [scenario])

  return (
    <Card className="flex flex-col gap-4 border-border/70 bg-card/60 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Scenario Testing
          </p>
          <h3 className="text-lg font-semibold">Score Weights</h3>
        </div>
        <div className="flex items-center gap-2">
          {onSave ? (
            <Button size="xs" variant="secondary" onClick={onSave}>
              Save
            </Button>
          ) : null}
          <Button
            size="xs"
            variant="ghost"
            disabled={!hasChanges}
            onClick={() => onChange(defaultScenario)}
          >
            Reset
          </Button>
        </div>
      </div>
      <div className="space-y-4">
        {weightConfigs.map((config) => (
          <div key={config.key} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{config.label}</span>
              <span className="font-medium">
                {scenario.weights[config.key].toFixed(2)}
              </span>
            </div>
            <Slider
              value={[scenario.weights[config.key]]}
              min={0}
              max={2}
              step={0.05}
              aria-label={config.label}
              onValueChange={(value) => handleWeightChange(config.key, value[0])}
            />
          </div>
        ))}
      </div>
      <Separator />
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Volatility cap (optional)</p>
        <Input
          type="number"
          step="0.001"
          min="0.0001"
          aria-label="Volatility cap"
          value={scenario.thresholds.volatilityCap ?? ""}
          onChange={(event) => handleVolatilityCap(event.target.value)}
          placeholder="e.g. 0.025"
        />
      </div>
    </Card>
  )
}
