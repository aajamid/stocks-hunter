import "server-only"

import { query } from "@/lib/db"
import type { AuditLogInput } from "@/lib/auth/types"

export async function writeAuditLog(input: AuditLogInput) {
  try {
    await query(
      `
      INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        metadata,
        ip_address
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        input.actorUserId ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.ipAddress ?? null,
      ]
    )
  } catch (error) {
    // Audit logging should never block the primary request path.
    console.error("audit log write failed", error)
  }
}
