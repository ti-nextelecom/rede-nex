import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  GripVertical,
  History,
  ImagePlus,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import {
  assignUserToStep,
  createProjectComment,
  createProjectStep,
  createStepHistoryEntry,
  deleteProjectAttachment,
  deleteProjectComment,
  deleteProjectStep,
  fetchProjectAttachments,
  fetchProjectComments,
  fetchProjectSteps,
  fetchProjectUsers,
  fetchStepHistory,
  formatProjectDate,
  removeStepAssignee,
  updateProject,
  updateProjectComment,
  updateProjectStep,
  uploadProjectAttachment,
} from '../lib/projectsApi';
import type { CommentMention, Project, ProjectAttachment, ProjectComment, ProjectStep, ProjectUser, Status, StepHistory } from '../lib/projectsApi';

const statusOptions: Status[] = [
  'Não iniciado',
  'Em andamento',
  'Concluído',
  'Concluído Antes do Prazo',
  'Atrasado',
];


const ACCENT_HEX: Record<string, string> = {
  blue: '#2878ee', teal: '#13a99b', pink: '#d83b9e',
  violet: '#7673ed', orange: '#e9874a', navy: '#304363',
};
function resolveStepColor(color?: string | null): string {
  if (!color) return '#2878ee';
  return color.startsWith('#') ? color : (ACCENT_HEX[color] ?? '#2878ee');
}

const statusDotClass: Record<Status, string> = {
  'Em andamento': 'dot-progress',
  'Concluído': 'dot-done',
  'Concluído Antes do Prazo': 'dot-early',
  'Atrasado': 'dot-late',
  'Atenção': 'dot-attention',
  'Não iniciado': 'dot-idle',
};

const statusPillClass: Record<Status, string> = {
  'Em andamento': 'status-progress',
  'Concluído': 'status-done',
  'Concluído Antes do Prazo': 'status-early',
  'Atrasado': 'status-late',
  'Atenção': 'status-attention',
  'Não iniciado': 'status-idle',
};

const statusLabel: Record<Status, string> = {
  'Em andamento': 'Em andamento',
  'Concluído': 'Concluído',
  'Concluído Antes do Prazo': 'Concluído antes do prazo',
  'Atrasado': 'Atrasado',
  'Atenção': 'Atenção',
  'Não iniciado': 'Aguardando',
};

const statusRowClass: Record<Status, string> = {
  'Concluído': 'row-done',
  'Concluído Antes do Prazo': 'row-early',
  'Atrasado': 'row-late',
  'Em andamento': 'row-progress',
  'Atenção': 'row-attention',
  'Não iniciado': '',
};

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = deadline.includes('T') ? deadline.split('T')[0] : deadline;
  return new Date(`${dateOnly}T00:00:00`) < today;
}

const DONE_STATUSES: Status[] = ['Concluído', 'Concluído Antes do Prazo'];

