-- Archive is personal and follows membership, not a global conversation status.
CREATE TABLE IF NOT EXISTS public.chat_conversation_archives (
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id),
  FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.chat_participants(conversation_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chat_conversation_archives_conversation_idx
  ON public.chat_conversation_archives(conversation_id, user_id);
REVOKE ALL ON public.chat_conversation_archives FROM PUBLIC;
