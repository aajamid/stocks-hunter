"use client"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { SymbolMeta } from "@/lib/types"

import { MultiSelect } from "./MultiSelect"

export type FilterState = {
  rangeMode: "rolling"
  rangeDays: 14 | 21 | 28
  name: string
  symbols: string[]
  sectors: string[]
  markets: string[]
  activeOnly: boolean
}

type FiltersSidebarProps = {
  symbols: SymbolMeta[]
  sectors: string[]
  markets: string[]
  filters: FilterState
  onChange: (next: FilterState) => void
}

export function FiltersSidebar({
  symbols,
  sectors,
  markets,
  filters,
  onChange,
}: FiltersSidebarProps) {
  const symbolOptions = symbols.map((symbol) => ({
    value: symbol.symbol,
    label: `${symbol.symbol} ${symbol.name_en ? `- ${symbol.name_en}` : ""}`.trim(),
  }))

  const sectorOptions = sectors.map((sector) => ({
    value: sector,
    label: sector,
  }))

  const marketOptions = markets.map((market) => ({
    value: market,
    label: market,
  }))

  return (
    <div className="flex flex-col gap-4">
      <Card className="space-y-4 border-border/70 bg-card/50 p-4">
        <div className="space-y-2">
          <Label htmlFor="range-mode">Range</Label>
          <Select
            value={filters.rangeMode}
            onValueChange={() => onChange({ ...filters, rangeMode: "rolling" })}
          >
            <SelectTrigger id="range-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rolling">Trailing days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="range-size">Range size</Label>
          <Select
            value={String(filters.rangeDays)}
            onValueChange={(value) =>
              onChange({
                ...filters,
                rangeDays: Number(value) as 14 | 21 | 28,
              })
            }
          >
            <SelectTrigger id="range-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="14">14 business days</SelectItem>
              <SelectItem value="21">21 business days</SelectItem>
              <SelectItem value="28">28 business days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name-search">Company search</Label>
          <Input
            id="name-search"
            value={filters.name}
            onChange={(event) =>
              onChange({ ...filters, name: event.target.value })
            }
            placeholder="e.g. SABIC"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Active only</p>
            <p className="text-xs text-muted-foreground">
              Show listed companies only
            </p>
          </div>
          <Switch
            checked={filters.activeOnly}
            onCheckedChange={(value) =>
              onChange({ ...filters, activeOnly: value })
            }
          />
        </div>
      </Card>

      <MultiSelect
        label="Symbols"
        options={symbolOptions}
        selected={filters.symbols}
        onChange={(symbols) => onChange({ ...filters, symbols })}
        searchable
        placeholder="Filter symbols"
      />
      <MultiSelect
        label="Sectors"
        options={sectorOptions}
        selected={filters.sectors}
        onChange={(sectors) => onChange({ ...filters, sectors })}
      />
      <MultiSelect
        label="Markets"
        options={marketOptions}
        selected={filters.markets}
        onChange={(markets) => onChange({ ...filters, markets })}
      />
    </div>
  )
}
