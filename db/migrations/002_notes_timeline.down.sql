DROP INDEX IF EXISTS public.app_note_comments_created_at_idx;
DROP INDEX IF EXISTS public.app_note_comments_is_public_idx;
DROP INDEX IF EXISTS public.app_note_comments_owner_user_id_idx;
DROP INDEX IF EXISTS public.app_note_comments_note_id_idx;
DROP TABLE IF EXISTS public.app_note_comments;

DROP INDEX IF EXISTS public.app_notes_created_at_idx;
DROP INDEX IF EXISTS public.app_notes_is_public_idx;
DROP INDEX IF EXISTS public.app_notes_owner_user_id_idx;
DROP TABLE IF EXISTS public.app_notes;
