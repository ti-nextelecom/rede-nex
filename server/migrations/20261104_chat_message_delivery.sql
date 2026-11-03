ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS client_message_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_sender_client_key
  ON public.chat_messages(sender_id,client_message_id) WHERE client_message_id IS NOT NULL;
