// Isolated UI review. Never loads .env, proxies production, or connects to a DB/AI.
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { dayKey } from '../shared/personalWork.mjs';

const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="24" fill="#314e66"/><text x="40" y="49" text-anchor="middle" font-size="24" fill="#e0f2fe">NX</text></svg>');
const user = { id: 'fixture-user', name: 'Alex Nascimento', email: 'alex@example.test', role_name: 'Administrador', photo_url: photo, status: 'active', position: 'Equipe de teste', online: true };
const colleague = { ...user, id: 'fixture-colleague', name: 'Marina Teste', role_name: 'Colaborador' };
const date = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return dayKey(d)!; };
const tasks = [
  { id: 'task-urgent', title: 'Revisar plano de expansão da rede', deadline: date(-2), priority: 'urgent' },
  { id: 'task-today', title: 'Validar a nova jornada do cliente', deadline: date(0), priority: 'high' },
  { id: 'task-week', title: 'Organizar documentação de implantação', deadline: date(3), priority: 'normal' },
  { id: 'task-none', title: 'Mapear oportunidades de automação', deadline: null, priority: 'normal' },
].map(t => ({ ...t, status: 'in_progress', owner_id: user.id, assignees: [{ id: user.id, name: user.name }] }));
const projects = [
  { id: 'project-owner', name: 'Expansão de infraestrutura', responsible_name: user.name, status: 'Em andamento', progress: 64, phase: 'Execução', deadline: date(20) },
  { id: 'project-member', name: 'Experiência do cliente', responsible_name: 'Marina Teste', status: 'Em andamento', progress: 42, phase: 'Planejamento', deadline: date(30) },
  { id: 'project-private', name: 'Projeto sem vínculo — não deve aparecer', responsible_name: 'Outro Usuário', status: 'Em andamento', progress: 12, deadline: date(40) },
].map((project, index) => ({ code: `NEX-${index + 1}`, category: 'Tecnologia', summary: 'Projeto fictício para conferência visual.', accent: 'blue', tag: null, tag_color: null, responsible_photo_url: photo, next_action: 'Validar próxima entrega', start_date: date(-10), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...project }));
const conversation = { id: 'fixture-conversation', name: colleague.name, type: 'direct', other_participant: { ...colleague, last_read_at: new Date().toISOString() }, participant_count: 2, unread_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
const chatMessages = [
  { id: 'message-1', sender: colleague, content: 'Bom dia! Já temos a atualização do projeto de expansão.' },
  { id: 'message-2', sender: colleague, content: 'A revisão técnica ficou pronta. Podemos alinhar os próximos passos na reunião de hoje?' },
  { id: 'message-3', sender: user, content: 'Perfeito! Vou revisar as entregas e atualizar as etapas do projeto.' },
  { id: 'message-4', sender: colleague, content: 'Combinado. Os documentos estão organizados e prontos para a equipe.' },
].map((message, index) => ({ ...message, sender_id: message.sender.id, conversation_id: conversation.id, created_at: new Date(Date.now() - (6 - index) * 60000).toISOString(), updated_at: new Date().toISOString() }));
// Fictional finance records; all mutations remain blocked by the preview.
const pcSetores = [
  { id: 'pc-tech', nome: 'Tecnologia e infraestrutura', card_last4: '4290', responsavel_nome: user.name, periodos_abertos: 2, periodos_atrasados: 1, periodos_inconsistentes: 0, saldo_aberto: '12842.75' },
  { id: 'pc-field', nome: 'Operações de campo', card_last4: '7812', responsavel_nome: colleague.name, card_brand: 'kamino', periodos_abertos: 1, periodos_atrasados: 0, periodos_inconsistentes: 1, saldo_aberto: '4360.50' },
  { id: 'pc-admin', nome: 'Administrativo', card_last4: null, responsavel_nome: colleague.name, periodos_abertos: 1, periodos_atrasados: 0, periodos_inconsistentes: 0, saldo_aberto: '1850.00' },
].map(s => ({ ativo: true, responsavel: null, responsavel_user_id: user.id, validador_user_id: colleague.id, validador_nome: colleague.name, card_brand: null, ...s }));
const pcPeriodos = (setorId: string) => [
  { id: `${setorId}-open`, periodo: 'Outubro / 2026', data_inicio: '2026-10-01', data_fim: '2026-10-31', status: 'aberto' },
  { id: `${setorId}-review`, periodo: 'Setembro / 2026', data_inicio: '2026-09-01', data_fim: '2026-09-30', status: 'aguardando_validacao' },
  { id: `${setorId}-issue`, periodo: 'Agosto / 2026', data_inicio: '2026-08-01', data_fim: '2026-08-31', status: 'inconsistencia' },
].map(p => ({ ...p, setor_id: setorId, responsavel_user_id: user.id, responsavel_nome: user.name, responsavel: null, total_gasto: '3240.50', qtd_lancamentos: 3, data_submissao: null, submetido_por: null, validado_por: null, validado_em: null }));
const pcLancamentos = (periodoId: string) => [
  { id: `${periodoId}-1`, descricao: 'Equipamentos para expansão da rede', fornecedor: 'Fornecedor de teste A', valor: '2400.00', status: 'pendente', qtd_anexos: 1 },
  { id: `${periodoId}-2`, descricao: 'Deslocamento para visita técnica', fornecedor: 'Fornecedor de teste B', valor: '620.50', status: 'aprovado', qtd_anexos: 0 },
  { id: `${periodoId}-3`, descricao: 'Materiais de apoio e organização', fornecedor: 'Fornecedor de teste C', valor: '220.00', status: 'inconsistente', qtd_anexos: 0 },
].map(l => ({ ...l, periodo_id: periodoId, data: '2026-10-16', data_compra: null, numero_documento: 'NF-TESTE', forma_pagamento: 'Cartão corporativo', parcelado: false, num_parcelas: null, setor_area: null, observacoes: null, created_by: user.id, autor_nome: user.name, qtd_comentarios: 0, validado_por: null, validado_em: null, validacao_obs: null, created_at: '2026-10-16T12:00:00Z', updated_at: '2026-10-16T12:00:00Z' }));
function syntheticAudio() {
  // Quiet synthetic test tone, not provider speech; exercises real playback lifecycle.
  const rate = 8000, samples = rate * 16, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / rate) * 12), 44 + i * 2);
  return buffer;
}
function isolatedApi(): Plugin {
  return { name: 'dashboard-fictional-api', configureServer(server) {
    server.middlewares.use('/api', (req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const scenario = new URL(req.headers.referer || '/', 'http://127.0.0.1').searchParams.get('scenario');
      const empty = scenario === 'empty';
      let data: unknown;
      if (url.pathname === '/tts' && req.method === 'POST') {
        if (scenario === 'tts-error') { res.statusCode = 503; res.end('Synthetic TTS unavailable'); return; }
        res.setHeader('Content-Type', 'audio/wav');
        if (scenario === 'tts-delayed') setTimeout(() => res.end(syntheticAudio()), 2500);
        else res.end(syntheticAudio());
        return;
      }
      if (req.method !== 'GET' && !['/copiloto', '/jarves'].includes(url.pathname)) { res.statusCode = 405; data = { error: 'Writes and AI disabled in isolated preview' }; }
      else if (url.pathname === '/auth/me') data = { data: user };
      else if (url.pathname === '/jarves') data = { reply: 'Seu dia está organizado. Comece pela revisão da expansão e depois confira os compromissos na agenda.' };
      else if (url.pathname === '/users' || url.pathname === '/projects/users') data = { data: [user, colleague] };
      else if (url.pathname === '/pc/minhas-permissoes') data = { data: { hasAccess: scenario !== 'pc-denied', papel: scenario === 'pc-denied' ? null : scenario === 'pc-standard' ? 'padrao' : 'admin' } };
      else if (url.pathname === '/pc/permissoes') data = { data: [{ id: 'perm-1', user_id: colleague.id, user_name: colleague.name, user_email: 'marina@example.test', papel: 'validador' }] };
      else if (url.pathname === '/pc/setores') {
        if (scenario === 'pc-error') { res.statusCode = 503; data = { error: 'Indisponibilidade simulada' }; }
        else data = { data: empty ? [] : pcSetores };
      }
      else if (/^\/pc\/setores\/[^/]+\/periodos$/.test(url.pathname)) data = { data: pcPeriodos(url.pathname.split('/')[3]) };
      else if (/^\/pc\/periodos\/[^/]+\/lancamentos$/.test(url.pathname)) data = { data: pcLancamentos(url.pathname.split('/')[3]) };
      else if (/^\/pc\/periodos\/[^/]+\/fatura$/.test(url.pathname)) {
        const id = url.pathname.split('/')[3], setorId = id.replace(/-(open|review|issue)$/, '');
        data = { data: { periodo: { ...pcPeriodos(setorId).find(p => p.id === id), setor_nome: pcSetores.find(s => s.id === setorId)?.nome, card_last4: '4290' }, lancamentos: pcLancamentos(id), total: 3240.5 } };
      }
      else if (/^\/pc\/lancamentos\/[^/]+$/.test(url.pathname)) {
        const id = url.pathname.split('/')[3], periodoId = id.replace(/-\d+$/, '');
        data = { data: pcLancamentos(periodoId).find(l => l.id === id) };
      }
      else if (url.pathname.startsWith('/pc/') && /\/(comentarios|anexos)$/.test(url.pathname)) data = { data: [] };
      else if (url.pathname === '/project-requests' || url.pathname.endsWith('/comments') || url.pathname.endsWith('/attachments') || url.pathname === '/stories') data = { data: [] };
      else if (url.pathname === '/users/me/chat-theme') data = { data: null };
      else if (url.pathname === '/gamification/ranking') data = { data: { ranking: [], my_position: null } };
      else if (url.pathname === '/chat/conversations') data = { data: [{ ...conversation, last_message: chatMessages[chatMessages.length - 1] }] };
      else if (url.pathname.endsWith('/messages')) data = { data: chatMessages, has_more: false };
      else if (url.pathname.endsWith('/notes')) data = { data: { content: '' } };
      else if (url.pathname === '/calendar/events') {
        if (scenario === 'calendar-error') { res.statusCode = 503; data = { error: 'Fixture: agenda unavailable' }; }
        else data = { data: empty ? [] : [{ id: 'event-today', title: 'Alinhamento de entregas', start_at: date(0) + 'T14:00:00-03:00', end_at: date(0) + 'T14:45:00-03:00', all_day: false, color: '#6bb9cd', location: 'Sala de projetos' }] };
      }
      else if (url.pathname === '/dashboard') data = { data: { stats: { users: 86, trainings: 12, articles: 48, posts: 23 }, recentPosts: empty ? [] : [
        { id: 'post-1', title: 'Novas conexões, novas possibilidades.', content: '', created_at: new Date().toISOString(), users: { name: 'Marina Teste' } },
        { id: 'post-2', title: 'Confira o calendário de capacitações da equipe', content: '', created_at: new Date(Date.now() - 3600000).toISOString(), users: { name: 'Lucas Teste' } },
      ] } };
      else if (url.pathname === '/tasks') data = { data: empty ? [] : tasks };
      else if (url.pathname === '/projects') data = { data: empty ? [] : projects };
      else if (url.pathname.endsWith('/steps')) {
        if (scenario === 'partial') { res.statusCode = 503; data = { error: 'Fixture: steps unavailable' }; }
        else data = { data: url.pathname.includes('private') ? [] : [{ id: 'step-1', name: 'Próxima entrega', status: 'Em andamento', deadline: date(5), responsible_user_id: user.id, assignees: [] }] };
      } else if (url.pathname === '/copiloto') data = { reply: 'Priorize a revisão do plano de expansão. Em seguida, valide a jornada do cliente para concluir a entrega de hoje.', source: 'rules' };
      else { res.statusCode = 404; data = { error: 'Unknown fixture endpoint' }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data));
    });
  } };
}
export default defineConfig({
  plugins: [react(), isolatedApi()], envDir: false,
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api'), 'import.meta.env.VITE_REMOTE_READ_ONLY': JSON.stringify('true') },
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
});
