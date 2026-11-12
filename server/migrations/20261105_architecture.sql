CREATE TABLE IF NOT EXISTS public.architecture_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id),
  title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK(char_length(description)<=4000),
  client_name text NOT NULL DEFAULT '' CHECK(char_length(client_name)<=160),
  address text NOT NULL DEFAULT '' CHECK(char_length(address)<=500),
  site_type text NOT NULL DEFAULT 'house' CHECK(site_type IN ('house','condominium','other')),
  is_template boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'team' CHECK(visibility IN ('private','team')),
  editor_ids uuid[] NOT NULL DEFAULT '{}',
  viewer_ids uuid[] NOT NULL DEFAULT '{}',
  document jsonb NOT NULL CHECK(coalesce(jsonb_typeof(document)='object' AND document->>'version'='1' AND document->>'units'='m' AND jsonb_typeof(document->'floors')='array',false) AND octet_length(document::text)<=6000000),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS architecture_owner_updated_idx ON public.architecture_projects(owner_id,updated_at DESC,id);
CREATE INDEX IF NOT EXISTS architecture_team_updated_idx ON public.architecture_projects(updated_at DESC,id) WHERE visibility='team' AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS architecture_editors_idx ON public.architecture_projects USING gin(editor_ids);
CREATE INDEX IF NOT EXISTS architecture_viewers_idx ON public.architecture_projects USING gin(viewer_ids);
REVOKE ALL ON public.architecture_projects FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.architecture_actor_id() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nullif(current_setting('app.architecture_user_id',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION public.architecture_actor_active() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id=public.architecture_actor_id() AND status='active')
$$;
ALTER TABLE public.architecture_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architecture_projects FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS architecture_read ON public.architecture_projects;
CREATE POLICY architecture_read ON public.architecture_projects FOR SELECT USING (
  (SELECT public.architecture_actor_active()) AND (
    owner_id=(SELECT public.architecture_actor_id()) OR editor_ids @> ARRAY[(SELECT public.architecture_actor_id())]
    OR viewer_ids @> ARRAY[(SELECT public.architecture_actor_id())] OR (visibility='team' AND archived_at IS NULL)
  )
);
DROP POLICY IF EXISTS architecture_insert ON public.architecture_projects;
CREATE POLICY architecture_insert ON public.architecture_projects FOR INSERT WITH CHECK (
  (SELECT public.architecture_actor_active()) AND owner_id=(SELECT public.architecture_actor_id())
);
DROP POLICY IF EXISTS architecture_update ON public.architecture_projects;
CREATE POLICY architecture_update ON public.architecture_projects FOR UPDATE USING (
  (SELECT public.architecture_actor_active()) AND (owner_id=(SELECT public.architecture_actor_id()) OR editor_ids @> ARRAY[(SELECT public.architecture_actor_id())])
) WITH CHECK (
  (SELECT public.architecture_actor_active()) AND (owner_id=(SELECT public.architecture_actor_id()) OR editor_ids @> ARRAY[(SELECT public.architecture_actor_id())])
);
CREATE OR REPLACE FUNCTION public.architecture_guard_update() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Responsável e identificação do projeto são imutáveis' USING ERRCODE='42501';
  END IF;
  IF public.architecture_actor_id() IS DISTINCT FROM OLD.owner_id AND
    (NEW.editor_ids IS DISTINCT FROM OLD.editor_ids OR NEW.viewer_ids IS DISTINCT FROM OLD.viewer_ids OR NEW.visibility IS DISTINCT FROM OLD.visibility OR NEW.archived_at IS DISTINCT FROM OLD.archived_at) THEN
    RAISE EXCEPTION 'Apenas o responsável pode alterar acesso ou arquivamento' USING ERRCODE='42501';
  END IF;
  NEW.updated_at=now();
  NEW.revision=OLD.revision+1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS architecture_guard_update ON public.architecture_projects;
CREATE TRIGGER architecture_guard_update BEFORE UPDATE ON public.architecture_projects FOR EACH ROW EXECUTE FUNCTION public.architecture_guard_update();
