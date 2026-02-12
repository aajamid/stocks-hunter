import assert from "node:assert/strict"
import test from "node:test"

import type { ScreenerRow } from "./types.ts"
import { scoreRows } from "./scoring.ts"

const createRow = (
  symbol: string,
  upDays: number,
  downDays: number
): ScreenerRow => ({
  symbol,
  up_days: upDays,
  down_days: downDays,
  net_direction_days: upDays - downDays,
})

test("14-day range uses ~7.143 points per day", () => {
  const [row] = scoreRows([createRow("A", 12, 3)], undefined, 14)
  assert.equal(row.score_components.pointPerDay, 7.143)
  assert.equal(row.score, 64.286)
})

test("21-day range uses ~4.762 points per day", () => {
  const [row] = scoreRows([createRow("B", 11, 4)], undefined, 21)
  assert.equal(row.score_components.pointPerDay, 4.762)
  assert.equal(row.score, 33.333)
})

test("28-day range uses ~3.571 points per day", () => {
  const [row] = scoreRows([createRow("C", 15, 5)], undefined, 28)
  assert.equal(row.score_components.pointPerDay, 3.571)
  assert.equal(row.score, 35.714)
})

test("increase days add score and decrease days deduct score", () => {
  const [row] = scoreRows([createRow("D", 6, 9)], undefined, 14)
  assert.equal(row.score, -21.429)
  assert.equal(row.score_components.upScore, 42.857)
  assert.equal(row.score_components.downScore, -64.286)
})

test("flat movement yields zero score", () => {
  const [row] = scoreRows([createRow("E", 0, 0)], undefined, 14)
  assert.equal(row.score, 0)
})
