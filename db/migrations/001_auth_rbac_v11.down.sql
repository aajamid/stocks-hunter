DROP INDEX IF EXISTS public.app_scenarios_owner_user_id_idx;

ALTER TABLE IF EXISTS public.app_scenarios
  DROP COLUMN IF EXISTS owner_user_id;

DROP INDEX IF EXISTS public.audit_logs_action_idx;
DROP INDEX IF EXISTS public.audit_logs_actor_user_id_idx;
DROP INDEX IF EXISTS public.audit_logs_created_at_idx;
DROP TABLE IF EXISTS public.audit_logs;

DROP INDEX IF EXISTS public.sessions_expires_at_idx;
DROP INDEX IF EXISTS public.sessions_user_id_idx;
DROP TABLE IF EXISTS public.sessions;

DROP INDEX IF EXISTS public.role_permissions_permission_id_idx;
DROP TABLE IF EXISTS public.role_permissions;

DROP INDEX IF EXISTS public.user_roles_role_id_idx;
DROP TABLE IF EXISTS public.user_roles;

DROP TABLE IF EXISTS public.permissions;
DROP TABLE IF EXISTS public.roles;

DROP INDEX IF EXISTS public.users_is_active_idx;
DROP TABLE IF EXISTS public.users;
