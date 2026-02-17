import { AdminPage } from "@/components/admin/AdminPage"
import { AppShell } from "@/components/layout/AppShell"

export default function AdminRoute() {
  return (
    <AppShell
      title="Admin Control Center"
      subtitle="Manage users, roles, permissions, and security audit trails."
    >
      <AdminPage />
    </AppShell>
  )
}
