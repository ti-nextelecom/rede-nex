-- Individual calendar days retain their revision even when cleared to 'unplanned'.
CREATE TABLE IF NOT EXISTS public.work_schedule_entries (
  user_id uuid NOT NULL REFERENCES public.users(id),
  day date NOT NULL CHECK(day BETWEEN '2000-01-01' AND '2100-12-31'),
  status text NOT NULL CHECK(status IN ('work','off','agreed_off','unplanned')),
  start_time text,
  end_time text,
  note text NOT NULL DEFAULT '' CHECK(char_length(note)<=500),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_by uuid NOT NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,day),
  CHECK((status='work' AND start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time<>end_time)
    OR (status<>'work' AND start_time IS NULL AND end_time IS NULL))
);
CREATE INDEX IF NOT EXISTS work_schedule_entries_day_idx ON public.work_schedule_entries(day,user_id);
CREATE INDEX IF NOT EXISTS work_schedule_entries_actor_idx ON public.work_schedule_entries(updated_by);
CREATE TABLE IF NOT EXISTS public.work_schedule_operations (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES public.users(id),
  request_hash text NOT NULL CHECK(length(request_hash)=64),
  changed_count integer NOT NULL CHECK(changed_count>=0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_schedule_operations_actor_idx ON public.work_schedule_operations(actor_id);
CREATE TABLE IF NOT EXISTS public.work_schedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.work_schedule_operations(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  day date NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.users(id),
  actor_name text NOT NULL,
  before_data jsonb,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_schedule_history_user_day_idx ON public.work_schedule_history(user_id,day,created_at DESC,id);
CREATE INDEX IF NOT EXISTS work_schedule_history_time_idx ON public.work_schedule_history(created_at DESC,id);
CREATE INDEX IF NOT EXISTS work_schedule_history_operation_idx ON public.work_schedule_history(operation_id);
CREATE INDEX IF NOT EXISTS work_schedule_history_actor_idx ON public.work_schedule_history(actor_id);

CREATE OR REPLACE FUNCTION public.schedule_actor_id() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nullif(current_setting('app.schedule_user_id',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION public.schedule_is_admin() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.roles r ON r.id=u.role_id
    WHERE u.id=public.schedule_actor_id() AND u.status='active' AND r.name='Administrador')
$$;
CREATE OR REPLACE FUNCTION public.schedule_is_supervisor() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u LEFT JOIN public.roles r ON r.id=u.role_id
    WHERE u.id=public.schedule_actor_id() AND u.status='active'
      AND (r.name IN ('Administrador','Gestor','Supervisor') OR EXISTS(SELECT 1 FROM public.departments d WHERE d.manager_id=u.id)))
$$;
CREATE OR REPLACE FUNCTION public.schedule_can_manage(subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id=public.schedule_actor_id() AND status='active') AND (
    public.schedule_is_admin() OR (
      WITH RECURSIVE ancestry AS (
        SELECT d.id,d.parent_id,d.manager_id,ARRAY[d.id] AS visited,false AS cyclic,1 AS depth
          FROM public.users u JOIN public.departments d ON d.id=u.department_id WHERE u.id=subject_id
        UNION ALL
        SELECT p.id,p.parent_id,p.manager_id,a.visited||p.id,p.id=ANY(a.visited),a.depth+1
          FROM public.departments p JOIN ancestry a ON p.id=a.parent_id WHERE NOT a.cyclic AND a.depth<64
      )
      SELECT EXISTS(SELECT 1 FROM ancestry WHERE manager_id=public.schedule_actor_id())
        AND NOT EXISTS(SELECT 1 FROM ancestry WHERE cyclic OR (depth=64 AND parent_id IS NOT NULL))
    )
  )
$$;
CREATE OR REPLACE FUNCTION public.schedule_can_read(subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT public.schedule_is_supervisor() OR EXISTS(SELECT 1 FROM public.users
    WHERE id=public.schedule_actor_id() AND status='active' AND id=subject_id)
$$;
REVOKE ALL ON public.work_schedule_entries,public.work_schedule_operations,public.work_schedule_history FROM PUBLIC;
ALTER TABLE public.work_schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedule_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedule_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedule_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedule_history FORCE ROW LEVEL SECURITY;
CREATE POLICY schedule_entries_read ON public.work_schedule_entries FOR SELECT USING(public.schedule_can_read(user_id));
CREATE POLICY schedule_entries_insert ON public.work_schedule_entries FOR INSERT WITH CHECK(public.schedule_can_manage(user_id) AND updated_by=public.schedule_actor_id());
CREATE POLICY schedule_entries_update ON public.work_schedule_entries FOR UPDATE USING(public.schedule_can_manage(user_id)) WITH CHECK(public.schedule_can_manage(user_id) AND updated_by=public.schedule_actor_id());
CREATE POLICY schedule_operations_read ON public.work_schedule_operations FOR SELECT USING(actor_id=public.schedule_actor_id());
CREATE POLICY schedule_operations_insert ON public.work_schedule_operations FOR INSERT WITH CHECK(actor_id=public.schedule_actor_id() AND public.schedule_is_supervisor());
CREATE POLICY schedule_history_read ON public.work_schedule_history FOR SELECT USING(public.schedule_can_read(user_id));
CREATE POLICY schedule_history_insert ON public.work_schedule_history FOR INSERT WITH CHECK(actor_id=public.schedule_actor_id() AND public.schedule_can_manage(user_id));
