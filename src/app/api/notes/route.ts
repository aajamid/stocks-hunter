import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { writeAuditLog } from "@/lib/auth/audit"
import { isAdmin, requireAuth, requirePermission } from "@/lib/auth/guard"
import { ensureSameOrigin, getClientIp } from "@/lib/auth/session"
import { query } from "@/lib/db"

const createNoteSchema = z.object({
  title: z.string().min(1).max(180),
  content: z.string().min(1).max(4000),
  isPublic: z.boolean().optional(),
})

type NoteRow = {
  note_id: string
  note_title: string
  note_content: string
  note_is_public: boolean
  note_owner_user_id: string
  note_created_at: string
  note_updated_at: string
  note_owner_email: string
  note_owner_name: string | null
  comment_id: string | null
  comment_content: string | null
  comment_is_public: boolean | null
  comment_owner_user_id: string | null
  comment_created_at: string | null
  comment_owner_email: string | null
  comment_owner_name: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { context, error } = await requireAuth(request)
    if (!context) return error
    const permissionError = requirePermission(context, "investments:read")
    if (permissionError) return permissionError

    const admin = isAdmin(context)
    const scopeParam = request.nextUrl.searchParams.get("scope")
    const scope = scopeParam === "mine" || scopeParam === "public" ? scopeParam : "all"

    const where: string[] = []
    const params: Array<string | boolean> = []

    if (scope === "mine") {
      params.push(context.user.id)
      where.push(`n.owner_user_id = $${params.length}`)
    } else if (scope === "public") {
      where.push("n.is_public = TRUE")
    } else if (!admin) {
      params.push(context.user.id)
      where.push(`(n.is_public = TRUE OR n.owner_user_id = $${params.length})`)
    }

    params.push(admin)
    const adminParam = `$${params.length}`
    params.push(context.user.id)
    const userParam = `$${params.length}`

    const result = await query<NoteRow>(
      `
      SELECT
        n.id as note_id,
        n.title as note_title,
        n.content as note_content,
        n.is_public as note_is_public,
        n.owner_user_id as note_owner_user_id,
        to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as note_created_at,
        to_char(n.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as note_updated_at,
        nu.email as note_owner_email,
        nu.full_name as note_owner_name,
        c.id as comment_id,
        c.content as comment_content,
        c.is_public as comment_is_public,
        c.owner_user_id as comment_owner_user_id,
        to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as comment_created_at,
        cu.email as comment_owner_email,
        cu.full_name as comment_owner_name
      FROM public.app_notes n
      INNER JOIN public.users nu ON nu.id = n.owner_user_id
      LEFT JOIN public.app_note_comments c
        ON c.note_id = n.id
        AND (${adminParam} OR n.owner_user_id = ${userParam} OR c.owner_user_id = ${userParam} OR c.is_public = TRUE)
      LEFT JOIN public.users cu ON cu.id = c.owner_user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY n.created_at DESC, c.created_at ASC
      `,
      params
    )

    const noteMap = new Map<
      string,
      {
        id: string
        title: string
        content: string
        isPublic: boolean
        owner: {
          userId: string
          email: string
          fullName: string | null
        }
        createdAt: string
        updatedAt: string
        canManage: boolean
        canComment: boolean
        comments: Array<{
          id: string
          content: string
          isPublic: boolean
          owner: {
            userId: string
            email: string
            fullName: string | null
          }
          createdAt: string
        }>
      }
    >()

    for (const row of result.rows) {
      if (!noteMap.has(row.note_id)) {
        const canManage = admin || row.note_owner_user_id === context.user.id
        const canComment = canManage || row.note_is_public
        noteMap.set(row.note_id, {
          id: row.note_id,
          title: row.note_title,
          content: row.note_content,
          isPublic: row.note_is_public,
          owner: {
            userId: row.note_owner_user_id,
            email: row.note_owner_email,
            fullName: row.note_owner_name,
          },
          createdAt: row.note_created_at,
          updatedAt: row.note_updated_at,
          canManage,
          canComment,
          comments: [],
        })
      }

      const note = noteMap.get(row.note_id)
      if (!note || !row.comment_id || !row.comment_content || !row.comment_owner_user_id) {
        continue
      }
      note.comments.push({
        id: row.comment_id,
        content: row.comment_content,
        isPublic: Boolean(row.comment_is_public),
        owner: {
          userId: row.comment_owner_user_id,
          email: row.comment_owner_email ?? "",
          fullName: row.comment_owner_name,
        },
        createdAt: row.comment_created_at ?? "",
      })
    }

    return NextResponse.json({
      notes: Array.from(noteMap.values()),
    })
  } catch (error) {
    console.error("notes get error", error)
    return NextResponse.json({ error: "Failed to load notes." }, { status: 500 })
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

    const body = await request.json()
    const parsed = createNoteSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue?.message ?? "Invalid payload." },
        { status: 400 }
      )
    }

    const result = await query<{ id: string }>(
      `
      INSERT INTO public.app_notes (
        owner_user_id,
        title,
        content,
        is_public
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [
        context.user.id,
        parsed.data.title.trim(),
        parsed.data.content.trim(),
        parsed.data.isPublic ?? false,
      ]
    )

    const noteId = result.rows[0]?.id ?? null
    await writeAuditLog({
      actorUserId: context.user.id,
      action: "NOTE_CREATED",
      entityType: "note",
      entityId: noteId,
      metadata: { isPublic: parsed.data.isPublic ?? false },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({ id: noteId }, { status: 201 })
  } catch (error) {
    console.error("notes create error", error)
    return NextResponse.json({ error: "Failed to create note." }, { status: 500 })
  }
}