export function ProjectDetailView({ project, onBack, onProjectUpdated, isAdmin = false, currentUserId, currentUserName }: { project: Project; onBack: () => void; onProjectUpdated: () => void; isAdmin?: boolean; currentUserId?: string; currentUserName?: string }) {
  const [steps, setSteps] = useState<ProjectStep[]>([]);
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStepForm, setShowStepForm] = useState(false);
  const [assigningStep, setAssigningStep] = useState<ProjectStep | null>(null);
  const [editingStepStatus, setEditingStepStatus] = useState<ProjectStep | null>(null);
  const [editCustomLabel, setEditCustomLabel] = useState('');
  const [editCustomColor, setEditCustomColor] = useState('#2878ee');
  const [activeTab, setActiveTab] = useState<'steps' | 'comments' | 'attachments'>('steps');
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachStepId, setAttachStepId] = useState('');
  const attachFileRef = useRef<HTMLInputElement>(null);
  const commentImgRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState<'PSC' | 'PSP' | ''>('');
  const [commentStepId, setCommentStepId] = useState('');
  const [commentMentions, setCommentMentions] = useState<CommentMention[]>([]);
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [editCommentType, setEditCommentType] = useState<'PSC' | 'PSP' | ''>('');
  const [stepFormCustomStatus, setStepFormCustomStatus] = useState(false);
  const [stepFormCustomLabel, setStepFormCustomLabel] = useState('');
  const [stepFormCustomColor, setStepFormCustomColor] = useState('#a0aab8');
  const [stepFormTagColor, setStepFormTagColor] = useState('');
  const [editingStep, setEditingStep] = useState<ProjectStep | null>(null);
  const [editStepData, setEditStepData] = useState({ name: '', desc: '', start: '', deadline: '', color: '#2878ee', status: 'Não iniciado' as Status, tag: '', tagColor: '' });
  const [deliveryStep, setDeliveryStep] = useState<ProjectStep | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [historyStep, setHistoryStep] = useState<ProjectStep | null>(null);
  const [historyData, setHistoryData] = useState<StepHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [assigningType, setAssigningType] = useState<'responsible' | 'participant'>('participant');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxSrc]);

  useEffect(() => {
    if (editingStep) {
      setEditStepData({
        name: editingStep.name,
        desc: editingStep.description ?? '',
        start: editingStep.start_date ?? '',
        deadline: editingStep.deadline ?? '',
        color: resolveStepColor(editingStep.color),
        status: editingStep.status,
        tag: editingStep.tag ?? '',
        tagColor: editingStep.tag_color ?? '',
      });
    }
  }, [editingStep?.id]);

  useEffect(() => {
    if (!showStepForm) {
      setStepFormCustomStatus(false);
      setStepFormCustomLabel('');
      setStepFormCustomColor('#a0aab8');
      setStepFormTagColor('');
    }
  }, [showStepForm]);

  const checkAndFixOverdueSteps = async (loadedSteps: ProjectStep[]): Promise<ProjectStep[]> => {
    const newlyDelayed: { step: ProjectStep; updatedStep: ProjectStep }[] = [];

    const updated = loadedSteps.map((step) => {
      if (!step.deadline) return step;
      if ([...DONE_STATUSES, 'Atrasado'].includes(step.status)) return step;
      if (isOverdue(step.deadline)) {
        newlyDelayed.push({ step, updatedStep: { ...step, status: 'Atrasado' as Status } });
        return { ...step, status: 'Atrasado' as Status };
      }
      return step;
    });

    if (newlyDelayed.length > 0) {
      await Promise.all(newlyDelayed.map(({ step }) => updateProjectStep(project.id, step.id, { status: 'Atrasado' })));
    }

    return updated;
  };

  const recalcAndSyncProject = async (currentSteps: ProjectStep[]) => {
    if (currentSteps.length === 0) return;
    const total = currentSteps.length;
    const completed = currentSteps.filter((s) => DONE_STATUSES.includes(s.status)).length;
    const delayed = currentSteps.filter((s) => s.status === 'Atrasado').length;
    const newProgress = Math.round((completed / total) * 100);

    let newStatus: Status;
    if (newProgress === 100) {
      newStatus = 'Concluído';
    } else if (delayed > 0) {
      newStatus = 'Atenção';
    } else if (completed > 0 || currentSteps.some((s) => s.status === 'Em andamento')) {
      newStatus = 'Em andamento';
    } else {
      newStatus = 'Não iniciado';
    }

    if (newProgress !== project.progress || newStatus !== project.status) {
      await updateProject(project.id, { progress: newProgress, status: newStatus });
      onProjectUpdated();
    }
  };

  const load = useCallback(async (silent = false) => {
    let loadedSteps: ProjectStep[] = [];
    try {
      const [s, u, c, a] = await Promise.all([fetchProjectSteps(project.id), fetchProjectUsers(), fetchProjectComments(project.id), fetchProjectAttachments(project.id)]);
      loadedSteps = s;
      setSteps(s);
      setUsers(u);
      setComments(c);
      setAttachments(a);
      setError(null);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Falha ao carregar dados.');
      return;
    } finally {
      if (!silent) setLoading(false);
    }
    try {
      const checkedSteps = await checkAndFixOverdueSteps(loadedSteps);
      if (checkedSteps.some((s, i) => s.status !== loadedSteps[i]?.status)) {
        setSteps(checkedSteps);
      }
      await recalcAndSyncProject(checkedSteps);
    } catch { /* background sync failure is non-critical */ }
  }, [project.id]);

  useEffect(() => { load(); }, [project.id]);

  useEffect(() => {
    if (currentUserName) setCommentAuthor(currentUserName);
  }, [currentUserName]);

  useEffect(() => {
    const interval = window.setInterval(() => load(true), 8000);
    return () => window.clearInterval(interval);
  }, [load]);

  function resizeImageToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = url;
    });
  }

  async function handleImageFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    const results = await Promise.all(arr.map(resizeImageToDataUrl));
    setCommentImages(prev => [...prev, ...results].slice(0, 4));
  }

  function handleCommentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter(i => i.type.startsWith('image/'));
    if (imageItems.length > 0) {
      e.preventDefault();
      const files = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[];
      handleImageFiles(files);
    }
  }

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && commentImages.length === 0) return;
    setSubmittingComment(true);
    try {
      const comment = await createProjectComment(
        project.id,
        commentAuthor.trim() || 'Anônimo',
        commentText.trim(),
        {
          step_id: commentStepId || null,
          comment_type: commentType || null,
          mentions: commentMentions,
          images: commentImages,
        }
      );
      setComments((prev) => [...prev, comment]);
      setCommentText('');
      setCommentType('');
      setCommentStepId('');
      setCommentMentions([]);
      setCommentImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar comentário.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteProjectComment(project.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir comentário.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setError('Arquivo muito grande. Máximo: 50 MB.'); return; }
    const allowed = ['application/pdf','image/jpeg','image/jpg','image/png','application/zip','application/x-rar-compressed','application/vnd.rar','text/markdown','text/html','application/octet-stream'];
    const extAllowed = /\.(pdf|jpe?g|png|zip|rar|md|html?)$/i.test(file.name);
    if (!allowed.includes(file.type) && !extAllowed) { setError('Tipo de arquivo não permitido. Use PDF, JPG, PNG, ZIP, RAR, MD ou HTML.'); return; }
    setUploadingFile(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => { reader.onload = (ev) => res(ev.target?.result as string); reader.onerror = rej; reader.readAsDataURL(file); });
      const data_base64 = dataUrl.split(',')[1];
      const att = await uploadProjectAttachment(project.id, {
        filename: file.name,
        data_base64,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
        step_id: attachStepId || null,
        uploaded_by: currentUserName ?? 'Anônimo',
      });
      setAttachments((prev) => [att, ...prev]);
      setAttachStepId('');
      if (attachFileRef.current) attachFileRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar arquivo.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (att: ProjectAttachment) => {
    try {
      await deleteProjectAttachment(project.id, att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover anexo.');
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    const text = editCommentText.trim();
    if (!text) return;
    try {
      const updated = await updateProjectComment(project.id, commentId, text, editCommentType || null);
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, content: updated.content, comment_type: updated.comment_type } : c));
      setEditingComment(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao editar comentário.');
    }
  };

  function deriveStatus(label: string): Status {
    const l = label.toLowerCase();
    if (l.includes('conclu') && (l.includes('prazo') || l.includes('antes'))) return 'Concluído Antes do Prazo';
    if (l.includes('conclu') || l.includes('finaliz') || l.includes('entregue') || l.includes('done')) return 'Concluído';
    if (l.includes('atras') || l.includes('atrasad')) return 'Atrasado';
    if (l.includes('andamento') || l.includes('progresso') || l.includes('execu')) return 'Em andamento';
    return 'Não iniciado';
  }

  const handleSaveCustomStatus = async () => {
    if (!editingStepStatus) return;
    const label = editCustomLabel.trim();
    const color = editCustomColor;
    const derivedStatus = label ? deriveStatus(label) : editingStepStatus.status;
    try {
      await updateProjectStep(project.id, editingStepStatus.id, {
        custom_status_label: label || null,
        custom_status_color: color,
        status: derivedStatus,
      });
      setEditingStepStatus(null);
      await load();
      onProjectUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar status.');
    }
  };

  const handleSaveStepEdit = async () => {
    if (!editingStep) return;
    const updatedName = editStepData.name.trim() || editingStep.name;
    setSteps((prev) => prev.map((s) => s.id === editingStep.id ? { ...s, name: updatedName, description: editStepData.desc.trim() || null, start_date: editStepData.start || null, deadline: editStepData.deadline || null, status: editStepData.status, tag: editStepData.tag.trim() || null, tag_color: editStepData.tagColor || null } : s));
    setEditingStep(null);
    try {
      await updateProjectStep(project.id, editingStep.id, {
        name: updatedName,
        description: editStepData.desc.trim() || null,
        start_date: editStepData.start || null,
        deadline: editStepData.deadline || null,
        color: editStepData.color,
        status: editStepData.status,
        tag: editStepData.tag.trim() || null,
        tag_color: editStepData.tagColor || null,
        custom_status_label: editingStep.custom_status_label,
        custom_status_color: editingStep.custom_status_color,
      });
      await createStepHistoryEntry(project.id, editingStep.id, 'Etapa editada', `Nome: "${updatedName}", Status: "${editStepData.status}"`, currentUserName);
      load(true);
      onProjectUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar etapa.');
      load(true);
    }
  };

  const handleCreateStep = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '');
    const color = String(form.get('color') || '#2878ee');
    const statusPresetRaw = String(form.get('status_preset') || 'Não iniciado');
    const startDate = String(form.get('start_date') || '') || null;
    const deadline = String(form.get('deadline') || '') || null;
    const description = String(form.get('description') || '') || null;
    const userId = String(form.get('user_id') || '') || null;
    const stepTag = String(form.get('step_tag') || '').trim() || null;
    const stepTagColor = stepFormTagColor || null;
    let stepStatus: Status;
    let stepCustomLabel: string | null = null;
    let stepCustomColor: string | null = null;
    if (statusPresetRaw === '__custom__') {
      const label = stepFormCustomLabel.trim();
      stepCustomLabel = label || null;
      stepCustomColor = stepFormCustomColor;
      stepStatus = label ? deriveStatus(label) : 'Não iniciado';
    } else {
      stepStatus = statusPresetRaw as Status;
    }
    try {
      const step = await createProjectStep(project.id, {
        name, color, start_date: startDate, deadline, description, order_index: steps.length,
        custom_status_label: stepCustomLabel, custom_status_color: stepCustomColor,
        status: stepStatus, tag: stepTag, tag_color: stepTagColor,
        responsible_user_id: userId || null,
      });
      await createStepHistoryEntry(project.id, step.id, 'Etapa criada', `Nome: "${name}"`, currentUserName);
      setShowStepForm(false);
      await load();
      onProjectUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar etapa.');
    }
  };

  const handleStepStatusChange = async (step: ProjectStep, newStatus: Status) => {
    setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, status: newStatus } : s));
    try {
      await updateProjectStep(project.id, step.id, { status: newStatus });
      await createStepHistoryEntry(project.id, step.id, `Status alterado para "${newStatus}"`, `Status anterior: "${step.status}"`, currentUserName);
      load(true);
      onProjectUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar etapa.');
      load(true);
    }
  };

  const handleDeleteStep = async (id: string) => {
    try {
      await deleteProjectStep(project.id, id);
      await load();
      onProjectUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover etapa.');
    }
  };

  const handleMarkDelivered = async (step: ProjectStep, date: string, isEdit = false) => {
    const isoDate = new Date(`${date}T12:00:00`).toISOString();
    const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
    const completionStatus: Status = (step.deadline && date < step.deadline.split('T')[0])
      ? 'Concluído Antes do Prazo'
      : 'Concluído';
    setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, delivery_date: isoDate, status: completionStatus } : s));
    setDeliveryStep(null);
    setDeliveryDate('');
    setEditingDelivery(false);
    try {
      await updateProjectStep(project.id, step.id, { delivery_date: isoDate, status: completionStatus });
      await createStepHistoryEntry(
        project.id,
        step.id,
        isEdit ? `Data de entrega editada para ${formattedDate}` : `Etapa marcada como entregue em ${formattedDate}`,
        isEdit ? `Data anterior: ${step.delivery_date ? new Date(step.delivery_date).toLocaleDateString('pt-BR') : 'nenhuma'}` : null,
        currentUserName
      );
      load(true);
      onProjectUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar entrega.');
      load(true);
    }
  };

  const handleUndeliver = async (step: ProjectStep) => {
    setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, delivery_date: null, status: 'Em andamento' as Status } : s));
    try {
      await updateProjectStep(project.id, step.id, { delivery_date: null, status: 'Em andamento' as Status });
      await createStepHistoryEntry(
        project.id,
        step.id,
        'Entrega desmarcada',
        `Data de entrega removida. Status retornou para "Em andamento".`,
        currentUserName
      );
      load(true);
      onProjectUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desmarcar entrega.');
      load(true);
    }
  };

  const handleReorder = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, order_index: i }));
    setSteps(updated);
    try {
      await Promise.all(updated.map((s) => updateProjectStep(project.id, s.id, { order_index: s.order_index })));
      await createStepHistoryEntry(project.id, moved.id, `Etapa reposicionada de #${fromIdx + 1} para #${toIdx + 1}`, null, currentUserName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reordenar etapas.');
      load(true);
    }
  };

  const handleAssignUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assigningStep) return;
    const form = new FormData(e.currentTarget);
    const userId = String(form.get('user_id') || '');
    if (!userId) return;
    const user = users.find((u) => u.id === userId);
    try {
      if (assigningType === 'responsible') {
        setSteps((prev) => prev.map((s) => s.id === assigningStep.id ? { ...s, responsible_user_id: userId, responsible_user: user ?? null } : s));
        setAssigningStep(null);
        await updateProjectStep(project.id, assigningStep.id, { responsible_user_id: userId });
        await createStepHistoryEntry(project.id, assigningStep.id, `Responsável definido: ${user?.name ?? userId}`, null, currentUserName);
      } else {
        await assignUserToStep(project.id, assigningStep.id, userId, null);
        setAssigningStep(null);
      }
      load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atribuir usuário.');
      load(true);
    }
  };

  const handleRemoveResponsible = async (step: ProjectStep) => {
    setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, responsible_user_id: null, responsible_user: null } : s));
    try {
      await updateProjectStep(project.id, step.id, { responsible_user_id: null });
      await createStepHistoryEntry(project.id, step.id, 'Responsável removido', null, currentUserName);
      load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover responsável.');
      load(true);
    }
  };

  const handleRemoveAssignee = async (stepId: string, assigneeId: string) => {
    try {
      await removeStepAssignee(project.id, stepId, assigneeId);
      load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover participante.');
    }
  };

  const total = steps.length;
  const doneCount = steps.filter((s) => DONE_STATUSES.includes(s.status)).length;
  const progressCount = steps.filter((s) => s.status === 'Em andamento').length;
  const lateCount = steps.filter((s) => s.status === 'Atrasado').length;
  const attentionCount = steps.filter((s) => s.status === 'Atenção').length;
  const lateSteps = steps.filter((s) => s.status === 'Atrasado');

  return (
    <div className="view-fade">
      <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Voltar para projetos</button>

      <div className="detail-header">
        <div className={`project-badge tone-${project.accent} large-badge`}>{project.code}</div>
        <div>
          <span className="card-category">{project.category}</span>
          <h2 className="detail-title">{project.name}</h2>
          <div className="detail-meta">
            <span className={`status-pill ${statusPillClass[project.status]}`}>
              <i />{statusLabel[project.status]}
            </span>
            <span><CalendarDays size={14} /> Prazo: {formatProjectDate(project.deadline)}</span>
            <span><Clock3 size={14} /> Fase: {project.phase}</span>
            {project.tag && <span className="project-tag">{project.tag}</span>}
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {lateSteps.length > 0 && (
        <div className="late-alert-banner">
          <AlertTriangle size={16} />
          <div>
            <strong>Atenção: {lateSteps.length} etapa{lateSteps.length > 1 ? 's' : ''} atrasada{lateSteps.length > 1 ? 's' : ''}</strong>
            <span>
              {[...new Set(lateSteps.flatMap((s) => s.assignees.map((a) => a.user.name)))].join(', ') || lateSteps.map((s) => s.name).join(', ')}
            </span>
          </div>
        </div>
      )}

      <div className="detail-section">
        <div className="panel-heading">
          <div className="detail-tabs">
            <button className={`detail-tab${activeTab === 'steps' ? ' active' : ''}`} onClick={() => setActiveTab('steps')}>
              Etapas <span className="heading-count">{total}</span>
            </button>
            <button className={`detail-tab${activeTab === 'comments' ? ' active' : ''}`} onClick={() => setActiveTab('comments')}>
              Comentários <span className="heading-count">{comments.length}</span>
            </button>
            <button className={`detail-tab${activeTab === 'attachments' ? ' active' : ''}`} onClick={() => setActiveTab('attachments')}>
              <Paperclip size={13} /> Anexos <span className="heading-count">{attachments.length}</span>
            </button>
          </div>
          {activeTab === 'steps' && isAdmin && (
            <button className="primary-button" onClick={() => setShowStepForm(true)}><Plus size={16} /> Nova etapa</button>
          )}
        </div>

        {activeTab === 'steps' && total > 0 && !loading && (
          <div className="step-perf-bar">
            {doneCount > 0 && <span className="perf-item perf-done"><CheckCircle2 size={12} /> {doneCount} concluída{doneCount > 1 ? 's' : ''}</span>}
            {progressCount > 0 && <span className="perf-item perf-progress"><Clock3 size={12} /> {progressCount} em andamento</span>}
            {lateCount > 0 && <span className="perf-item perf-late"><AlertTriangle size={12} /> {lateCount} atrasada{lateCount > 1 ? 's' : ''}</span>}
            {attentionCount > 0 && <span className="perf-item perf-attention">⚠ {attentionCount} em atenção</span>}
            {doneCount === 0 && progressCount === 0 && lateCount === 0 && attentionCount === 0 && (
              <span className="perf-item perf-idle">{total} não iniciada{total > 1 ? 's' : ''}</span>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="comments-section">
            <form className="comment-form" onSubmit={handleSubmitComment}>
              <div className="comment-form-row">
                <input
                  className="comment-author-input"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={80}
                  readOnly={!!currentUserName}
                />
                <div className="comment-type-toggle">
                  <button type="button" className={`comment-type-btn${commentType === 'PSC' ? ' active-psc' : ''}`} onClick={() => setCommentType(commentType === 'PSC' ? '' : 'PSC')} title="Para seu conhecimento — apenas informação">PSC</button>
                  <button type="button" className={`comment-type-btn${commentType === 'PSP' ? ' active-psp' : ''}`} onClick={() => setCommentType(commentType === 'PSP' ? '' : 'PSP')} title="Para o seu posicionamento — requer ação">PSP</button>
                </div>
              </div>
              <select className="comment-step-select" value={commentStepId} onChange={(e) => setCommentStepId(e.target.value)}>
                <option value="">Sem etapa vinculada</option>
                {steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="comment-mentions-row">
                {commentMentions.map((m) => (
                  <span key={m.id} className="mention-chip">
                    @{m.name.split(' ')[0]}
                    <button type="button" onClick={() => setCommentMentions((prev) => prev.filter((x) => x.id !== m.id))}><X size={10} /></button>
                  </span>
                ))}
                <div className="mention-picker-wrap">
                  <button type="button" className="tag-add-btn" onClick={() => setShowMentionPicker((v) => !v)}>
                    <Plus size={12} /> @Mencionar
                  </button>
                  {showMentionPicker && (
                    <div className="mention-picker-dropdown">
                      {users.filter((u) => !commentMentions.some((m) => m.id === u.id)).map((u) => (
                        <button key={u.id} type="button" className="mention-picker-option" onClick={() => { setCommentMentions((prev) => [...prev, { id: u.id, name: u.name }]); setShowMentionPicker(false); }}>
                          {u.photo_url ? <img src={u.photo_url} alt={u.name} className="avatar avatar-photo" style={{width:20,height:20}} /> : <div className="avatar avatar-navy" style={{width:20,height:20,fontSize:9}}>{getInitials(u.name)}</div>}
                          {u.name}
                        </button>
                      ))}
                      {users.filter((u) => !commentMentions.some((m) => m.id === u.id)).length === 0 && <span style={{padding:'8px 12px',fontSize:12,color:'#64748b'}}>Todos mencionados</span>}
                    </div>
                  )}
                </div>
              </div>
              <textarea
                className="comment-textarea"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onPaste={handleCommentPaste}
                placeholder="Escreva um comentário… (Ctrl+V para colar imagem)"
                rows={3}
              />
              {commentImages.length > 0 && (
                <div className="comment-images-preview">
                  {commentImages.map((src, i) => (
                    <div key={i} className="comment-img-thumb-wrap">
                      <img src={src} className="comment-img-thumb" alt="" />
                      <button type="button" className="comment-img-remove" onClick={() => setCommentImages(prev => prev.filter((_, j) => j !== i))}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-actions">
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button type="button" className="img-attach-btn" onClick={() => commentImgRef.current?.click()} title="Adicionar foto (ou Ctrl+V para colar)">
                    <ImagePlus size={14} /> Foto
                  </button>
                  <input ref={commentImgRef} type="file" accept="image/*" multiple hidden onChange={e => e.target.files && handleImageFiles(e.target.files)} />
                  <div style={{fontSize:11,color:'#94a3b8'}}>
                    {commentType === 'PSC' && <span style={{color:'#2878ee',fontWeight:600}}>PSC — Para seu conhecimento</span>}
                    {commentType === 'PSP' && <span style={{color:'#d83b9e',fontWeight:600}}>PSP — Para o seu posicionamento</span>}
                  </div>
                </div>
                <button type="submit" className="primary-button" disabled={submittingComment || (!commentText.trim() && commentImages.length === 0)}>
                  <Check size={15} /> {submittingComment ? 'Enviando…' : 'Comentar'}
                </button>
              </div>
            </form>
            {comments.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 24 }}>
                <UsersIcon size={28} />
                <h3>Nenhum comentário ainda</h3>
                <p>Adicione observações e documentação sobre o projeto.</p>
              </div>
            ) : (
              <div className="comments-list">
                {comments.map((c) => {
                  const authorUser = users.find((u) => u.name === c.author_name);
                  return (
                  <div key={c.id} className="comment-item">
                    {authorUser?.photo_url
                      ? <img src={authorUser.photo_url} alt={c.author_name} className="comment-avatar comment-avatar-photo" />
                      : <div className="comment-avatar">{c.author_name.charAt(0).toUpperCase()}</div>
                    }
                    <div className="comment-body">
                      <div className="comment-header">
                        <strong>{c.author_name}</strong>
                        {c.comment_type && (
                          <span className={`comment-type-badge ${c.comment_type === 'PSP' ? 'badge-psp' : 'badge-psc'}`}>
                            {c.comment_type === 'PSC' ? '📌 PSC' : '⚡ PSP'}
                          </span>
                        )}
                        {c.step_name && <span className="comment-step-ref">↳ {c.step_name}</span>}
                        <span className="comment-date">{new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {(isAdmin || c.author_name === currentUserName) && (
                          <button className="comment-delete" onClick={() => { setEditingComment(c.id); setEditCommentText(c.content); setEditCommentType(c.comment_type ?? ''); }} title="Editar comentário"><Pencil size={11} /></button>
                        )}
                        {(isAdmin || c.author_name === currentUserName) && (
                          <button className="comment-delete" onClick={() => handleDeleteComment(c.id)} title="Excluir"><X size={12} /></button>
                        )}
                      </div>
                      {(c.mentions ?? []).length > 0 && (
                        <div className="comment-mentions">
                          {(c.mentions ?? []).map((m) => <span key={m.id} className="mention-chip-sm">@{m.name.split(' ')[0]}</span>)}
                        </div>
                      )}
                      {editingComment === c.id ? (
                        <div className="comment-edit-wrap">
                          <textarea
                            className="comment-textarea"
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            rows={2}
                            autoFocus
                          />
                          <div style={{display:'flex',gap:6,marginTop:6,alignItems:'center'}}>
                            <button type="button" className={`comment-type-btn${editCommentType === 'PSC' ? ' active-psc' : ''}`} onClick={() => setEditCommentType(editCommentType === 'PSC' ? '' : 'PSC')} title="Para seu conhecimento">PSC</button>
                            <button type="button" className={`comment-type-btn${editCommentType === 'PSP' ? ' active-psp' : ''}`} onClick={() => setEditCommentType(editCommentType === 'PSP' ? '' : 'PSP')} title="Para o seu posicionamento">PSP</button>
                            <div style={{flex:1}} />
                            <button className="primary-button" style={{fontSize:12,padding:'5px 12px'}} onClick={() => handleSaveCommentEdit(c.id)} disabled={!editCommentText.trim()}><Check size={13} /> Salvar</button>
                            <button className="secondary-button" style={{fontSize:12,padding:'5px 12px'}} onClick={() => setEditingComment(null)}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {c.content && <p className="comment-content">{c.content}</p>}
                          {(c.images ?? []).length > 0 && (
                            <div className="comment-images-display">
                              {(c.images ?? []).map((src, i) => (
                                <button key={i} className="comment-img-btn" onClick={() => setLightboxSrc(src)}>
                                  <img src={src} alt="" className="comment-img-display" />
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="attachments-section">
            <div className="attachment-upload-box">
              <label className="attachment-upload-label">
                <Upload size={18} />
                <span>{uploadingFile ? 'Enviando…' : 'Selecionar arquivo'}</span>
                <small>PDF, JPG, PNG, ZIP, RAR, MD, HTML — máx. 50 MB</small>
                <input
                  ref={attachFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.zip,.rar,.md,.html"
                  style={{ display: 'none' }}
                  disabled={uploadingFile}
                  onChange={handleFileUpload}
                />
              </label>
              <select className="comment-step-select" style={{maxWidth:260}} value={attachStepId} onChange={(e) => setAttachStepId(e.target.value)}>
                <option value="">Projeto inteiro</option>
                {steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {attachments.length === 0 ? (
              <div className="empty-state" style={{marginTop:24}}>
                <Paperclip size={28} /><h3>Nenhum anexo ainda</h3><p>Envie arquivos vinculados a uma etapa ou ao projeto.</p>
              </div>
            ) : (
              <div className="attachments-list">
                {attachments.map((a) => (
                  <div key={a.id} className="attachment-item">
                    <div className="attachment-icon"><FileText size={22} /></div>
                    <div className="attachment-info">
                      <strong className="attachment-name">{a.filename}</strong>
                      <span className="attachment-meta">
                        {a.step_name ? <span className="comment-step-ref">↳ {a.step_name}</span> : <span style={{color:'#94a3b8',fontSize:11}}>Projeto inteiro</span>}
                        {' · '}{a.uploaded_by ?? 'Anônimo'}
                        {' · '}{a.file_size ? `${(a.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                        {' · '}{new Date(a.created_at).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="attachment-actions">
                      <a href={`/api/projects/${project.id}/attachments/${a.id}/download`} download={a.filename} className="round-button" title="Baixar"><Download size={14} /></a>
                      {isAdmin && <button className="round-button" onClick={() => handleDeleteAttachment(a)} title="Excluir"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'steps' && (loading ? (
          <p className="loading-text">Carregando etapas…</p>
        ) : total === 0 ? (
          <div className="empty-state">
            <UsersIcon size={28} />
            <h3>Nenhuma etapa cadastrada</h3>
            <p>Crie etapas para detalhar fases, responsáveis e prazos.</p>
          </div>
        ) : (
          <div className="steps-tbl-wrap">
            <table className="steps-tbl">
              <thead>
                <tr>
                  <th>Fase do projeto</th>
                  <th>Status</th>
                  <th>Descrição</th>
                  <th>Prazo</th>
                  <th>Entregue</th>
                  <th>Responsável</th>
                  <th>Participantes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, idx) => (
                  <tr
                    key={step.id}
                    className={`steps-tbl-row ${statusRowClass[step.status]}${dragOverIdx === idx && dragIdx !== idx ? ' drag-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    onDrop={() => { if (dragIdx !== null && dragIdx !== idx) handleReorder(dragIdx, idx); setDragIdx(null); setDragOverIdx(null); }}
                    style={dragIdx === idx ? { opacity: 0.4 } : undefined}
                  >
                    <td>
                      <div className="step-phase-cell">
                        {isAdmin && (
                          <div
                            className="drag-handle"
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); setDragIdx(idx); }}
                            title="Arrastar para reordenar"
                          >
                            <GripVertical size={14} />
                          </div>
                        )}
                        <div className="step-color-bar" style={{ background: resolveStepColor(step.color) }} />
                        <span className="step-name-text">{step.name}</span>
                        {step.tag
                          ? <span className="project-tag" style={{marginLeft:8,cursor:'pointer',...(step.tag_color ? {background:step.tag_color,borderColor:step.tag_color,color:'#fff'} : {})}} onClick={() => setEditingStep(step)}>{step.tag}</span>
                          : <button className="tag-add-btn" onClick={() => setEditingStep(step)}><Plus size={11} /> Etiqueta</button>
                        }
                      </div>
                    </td>
                    <td>
                      {step.custom_status_label ? (
                        <button
                          className="custom-status-pill"
                          style={{ background: step.custom_status_color ?? '#a0aab8', color: '#fff' }}
                          onClick={() => {
                            setEditingStepStatus(step);
                            setEditCustomLabel(step.custom_status_label ?? '');
                            setEditCustomColor(step.custom_status_color ?? '#a0aab8');
                          }}
                          title="Clique para editar o status personalizado"
                        >
                          {step.custom_status_label}
                        </button>
                      ) : (
                        <label className="step-status-label">
                          <span className={`status-pill ${statusPillClass[step.status]} step-status-pill`}>
                            <span className={`step-status-dot ${statusDotClass[step.status]}`} />
                            {statusLabel[step.status]}
                          </span>
                          <select
                            className="step-status-hidden-select"
                            value={step.status}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__custom__') {
                                setEditingStepStatus(step);
                                setEditCustomLabel('');
                                setEditCustomColor('#a0aab8');
                              } else {
                                handleStepStatusChange(step, val as Status);
                              }
                            }}
                          >
                            {statusOptions.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                            <option value="__custom__">— Personalizada</option>
                          </select>
                        </label>
                      )}
                    </td>
                    <td className="step-desc-cell">
                      {step.description ? (step.description.length > 100 ? step.description.slice(0, 100) + '…' : step.description) : <span className="step-no-desc">—</span>}
                    </td>
                    <td>
                      <div className={`step-date-cell${step.status === 'Atrasado' ? ' date-overdue' : ''}`}>
                        {step.start_date && <><CalendarDays size={12} /><span style={{marginRight:4}}>{formatProjectDate(step.start_date)}</span><span style={{color:'#c5cdd8',marginRight:4}}>→</span></>}
                        <CalendarDays size={12} />
                        {formatProjectDate(step.deadline)}
                      </div>
                    </td>
                    <td>
                      {step.delivery_date ? (
                        <div className="step-delivery-cell">
                          <div className="step-date-cell" style={{color:'#13a99b',fontWeight:600}}>
                            <CheckCircle2 size={13} />
                            <span>{new Date(step.delivery_date).toLocaleDateString('pt-BR', {day:'2-digit',month:'short',year:'numeric'})}</span>
                          </div>
                          {isAdmin && <div className="step-delivery-actions">
                            <button className="tag-add-btn" style={{fontSize:10}} onClick={() => { setDeliveryStep(step); setDeliveryDate(step.delivery_date!.split('T')[0]); setEditingDelivery(true); }} title="Editar data de entrega"><Pencil size={10} /></button>
                            <button className="tag-add-btn" style={{fontSize:10,color:'#ef4444',borderColor:'#ef4444'}} onClick={() => handleUndeliver(step)} title="Desmarcar entrega"><X size={10} /></button>
                          </div>}
                        </div>
                      ) : (() => {
                        const canDeliver = isAdmin || (currentUserId && (step.responsible_user_id === currentUserId || step.assignees.some((a) => a.user_id === currentUserId)));
                        return canDeliver ? (
                          <button className="assign-empty-btn" onClick={() => { setDeliveryStep(step); setDeliveryDate(new Date().toISOString().split('T')[0]); setEditingDelivery(false); }} title="Registrar entrega">
                            <Check size={13} /> Entregar
                          </button>
                        ) : <span className="step-no-desc">—</span>;
                      })()}
                    </td>
                    <td>
                      <div className="step-resp-cell">
                        {step.responsible_user ? (
                          <div className="step-responsible">
                            {step.responsible_user.photo_url
                              ? <img src={step.responsible_user.photo_url} alt={step.responsible_user.name} className="avatar avatar-photo resp-avatar" />
                              : <div className="avatar avatar-navy resp-avatar">{getInitials(step.responsible_user.name)}</div>
                            }
                            <div className="resp-info">
                              <span className="resp-name">{step.responsible_user.name.split(' ')[0]}</span>
                            </div>
                            {isAdmin && <>
                              <button className="assignee-remove" onClick={() => { setAssigningType('responsible'); setAssigningStep(step); }} title="Trocar responsável"><Pencil size={10} /></button>
                              <button className="assignee-remove" onClick={() => handleRemoveResponsible(step)} title="Remover responsável"><X size={10} /></button>
                            </>}
                          </div>
                        ) : (
                          isAdmin && <button className="assign-empty-btn" onClick={() => { setAssigningType('responsible'); setAssigningStep(step); }}>
                            <Plus size={13} /> Definir
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="step-resp-cell">
                        {step.assignees.map((a) => (
                          <div className="step-responsible" key={a.id}>
                            {a.user.photo_url
                              ? <img src={a.user.photo_url} alt={a.user.name} className="avatar avatar-photo resp-avatar" />
                              : <div className="avatar avatar-navy resp-avatar">{getInitials(a.user.name)}</div>
                            }
                            <div className="resp-info">
                              <span className="resp-name">{a.user.name.split(' ')[0]}</span>
                            </div>
                            {isAdmin && <button className="assignee-remove" onClick={() => handleRemoveAssignee(a.step_id, a.id)} title="Remover participante"><X size={10} /></button>}
                          </div>
                        ))}
                        {isAdmin && <button className="assign-empty-btn" onClick={() => { setAssigningType('participant'); setAssigningStep(step); }}>
                          <Plus size={13} /> {step.assignees.length === 0 ? 'Adicionar' : 'Mais'}
                        </button>}
                      </div>
                    </td>
                    <td>
                      <div className="step-tbl-actions">
                        <button className="round-button" onClick={async () => { setHistoryStep(step); setHistoryLoading(true); setHistoryData([]); try { const h = await fetchStepHistory(project.id, step.id); setHistoryData(h); } finally { setHistoryLoading(false); } }} title="Histórico da etapa"><History size={14} /></button>
                        {isAdmin && <>
                          <button className="round-button" onClick={() => setEditingStep(step)} title="Editar etapa"><Pencil size={14} /></button>
                          <button className="round-button" onClick={() => handleDeleteStep(step.id)} title="Excluir etapa"><Trash2 size={14} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {showStepForm && (
        <div className="modal-overlay" onClick={() => setShowStepForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="section-kicker">Nova etapa</span><h3>{project.name}</h3></div>
              <button className="round-button" onClick={() => setShowStepForm(false)}><X size={18} /></button>
            </div>
            <form className="project-form" onSubmit={handleCreateStep}>
              <label>Nome da etapa<input name="name" required placeholder="Ex.: Levantamento de requisitos" /></label>
              <label>Descrição <span className="optional">opcional</span>
                <textarea name="description" rows={2} placeholder="Detalhamento desta fase…" />
              </label>
              <div className="form-row">
                <label>Prazo de início<input name="start_date" type="date" /></label>
                <label>Prazo final<input name="deadline" type="date" /></label>
              </div>
              <label>Status inicial
                <div className="status-preset-picker">
                  {statusOptions.map((s) => (
                    <label key={s} className="status-preset-option">
                      <input type="radio" name="status_preset" value={s} defaultChecked={s === 'Não iniciado'} onChange={() => setStepFormCustomStatus(false)} />
                      <span className={`status-preset-pill ${statusPillClass[s]}`}>
                        <i className={statusDotClass[s]} />
                        {statusLabel[s]}
                      </span>
                    </label>
                  ))}
                  <label className="status-preset-option">
                    <input type="radio" name="status_preset" value="__custom__" onChange={() => setStepFormCustomStatus(true)} />
                    <span className="status-preset-pill status-custom">
                      <i />
                      Personalizada
                    </span>
                  </label>
                </div>
                {stepFormCustomStatus && (
                  <div className="step-custom-status-inline">
                    <input
                      className="step-custom-status-label-input"
                      value={stepFormCustomLabel}
                      onChange={(e) => setStepFormCustomLabel(e.target.value)}
                      placeholder="Ex.: Em revisão, Aguardando aprovação…"
                      maxLength={40}
                    />
                    <input type="color" value={stepFormCustomColor} onChange={(e) => setStepFormCustomColor(e.target.value)} className="step-color-input" style={{ width: 36, height: 36, flexShrink: 0 }} />
                    <span className="custom-status-pill" style={{ background: stepFormCustomColor, color: '#fff' }}>
                      {stepFormCustomLabel || 'Prévia'}
                    </span>
                  </div>
                )}
              </label>
              <label>Etiqueta <span className="optional">opcional — ex: BLOQUEADO, CRÍTICO, AGUARDA</span>
                <input name="step_tag" placeholder="Texto livre para destacar esta etapa" maxLength={25} />
                <div className="tag-color-picker" style={{marginTop:6}}>{'#2878ee,#d83b9e,#11a99b,#7673ed,#e9874a,#ef4444,#f59e0b,#22c55e,#304363,#6b7280'.split(',').map(c => <button type="button" key={c} className={stepFormTagColor === c ? 'accent-dot active' : 'accent-dot'} style={{background:c}} onClick={() => setStepFormTagColor(c)} aria-label={c} />)}<input type="color" value={stepFormTagColor || '#2878ee'} onChange={(e) => setStepFormTagColor(e.target.value)} className="tag-color-input" title="Cor personalizada" />{stepFormTagColor && <button type="button" className="round-button" style={{marginLeft:4,fontSize:14}} onClick={() => setStepFormTagColor('')} title="Limpar cor">×</button>}</div>
              </label>
              <div className="step-form-divider"><span>Responsável</span></div>
              {users.length === 0 ? (
                <p className="step-form-no-users">Nenhum usuário cadastrado ainda.</p>
              ) : (
                <label>Responsável <span className="optional">opcional</span>
                  <select name="user_id" defaultValue="">
                    <option value="">Sem responsável</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.department_name ? ` · ${u.department_name}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setShowStepForm(false)}>Cancelar</button>
                <button type="submit" className="primary-button"><Check size={16} /> Criar etapa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingStep && (
        <div className="modal-overlay" onClick={() => setEditingStep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="section-kicker">Editar etapa</span><h3>{editingStep.name}</h3></div>
              <button className="round-button" onClick={() => setEditingStep(null)}><X size={18} /></button>
            </div>
            <div className="project-form" style={{gap:16}}>
              <label>Nome da etapa
                <input value={editStepData.name} onChange={(e) => setEditStepData((d) => ({ ...d, name: e.target.value }))} required />
              </label>
              <label>Descrição <span className="optional">opcional</span>
                <textarea rows={2} value={editStepData.desc} onChange={(e) => setEditStepData((d) => ({ ...d, desc: e.target.value }))} placeholder="Detalhamento desta fase…" />
              </label>
              <div className="form-row">
                <label>Prazo de início<input type="date" value={editStepData.start} onChange={(e) => setEditStepData((d) => ({ ...d, start: e.target.value }))} /></label>
                <label>Prazo final<input type="date" value={editStepData.deadline} onChange={(e) => setEditStepData((d) => ({ ...d, deadline: e.target.value }))} /></label>
              </div>
              <label>Status
                <div className="status-preset-picker" style={{marginTop:8}}>
                  {statusOptions.map((s) => (
                    <label key={s} className="status-preset-option">
                      <input type="radio" name="edit_step_status" value={s} checked={editStepData.status === s} onChange={() => setEditStepData((d) => ({ ...d, status: s }))} />
                      <span className={`status-preset-pill ${statusPillClass[s]}`}><i />{statusLabel[s]}</span>
                    </label>
                  ))}
                </div>
              </label>
              <label>Etiqueta <span className="optional">opcional</span>
                <input value={editStepData.tag} onChange={(e) => setEditStepData((d) => ({ ...d, tag: e.target.value }))} placeholder="Ex.: BLOQUEADO, CRÍTICO, AGUARDA…" maxLength={25} />
                <div className="tag-color-picker" style={{marginTop:6}}>{'#2878ee,#d83b9e,#11a99b,#7673ed,#e9874a,#ef4444,#f59e0b,#22c55e,#304363,#6b7280'.split(',').map(c => <button type="button" key={c} className={editStepData.tagColor === c ? 'accent-dot active' : 'accent-dot'} style={{background:c}} onClick={() => setEditStepData((d) => ({ ...d, tagColor: c }))} aria-label={c} />)}<input type="color" value={editStepData.tagColor || '#2878ee'} onChange={(e) => setEditStepData((d) => ({ ...d, tagColor: e.target.value }))} className="tag-color-input" title="Cor personalizada" />{editStepData.tagColor && <button type="button" className="round-button" style={{marginLeft:4,fontSize:14}} onClick={() => setEditStepData((d) => ({ ...d, tagColor: '' }))} title="Limpar cor">×</button>}</div>
              </label>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setEditingStep(null)}>Cancelar</button>
                <button type="button" className="primary-button" onClick={handleSaveStepEdit}><Check size={16} /> Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingStepStatus && (
        <div className="modal-overlay" onClick={() => setEditingStepStatus(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="section-kicker">Status da etapa</span><h3>{editingStepStatus.name}</h3></div>
              <button className="round-button" onClick={() => setEditingStepStatus(null)}><X size={18} /></button>
            </div>
            <div className="project-form" style={{ gap: 16 }}>
              <label>Nome do status
                <input
                  value={editCustomLabel}
                  onChange={(e) => setEditCustomLabel(e.target.value)}
                  placeholder="Ex.: Em revisão, Aguardando, Bloqueado…"
                  autoFocus
                />
              </label>
              <label>Cor do status
                <div className="step-color-picker-wrap">
                  <input type="color" value={editCustomColor} onChange={(e) => setEditCustomColor(e.target.value)} className="step-color-input" />
                  <span className="step-color-hint">Cor do badge de status</span>
                  <span className="custom-status-pill" style={{ background: editCustomColor, color: '#fff', marginLeft: 8 }}>{editCustomLabel || 'Prévia'}</span>
                </div>
              </label>
              <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                  onClick={async () => {
                    if (!editingStepStatus) return;
                    await updateProjectStep(project.id, editingStepStatus.id, { custom_status_label: null, custom_status_color: null });
                    setEditingStepStatus(null);
                    await load();
                    onProjectUpdated();
                  }}
                >
                  Remover personalização
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="secondary-button" onClick={() => setEditingStepStatus(null)}>Cancelar</button>
                  <button type="button" className="primary-button" onClick={handleSaveCustomStatus}><Check size={16} /> Salvar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deliveryStep && (
        <div className="modal-overlay" onClick={() => { setDeliveryStep(null); setEditingDelivery(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><span className="section-kicker">{editingDelivery ? 'Editar data de entrega' : 'Registrar entrega'}</span><h3>{deliveryStep.name}</h3></div>
              <button className="round-button" onClick={() => { setDeliveryStep(null); setEditingDelivery(false); }}><X size={18} /></button>
            </div>
            <div className="project-form" style={{gap:16}}>
              <label>Data de entrega
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => { setDeliveryStep(null); setEditingDelivery(false); }}>Cancelar</button>
                <button type="button" className="primary-button" disabled={!deliveryDate} onClick={() => { if (deliveryDate) handleMarkDelivered(deliveryStep, deliveryDate, editingDelivery); }}>
                  <Check size={16} /> {editingDelivery ? 'Salvar nova data' : 'Confirmar entrega'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {historyStep && (
        <div className="modal-overlay" onClick={() => setHistoryStep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth:560}}>
            <div className="modal-header">
              <div><span className="section-kicker">Histórico da etapa</span><h3>{historyStep.name}</h3></div>
              <button className="round-button" onClick={() => setHistoryStep(null)}><X size={18} /></button>
            </div>
            {historyLoading ? (
              <p style={{padding:'16px 0',color:'#64748b',fontSize:14}}>Carregando histórico…</p>
            ) : historyData.length === 0 ? (
              <div className="empty-state" style={{marginTop:16}}><History size={24} /><h3>Sem histórico</h3><p>Nenhuma ação registrada para esta etapa ainda.</p></div>
            ) : (
              <div className="history-list">
                {historyData.map((h) => (
                  <div key={h.id} className="history-item">
                    <div className="history-icon"><History size={13} /></div>
                    <div className="history-body">
                      <strong>{h.action}</strong>
                      {h.details && <span>{h.details}</span>}
                      <div className="history-meta">
                        <span>👤 {h.actor_name ?? 'Sistema'}</span>
                        {h.actor_ip && <span>🌐 {h.actor_ip}</span>}
                        <span>🕐 {new Date(h.created_at).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {assigningStep && (
        <div className="modal-overlay" onClick={() => setAssigningStep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-kicker">{assigningType === 'responsible' ? 'Definir responsável' : 'Adicionar participante'}</span>
                <h3>{assigningStep.name}</h3>
              </div>
              <button className="round-button" onClick={() => setAssigningStep(null)}><X size={18} /></button>
            </div>
            {users.length === 0 ? (
              <div className="empty-state">
                <UsersIcon size={28} /><h3>Nenhum usuário cadastrado</h3><p>Nenhum usuário disponível no sistema.</p>
              </div>
            ) : (
              <form className="project-form" onSubmit={handleAssignUser}>
                <label>{assigningType === 'responsible' ? 'Responsável (único)' : 'Participante'}
                  <select name="user_id" required defaultValue="">
                    <option value="" disabled>Selecione…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.department_name ? ` · ${u.department_name}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {assigningType === 'responsible' && <p style={{fontSize:12,color:'#64748b',margin:0}}>O responsável aparece na tela de apresentação. Apenas um por etapa.</p>}
                <div className="form-actions">
                  <button type="button" className="secondary-button" onClick={() => setAssigningStep(null)}>Cancelar</button>
                  <button type="submit" className="primary-button"><Check size={16} /> {assigningType === 'responsible' ? 'Definir' : 'Adicionar'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
          <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
          <img src={lightboxSrc} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
