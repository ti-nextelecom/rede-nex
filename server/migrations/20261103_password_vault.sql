-- Only encrypted, authenticated envelopes. Master passwords and plaintext never enter this table.
CREATE TABLE IF NOT EXISTS public.password_vaults (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  envelope jsonb NOT NULL CHECK (
    jsonb_typeof(envelope) = 'object'
    AND envelope ?& ARRAY['version','iterations','salt','iv','ciphertext']
    AND envelope - ARRAY['version','iterations','salt','iv','ciphertext'] = '{}'::jsonb
    AND envelope->>'version' = '1' AND envelope->>'iterations' = '600000'
    AND octet_length(envelope::text) <= 1500000
  ),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.password_vaults FROM PUBLIC;
ALTER TABLE public.password_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_vaults FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS password_vault_owner ON public.password_vaults;
CREATE POLICY password_vault_owner ON public.password_vaults FOR ALL
  USING (user_id = NULLIF(current_setting('app.vault_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.vault_user_id', true), '')::uuid);
