import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, ListTodo, RefreshCw } from 'lucide-react';
import { apiPost } from '../lib/apiClient';
import type { buildWorkBriefing } from '../../shared/personalWork.mjs';
import { DashboardCopilotChat } from './DashboardCopilotChat';

type Briefing = ReturnType<typeof buildWorkBriefing>;
type Reply = { reply: string; source?: 'ai' | 'rules' };
// In-memory only, scoped by authenticated user AND work fingerprint. No shared
// browser storage of colleagues' work. Short cache avoids repeated paid calls.
const requests = new Map<string, { at: number; promise: Promise<Reply> }>();

export function DailyBriefing({ briefing, userId }: { briefing: Briefing; userId: string }) {
  const [reply, setReply] = useState<Reply | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const fingerprint = JSON.stringify(briefing);
  useEffect(() => {
    let active = true;
    setReply(null); setUnavailable(false); setLoading(true);
    const key = `${userId}:${fingerprint}:${revision}`;
    const now = Date.now();
    for (const [id, item] of requests) if (now - item.at > 5 * 60_000) requests.delete(id);
    if (!requests.has(key)) {
      if (requests.size >= 20) requests.delete(requests.keys().next().value!);
      requests.set(key, { at: now, promise: apiPost<Reply>('/copiloto', {
        message: 'Prepare meu briefing de hoje e priorize minhas pendências.', intent: 'daily-briefing', history: [],
      }) });
    }
    void requests.get(key)!.promise.then(result => { if (active) setReply(result); })
      .catch(() => { if (active) setUnavailable(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, fingerprint, revision]);

  return <section className="daily-briefing" aria-labelledby="daily-briefing-title">
    <div className="daily-briefing-heading"><div><h2 id="daily-briefing-title">Visão do dia</h2><p>Suas prioridades e acesso rápido ao trabalho.</p></div><button type="button" aria-label="Atualizar briefing do Copiloto" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /><span>Atualizar</span></button></div>
    <div className="daily-briefing-body">
      <div className="daily-briefing-copy">
        <p className="daily-briefing-lead">{briefing.pending ? <>Você tem <strong>{briefing.pending} pendências</strong>, sendo <strong>{briefing.overdue} vencidas</strong> e <strong>{briefing.today} para hoje</strong>.</> : 'Nenhuma tarefa atribuída pendente. Confira também as etapas dos seus projetos.'}</p>
        <p className="daily-briefing-source" role="status">{loading ? 'Atualizando resumo…' : reply?.source === 'ai' ? 'Resumo gerado por IA' : unavailable ? 'Resumo local das suas atividades' : 'Resumo operacional da REDE NEX'}</p>
        {reply && <p className="daily-briefing-response">{reply.reply}</p>}
        <h3 className="daily-briefing-project-label">Projetos em andamento</h3><div className="daily-briefing-projects">{briefing.projects.slice(0, 3).map(project => <Link key={project.id} to={`/projetos?projeto=${encodeURIComponent(project.id)}`}><span>{project.involvement === 'responsible' ? 'Responsável' : 'Participante'}</span><strong>{project.name}</strong><small>{project.pending_count === null ? 'Etapas indisponíveis' : `${project.pending_count} etapa(s) pendente(s)`}{project.overdue_count ? ` • ${project.overdue_count} vencida(s)` : ''}</small><ArrowRight size={16} /></Link>)}{!briefing.projects.length&&<p>Nenhum projeto ativo no seu resumo.</p>}</div>
      </div>
      <div className="daily-briefing-live-chat"><DashboardCopilotChat briefing={briefing} autoStartConversation /></div>
    </div>
    <div className="daily-briefing-focus"><h3><ListTodo size={17} /> Por onde começar</h3><div className="daily-briefing-focus-list">{briefing.focus.map((task, index) => <Link key={task.id} to={`/tarefas?tarefa=${encodeURIComponent(task.id)}`}><span>{index + 1}</span><div><strong>{task.title}</strong><small><Clock3 size={12} />{task.deadline ? new Date(task.deadline.includes('T') ? task.deadline : `${task.deadline}T12:00:00`).toLocaleDateString('pt-BR') : 'Definir prazo'} • {task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta prioridade' : 'Planejada'}</small></div><ArrowRight size={15} /></Link>)}</div>{!briefing.focus.length && <p>Suas próximas tarefas aparecerão aqui. Abra os projetos abaixo para revisar as etapas da equipe.</p>}</div>
  </section>;
}
