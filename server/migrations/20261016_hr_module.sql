-- Execute explicitly with the application's migration owner, never on startup.
BEGIN;
CREATE SCHEMA IF NOT EXISTS nex_hr;
REVOKE ALL ON SCHEMA nex_hr FROM PUBLIC;
CREATE TABLE IF NOT EXISTS nex_hr.grants (
  target_kind text NOT NULL CHECK (target_kind IN ('role','user')),
  target_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('rh.view','rh.manage','aso.view','aso.manage','aso.export','vacations.view','vacations.manage','vacations.export')),
  allowed boolean NOT NULL,
  PRIMARY KEY(target_kind,target_id,permission)
);
CREATE TABLE IF NOT EXISTS nex_hr.settings (id integer PRIMARY KEY CHECK(id=1), revision integer NOT NULL DEFAULT 1);
ALTER TABLE nex_hr.settings NO FORCE ROW LEVEL SECURITY;
INSERT INTO nex_hr.settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS nex_hr.employees (
  id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES public.users(id),
  employee_code text UNIQUE, full_name text NOT NULL CHECK(length(full_name) BETWEEN 2 AND 200),
  short_name text NOT NULL DEFAULT '', team text NOT NULL DEFAULT '', area text NOT NULL DEFAULT '', company text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '', admission_on date, needs_review boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_employees_team_idx ON nex_hr.employees(team) WHERE NOT archived;
CREATE TABLE IF NOT EXISTS nex_hr.asos (
  id uuid PRIMARY KEY, employee_id uuid NOT NULL UNIQUE REFERENCES nex_hr.employees(id),
  last_exam_on date, periodicity_months integer NOT NULL DEFAULT 12 CHECK(periodicity_months BETWEEN 1 AND 60),
  scheduled_on date, planned_month date CHECK(planned_month IS NULL OR extract(day FROM planned_month)=1), completed_on date,
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000), checklist jsonb NOT NULL DEFAULT '{}',
  archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(scheduled_on IS NULL OR planned_month IS NULL)
);
CREATE TABLE IF NOT EXISTS nex_hr.vacations (
  id uuid PRIMARY KEY, employee_id uuid NOT NULL REFERENCES nex_hr.employees(id),
  acquisition_start date NOT NULL, acquisition_end date NOT NULL, concession_end date NOT NULL,
  balance_days numeric(6,2) NOT NULL CHECK(balance_days BETWEEN 0 AND 366), source_start_limit date,
  start_on date, planned_month date CHECK(planned_month IS NULL OR extract(day FROM planned_month)=1),
  leave_days integer NOT NULL DEFAULT 30 CHECK(leave_days BETWEEN 1 AND 60), bonus_days integer NOT NULL DEFAULT 0 CHECK(bonus_days BETWEEN 0 AND 30),
  awaiting_employee boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','planned','completed','cancelled')),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000), checklist jsonb NOT NULL DEFAULT '{}',
  archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id,acquisition_start,acquisition_end),
  CHECK(acquisition_end>=acquisition_start AND concession_end>acquisition_end),
  CHECK(start_on IS NULL OR planned_month IS NULL),
  CHECK(status IN ('draft','cancelled') OR leave_days+bonus_days<=balance_days)
);
CREATE INDEX IF NOT EXISTS hr_vacations_employee_idx ON nex_hr.vacations(employee_id);
CREATE INDEX IF NOT EXISTS hr_vacations_start_idx ON nex_hr.vacations(start_on) WHERE NOT archived;
CREATE TABLE IF NOT EXISTS nex_hr.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.users(id),
  resource text NOT NULL CHECK(resource IN ('rh','aso','vacations','permissions')), entity_id uuid,
  operation text NOT NULL, before_data jsonb, after_data jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_audit_actor_idx ON nex_hr.audit(actor_id);
