import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { writeAuditLog } from "@/lib/auth/audit"
import { isAdmin, requireAuth, requirePermission } from "@/lib/auth/guard"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { query } from "@/lib/db"

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  isPublic: z.boolean().optional(),
})

type NoteAccessRow = {
  owner_user_id: string
  is_public: boolean
}

export async function POST(
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

    const noteResult = await query<NoteAccessRow>(
      `
      SELECT owner_user_id, is_public
      FROM public.app_notes
      WHERE id = $1
      `,
      [id]
    )
    const note = noteResult.rows[0]
    if (!note) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 })
    }

    const admin = isAdmin(auth)
    const canAccess = admin || note.owner_user_id === auth.user.id || note.is_public
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const body = await request.json()
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue?.message ?? "Invalid payload." },
        { status: 400 }
      )
    }

    const result = await query<{ id: string }>(
      `
      INSERT INTO public.app_note_comments (
        note_id,
        owner_user_id,
        content,
        is_public
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [id, auth.user.id, parsed.data.content.trim(), parsed.data.isPublic ?? false]
    )

    const commentId = result.rows[0]?.id ?? null
    await writeAuditLog({
      actorUserId: auth.user.id,
      action: "NOTE_COMMENT_CREATED",
      entityType: "note_comment",
      entityId: commentId,
      metadata: {
        noteId: id,
        isPublic: parsed.data.isPublic ?? false,
      },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ id: commentId }, { status: 201 })
  } catch (error) {
    console.error("note comment create error", error)
    return NextResponse.json({ error: "Failed to add comment." }, { status: 500 })
  }
}
