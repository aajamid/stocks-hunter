import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { AppShell } from "@/components/layout/AppShell"

export default function Home() {
  return (
    <AppShell
      title="Equity Screener"
      subtitle="Filter Saudi equities, compute scores, and export results."
    >
      <DashboardPage />
    </AppShell>
  )
}
