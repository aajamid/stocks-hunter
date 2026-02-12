"use client"

import { AlertTriangle } from "lucide-react"

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  )
}
