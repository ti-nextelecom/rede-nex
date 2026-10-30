-- Upgrade the existing native PostgreSQL database. Applied only by db:migrate.
CREATE TABLE IF NOT EXISTS public.task_observers (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_observers_user_task_idx ON public.task_observers(user_id, task_id);

-- Removing a checklist step retains the file in the task's general library.
ALTER TABLE public.task_files ADD COLUMN IF NOT EXISTS checklist_item_id uuid
  REFERENCES public.task_checklist_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS task_files_checklist_item_idx ON public.task_files(checklist_item_id)
  WHERE checklist_item_id IS NOT NULL;
