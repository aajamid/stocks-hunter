"use client"

import { useEffect, useState } from "react"

import { ErrorBanner } from "@/components/common/ErrorBanner"
import { LoadingState } from "@/components/common/LoadingState"
import { ScenarioPanel } from "@/components/dashboard/ScenarioPanel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { defaultScenario } from "@/lib/scoring"
import type { ScenarioConfig } from "@/lib/types"

type ScenarioRecord = {
  id: number
  name: string
  config: ScenarioConfig
  created_at: string
  updated_at: string
}

export function ScenarioLibraryPage() {
  const [scenario, setScenario] = useState<ScenarioConfig>(defaultScenario)
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([])
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const fetchScenarios = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/scenarios")
      if (!response.ok) throw new Error("Failed to load scenarios.")
      const payload = await response.json()
      if (payload.warning) setWarning(payload.warning)
      const normalized = (payload.scenarios ?? []).map((item: ScenarioRecord) => {
        const config =
          typeof item.config === "string" ? JSON.parse(item.config) : item.config
        return { ...item, config }
      })
      setScenarios(normalized)
    } catch (err) {
      console.error(err)
      setError("Failed to load scenarios.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScenarios()
  }, [])

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      setLoading(true)
      const response = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config: scenario }),
      })
      if (!response.ok) throw new Error("Failed to save scenario.")
      setName("")
      await fetchScenarios()
    } catch (err) {
      console.error(err)
      setError("Failed to save scenario.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setLoading(true)
      const response = await fetch("/api/scenarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) throw new Error("Failed to delete scenario.")
      await fetchScenarios()
    } catch (err) {
      console.error(err)
      setError("Failed to delete scenario.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <ScenarioPanel scenario={scenario} onChange={setScenario} />
        <Card className="border-border/70 bg-card/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Save Scenario
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Scenario name"
            />
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Saved Scenarios
              </p>
              <h3 className="text-lg font-semibold">Scenario library</h3>
            </div>
            <Button size="sm" variant="secondary" onClick={fetchScenarios}>
              Refresh
            </Button>
          </div>
          {warning ? (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {warning}
            </div>
          ) : null}
          {error ? <ErrorBanner message={error} /> : null}
          {loading && scenarios.length === 0 ? (
            <LoadingState />
          ) : scenarios.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No scenarios saved yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {scenarios.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(item.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setScenario(item.config)}
                    >
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