CREATE INDEX IF NOT EXISTS hr_audit_entity_idx ON nex_hr.audit(entity_id,created_at DESC);
CREATE TABLE IF NOT EXISTS nex_hr.import_keys (
  source text NOT NULL, source_id text NOT NULL, employee_id uuid NOT NULL REFERENCES nex_hr.employees(id),
  PRIMARY KEY(source,source_id)
);
CREATE INDEX IF NOT EXISTS hr_import_employee_idx ON nex_hr.import_keys(employee_id);
CREATE OR REPLACE FUNCTION nex_hr.actor_id() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nullif(current_setting('nex_hr.actor',true),'')::uuid
$$;
CREATE OR REPLACE FUNCTION nex_hr.is_admin() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.roles r ON r.id=u.role_id WHERE u.id=nex_hr.actor_id() AND u.status='active' AND r.name='Administrador')
$$;
-- Invoker functions: no SECURITY DEFINER or bypass of permission-table RLS.
CREATE OR REPLACE FUNCTION nex_hr.raw_allowed(p text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT coalesce((SELECT g.allowed FROM nex_hr.grants g WHERE g.target_kind='user' AND g.target_id=nex_hr.actor_id() AND g.permission=p),
    (SELECT g.allowed FROM nex_hr.grants g JOIN public.users u ON u.role_id=g.target_id WHERE g.target_kind='role' AND u.id=nex_hr.actor_id() AND u.status='active' AND g.permission=p),false)
$$;
CREATE OR REPLACE FUNCTION nex_hr.allowed(p text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nex_hr.is_admin() OR (EXISTS(SELECT 1 FROM public.users WHERE id=nex_hr.actor_id() AND status='active') AND nex_hr.raw_allowed('rh.view') AND nex_hr.raw_allowed(p)
    AND (split_part(p,'.',1)='rh' OR nex_hr.raw_allowed(split_part(p,'.',1)||'.view')))
$$;
ALTER TABLE nex_hr.grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_hr.grants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS grants_read ON nex_hr.grants;
CREATE POLICY grants_read ON nex_hr.grants FOR SELECT USING (nex_hr.is_admin() OR (target_kind='user' AND target_id=nex_hr.actor_id()) OR (target_kind='role' AND target_id=(SELECT role_id FROM public.users WHERE id=nex_hr.actor_id())));
DROP POLICY IF EXISTS grants_write ON nex_hr.grants;
CREATE POLICY grants_write ON nex_hr.grants FOR ALL USING(nex_hr.is_admin()) WITH CHECK(nex_hr.is_admin());
ALTER TABLE nex_hr.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_hr.settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_admin ON nex_hr.settings;
CREATE POLICY settings_admin ON nex_hr.settings FOR ALL USING(nex_hr.is_admin()) WITH CHECK(nex_hr.is_admin());
DO $policies$
DECLARE t text; resource text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employees','asos','vacations','import_keys'] LOOP
    resource := CASE WHEN t='asos' THEN 'aso' WHEN t='vacations' THEN 'vacations' ELSE 'rh' END;
    EXECUTE format('ALTER TABLE nex_hr.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE nex_hr.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS data_read ON nex_hr.%I',t);
    EXECUTE format('DROP POLICY IF EXISTS data_write ON nex_hr.%I',t);
    IF t='employees' THEN
      EXECUTE format('CREATE POLICY data_read ON nex_hr.%I FOR SELECT USING(nex_hr.allowed(''aso.view'') OR nex_hr.allowed(''vacations.view'') OR nex_hr.allowed(''rh.manage''))',t);
    ELSE
      EXECUTE format('CREATE POLICY data_read ON nex_hr.%I FOR SELECT USING(nex_hr.allowed(%L))',t,resource||'.view');
    END IF;
    EXECUTE format('CREATE POLICY data_write ON nex_hr.%I FOR ALL USING(nex_hr.allowed(%L)) WITH CHECK(nex_hr.allowed(%L))',t,resource||'.manage',resource||'.manage');
  END LOOP;
END $policies$;
ALTER TABLE nex_hr.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_hr.audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_read ON nex_hr.audit;
CREATE POLICY audit_read ON nex_hr.audit FOR SELECT USING (nex_hr.is_admin() OR (resource<>'permissions' AND nex_hr.allowed(resource||'.view')));
DROP POLICY IF EXISTS audit_insert ON nex_hr.audit;
CREATE POLICY audit_insert ON nex_hr.audit FOR INSERT WITH CHECK(actor_id=nex_hr.actor_id() AND (nex_hr.is_admin() OR (resource<>'permissions' AND nex_hr.allowed(resource||'.manage'))));
REVOKE ALL ON ALL TABLES IN SCHEMA nex_hr FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA nex_hr FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nex_hr FROM PUBLIC;
COMMIT;
