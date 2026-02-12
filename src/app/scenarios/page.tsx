import { AppShell } from "@/components/layout/AppShell"
import { ScenarioLibraryPage } from "@/components/scenarios/ScenarioLibraryPage"

export default function ScenariosPage() {
  return (
    <AppShell
      title="Scenario Library"
      subtitle="Tune weights, set thresholds, and save reusable scoring presets."
    >
      <ScenarioLibraryPage />
    </AppShell>
  )
}
