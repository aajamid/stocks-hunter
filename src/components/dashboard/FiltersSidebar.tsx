"use client"

import { useEffect, useMemo } from "react"

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
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { SymbolMeta } from "@/lib/types"

import { MultiSelect } from "./MultiSelect"

export type FilterState = {
  rangeMode: "rolling"
  rangeDays: 14 | 21 | 28
  name: string
  scoreRange: [number, number]
  minPrice: string
  minAvgVolume: string
  minAvgTurnover: string
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
  const symbolByCode = useMemo(
    () => new Map(symbols.map((symbol) => [symbol.symbol, symbol])),
    [symbols]
  )

  const availableSymbols = useMemo(() => {
    return symbols.filter((symbol) => {
      if (filters.sectors.length) {
        const sector = symbol.sector ?? ""
        if (!filters.sectors.includes(sector)) return false
      }
      if (filters.markets.length) {
        const market = symbol.market ?? ""
        if (!filters.markets.includes(market)) return false
      }
      if (filters.activeOnly && symbol.is_active === false) return false
      return true
    })
  }, [filters.activeOnly, filters.markets, filters.sectors, symbols])

  const availableSymbolSet = useMemo(
    () => new Set(availableSymbols.map((symbol) => symbol.symbol)),
    [availableSymbols]
  )

  useEffect(() => {
    if (filters.symbols.length === 0) return
    const nextSymbols = filters.symbols.filter((symbol) =>
      availableSymbolSet.has(symbol)
    )
    if (nextSymbols.length === filters.symbols.length) return
    onChange({ ...filters, symbols: nextSymbols })
  }, [availableSymbolSet, filters, onChange])

  const symbolOptions = availableSymbols.map((symbol) => ({
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
      <Card className="space-y-4 border-border/70 bg-card/50 p-3 sm:p-4">
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="score-range">Score range</Label>
            <span className="text-xs text-muted-foreground">
              {filters.scoreRange[0]} - {filters.scoreRange[1]}
            </span>
          </div>
          <Slider
            id="score-range"
            value={filters.scoreRange}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => {
              if (value.length !== 2) return
              const min = Math.max(0, Math.min(100, Math.round(value[0])))
              const max = Math.max(0, Math.min(100, Math.round(value[1])))
              onChange({
                ...filters,
                scoreRange: [Math.min(min, max), Math.max(min, max)],
              })
            }}
          />
          <p className="text-xs text-muted-foreground">
            Filter results by score band.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="min-price">Min price</Label>
            <Input
              id="min-price"
              value={filters.minPrice}
              onChange={(event) =>
                onChange({ ...filters, minPrice: event.target.value })
              }
              placeholder="e.g. 5"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min-volume">Min avg volume</Label>
            <Input
              id="min-volume"
              value={filters.minAvgVolume}
              onChange={(event) =>
                onChange({ ...filters, minAvgVolume: event.target.value })
              }
              placeholder="e.g. 100000"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-turnover">Min avg turnover</Label>
          <Input
            id="min-turnover"
            value={filters.minAvgTurnover}
            onChange={(event) =>
              onChange({ ...filters, minAvgTurnover: event.target.value })
            }
            placeholder="e.g. 5000000"
            inputMode="decimal"
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
            aria-label="Active companies only"
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
        onChange={(nextSymbols) => {
          const nextSectors = Array.from(
            new Set(
              nextSymbols
                .map((symbolCode) => symbolByCode.get(symbolCode)?.sector ?? "")
                .filter((sector): sector is string => sector.length > 0)
            )
          )
          onChange({
            ...filters,
            symbols: nextSymbols,
            sectors: nextSymbols.length > 0 ? nextSectors : filters.sectors,
          })
        }}
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
