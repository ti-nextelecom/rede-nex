ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS task_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS public.task_template_recipients (
  template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY(template_id,user_id)
);
CREATE INDEX IF NOT EXISTS task_template_recipients_user_idx ON public.task_template_recipients(user_id,template_id);
CREATE TABLE IF NOT EXISTS public.task_checklist_item_people (
  item_id uuid NOT NULL REFERENCES public.task_checklist_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('participant','observer')),
  PRIMARY KEY(item_id,user_id,role)
);
CREATE INDEX IF NOT EXISTS task_checklist_item_people_user_idx ON public.task_checklist_item_people(user_id,item_id);
REVOKE ALL ON public.task_template_recipients, public.task_checklist_item_people FROM PUBLIC;
