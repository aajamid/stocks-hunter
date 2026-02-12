export const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})

export const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
})

export const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
})
