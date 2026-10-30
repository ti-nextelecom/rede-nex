-- Additive: personal browser subscriptions, delivery outbox and chat nudges.
CREATE TABLE IF NOT EXISTS public.chat_attention_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_attention_actor_conversation_idx
  ON public.chat_attention_requests(conversation_id,actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS chat_attention_message_idx ON public.chat_attention_requests(message_id);
CREATE INDEX IF NOT EXISTS chat_attention_actor_idx ON public.chat_attention_requests(actor_id);
CREATE TABLE IF NOT EXISTS public.browser_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS browser_push_user_idx ON public.browser_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS browser_push_session_idx ON public.browser_push_subscriptions(session_id);
CREATE TABLE IF NOT EXISTS public.browser_push_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.browser_push_subscriptions(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,notification_id)
);
CREATE INDEX IF NOT EXISTS browser_push_due_idx ON public.browser_push_deliveries(next_attempt_at,id);
CREATE INDEX IF NOT EXISTS browser_push_notification_idx ON public.browser_push_deliveries(notification_id);
CREATE OR REPLACE FUNCTION public.enqueue_browser_notification() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.browser_push_deliveries(subscription_id,notification_id)
    SELECT s.id,NEW.id FROM public.browser_push_subscriptions s
    JOIN public.user_sessions us ON us.id=s.session_id AND us.user_id=s.user_id
    JOIN public.users u ON u.id=s.user_id
    WHERE s.user_id=NEW.user_id AND us.revoked_at IS NULL AND us.expires_at>now() AND u.status='active'
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enqueue_browser_notification ON public.notifications;
CREATE TRIGGER enqueue_browser_notification AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_browser_notification();
REVOKE ALL ON public.chat_attention_requests,public.browser_push_subscriptions,public.browser_push_deliveries FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_browser_notification() FROM PUBLIC;
