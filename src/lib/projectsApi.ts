import { apiDelete, apiGet, apiPost, apiPut } from './apiClient';

export type Status = 'Não iniciado' | 'Em andamento' | 'Concluído' | 'Concluído Antes do Prazo' | 'Atrasado' | 'Atenção';
export type Accent = 'blue' | 'pink' | 'teal' | 'violet' | 'orange' | 'navy';

export type Project = {
  id: string;
  name: string;
  code: string;
  responsible_name: string;
  responsible_photo_url: string | null;
  status: Status;
  progress: number;
  deadline: string | null;
  start_date: string | null;
  category: string;
  phase: string;
  next_action: string;
  summary: string | null;
  accent: Accent;
  tag: string | null;
  tag_color: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectUser = {
  id: string;
  name: string;
  photo_url?: string | null;
  department_name?: string | null;
  role_name?: string | null;
};

export type ProjectStep = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  deadline: string | null;
  responsible_name: string | null;
  responsible_user_id: string | null;
  responsible_user: ProjectUser | null;
  status: Status;
  order_index: number;
  color: string;
  custom_status_label: string | null;
  custom_status_color: string | null;
  assignees: StepAssigneeWithUser[];
  tag: string | null;
  tag_color: string | null;
  delivery_date: string | null;
};

export type StepAssignee = {
  id: string;
  step_id: string;
  user_id: string;
  deadline: string | null;
  created_at: string;
};

export type StepAssigneeWithUser = StepAssignee & {
  user: ProjectUser;
};

export type ProjectRequest = {
  id: string;
  project_id: string | null;
  title: string;
  requester_name: string;
  request_type: string;
  status: 'Aberta' | 'Em análise' | 'Concluída';
  created_at: string;
};

export type CommentMention = { id: string; name: string };

export type ProjectComment = {
  id: string;
  project_id: string;
  author_name: string;
  content: string;
  step_id: string | null;
  step_name?: string | null;
  comment_type: 'PSC' | 'PSP' | null;
  mentions: CommentMention[];
  images?: string[];
  created_at: string;
};

