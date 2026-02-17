import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { writeAuditLog } from "@/lib/auth/audit"
import { isAdmin, requireAuth, requirePermission } from "@/lib/auth/guard"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
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

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "investments:read")
    if (permissionError) return permissionError

    const exists = await tableExists()
    if (!exists) {
      return NextResponse.json({
        scenarios: [],
        warning: "Table app_scenarios not found.",
      })
    }

    const admin = isAdmin(context)
    const result = await query<{
      id: number
      name: string
      config: unknown
      owner_user_id: string | null
      created_at: string
      updated_at: string
    }>(
      `
      SELECT id, name, config, owner_user_id, created_at, updated_at
      FROM public.app_scenarios
      ${admin ? "" : "WHERE owner_user_id = $1"}
      ORDER BY updated_at DESC
    `,
      admin ? [] : [context.user.id]
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
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "investments:write")
    if (permissionError) return permissionError

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
      INSERT INTO public.app_scenarios (name, config, owner_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
      [parsed.data.name, JSON.stringify(config), context.user.id]
    )

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "SCENARIO_CREATED",
      entityType: "scenario",
      entityId: String(result.rows[0]?.id ?? ""),
      metadata: { name: parsed.data.name },
      ipAddress: getClientIp(request),
    })

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
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "investments:write")
    if (permissionError) return permissionError

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
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
    }

    const config = applyScenarioDefaults(parsed.data.config)
    const admin = isAdmin(context)
    await query(
      `
      UPDATE public.app_scenarios
      SET name = $1,
          config = $2,
          updated_at = NOW()
      WHERE id = $3
      ${admin ? "" : "AND owner_user_id = $4"}
    `,
      admin
        ? [parsed.data.name, JSON.stringify(config), parsed.data.id]
        : [parsed.data.name, JSON.stringify(config), parsed.data.id, context.user.id]
    )

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "SCENARIO_UPDATED",
      entityType: "scenario",
      entityId: String(parsed.data.id),
      metadata: { name: parsed.data.name },
      ipAddress: getClientIp(request),
    })

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
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "investments:write")
    if (permissionError) return permissionError

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

    const admin = isAdmin(context)
    await query(
      `
      DELETE FROM public.app_scenarios
      WHERE id = $1
      ${admin ? "" : "AND owner_user_id = $2"}
    `,
      admin ? [id] : [id, context.user.id]
    )

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "SCENARIO_DELETED",
      entityType: "scenario",
      entityId: String(id),
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("scenarios delete error", error)
    return NextResponse.json(
      { error: "Failed to delete scenario." },
      { status: 500 }
    )
  }
}
