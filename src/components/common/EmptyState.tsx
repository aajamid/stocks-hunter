"use client"

import { SearchX } from "lucide-react"

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 px-6 text-center">
      <SearchX className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}
