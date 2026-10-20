-- Existing VM only: move legacy startup DDL into an explicit migration.
CREATE TABLE IF NOT EXISTS public.ti_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  description text DEFAULT '', responsible text DEFAULT 'TI', status text NOT NULL DEFAULT 'Em andamento',
  start_date date, due_date date, progress_pct int NOT NULL DEFAULT 0, color text DEFAULT 'blue',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ti_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.ti_projects(id) ON DELETE SET NULL,
  title text NOT NULL, description text DEFAULT '', category text DEFAULT '', priority text NOT NULL DEFAULT 'Média',
  responsible text DEFAULT 'Wendel', requester text DEFAULT '', status text NOT NULL DEFAULT 'Backlog',
  progress_pct int NOT NULL DEFAULT 0, scheduled_date date, scheduled_time time, started_at timestamptz,
  completed_at timestamptz, due_date date, blocked_reason text DEFAULT '', observations text DEFAULT '', result text DEFAULT '',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ti_task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid REFERENCES public.ti_tasks(id) ON DELETE CASCADE,
  field_changed text NOT NULL, old_value text, new_value text, changed_by text DEFAULT 'Sistema', ts timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ti_tasks_project_idx ON public.ti_tasks(project_id);
CREATE INDEX IF NOT EXISTS ti_history_task_idx ON public.ti_task_history(task_id);
CREATE TABLE IF NOT EXISTS public.training_progress (
  user_id text NOT NULL, training_id text NOT NULL, progress_pct int NOT NULL DEFAULT 0,
  completed_at timestamptz, PRIMARY KEY(user_id,training_id)
);
CREATE TABLE IF NOT EXISTS public.nav_settings (
  role_name varchar(100) PRIMARY KEY, visible_routes jsonb, updated_at timestamptz DEFAULT now()
);
