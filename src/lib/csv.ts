type CsvValue = string | number | boolean | null | undefined

const escapeCsv = (value: CsvValue) => {
  if (value === null || value === undefined) return ""
  const stringValue = String(value)
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`
  }
  return stringValue
}

export function toCsv<T extends Record<string, CsvValue>>(
  rows: T[],
  columns: Array<{ key: keyof T; label: string }>
) {
  const header = columns.map((col) => escapeCsv(col.label)).join(",")
  const body = rows.map((row) =>
    columns.map((col) => escapeCsv(row[col.key])).join(",")
  )
  return [header, ...body].join("\n")
}
