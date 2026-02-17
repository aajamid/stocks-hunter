"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type NotesScope = "all" | "mine" | "public"

type NoteComment = {
  id: string
  content: string
  isPublic: boolean
  createdAt: string
  owner: {
    userId: string
    email: string
    fullName: string | null
  }
}

type Note = {
  id: string
  title: string
  content: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
  canManage: boolean
  canComment: boolean
  owner: {
    userId: string
    email: string
    fullName: string | null
  }
  comments: NoteComment[]
}

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return payload?.error ?? fallback
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export function NotesTimelinePage() {
  const router = useRouter()
  const [scope, setScope] = useState<NotesScope>("all")
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState("")
  const [newIsPublic, setNewIsPublic] = useState(false)

  const [commentDraftByNote, setCommentDraftByNote] = useState<Record<string, string>>({})
  const [commentPublicByNote, setCommentPublicByNote] = useState<Record<string, boolean>>({})

  const noteCountLabel = useMemo(() => `${notes.length} note(s)`, [notes.length])

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/notes?scope=${scope}`)
      if (response.status === 401) {
        const nextPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/notes"
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`)
        return
      }
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load notes."))
      }
      const payload = (await response.json()) as { notes: Note[] }
      setNotes(payload.notes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes.")
    } finally {
      setLoading(false)
    }
  }, [router, scope])

  useEffect(() => {
    void fetchNotes()
  }, [fetchNotes])

  const createNote = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          isPublic: newIsPublic,
        }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create note."))
      }
      setNewTitle("")
      setNewContent("")
      setNewIsPublic(false)
      await fetchNotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note.")
    } finally {
      setSaving(false)
    }
  }

  const addComment = async (noteId: string) => {
    const content = (commentDraftByNote[noteId] ?? "").trim()
    if (!content) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/notes/${noteId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          isPublic: Boolean(commentPublicByNote[noteId]),
        }),
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to add comment."))
      }
      setCommentDraftByNote((prev) => ({ ...prev, [noteId]: "" }))
      setCommentPublicByNote((prev) => ({ ...prev, [noteId]: false }))
      await fetchNotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment.")
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (noteId: string) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete note."))
      }
      await fetchNotes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </Card>
      ) : null}

      <Card className="space-y-3 border-border/70 bg-card/60 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Note Taking
          </p>
          <h3 className="text-lg font-semibold">Capture timeline notes</h3>
        </div>
        <div className="grid gap-2">
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Note title"
            maxLength={180}
          />
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            placeholder="Write your note..."
            className="min-h-[110px] rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
            maxLength={4000}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={newIsPublic}
              onCheckedChange={setNewIsPublic}
              aria-label="Public note toggle"
            />
            <span className="text-sm text-muted-foreground">
              {newIsPublic ? "Public note" : "Private note"}
            </span>
          </div>
          <Button
            onClick={createNote}
            disabled={saving || !newTitle.trim() || !newContent.trim()}
          >
            Save note
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 border-border/70 bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={scope === "all" ? "secondary" : "ghost"}
              onClick={() => setScope("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={scope === "mine" ? "secondary" : "ghost"}
              onClick={() => setScope("mine")}
            >
              My notes
            </Button>
            <Button
              size="sm"
              variant={scope === "public" ? "secondary" : "ghost"}
              onClick={() => setScope("public")}
            >
              Public only
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">{noteCountLabel}</div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes found for this view.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id} className="space-y-3 border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-semibold">{note.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {note.owner.fullName ?? note.owner.email} •{" "}
                      {note.isPublic ? "Public" : "Private"} • {formatDate(note.createdAt)}
                    </p>
                  </div>
                  {note.canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void deleteNote(note.id)}
                      disabled={saving}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground/95">{note.content}</p>

                <div className="space-y-2 rounded-md border border-border/60 bg-card/50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Comments timeline
                  </p>
                  {note.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {note.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md border border-border/40 px-2 py-2">
                          <p className="text-sm">{comment.content}</p>
                          <p className="text-xs text-muted-foreground">
                            {comment.owner.fullName ?? comment.owner.email} •{" "}
                            {comment.isPublic ? "Public" : "Private"} •{" "}
                            {formatDate(comment.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {note.canComment ? (
                    <div className="space-y-2 pt-1">
                      <Input
                        value={commentDraftByNote[note.id] ?? ""}
                        onChange={(event) =>
                          setCommentDraftByNote((prev) => ({
                            ...prev,
                            [note.id]: event.target.value,
                          }))
                        }
                        placeholder="Add a comment"
                        maxLength={2000}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(commentPublicByNote[note.id])}
                            onCheckedChange={(value) =>
                              setCommentPublicByNote((prev) => ({
                                ...prev,
                                [note.id]: value,
                              }))
                            }
                            aria-label={`Public comment toggle for ${note.title}`}
                          />
                          <Label className="text-xs text-muted-foreground">
                            {commentPublicByNote[note.id] ? "Public comment" : "Private comment"}
                          </Label>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void addComment(note.id)}
                          disabled={saving || !(commentDraftByNote[note.id] ?? "").trim()}
                        >
                          Add comment
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      You cannot comment on this note.
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
