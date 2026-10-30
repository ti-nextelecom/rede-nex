-- One reaction per person/message. Membership removal also removes their reactions.
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id,user_id),
  FOREIGN KEY (conversation_id,user_id)
    REFERENCES public.chat_participants(conversation_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS chat_message_reactions_membership_idx
  ON public.chat_message_reactions(conversation_id,user_id);
REVOKE ALL ON public.chat_message_reactions FROM PUBLIC;
