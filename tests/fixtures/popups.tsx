// Development-only fixture. NEVER include tests/ in the hosted public directory.
// Every application API request is intercepted here; no production reads/writes.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/auth';
import { GlobalNotifications } from '../../src/components/GlobalNotifications';
import { wsEventBus } from '../../src/lib/wsEventBus';
import '../../src/index.css';

let sequence = 0;
const conversations = [{ id: 'fixture-conversation', name: 'Pessoa de teste', type: 'direct', unread_count: 0, is_muted: false, last_message: { id: 'initial', content: '', sender: { id: 'fixture-sender', name: 'Pessoa de teste' } } }];
const notifications: Array<Record<string, unknown>> = [];
window.fetch = async input => {
  const url = String(input);
  const data = url.endsWith('/auth/me') ? { id: 'fixture-user', name: 'Usuário de teste', email: 'fixture@example.invalid' }
    : url.endsWith('/chat/conversations') ? conversations
    : url.endsWith('/notifications') ? notifications : null;
  if (!data) throw new Error('Fixture blocked unexpected request: ' + url);
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
function sendMessage(muted = false) {
  conversations[0].is_muted = muted;
  conversations[0].unread_count++;
  conversations[0].last_message = { id: `message-${++sequence}`, content: `Mensagem de teste ${sequence}. Clique para abrir a conversa correta.`, sender: { id: 'fixture-sender', name: 'Pessoa de teste' } };
  wsEventBus.emit({ type: 'message:incoming' });
}
function sendWork(kind: 'task' | 'project') {
  notifications.unshift({ id: `notification-${++sequence}`, title: kind === 'task' ? 'Você foi atribuído à entrega' : 'Uma etapa do seu projeto mudou', message: 'Dados fictícios: nenhuma pessoa real foi notificada.', type: kind, actor_name: 'Autor de teste', read: false, created_at: new Date().toISOString(), link: kind === 'task' ? '/tarefas?tarefa=fixture-task' : '/projetos?projeto=fixture-project' });
  wsEventBus.emit({ type: 'notification:new' });
}
function Fixture() {
  const location = useLocation();
  return <div style={{ minHeight: '100vh', background: '#101b2b', color: '#eef2ff', padding: 30 }}><h1 style={{ fontSize: 25 }}>Teste isolado de pop-ups</h1><p>Dados fictícios. Nenhuma API externa é chamada.</p><p role="status">Destino: {location.pathname}{location.search}</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>{[
    ['Nova mensagem', () => sendMessage()], ['Mensagem silenciada', () => sendMessage(true)], ['Nova tarefa', () => sendWork('task')], ['Novo projeto', () => sendWork('project')], ['Repetir sincronização', () => wsEventBus.emit({ type: 'notification:new' })],
  ].map(([label, action]) => <button key={String(label)} style={{ padding: 12, background: '#334155', borderRadius: 12 }} onClick={action as () => void}>{String(label)}</button>)}</div><GlobalNotifications /></div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><MemoryRouter><AuthProvider><Fixture /></AuthProvider></MemoryRouter></React.StrictMode>);
