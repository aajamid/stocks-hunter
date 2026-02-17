import { AppShell } from "@/components/layout/AppShell"
import { NotesTimelinePage } from "@/components/notes/NotesTimelinePage"

export default function NotesPage() {
  return (
    <AppShell
      title="Notes Timeline"
      subtitle="Capture notes and comments, and control public/private visibility."
    >
      <NotesTimelinePage />
    </AppShell>
  )
}
