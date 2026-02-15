"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type Option = {
  value: string
  label: string
  meta?: string
}

type MultiSelectProps = {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  searchable?: boolean
  placeholder?: string
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  placeholder,
}: MultiSelectProps) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery, options])

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <Card className="space-y-3 border-border/70 bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
          disabled={selected.length === 0}
        >
          Clear
        </Button>
      </div>
      {searchable ? (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder ?? "Search"}
        />
      ) : null}
      <Separator />
      <div className="max-h-52 space-y-2 overflow-y-auto pr-1 text-sm">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matches.</p>
        ) : null}
        {filtered.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-foreground/90 hover:bg-accent/40"
          >
            <span className="truncate">{option.label}</span>
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={() => toggleValue(option.value)}
            />
          </label>
        ))}
      </div>
    </Card>
  )
}
