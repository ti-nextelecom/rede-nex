CREATE OR REPLACE FUNCTION public.behavioral_actor_id() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nullif(current_setting('app.behavioral_user_id',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION public.behavioral_actor_active() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id=public.behavioral_actor_id() AND status='active')
$$;
CREATE OR REPLACE FUNCTION public.behavioral_is_admin() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.roles r ON r.id=u.role_id WHERE u.id=public.behavioral_actor_id() AND u.status='active' AND r.name='Administrador')
$$;
CREATE OR REPLACE FUNCTION public.behavioral_can_read(subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT public.behavioral_actor_active() AND (
    subject_id=public.behavioral_actor_id() OR public.behavioral_is_admin() OR (
      WITH RECURSIVE ancestry AS (
        SELECT d.id,d.parent_id,d.manager_id,ARRAY[d.id] AS visited,false AS cyclic,1 AS depth
        FROM public.users u JOIN public.departments d ON d.id=u.department_id WHERE u.id=subject_id
        UNION ALL
        SELECT p.id,p.parent_id,p.manager_id,a.visited||p.id,p.id=ANY(a.visited),a.depth+1
        FROM public.departments p JOIN ancestry a ON p.id=a.parent_id WHERE NOT a.cyclic AND a.depth<64
      )
      SELECT EXISTS(SELECT 1 FROM ancestry WHERE manager_id=public.behavioral_actor_id())
        AND NOT EXISTS(SELECT 1 FROM ancestry WHERE cyclic OR (depth=64 AND parent_id IS NOT NULL))
    )
  )
$$;
CREATE TABLE IF NOT EXISTS public.behavioral_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  attempt_id uuid NOT NULL,
  questionnaire_version text NOT NULL CHECK(char_length(questionnaire_version) BETWEEN 1 AND 64),
  answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<=2048),
  questionnaire jsonb NOT NULL CHECK(jsonb_typeof(questionnaire)='object' AND octet_length(questionnaire::text)<=64000),
  result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=64000),
  subject_snapshot jsonb NOT NULL CHECK(jsonb_typeof(subject_snapshot)='object' AND octet_length(subject_snapshot::text)<=4096),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,attempt_id)
);
CREATE INDEX IF NOT EXISTS behavioral_assessments_user_time_idx ON public.behavioral_assessments(user_id,submitted_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS public.behavioral_drafts (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  questionnaire_version text NOT NULL CHECK(char_length(questionnaire_version) BETWEEN 1 AND 64),
  answers jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<=2048),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.behavioral_badges (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  assessment_id uuid NOT NULL REFERENCES public.behavioral_assessments(id),
  profile_key text NOT NULL CHECK(profile_key IN ('T','A','L','G','F','orca','cisne','leao','onca','puma','combined')),
  mode text NOT NULL CHECK(mode IN ('pure','traits','hybrid','blend','balanced')),
  dominant_key text NOT NULL CHECK(dominant_key IN ('T','A','L','G','F')),
  secondary_key text CHECK(secondary_key IN ('T','A','L','G','F')),
  components jsonb NOT NULL CHECK(jsonb_typeof(components)='array' AND jsonb_array_length(components) BETWEEN 1 AND 5 AND components <@ '["T","A","L","G","F"]'::jsonb),
  questionnaire_version text NOT NULL,
  submitted_at timestamptz NOT NULL
);
REVOKE ALL ON public.behavioral_assessments,public.behavioral_drafts,public.behavioral_badges FROM PUBLIC;
ALTER TABLE public.behavioral_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavioral_badges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS behavioral_assessments_read ON public.behavioral_assessments;
CREATE POLICY behavioral_assessments_read ON public.behavioral_assessments FOR SELECT USING(public.behavioral_can_read(user_id));
DROP POLICY IF EXISTS behavioral_assessments_insert ON public.behavioral_assessments;
CREATE POLICY behavioral_assessments_insert ON public.behavioral_assessments FOR INSERT WITH CHECK((SELECT public.behavioral_actor_active()) AND user_id=(SELECT public.behavioral_actor_id()));
DROP POLICY IF EXISTS behavioral_drafts_owner ON public.behavioral_drafts;
CREATE POLICY behavioral_drafts_owner ON public.behavioral_drafts FOR ALL USING((SELECT public.behavioral_actor_active()) AND user_id=(SELECT public.behavioral_actor_id())) WITH CHECK((SELECT public.behavioral_actor_active()) AND user_id=(SELECT public.behavioral_actor_id()));
DROP POLICY IF EXISTS behavioral_badges_read ON public.behavioral_badges;
CREATE POLICY behavioral_badges_read ON public.behavioral_badges FOR SELECT USING((SELECT public.behavioral_actor_active()) AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=behavioral_badges.user_id AND u.status='active'));
DROP POLICY IF EXISTS behavioral_badges_write ON public.behavioral_badges;
CREATE POLICY behavioral_badges_write ON public.behavioral_badges FOR ALL USING((SELECT public.behavioral_actor_active()) AND user_id=(SELECT public.behavioral_actor_id())) WITH CHECK(
  (SELECT public.behavioral_actor_active()) AND user_id=(SELECT public.behavioral_actor_id()) AND EXISTS(
    SELECT 1 FROM public.behavioral_assessments a WHERE a.id=assessment_id AND a.user_id=behavioral_badges.user_id
      AND a.result->>'profile_key'=profile_key AND a.result->>'mode'=mode AND a.result->>'dominant_key'=dominant_key
      AND (a.result->>'secondary_key') IS NOT DISTINCT FROM secondary_key AND a.result->'components'=components
      AND a.questionnaire_version=behavioral_badges.questionnaire_version AND a.submitted_at=behavioral_badges.submitted_at
  )
);
CREATE OR REPLACE FUNCTION public.behavioral_immutable_assessment() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Avaliações concluídas são imutáveis; inicie uma nova avaliação' USING ERRCODE='42501'; END
$$;
DROP TRIGGER IF EXISTS behavioral_immutable_assessment ON public.behavioral_assessments;
CREATE TRIGGER behavioral_immutable_assessment BEFORE UPDATE OR DELETE ON public.behavioral_assessments FOR EACH ROW EXECUTE FUNCTION public.behavioral_immutable_assessment();
