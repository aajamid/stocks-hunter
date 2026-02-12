import { AppShell } from "@/components/layout/AppShell"
import { SymbolDetailPage } from "@/components/symbol/SymbolDetailPage"

type SymbolPageProps = {
  params: { symbol: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default function SymbolPage({ params, searchParams }: SymbolPageProps) {
  const initialParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      initialParams.set(key, value)
    } else if (Array.isArray(value)) {
      value.forEach((entry) => initialParams.append(key, entry))
    }
  })

  return (
    <AppShell
      title={`${params.symbol} Detail`}
      subtitle="Deep dive into price action, signals, and score drivers."
    >
      <SymbolDetailPage
        symbol={params.symbol}
        initialParams={initialParams.toString()}
      />
    </AppShell>
  )
}
