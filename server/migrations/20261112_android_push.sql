-- Durable Android push tied to the authenticated session. No private keys live in SQL.
CREATE TABLE IF NOT EXISTS public.device_fcm_tokens (
  token text PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Upgrade installations which created the legacy token table outside migrations.
ALTER TABLE public.device_fcm_tokens ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.user_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.device_fcm_tokens ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS device_fcm_tokens_token_idx ON public.device_fcm_tokens(token);
CREATE INDEX IF NOT EXISTS device_fcm_tokens_user_idx ON public.device_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS device_fcm_tokens_session_idx ON public.device_fcm_tokens(session_id);
CREATE TABLE IF NOT EXISTS public.android_push_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_token text NOT NULL REFERENCES public.device_fcm_tokens(token) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(device_token,notification_id)
);
CREATE INDEX IF NOT EXISTS android_push_due_idx ON public.android_push_deliveries(next_attempt_at,id);
CREATE INDEX IF NOT EXISTS android_push_notification_idx ON public.android_push_deliveries(notification_id);
CREATE OR REPLACE FUNCTION public.enqueue_android_notification() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.android_push_deliveries(device_token,notification_id)
    SELECT d.token,NEW.id FROM public.device_fcm_tokens d
    JOIN public.user_sessions s ON s.id=d.session_id AND s.user_id=d.user_id
    JOIN public.users u ON u.id=d.user_id
    WHERE d.user_id=NEW.user_id AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='active'
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enqueue_android_notification ON public.notifications;
CREATE TRIGGER enqueue_android_notification AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_android_notification();
REVOKE ALL ON public.device_fcm_tokens,public.android_push_deliveries FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_android_notification() FROM PUBLIC;
