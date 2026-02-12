"use client"

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[180px] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
      {label ?? "Loading data..."}
    </div>
  )
}
