import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { query } from "@/lib/db"
import { applyScenarioDefaults } from "@/lib/scoring"

const ScenarioPayload = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(120),
  config: z
    .object({
      weights: z
        .object({
          momentum: z.number().min(0).max(2).optional(),
          direction: z.number().min(0).max(2).optional(),
          volatility: z.number().min(0).max(2).optional(),
          volumeSpike: z.number().min(0).max(2).optional(),
          intraday: z.number().min(0).max(2).optional(),
        })
        .optional(),
      thresholds: z
        .object({
          volatilityCap: z.number().min(0.0001).max(10).optional(),
        })
        .optional(),
    })
    .optional(),
})

async function tableExists() {
  const result = await query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'app_scenarios'
    ) as exists
  `,
    []
  )
  return result.rows[0]?.exists ?? false
}

export async function GET() {
  try {
    const exists = await tableExists()
    if (!exists) {
      return NextResponse.json({
        scenarios: [],
        warning: "Table app_scenarios not found.",
      })
    }

    const result = await query<{
      id: number
      name: string
      config: unknown
      created_at: string
      updated_at: string
    }>(
      `
      SELECT id, name, config, created_at, updated_at
      FROM public.app_scenarios
      ORDER BY updated_at DESC
    `,
      []
    )

    return NextResponse.json({ scenarios: result.rows })
  } catch (error) {
    console.error("scenarios api error", error)
    return NextResponse.json(
      { error: "Failed to load scenarios." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const exists = await tableExists()
    if (!exists) {
      return NextResponse.json(
        { error: "Table app_scenarios not found." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = ScenarioPayload.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const config = applyScenarioDefaults(parsed.data.config)
    const result = await query<{ id: number }>(
      `
      INSERT INTO public.app_scenarios (name, config)
      VALUES ($1, $2)
      RETURNING id
    `,
      [parsed.data.name, JSON.stringify(config)]
    )

    return NextResponse.json({ id: result.rows[0]?.id })
  } catch (error) {
    console.error("scenarios create error", error)
    return NextResponse.json(
      { error: "Failed to create scenario." },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const exists = await tableExists()
    if (!exists) {
      return NextResponse.json(
        { error: "Table app_scenarios not found." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = ScenarioPayload.safeParse(body)
    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json(
        { error: "Invalid payload." },
        { status: 400 }
      )
    }

    const config = applyScenarioDefaults(parsed.data.config)
    await query(
      `
      UPDATE public.app_scenarios
      SET name = $1,
          config = $2,
          updated_at = NOW()
      WHERE id = $3
    `,
      [parsed.data.name, JSON.stringify(config), parsed.data.id]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("scenarios update error", error)
    return NextResponse.json(
      { error: "Failed to update scenario." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const exists = await tableExists()
    if (!exists) {
      return NextResponse.json(
        { error: "Table app_scenarios not found." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const id = Number(body?.id)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 })
    }

    await query(
      `
      DELETE FROM public.app_scenarios
      WHERE id = $1
    `,
      [id]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("scenarios delete error", error)
    return NextResponse.json(
      { error: "Failed to delete scenario." },
      { status: 500 }
    )
  }
}
