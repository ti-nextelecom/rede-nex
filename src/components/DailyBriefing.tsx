import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Clock3, Cpu, ListTodo, RefreshCw, ScanLine } from 'lucide-react';
import { apiPost } from '../lib/apiClient';
import type { buildWorkBriefing } from '../../shared/personalWork.mjs';
import { DashboardCopilotChat } from './DashboardCopilotChat';
import { JarvisVoiceVisual } from './JarvisVoiceVisual';
import type { JarvisVoiceState } from '../hooks/useJarvisSpeech';

type Briefing = ReturnType<typeof buildWorkBriefing>;
type Reply = { reply: string; source?: 'ai' | 'rules' };
// In-memory only, scoped by authenticated user AND work fingerprint. No shared
// browser storage of colleagues' work. Short cache avoids repeated paid calls.
const requests = new Map<string, { at: number; promise: Promise<Reply> }>();

export function DailyBriefing({ briefing, userId, userName }: { briefing: Briefing; userId: string; userName?: string }) {
  const [reply, setReply] = useState<Reply | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const [voiceState, setVoiceState] = useState<JarvisVoiceState>('idle');
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

  return <section id="jarvis-assistant" data-voice-state={voiceState} className="daily-briefing" aria-labelledby="daily-briefing-title">
    <div className="daily-briefing-heading"><div className="jarvis-section-label"><Cpu size={18} /><span>INTELIGÊNCIA A SEU FAVOR</span></div><span className="jarvis-context-label"><ScanLine size={15} /> Seu contexto. Suas prioridades.</span><button type="button" aria-label="Atualizar briefing do Jarvis" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} /><span>Atualizar resumo</span></button></div>
    <div className="daily-briefing-body">
      <div className="daily-briefing-copy">
        <div className="jarvis-introduction">
          <div><span className="jarvis-eyebrow">SEU ASSISTENTE PESSOAL</span><h2 id="daily-briefing-title">Jarvis<span>.</span></h2><p>Seu dia conectado.<br /><strong>Você no comando.</strong></p></div>
          <div className="jarvis-core" aria-hidden="true"><span className="jarvis-core-grid" /><span className="jarvis-orbit jarvis-orbit-outer" /><span className="jarvis-orbit jarvis-orbit-inner" /><span className="jarvis-core-center"><Cpu size={32} strokeWidth={1.3} /></span><i /><b /></div>
        </div>
        <JarvisVoiceVisual state={voiceState} />
        <div className="jarvis-daily-caption"><span /> PANORAMA DO DIA</div>
        <p className="daily-briefing-lead">{briefing.pending ? <>Você tem <strong>{briefing.pending} {briefing.pending === 1 ? 'pendência' : 'pendências'}</strong>, sendo <strong>{briefing.overdue} {briefing.overdue === 1 ? 'vencida' : 'vencidas'}</strong> e <strong>{briefing.today} para hoje</strong>.</> : 'Nenhuma tarefa atribuída pendente. Confira também as etapas dos seus projetos.'}</p>
        <p className="daily-briefing-source" role="status"><span className={loading ? 'is-loading' : ''} />{loading ? 'Atualizando resumo…' : reply?.source === 'ai' ? 'Resumo gerado por IA' : unavailable ? 'Resumo local das suas atividades' : 'Resumo operacional da REDE NEX'}</p>
        {reply && <p className="daily-briefing-response">{reply.reply}</p>}
        <div className="jarvis-project-heading"><h3 className="daily-briefing-project-label">No seu radar</h3><Link to="/projetos">Ver projetos <ArrowUpRight size={14} /></Link></div>
        <div className="daily-briefing-projects">{briefing.projects.slice(0, 2).map(project => <Link key={project.id} to={`/projetos?projeto=${encodeURIComponent(project.id)}`}><span>{project.involvement === 'responsible' ? 'Responsável' : 'Participante'}</span><strong>{project.name}</strong><small>{project.pending_count === null ? 'Etapas indisponíveis' : `${project.pending_count} etapa(s) pendente(s)`}{project.overdue_count ? ` • ${project.overdue_count} vencida(s)` : ''}</small><ArrowRight size={16} /></Link>)}{!briefing.projects.length&&<p>Nenhum projeto ativo no seu resumo.</p>}</div>
      </div>
      <div className="daily-briefing-live-chat"><DashboardCopilotChat briefing={briefing} userName={userName} onVoiceStateChange={setVoiceState} /></div>
    </div>
    <div className="daily-briefing-focus"><div className="jarvis-focus-heading"><h3><ListTodo size={17} /> Por onde começar</h3><span>Prioridades do seu trabalho</span></div><div className="daily-briefing-focus-list">{briefing.focus.slice(0, 3).map((task, index) => <Link key={task.id} to={`/tarefas?tarefa=${encodeURIComponent(task.id)}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{task.title}</strong><small><Clock3 size={12} />{task.deadline ? new Date(task.deadline.includes('T') ? task.deadline : `${task.deadline}T12:00:00`).toLocaleDateString('pt-BR') : 'Definir prazo'} • {task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta prioridade' : 'Planejada'}</small></div><ArrowUpRight size={16} /></Link>)}</div>{!briefing.focus.length && <p>Suas próximas tarefas aparecerão aqui. Abra os projetos abaixo para revisar as etapas da equipe.</p>}</div>
  </section>;
}
