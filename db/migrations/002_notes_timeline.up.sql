CREATE TABLE IF NOT EXISTS public.app_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_notes_owner_user_id_idx
  ON public.app_notes (owner_user_id);

CREATE INDEX IF NOT EXISTS app_notes_is_public_idx
  ON public.app_notes (is_public);

CREATE INDEX IF NOT EXISTS app_notes_created_at_idx
  ON public.app_notes (created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_note_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.app_notes(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_note_comments_note_id_idx
  ON public.app_note_comments (note_id);

CREATE INDEX IF NOT EXISTS app_note_comments_owner_user_id_idx
  ON public.app_note_comments (owner_user_id);

CREATE INDEX IF NOT EXISTS app_note_comments_is_public_idx
  ON public.app_note_comments (is_public);

CREATE INDEX IF NOT EXISTS app_note_comments_created_at_idx
  ON public.app_note_comments (created_at ASC);
