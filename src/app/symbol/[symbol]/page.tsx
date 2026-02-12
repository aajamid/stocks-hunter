import { AppShell } from "@/components/layout/AppShell"
import { SymbolDetailPage } from "@/components/symbol/SymbolDetailPage"

type SymbolPageProps = {
  params: Promise<{ symbol: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SymbolPage({
  params,
  searchParams,
}: SymbolPageProps) {
  const { symbol } = await params
  const resolvedSearchParams = await searchParams

  const initialParams = new URLSearchParams()
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      initialParams.set(key, value)
    } else if (Array.isArray(value)) {
      value.forEach((entry) => initialParams.append(key, entry))
    }
  })

  const normalizedSymbol = symbol.toUpperCase()

  return (
    <AppShell
      title={`${normalizedSymbol} Detail`}
      subtitle="Deep dive into price action, signals, and score drivers."
    >
      <SymbolDetailPage
        symbol={normalizedSymbol}
        initialParams={initialParams.toString()}
      />
    </AppShell>
  )
}
