import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { writeAuditLog } from "@/lib/auth/audit"
import { isAdmin, requireAuth, requirePermission } from "@/lib/auth/guard"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { query } from "@/lib/db"

const updateNoteSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  content: z.string().min(1).max(4000).optional(),
  isPublic: z.boolean().optional(),
})

async function getNoteOwner(noteId: string) {
  const result = await query<{ owner_user_id: string }>(
    `
    SELECT owner_user_id
    FROM public.app_notes
    WHERE id = $1
    `,
    [noteId]
  )
  return result.rows[0]?.owner_user_id ?? null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context: auth, error } = await requireAuth(request)
    if (!auth) return error
    const permissionError = requirePermission(auth, "investments:write")
    if (permissionError) return permissionError

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Note id is required." }, { status: 400 })
    }

    const ownerId = await getNoteOwner(id)
    if (!ownerId) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 })
    }

    const admin = isAdmin(auth)
    if (!admin && ownerId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateNoteSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue?.message ?? "Invalid payload." },
        { status: 400 }
      )
    }

    const updates = parsed.data
    const sets: string[] = ["updated_at = NOW()"]
    const params: Array<string | boolean> = []
    if (typeof updates.title === "string") {
      params.push(updates.title.trim())
      sets.push(`title = $${params.length}`)
    }
    if (typeof updates.content === "string") {
      params.push(updates.content.trim())
      sets.push(`content = $${params.length}`)
    }
    if (typeof updates.isPublic === "boolean") {
      params.push(updates.isPublic)
      sets.push(`is_public = $${params.length}`)
    }

    params.push(id)
    await query(
      `
      UPDATE public.app_notes
      SET ${sets.join(", ")}
      WHERE id = $${params.length}
      `,
      params
    )

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "NOTE_UPDATED",
      entityType: "note",
      entityId: id,
      metadata: { updatedFields: Object.keys(updates) },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("notes patch error", error)
    return NextResponse.json({ error: "Failed to update note." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originError = ensureSameOrigin(request)
  if (originError) return originError

  try {
    const { context: auth, error } = await requireAuth(request)
    if (!auth) return error
    const permissionError = requirePermission(auth, "investments:write")
    if (permissionError) return permissionError

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Note id is required." }, { status: 400 })
    }

    const ownerId = await getNoteOwner(id)
    if (!ownerId) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 })
    }

    const admin = isAdmin(auth)
    if (!admin && ownerId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    await query(
      `
      DELETE FROM public.app_notes
      WHERE id = $1
      `,
      [id]
    )

    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "NOTE_DELETED",
      entityType: "note",
      entityId: id,
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("notes delete error", error)
    return NextResponse.json({ error: "Failed to delete note." }, { status: 500 })
  }
}