export type ProjectAttachment = {
  id: string;
  project_id: string;
  step_id: string | null;
  step_name: string | null;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type StepHistory = {
  id: string;
  step_id: string;
  action: string;
  details: string | null;
  actor_name: string | null;
  actor_ip: string | null;
  created_at: string;
};

export const DEFAULT_PHASES = [
  'Descoberta', 'Planejamento', 'Execução', 'Testes', 'Go-live', 'Estabilização',
];

export function formatProjectDate(value: string | null): string {
  if (!value) return 'A definir';
  const dateOnly = value.includes('T') ? value.split('T')[0] : value;
  const date = new Date(`${dateOnly}T12:00:00`);
  if (isNaN(date.getTime())) return 'A definir';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
  return res.data;
}

export async function fetchProjects(): Promise<Project[]> {
  return unwrap(apiGet<{ data: Project[] }>('/projects'));
}

export async function createProject(payload: {
  name: string; responsible_name: string; responsible_photo_url?: string | null;
  category?: string; start_date?: string | null; deadline?: string | null;
  summary?: string | null; accent?: Accent; status?: Status; tag?: string | null;
}): Promise<Project> {
  const code = payload.name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  return unwrap(apiPost<{ data: Project }>('/projects', {
    ...payload, code,
    status: payload.status ?? 'Não iniciado',
    progress: 0,
    phase: 'Descoberta',
    next_action: 'Definir primeiro passo',
    category: payload.category ?? 'Estratégico',
    accent: payload.accent ?? 'blue',
  }));
}

export async function updateProject(id: string, payload: Partial<Project>): Promise<Project> {
  return unwrap(apiPut<{ data: Project }>(`/projects/${id}`, payload));
}

export async function deleteProject(id: string): Promise<void> {
  return apiDelete(`/projects/${id}`);
}

export async function fetchProjectSteps(projectId: string): Promise<ProjectStep[]> {
  return unwrap(apiGet<{ data: ProjectStep[] }>(`/projects/${projectId}/steps`));
}

export async function createProjectStep(projectId: string, payload: {
  name: string; color?: string; start_date?: string | null; deadline?: string | null;
  description?: string | null; order_index?: number; status?: Status;
  custom_status_label?: string | null; custom_status_color?: string | null;
  tag?: string | null; tag_color?: string | null; responsible_user_id?: string | null;
}): Promise<ProjectStep> {
  return unwrap(apiPost<{ data: ProjectStep }>(`/projects/${projectId}/steps`, payload));
}

export async function updateProjectStep(projectId: string, stepId: string, payload: Partial<Omit<ProjectStep, 'id' | 'project_id'>>): Promise<ProjectStep> {
  return unwrap(apiPut<{ data: ProjectStep }>(`/projects/${projectId}/steps/${stepId}`, payload));
}

export async function deleteProjectStep(projectId: string, stepId: string): Promise<void> {
  return apiDelete(`/projects/${projectId}/steps/${stepId}`);
}

export async function assignUserToStep(projectId: string, stepId: string, userId: string, deadline?: string | null): Promise<StepAssignee> {
  return unwrap(apiPost<{ data: StepAssignee }>(`/projects/${projectId}/steps/${stepId}/assignees`, { user_id: userId, deadline: deadline ?? null }));
}

export async function removeStepAssignee(projectId: string, stepId: string, assigneeId: string): Promise<void> {
  return apiDelete(`/projects/${projectId}/steps/${stepId}/assignees/${assigneeId}`);
}

export async function fetchStepHistory(projectId: string, stepId: string): Promise<StepHistory[]> {
  return unwrap(apiGet<{ data: StepHistory[] }>(`/projects/${projectId}/steps/${stepId}/history`));
}

export async function createStepHistoryEntry(projectId: string, stepId: string, action: string, details?: string | null, actorName?: string): Promise<void> {
  await apiPost<{ data: StepHistory }>(`/projects/${projectId}/steps/${stepId}/history`, {
    action, details: details ?? null, actor_name: actorName ?? 'Sistema',
  });
}

export async function fetchProjectComments(projectId: string): Promise<ProjectComment[]> {
  return unwrap(apiGet<{ data: ProjectComment[] }>(`/projects/${projectId}/comments`));
}

export async function createProjectComment(
  projectId: string, authorName: string, content: string,
  options?: { step_id?: string | null; comment_type?: 'PSC' | 'PSP' | null; mentions?: CommentMention[]; images?: string[] }
): Promise<ProjectComment> {
  return unwrap(apiPost<{ data: ProjectComment }>(`/projects/${projectId}/comments`, {
    author_name: authorName, content,
    step_id: options?.step_id ?? null,
    comment_type: options?.comment_type ?? null,
    mentions: options?.mentions ?? [],
    images: options?.images ?? [],
  }));
}

export async function updateProjectComment(projectId: string, commentId: string, content: string, commentType?: 'PSC' | 'PSP' | null): Promise<ProjectComment> {
  return unwrap(apiPut<{ data: ProjectComment }>(`/projects/${projectId}/comments/${commentId}`, { content, comment_type: commentType ?? null }));
}

export async function deleteProjectComment(projectId: string, commentId: string): Promise<void> {
  return apiDelete(`/projects/${projectId}/comments/${commentId}`);
}

export async function fetchProjectAttachments(projectId: string): Promise<ProjectAttachment[]> {
  return unwrap(apiGet<{ data: ProjectAttachment[] }>(`/projects/${projectId}/attachments`));
}

export async function uploadProjectAttachment(
  projectId: string,
  payload: { filename: string; data_base64: string; mime_type: string; file_size: number; step_id?: string | null; uploaded_by?: string }
): Promise<ProjectAttachment> {
  return unwrap(apiPost<{ data: ProjectAttachment }>(`/projects/${projectId}/attachments`, payload));
}

export async function deleteProjectAttachment(projectId: string, attachmentId: string): Promise<void> {
  return apiDelete(`/projects/${projectId}/attachments/${attachmentId}`);
}

export async function fetchProjectUsers(): Promise<ProjectUser[]> {
  return unwrap(apiGet<{ data: ProjectUser[] }>('/users'));
}

export async function fetchOpenRequests(): Promise<ProjectRequest[]> {
  return unwrap(apiGet<{ data: ProjectRequest[] }>('/project-requests?status=Aberta'));
}

export async function createRequest(payload: {
  project_id?: string | null; title: string; requester_name: string; request_type?: string;
}): Promise<ProjectRequest> {
  return unwrap(apiPost<{ data: ProjectRequest }>('/project-requests', payload));
}
