
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Building2, ChartNoAxesCombined, Clock3, CreditCard, History, Plus, ReceiptText, Search, ShieldCheck, Trash2, TriangleAlert, Wallet } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { apiGet } from '../lib/apiClient';
import {
  pcListSetores, pcCreateSetor, pcUpdateSetor,
  pcListPeriodos, pcCreatePeriodo, pcFecharPeriodo,
  pcListLancamentos, pcGetLancamento, pcCreateLancamento, pcUpdateLancamento, pcDeleteLancamento,
  pcUpdateLancamentoStatus,
  pcListComentarios, pcCreateComentario,
  pcListAnexos, pcCreateAnexo, pcDeleteAnexo,
  pcGetFatura,
  pcGetMinhasPermissoes,
  pcListPermissoes, pcCreatePermissao, pcDeletePermissao,
  pcDeleteSetor,
  pcSubmitPeriodo, pcValidarPeriodo, pcInconsistenciaPeriodo, pcCorrigirPeriodo, pcCancelarSubmissaoPeriodo,
  pcListComentariosPeriodo, pcCreateComentarioPeriodo,
} from '../lib/prestacaoContasApi';
import type { Setor, Periodo, Lancamento, Comentario, Anexo, FaturaData, PcPermissao, ComentarioPeriodo } from '../lib/prestacaoContasApi';
import './prestacao-contas.css';
import './prestacao-contas-next.css';

const SETOR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16', '#ef4444'];
const PrestacaoFinanceCharts = lazy(() => import('../components/PrestacaoFinanceCharts'));

const fmt = (v: string | number) =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(String(e.target!.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const statusStyle = (status: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    pendente: { background: '#fbbf2417', color: '#f6cc71', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 },
    aprovado: { background: '#34d39917', color: '#7ce0b5', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 },
    inconsistente: { background: '#fb718517', color: '#fda4af', padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600 },
  };
  return map[status] || { background: '#94a3b817', color: '#b1bfd0', padding: '4px 10px', borderRadius: 99, fontSize: 12 };
};

const periodoStatusInfo = (status: string) => {
  const map: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    aberto:               { label: 'Aberto',               color: '#7ce0b5', bg: '#34d39917', dot: '#34d399' },
    aguardando_validacao: { label: 'Aguard. Validação',    color: '#f6cc71', bg: '#fbbf2417', dot: '#fbbf24' },
    atrasado:             { label: 'Atrasado',             color: '#fda4af', bg: '#fb718517', dot: '#fb7185' },
    validado:             { label: 'Validado',             color: '#7ce0b5', bg: '#34d39917', dot: '#34d399' },
    inconsistencia:       { label: 'Inconsistência',       color: '#fdb98a', bg: '#fb923c17', dot: '#fb923c' },
    fechado:              { label: 'Fechado',              color: '#b1bfd0', bg: '#94a3b817', dot: '#94a3b8' },
  };
  return map[status] || map.fechado;
};

type PcUser = { id: string; name: string; email: string };
type View = 'setores' | 'periodos' | 'lancamentos' | 'fatura' | 'bi' | 'log';
type ModalType = 'novo-setor' | 'edit-setor' | 'novo-periodo' | 'novo-lancamento' | 'edit-lancamento' | 'permissoes' | null;
type BiLanc = Lancamento & { setor_nome: string; periodo_nome: string };
type BiPeriodo = Periodo & { setor_nome: string };

export function PrestacaoContasPage() {
  const { user } = useAuth();
  const [pcPapel, setPcPapel] = useState<'admin' | 'validador' | 'padrao' | null>(null);
  const [pcLoading, setPcLoading] = useState(true);
  const [users, setUsers] = useState<PcUser[]>([]);
  const [pcPermList, setPcPermList] = useState<PcPermissao[]>([]);
  const [permForm, setPermForm] = useState({ user_id: '', papel: 'padrao' });
  const [permSaving, setPermSaving] = useState(false);

  const [view, setView] = useState<View>('setores');
  const [setor, setSetor] = useState<Setor | null>(null);
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorSearch, setSetorSearch] = useState('');
  const [setorFilter, setSetorFilter] = useState<'todos' | 'atencao'>('todos');
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [fatura, setFatura] = useState<FaturaData | null>(null);
  const [biSetores, setBiSetores] = useState<Setor[]>([]);
  const [biPeriodos, setBiPeriodos] = useState<BiPeriodo[]>([]);
  const [biLancs, setBiLancs] = useState<BiLanc[]>([]);
  const [biReady, setBiReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLanc, setDrawerLanc] = useState<Lancamento | null>(null);
  const [drawerComs, setDrawerComs] = useState<Comentario[]>([]);
  const [drawerAnexos, setDrawerAnexos] = useState<Anexo[]>([]);
  const [editModalAnexos, setEditModalAnexos] = useState<Anexo[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [comentario, setComentario] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, string | boolean | number>>({});
  const [fileNames, setFileNames] = useState('');
  const selectedFiles = useRef<FileList | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [nextMonthConfirm, setNextMonthConfirm] = useState<{
    label: string; inicio: string; fim: string; existingPeriodoId: string | null;
  } | null>(null);
  const [periodoComentarios, setPeriodoComentarios] = useState<ComentarioPeriodo[]>([]);
  const [periodoTab, setPeriodoTab] = useState<'lancamentos' | 'comentarios'>('lancamentos');
  const [periodoCommentText, setPeriodoCommentText] = useState('');
  const [incDialog, setIncDialog] = useState('');
  const [corrigirModal, setCorrigirModal] = useState(false);
  const [corrigirTexto, setCorrigirTexto] = useState('');
  const [incDialogOpen, setIncDialogOpen] = useState(false);

  const toast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const setF = (key: string, val: string | boolean | number) =>
    setForm(p => ({ ...p, [key]: val }));

  // ── Boot: load role + users list ──────────────────────────

  useEffect(() => {
    Promise.all([
      pcGetMinhasPermissoes().then(r => setPcPapel(r.data.papel)).catch(() => setPcPapel(null)),
      (apiGet as (path: string) => Promise<{ data: PcUser[] }>)('/users')
        .then(r => setUsers(r.data || []))
        .catch(() => {}),
    ]).finally(() => setPcLoading(false));
  }, []);

  // Load permissions list when admin opens modal
  useEffect(() => {
    if (modal === 'permissoes' && pcPapel === 'admin') {
      pcListPermissoes().then(r => setPcPermList(r.data)).catch(() => {});
    }
  }, [modal, pcPapel]);

  // ── Loaders ───────────────────────────────────────────────

  const loadSetores = useCallback(async () => {
    setLoading(true); setError(null); setForbidden(false);
    try {
      const { data } = await pcListSetores();
      setSetores(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('403')) setForbidden(true); else setError(msg);
    } finally { setLoading(false); }
  }, []);

  const loadPeriodos = useCallback(async (s: Setor) => {
    setLoading(true); setError(null);
    try { const { data } = await pcListPeriodos(s.id); setPeriodos(data); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  const loadLancamentos = useCallback(async (p: Periodo) => {
    setLoading(true); setError(null);
    try { const { data } = await pcListLancamentos(p.id); setLancamentos(data); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  const loadFatura = useCallback(async (p: Periodo) => {
    setLoading(true); setError(null);
    try { const { data } = await pcGetFatura(p.id); setFatura(data); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  const loadBI = useCallback(async () => {
    setBiReady(false); setLoading(true); setError(null);
    try {
      const { data: sx } = await pcListSetores();
      const ppAll = await Promise.all(sx.map(s =>
        pcListPeriodos(s.id).then(r => r.data.map(p => ({ ...p, setor_nome: s.nome })))
      ));
      const allP = ppAll.flat();
      const llAll = await Promise.all(allP.map(p =>
        pcListLancamentos(p.id).then(r => r.data.map(l => ({ ...l, setor_nome: p.setor_nome, periodo_nome: p.periodo })))
      ));
      setBiSetores(sx);
      setBiPeriodos(allP);
      setBiLancs(llAll.flat());
      setBiReady(true);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!pcLoading && pcPapel !== null) loadSetores(); }, [pcLoading, pcPapel, loadSetores]);

  // ── Navigation ────────────────────────────────────────────

  const navSetores = useCallback(() => {
    setView('setores'); setSetor(null); setPeriodo(null); loadSetores();
  }, [loadSetores]);

  const navPeriodos = useCallback(async (s: Setor) => {
    setSetor(s); setView('periodos'); await loadPeriodos(s);
  }, [loadPeriodos]);

  const navLancamentos = useCallback(async (p: Periodo) => {
    setPeriodo(p); setView('lancamentos'); setPeriodoTab('lancamentos');
    setIncDialogOpen(false); setIncDialog('');
    const [, { data: coms }] = await Promise.all([loadLancamentos(p), pcListComentariosPeriodo(p.id)]);
    setPeriodoComentarios(coms);
  }, [loadLancamentos]);

  const navFatura = useCallback(async (p: Periodo) => {
    setPeriodo(p); setView('fatura'); await loadFatura(p);
  }, [loadFatura]);

  const navBI = useCallback(() => { setView('bi'); loadBI(); }, [loadBI]);
  const navLog = useCallback(() => { setView('log'); loadBI(); }, [loadBI]);

  // ── Drawer ────────────────────────────────────────────────

  const openDrawer = useCallback(async (lancId: string) => {
    setDrawerOpen(true); setDrawerLoading(true);
    setDrawerLanc(null); setDrawerComs([]); setDrawerAnexos([]);
    try {
      const [{ data: l }, { data: coms }, { data: anx }] = await Promise.all([
        pcGetLancamento(lancId), pcListComentarios(lancId), pcListAnexos(lancId),
      ]);
      setDrawerLanc(l); setDrawerComs(coms); setDrawerAnexos(anx);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
    finally { setDrawerLoading(false); }
  }, [toast]);

  const closeDrawer = () => { setDrawerOpen(false); setDrawerLanc(null); };

  const sendComment = async () => {
    if (!drawerLanc || !comentario.trim()) return;
    try {
      const { data: c } = await pcCreateComentario(drawerLanc.id, comentario.trim());
      setDrawerComs(p => [...p, c]); setComentario('');
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const uploadAnexo = async (files: FileList) => {
    if (!drawerLanc) return;
    for (const file of Array.from(files)) {
      try {
        const data = await readAsDataUrl(file);
        const { data: a } = await pcCreateAnexo(drawerLanc.id, { file_name: file.name, file_type: file.type, data });
        setDrawerAnexos(p => [...p, a]); toast(`${file.name} enviado!`);
      } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
    }
  };

  const excluirAnexo = async (id: string) => {
    if (!confirm('Remover este anexo?')) return;
    try {
      await pcDeleteAnexo(id);
      setDrawerAnexos(p => p.filter(a => a.id !== id));
      toast('Anexo removido.');
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const deletarLancamento = async () => {
    if (!drawerLanc || !confirm('Excluir este lançamento? Não pode ser desfeito.')) return;
    try {
      await pcDeleteLancamento(drawerLanc.id);
      closeDrawer(); toast('Lançamento excluído.');
      if (periodo) await loadLancamentos(periodo);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const deletarLancamentoById = async (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!confirm('Excluir este lançamento? Não pode ser desfeito.')) return;
    try {
      await pcDeleteLancamento(id);
      toast('Lançamento excluído.');
      if (periodo) await loadLancamentos(periodo);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const deletarSetor = async (s: Setor, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!confirm(`Excluir setor "${s.nome}"? Todos os períodos e lançamentos serão removidos. Não pode ser desfeito.`)) return;
    try {
      await pcDeleteSetor(s.id);
      toast('Setor excluído.');
      navSetores();
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const validarLancamento = async (status: Lancamento['status'], obs?: string) => {
    if (!drawerLanc) return;
    try {
      await pcUpdateLancamentoStatus(drawerLanc.id, { status, obs });
      toast(status === 'aprovado' ? '✓ Lançamento aprovado.' : status === 'pendente' ? 'Lançamento devolvido para análise.' : '⚠ Marcado como inconsistente.');
      await openDrawer(drawerLanc.id);
      if (periodo) await loadLancamentos(periodo);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  // ── Modals ────────────────────────────────────────────────

  const openModal = (type: ModalType, init: Record<string, string | boolean | number> = {}) => {
    setForm(init); setModal(type); setFileNames(''); selectedFiles.current = null;
  };

  const openNovoLancamento = () => openModal('novo-lancamento', {
    data: new Date().toISOString().slice(0, 10), compra: '', forn: '', desc: '',
    doc: '', valor: '', parcelado: false, parcelas: '', setor_area: setor?.nome || '', obs: '',
  });

  const openEditLancamento = async () => {
    const l = drawerLanc; if (!l) return;
    openModal('edit-lancamento', {
      data: l.data?.slice(0, 10) || '', compra: l.data_compra?.slice(0, 10) || '',
      forn: l.fornecedor || '', desc: l.descricao, doc: l.numero_documento || '',
      valor: l.valor, parcelado: l.parcelado, parcelas: l.num_parcelas?.toString() || '',
      setor_area: l.setor_area || '', obs: l.observacoes || '',
    });
    try { const { data: a } = await pcListAnexos(l.id); setEditModalAnexos(a); }
    catch { setEditModalAnexos([]); }
  };

  const openEditDirect = async (lancId: string) => {
    try {
      const { data: l } = await pcGetLancamento(lancId);
      setDrawerLanc(l);
      openModal('edit-lancamento', {
        data: l.data?.slice(0, 10) || '', compra: l.data_compra?.slice(0, 10) || '',
        forn: l.fornecedor || '', desc: l.descricao, doc: l.numero_documento || '',
        valor: l.valor, parcelado: l.parcelado, parcelas: l.num_parcelas?.toString() || '',
        setor_area: l.setor_area || '', obs: l.observacoes || '',
      });
      try { const { data: a } = await pcListAnexos(lancId); setEditModalAnexos(a); }
      catch { setEditModalAnexos([]); }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const fecharPeriodo = async (p: Periodo) => {
    if (!confirm('Fechar este período? Não receberá novos lançamentos.')) return;
    try { await pcFecharPeriodo(p.id); toast('Período fechado.'); if (setor) await loadPeriodos(setor); }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const submitPeriodo = async () => {
    if (!periodo) return;
    if (!confirm('Enviar período para validação?')) return;
    try {
      const { data: r } = await pcSubmitPeriodo(periodo.id);
      setPeriodo(r); toast('Período enviado para validação!');
      if (setor) await loadPeriodos(setor);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const handleValidarPeriodo = async () => {
    if (!periodo) return;
    if (!confirm('Validar este período?')) return;
    try {
      const { data: r } = await pcValidarPeriodo(periodo.id);
      setPeriodo(r); toast('✓ Período validado!');
      if (setor) await loadPeriodos(setor);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const handleInconsistenciaPeriodo = async () => {
    if (!periodo || !incDialog.trim()) return;
    try {
      const { data: r } = await pcInconsistenciaPeriodo(periodo.id, { texto: incDialog.trim() });
      setPeriodo(r); setIncDialogOpen(false); setIncDialog('');
      const { data: coms } = await pcListComentariosPeriodo(periodo.id);
      setPeriodoComentarios(coms); setPeriodoTab('comentarios');
      toast('⚠ Inconsistência registrada. Responsável notificado.');
      if (setor) await loadPeriodos(setor);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const handleCorrigirPeriodo = () => {
    if (!periodo) return;
    setCorrigirTexto('');
    setCorrigirModal(true);
  };

  const submitCorrigir = async () => {
    if (!periodo) return;
    if (!corrigirTexto.trim()) { toast('Descreva o que foi corrigido antes de reenviar'); return; }
    try {
      const { data: r } = await pcCorrigirPeriodo(periodo.id, corrigirTexto.trim());
      setPeriodo(r); toast('Período resubmetido para validação!');
      const { data: coms } = await pcListComentariosPeriodo(periodo.id);
      setPeriodoComentarios(coms);
      if (setor) await loadPeriodos(setor);
      setCorrigirModal(false); setCorrigirTexto('');
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const cancelarSubmissao = async () => {
    if (!periodo) return;
    if (!confirm('Cancelar envio para validação? O período voltará ao status aberto.')) return;
    try {
      const { data: r } = await pcCancelarSubmissaoPeriodo(periodo.id);
      setPeriodo(r); toast('↩ Envio cancelado. Período voltou para edição.');
      const { data: coms } = await pcListComentariosPeriodo(periodo.id);
      setPeriodoComentarios(coms); setPeriodoTab('comentarios');
      if (setor) await loadPeriodos(setor);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const aprovarLancamento = async (id: string) => {
    try {
      await pcUpdateLancamentoStatus(id, { status: 'aprovado' });
      setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: 'aprovado' as const } : l));
      toast('Lançamento aprovado');
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const inconsistenteLancamento = async (id: string) => {
    try {
      await pcUpdateLancamentoStatus(id, { status: 'inconsistente' });
      setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: 'inconsistente' as const } : l));
      toast('Lançamento marcado como inconsistente');
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const sendPeriodoComment = async () => {
    if (!periodo || !periodoCommentText.trim()) return;
    try {
      const { data: c } = await pcCreateComentarioPeriodo(periodo.id, periodoCommentText.trim());
      setPeriodoComentarios(p => [...p, c]); setPeriodoCommentText('');
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (modal === 'novo-setor') {
        const nome = String(form.nome || '').trim();
        if (!nome) { toast('Nome obrigatório'); return; }
        const resp_user_id = String(form.resp_user_id || '') || null;
        const resp_nome = resp_user_id ? (users.find(u => u.id === resp_user_id)?.name || null) : null;
        const validador_uid_n = String(form.validador_user_id || '') || null;
        await pcCreateSetor({ nome, card_last4: String(form.card || '').trim() || null, responsavel: resp_nome, responsavel_user_id: resp_user_id, card_brand: String(form.card_brand || '') || null, validador_user_id: validador_uid_n });
        toast('Setor criado!'); setModal(null); await loadSetores();

      } else if (modal === 'edit-setor' && setor) {
        const nome = String(form.nome || '').trim();
        if (!nome) { toast('Nome obrigatório'); return; }
        const resp_user_id = String(form.resp_user_id || '') || null;
        const resp_nome = resp_user_id ? (users.find(u => u.id === resp_user_id)?.name || null) : null;
        const validador_uid_e = String(form.validador_user_id || '') || null;
        const { data: updated } = await pcUpdateSetor(setor.id, { nome, card_last4: String(form.card || '').trim() || null, responsavel: resp_nome, responsavel_user_id: resp_user_id, card_brand: String(form.card_brand || '') || null, validador_user_id: validador_uid_e });
        setSetor(updated); toast('Setor atualizado!'); setModal(null); await loadPeriodos(updated);

      } else if (modal === 'novo-periodo' && setor) {
        const peri = String(form.periodo || '').trim(), ini = String(form.inicio || ''), fim = String(form.fim || '');
        if (!peri || !ini || !fim) { toast('Preencha todos os campos'); return; }
        const resp_user_id = String(form.resp_user_id || '') || null;
        const resp_nome = resp_user_id ? (users.find(u => u.id === resp_user_id)?.name || null) : null;
        await pcCreatePeriodo({ setor_id: setor.id, periodo: peri, data_inicio: ini, data_fim: fim, responsavel: resp_nome, responsavel_user_id: resp_user_id });
        toast('Período criado!'); setModal(null); await loadPeriodos(setor);

      } else if (modal === 'novo-lancamento' && periodo) {
        const data = String(form.data || ''), desc = String(form.desc || '').trim(), valor = parseFloat(String(form.valor || ''));
        if (!data || !desc || isNaN(valor) || valor <= 0) { toast('Preencha Data, Descrição e Valor'); return; }

        const confirm = nextMonthConfirm;
        if (!confirm) {
          const periodoFim = new Date(String(periodo.data_fim).slice(0, 10) + 'T12:00:00');
          const nextMonthStart = new Date(periodoFim.getFullYear(), periodoFim.getMonth() + 1, 1);
          const compraStr = String(form.compra || '');
          const compraInPeriodMonth = compraStr ? (() => {
            const d = new Date(compraStr + 'T12:00:00');
            return d.getFullYear() === periodoFim.getFullYear() && d.getMonth() === periodoFim.getMonth();
          })() : false;
          if (new Date() >= nextMonthStart && !compraInPeriodMonth) {
            const ny = periodoFim.getMonth() === 11 ? periodoFim.getFullYear() + 1 : periodoFim.getFullYear();
            const nm = (periodoFim.getMonth() + 1) % 12;
            const lastDay = new Date(ny, nm + 1, 0).getDate();
            const mNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
            const label = `${mNames[nm]}/${ny}`;
            const inicio = `${ny}-${String(nm + 1).padStart(2, '0')}-01`;
            const fim = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const existing = periodos.find(p => {
              const ps = new Date(String(p.data_inicio).slice(0, 10) + 'T12:00:00');
              return ps.getFullYear() === ny && ps.getMonth() === nm && p.status === 'aberto';
            });
            setNextMonthConfirm({ label, inicio, fim, existingPeriodoId: existing?.id ?? null });
            return;
          }
        }

        const parcelado = !!form.parcelado;
        const num_parcelas = parcelado && form.parcelas ? parseInt(String(form.parcelas)) : null;
        let targetPeriodoId = periodo.id;
        let redirectToPeriodo: Periodo | null = null;

        if (confirm) {
          if (confirm.existingPeriodoId) {
            targetPeriodoId = confirm.existingPeriodoId;
            redirectToPeriodo = periodos.find(p => p.id === confirm.existingPeriodoId) ?? null;
          } else {
            const resp_uid = periodo.responsavel_user_id || null;
            const resp_n = resp_uid ? (users.find(u => u.id === resp_uid)?.name ?? null) : periodo.responsavel ?? null;
            const { data: created } = await pcCreatePeriodo({
              setor_id: setor!.id, periodo: confirm.label,
              data_inicio: confirm.inicio, data_fim: confirm.fim,
              responsavel: resp_n, responsavel_user_id: resp_uid,
            });
            targetPeriodoId = created.id;
            redirectToPeriodo = created;
          }
          setNextMonthConfirm(null);
        }

        const { data: lanc } = await pcCreateLancamento({
          periodo_id: targetPeriodoId, data, data_compra: String(form.compra || '') || null,
          fornecedor: String(form.forn || '').trim() || null, descricao: desc, valor,
          numero_documento: String(form.doc || '').trim() || null,
          forma_pagamento: setor?.card_last4 ? 'Cartão de Crédito KAMINO' : null,
          parcelado, num_parcelas, setor_area: String(form.setor_area || '').trim() || null,
          observacoes: String(form.obs || '').trim() || null,
        });
        if (selectedFiles.current?.length) {
          for (const file of Array.from(selectedFiles.current)) {
            try {
              const fileData = await readAsDataUrl(file);
              await pcCreateAnexo(lanc.id, { file_name: file.name, file_type: file.type, data: fileData });
            } catch (fe) { toast(`Erro ${file.name}: ${fe instanceof Error ? fe.message : String(fe)}`); }
          }
        }
        if (redirectToPeriodo) {
          toast(`Lançamento adicionado em ${redirectToPeriodo.periodo}!`);
          setModal(null);
          if (setor) await loadPeriodos(setor);
          setPeriodo(redirectToPeriodo);
          await loadLancamentos(redirectToPeriodo);
        } else {
          toast('Lançamento adicionado!'); setModal(null); await loadLancamentos(periodo);
        }

      } else if (modal === 'edit-lancamento' && drawerLanc) {
        const data = String(form.data || ''), desc = String(form.desc || '').trim(), valor = parseFloat(String(form.valor || ''));
        if (!data || !desc || isNaN(valor) || valor <= 0) { toast('Preencha campos obrigatórios'); return; }
        const parcelado = !!form.parcelado;
        const num_parcelas = parcelado && form.parcelas ? parseInt(String(form.parcelas)) : null;
        const data_compra = String(form.compra || '') || null;
        const prev = drawerLanc;
        await pcUpdateLancamento(drawerLanc.id, {
          data, data_compra, descricao: desc, valor,
          fornecedor: String(form.forn || '').trim() || null,
          numero_documento: String(form.doc || '').trim() || null,
          forma_pagamento: prev.forma_pagamento || null,
          parcelado, num_parcelas,
          setor_area: String(form.setor_area || '').trim() || null,
          observacoes: String(form.obs || '').trim() || null,
        });
        const changes: string[] = [];
        if (prev.descricao !== desc) changes.push(`Descrição: "${prev.descricao}" → "${desc}"`);
        if (parseFloat(prev.valor) !== valor) changes.push(`Valor: ${fmt(prev.valor)} → ${fmt(valor)}`);
        if ((prev.data?.slice(0, 10) || '') !== data) changes.push(`Data: ${fmtDate(prev.data)} → ${fmtDate(data)}`);
        if ((prev.data_compra?.slice(0, 10) || '') !== (data_compra || '')) changes.push(`Data compra: ${fmtDate(prev.data_compra)} → ${fmtDate(data_compra)}`);
        if (!!prev.parcelado !== parcelado) changes.push(`Parcelado: ${prev.parcelado ? 'Sim' : 'Não'} → ${parcelado ? 'Sim' : 'Não'}`);
        if (selectedFiles.current?.length) {
          for (const file of Array.from(selectedFiles.current)) {
            try {
              const fileData = await readAsDataUrl(file);
              await pcCreateAnexo(drawerLanc.id, { file_name: file.name, file_type: file.type, data: fileData });
            } catch (fe) { toast(`Erro ${file.name}: ${fe instanceof Error ? fe.message : String(fe)}`); }
          }
        }
        const logText = `✏️ Editado em ${new Date().toLocaleString('pt-BR')}${changes.length ? ': ' + changes.join(' | ') : ''}`;
        await pcCreateComentario(drawerLanc.id, logText);
        toast('Lançamento atualizado!'); setModal(null);
        await openDrawer(drawerLanc.id);
        if (periodo) await loadLancamentos(periodo);
      }
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  // ── Permission management ─────────────────────────────────

  const addPermissao = async () => {
    if (!permForm.user_id || !permForm.papel) { toast('Selecione usuário e papel'); return; }
    setPermSaving(true);
    try {
      await pcCreatePermissao({ user_id: permForm.user_id, papel: permForm.papel });
      toast('Permissão concedida!');
      setPermForm({ user_id: '', papel: 'padrao' });
      const r = await pcListPermissoes();
      setPcPermList(r.data);
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
    finally { setPermSaving(false); }
  };

  const removePermissao = async (id: string, nome: string) => {
    if (!confirm(`Remover acesso de ${nome}?`)) return;
    try {
      await pcDeletePermissao(id);
      setPcPermList(p => p.filter(x => x.id !== id));
      toast('Permissão removida.');
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e)); }
  };

  // ── Render ────────────────────────────────────────────────

  if (pcLoading) return (
    <div className="pc-page">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <span className="pc-spinner" />
      </div>
    </div>
  );

  if (pcPapel === null || forbidden) return (
    <div className="pc-page">
      <div className="pc-empty" style={{ marginTop: 80 }}>
        <h2>Acesso Restrito</h2>
        <p>Você não tem permissão para acessar a Prestação de Contas.</p>
        <p style={{ fontSize: 13, color: 'var(--pc-muted)' }}>Solicite acesso ao administrador do módulo.</p>
      </div>
    </div>
  );

  const isAdmin = pcPapel === 'admin';
  const canValidate = pcPapel === 'admin' || pcPapel === 'validador';
  const totalSetoresAberto = setores.reduce((s, x) => s + parseFloat(x.saldo_aberto || '0'), 0);
  const totalLancs = lancamentos.reduce((s, l) => s + parseFloat(l.valor), 0);
  const totalBI = biLancs.reduce((s, l) => s + parseFloat(l.valor), 0);
  const precisaAtencao = (s: Setor) => Number(s.periodos_atrasados) > 0 || Number(s.periodos_inconsistentes) > 0;
  const setoresAtencao = setores.filter(precisaAtencao).length;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const searchTerm = normalize(setorSearch.trim());
  const visibleSetores = setores.filter(s =>
    (setorFilter === 'todos' || precisaAtencao(s)) &&
    normalize([s.nome, s.responsavel_nome, s.responsavel, s.card_last4].filter(Boolean).join(' ')).includes(searchTerm)
  );

  const usersInPerm = new Set(pcPermList.map(p => p.user_id));
  const availableUsers = users.filter(u => !usersInPerm.has(u.id) && u.id !== user?.id);

  return (
    <div className="pc-page">
      {/* Breadcrumb */}
      <nav className="pc-breadcrumb" aria-label="Navegação da prestação de contas">
        <button onClick={navSetores}>Setores</button>
        {setor && <><span>›</span><button onClick={() => navPeriodos(setor)}>{setor.nome}</button></>}
        {periodo && <><span>›</span><button onClick={() => navLancamentos(periodo)}>{periodo.periodo}</button></>}
        {view === 'fatura' && <><span>›</span><span>Fatura</span></>}
        {view === 'bi' && <><span>›</span><span>BI</span></>}
        {view === 'log' && <><span>›</span><span>Log</span></>}
        <span className="pc-access-badge">
          <ShieldCheck size={14} aria-hidden="true" /> {pcPapel === 'admin' ? 'Administrador' : pcPapel === 'validador' ? 'Validador' : 'Colaborador'}
        </span>
      </nav>

      {loading && view !== 'bi' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <span className="pc-spinner" />
        </div>
      )}

      {error && (
        <div className="pc-empty" style={{ color: '#ef4444' }}>
          Erro: {error}&nbsp;
          <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={loadSetores}>Tentar novamente</button>
        </div>
      )}

      {/* ── SETORES ── */}
      {!loading && !error && view === 'setores' && (
        <div>
          <div className="pc-page-hd pc-overview-hd">
            <div>
              <span className="pc-eyebrow"><ReceiptText size={15} aria-hidden="true" /> CONTROLE FINANCEIRO</span>
              <h1>Prestação de Contas</h1>
              <p>Despesas organizadas. Cada prestação, no seu lugar.</p>
            </div>
            <div className="pc-actions">
              <button className="pc-btn pc-btn-ghost" onClick={navLog}><History size={17} aria-hidden="true" /> Histórico</button>
              <button className="pc-btn pc-btn-ghost" onClick={navBI}><ChartNoAxesCombined size={17} aria-hidden="true" /> Análises</button>
              {isAdmin && (
                <>
                  <button className="pc-btn pc-btn-ghost" onClick={() => setModal('permissoes')}><ShieldCheck size={17} aria-hidden="true" /> Permissões</button>
                  <button className="pc-btn pc-btn-primary" onClick={() => openModal('novo-setor', { nome: '', card: '', card_brand: '', resp_user_id: '', validador_user_id: '' })}><Plus size={18} aria-hidden="true" /> Novo setor</button>
                </>
              )}
            </div>
          </div>
          <div className="pc-kpis pc-overview-kpis" aria-label="Resumo dos setores disponíveis">
            <div className="pc-kpi pc-kpi-featured"><Wallet className="pc-kpi-icon" size={20} aria-hidden="true" /><span className="pc-kpi-label">Total em aberto</span><span className="pc-kpi-value">{fmt(totalSetoresAberto)}</span><span className="pc-kpi-sub">Saldo dos setores disponíveis</span></div>
            <div className="pc-kpi"><Building2 className="pc-kpi-icon" size={20} aria-hidden="true" /><span className="pc-kpi-label">Setores</span><span className="pc-kpi-value">{setores.length}</span><span className="pc-kpi-sub">Disponíveis para o seu acesso</span></div>
            <div className="pc-kpi"><Clock3 className="pc-kpi-icon" size={20} aria-hidden="true" /><span className="pc-kpi-label">Períodos abertos</span><span className="pc-kpi-value">{setores.reduce((s, x) => s + (Number(x.periodos_abertos) || 0), 0)}</span><span className="pc-kpi-sub">Em acompanhamento</span></div>
            <div className="pc-kpi"><TriangleAlert className="pc-kpi-icon" size={20} aria-hidden="true" /><span className="pc-kpi-label">Precisam de atenção</span><span className="pc-kpi-value">{setoresAtencao}</span><span className="pc-kpi-sub">Setores com atrasos ou inconsistências</span></div>
          </div>
          <div className="pc-sector-toolbar">
            <div><h2>Seus setores <span>{setores.length}</span></h2><p>Selecione um setor para acompanhar os períodos e comprovantes.</p></div>
            <label className="pc-sector-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar setores" placeholder="Buscar setor, responsável ou cartão" value={setorSearch} onChange={e => setSetorSearch(e.target.value)} /></label>
          </div>
          <div className="pc-sector-filters" aria-label="Filtrar setores">
            <button aria-pressed={setorFilter === 'todos'} onClick={() => setSetorFilter('todos')}>Todos os setores <span>{setores.length}</span></button>
            <button aria-pressed={setorFilter === 'atencao'} onClick={() => setSetorFilter('atencao')}><TriangleAlert size={14} aria-hidden="true" /> Precisam de atenção <span>{setoresAtencao}</span></button>
          </div>
          {setores.length === 0
            ? <div className="pc-empty">Nenhum setor cadastrado.{isAdmin ? ' Crie o primeiro!' : ''}</div>
            : (
              visibleSetores.length === 0 ? <div className="pc-empty"><Search size={28} aria-hidden="true" /><h3>Nenhum setor encontrado</h3><p>Experimente outro nome ou remova os filtros.</p><button className="pc-btn pc-btn-ghost" onClick={() => { setSetorSearch(''); setSetorFilter('todos'); }}>Limpar filtros</button></div> : <div className="pc-setores-grid">
                {visibleSetores.map(s => {
                  const i = setores.indexOf(s);
                  const isKamino = s.card_brand === 'kamino';
                  return (
                    <article
                      key={s.id}
                      className={`pc-setor-card${isKamino ? ' pc-setor-card--kamino' : ''}`}
                      style={isKamino ? undefined : { '--card-accent': s.periodos_inconsistentes > 0 ? '#ef4444' : SETOR_COLORS[i % SETOR_COLORS.length] } as React.CSSProperties}
                    >
                      <button className="pc-setor-open" onClick={() => navPeriodos(s)} aria-label={`Abrir setor ${s.nome}`}>
                      {isKamino ? (
                        <div className="pc-kamino-header">
                          <span className="pc-kamino-logo">⌘ KAMINO</span>
                          <span className="pc-kamino-chip">▪</span>
                        </div>
                      ) : (
                        <div className="pc-setor-card-bar" />
                      )}
                      <div className="pc-setor-card-body">
                        <div className="pc-setor-icon">{s.card_last4 ? <CreditCard size={25} aria-hidden="true" /> : <Building2 size={25} aria-hidden="true" />}</div>
                        <div className="pc-setor-info">
                          <strong>{s.nome}</strong>
                          {s.card_last4 && <small>{isKamino ? '•••• •••• •••• ' : 'Cartão •••• '}{s.card_last4}</small>}
                          <small>{s.responsavel_nome || s.responsavel || 'Responsável não definido'}</small>
                        </div>
                      </div>
                      <div className="pc-setor-card-foot">
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          {s.periodos_inconsistentes > 0 && (
                            <span className="pc-sector-warning">{s.periodos_inconsistentes} inconsistência(s)</span>
                          )}
                          {Number(s.periodos_atrasados) > 0 && <span className="pc-sector-warning">{s.periodos_atrasados} período(s) atrasado(s)</span>}
                          {!precisaAtencao(s) && <span className="pc-sector-clear">Sem alertas</span>}
                          <small>{Number(s.periodos_abertos) || 0} período(s) aberto(s)</small>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="pc-sector-balance"><small>Saldo em aberto</small><strong>{fmt(s.saldo_aberto)}</strong></span><ArrowUpRight size={18} aria-hidden="true" />
                        </span>
                      </div>
                      </button>
                      {isAdmin && <button className="pc-card-delete-btn" title={`Excluir setor ${s.nome}`} aria-label={`Excluir setor ${s.nome}`} onClick={ev => deletarSetor(s, ev)}><Trash2 size={15} aria-hidden="true" /></button>}
                    </article>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* ── PERÍODOS ── */}
      {!loading && !error && view === 'periodos' && setor && (
        <div>
          <div className="pc-page-hd">
            <div>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={navSetores} style={{ marginBottom: 6, fontWeight: 600 }}>← Voltar</button>
              <h1>{setor.nome}</h1>
              {setor.card_last4 && <p>Cartão •••• {setor.card_last4}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isAdmin && (
                <>
                  <button className="pc-btn pc-btn-ghost" onClick={() => openModal('edit-setor', { nome: setor.nome, card: setor.card_last4 || '', card_brand: setor.card_brand || '', resp_user_id: setor.responsavel_user_id || '', validador_user_id: setor.validador_user_id || '' })}>✏️ Editar Setor</button>
                  <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={ev => deletarSetor(setor, ev)}>🗑️ Excluir Setor</button>
                  <button className="pc-btn pc-btn-primary" onClick={() => openModal('novo-periodo', { periodo: '', inicio: '', fim: '', resp_user_id: '' })}>+ Novo Período</button>
                </>
              )}
            </div>
          </div>
          {periodos.length === 0
            ? <div className="pc-empty">Nenhum período cadastrado para este setor.</div>
            : (
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr><th>Período</th><th>Início</th><th>Fim</th><th>Responsável</th><th>Status</th><th>Lançamentos</th><th>Total</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {periodos.map(p => (
                      <tr key={p.id}>
                        <td><button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => navLancamentos(p)}>{p.periodo}</button></td>
                        <td>{fmtDate(p.data_inicio)}</td>
                        <td>{fmtDate(p.data_fim)}</td>
                        <td>{p.responsavel_nome || p.responsavel || '—'}</td>
                        <td>
                          {(() => { const si = periodoStatusInfo(p.status); return (
                            <div>
                              <span style={{ color: si.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: si.dot, display: 'inline-block' }} />
                                {si.label}
                              </span>
                              {p.status === 'validado' && p.validado_por_nome && (
                                <div style={{ fontSize: 11, color: 'var(--pc-muted)', marginTop: 2 }}>
                                  {p.validado_por_nome} · {fmtDate(p.validado_em)}
                                </div>
                              )}
                            </div>
                          ); })()}
                        </td>
                        <td>{p.qtd_lancamentos}</td>
                        <td>{fmt(p.total_gasto)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => navLancamentos(p)}>Ver</button>
                            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => navFatura(p)}>Fatura</button>
                            {canValidate && (p.status === 'aberto' || p.status === 'atrasado') && <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => fecharPeriodo(p)}>Fechar</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── LANÇAMENTOS ── */}
      {!loading && !error && view === 'lancamentos' && periodo && (
        <div>
          <div className="pc-page-hd">
            <div>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setor && navPeriodos(setor)} style={{ marginBottom: 6, fontWeight: 600 }}>← Voltar</button>
              <h1>{periodo.periodo}</h1>
              <p>
                {fmtDate(periodo.data_inicio)} — {fmtDate(periodo.data_fim)}
                &nbsp;·&nbsp;
                {(() => { const si = periodoStatusInfo(periodo.status); return (
                  <span style={{ color: si.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: si.dot, display: 'inline-block' }} />
                    {si.label}
                  </span>
                ); })()}
                {(periodo.responsavel_nome || periodo.responsavel) && <>&nbsp;·&nbsp;👤 {periodo.responsavel_nome || periodo.responsavel}</>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="pc-btn pc-btn-ghost" onClick={() => navFatura(periodo)}>📄 Fatura</button>
              {(periodo.status === 'aberto' || periodo.status === 'atrasado') && (
                <button className="pc-btn pc-btn-primary" onClick={openNovoLancamento}>+ Lançamento</button>
              )}
              {(periodo.status === 'aberto' || periodo.status === 'atrasado') && (
                <button className="pc-btn pc-btn-ghost" onClick={submitPeriodo}>📤 Enviar p/ Validação</button>
              )}
              {periodo.status === 'aguardando_validacao' && canValidate && !incDialogOpen && (
                <>
                  <button className="pc-btn pc-btn-positive" onClick={handleValidarPeriodo}>✓ Validar</button>
                  <button className="pc-btn pc-btn-negative" onClick={() => setIncDialogOpen(true)}>⚠ Inconsistência</button>
                </>
              )}
              {periodo.status === 'aguardando_validacao' && (isAdmin || user?.id === periodo.responsavel_user_id) && (
                <button className="pc-btn pc-btn-warning" onClick={cancelarSubmissao}>↩ Cancelar Envio</button>
              )}
              {periodo.status === 'inconsistencia' && (
                <button className="pc-btn pc-btn-primary" onClick={handleCorrigirPeriodo}>🔧 Corrigir e Reenviar</button>
              )}
              {canValidate && (periodo.status === 'aberto' || periodo.status === 'atrasado' || periodo.status === 'aguardando_validacao') && (
                <button className="pc-btn pc-btn-ghost" onClick={() => fecharPeriodo(periodo)}>🔒 Fechar</button>
              )}
            </div>
          </div>
          {/* ── Inconsistência dialog ── */}
          {/* Corrigir e Reenviar Modal */}
      {corrigirModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="pc-modal" role="dialog" aria-modal="true" aria-label="Corrigir e Reenviar" style={{
            background: 'var(--pc-surface)', borderRadius: 18, padding: 28, width: 480, maxWidth: '95vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Corrigir e Reenviar</h3>
            <p style={{ color: 'var(--pc-muted)', fontSize: 14, margin: '0 0 16px' }}>
              Descreva o que foi corrigido para registrar no histórico do período.
            </p>
            <textarea className="pc-correction-input" aria-label="Descreva o que foi corrigido"
              value={corrigirTexto}
              onChange={e => setCorrigirTexto(e.target.value)}
              placeholder="Ex: Nota fiscal ajustada, valor corrigido de R$ X para R$ Y..."
              rows={4}
              style={{
                width: '100%', borderRadius: 10, border: '1px solid var(--pc-border)',
                padding: '10px 12px', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                className="pc-btn pc-btn-ghost"
                onClick={() => { setCorrigirModal(false); setCorrigirTexto(''); }}
              >Cancelar</button>
              <button
                className="pc-btn pc-btn-primary"
                onClick={submitCorrigir}
                disabled={!corrigirTexto.trim()}
                style={{ opacity: corrigirTexto.trim() ? 1 : 0.5 }}
              >Reenviar para Validação</button>
            </div>
          </div>
        </div>
      )}

      {incDialogOpen && (
            <div className="pc-inconsistency">
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>⚠ Descreva a inconsistência encontrada:</p>
                <textarea
                  value={incDialog}
                  onChange={e => setIncDialog(e.target.value)}
                  placeholder="Ex: Falta nota fiscal do lançamento de R$ 1.200 do dia 15/08..."
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 90 }}>
                <button className="pc-btn pc-btn-sm pc-btn-negative" onClick={handleInconsistenciaPeriodo} disabled={!incDialog.trim()}>Confirmar</button>
                <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => { setIncDialogOpen(false); setIncDialog(''); }}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="pc-kpis">
            <div className="pc-kpi"><span className="pc-kpi-label">Total Gasto</span><span className="pc-kpi-value">{fmt(totalLancs)}</span></div>
            <div className="pc-kpi"><span className="pc-kpi-label">Lançamentos</span><span className="pc-kpi-value">{lancamentos.length}</span></div>
            <div className="pc-kpi"><span className="pc-kpi-label">Pendentes</span><span className="pc-kpi-value">{lancamentos.filter(l => l.status === 'pendente').length}</span></div>
            <div className="pc-kpi"><span className="pc-kpi-label">Aprovados</span><span className="pc-kpi-value">{lancamentos.filter(l => l.status === 'aprovado').length}</span></div>
          </div>
          {/* ── Period tabs ── */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            <button
              className={`pc-btn pc-btn-sm${periodoTab === 'lancamentos' ? ' pc-btn-primary' : ' pc-btn-ghost'}`}
              onClick={() => setPeriodoTab('lancamentos')}
            >Lançamentos ({lancamentos.length})</button>
            <button
              className={`pc-btn pc-btn-sm${periodoTab === 'comentarios' ? ' pc-btn-primary' : ' pc-btn-ghost'}`}
              onClick={() => setPeriodoTab('comentarios')}
            >
              Histórico{periodoComentarios.length > 0 ? ` (${periodoComentarios.length})` : ''}
              {periodoComentarios.some(c => c.tipo === 'inconsistencia') && periodo.status !== 'validado' ? ' ⚠' : ''}
            </button>
          </div>

          {/* ── Period comments tab ── */}
          {periodoTab === 'comentarios' && (
            <div>
              {periodoComentarios.length === 0
                ? <div className="pc-empty">Nenhum comentário neste período.</div>
                : (
                  <div className="pc-comentarios" style={{ marginBottom: 12 }}>
                    {periodoComentarios.map(c => {
                      const isInc = c.tipo === 'inconsistencia', isCor = c.tipo === 'correcao';
                      const isSubmit = c.tipo === 'submit', isVal = c.tipo === 'validado', isCan = c.tipo === 'cancelamento';
                      const cStyle = isInc ? { borderLeft: '3px solid #fb7185', background: '#fb71850c' }
                        : isCor ? { borderLeft: '3px solid #34d399', background: '#34d3990c' }
                        : isSubmit ? { borderLeft: '3px solid #60a5fa', background: '#60a5fa0c' }
                        : isVal ? { borderLeft: '3px solid #34d399', background: '#34d3990c' }
                        : isCan ? { borderLeft: '3px solid #fb923c', background: '#fb923c0c' }
                        : {};
                      return (
                        <div key={c.id} className="pc-comentario" style={cStyle}>
                          <div className="pc-com-hd">
                            <strong>{isInc ? '⚠ INCONSISTÊNCIA' : isCor ? '✔ CORREÇÃO' : isSubmit ? '📤 ENVIADO' : isVal ? '✓ VALIDADO' : isCan ? '↩ CANCELADO' : ''} {c.autor_nome}</strong>
                            <span>{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <p>{c.texto}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              <div className="pc-comentario-input">
                <input
                  value={periodoCommentText}
                  onChange={e => setPeriodoCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPeriodoComment(); } }}
                  placeholder="Adicionar comentário ao período..."
                />
                <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={sendPeriodoComment}>Enviar</button>
              </div>
            </div>
          )}

          {/* ── Lancamentos tab ── */}
          {periodoTab === 'lancamentos' && lancamentos.length === 0
            ? <div className="pc-empty">Nenhum lançamento neste período.{(periodo.status === 'aberto' || periodo.status === 'atrasado') ? ' Clique em "+ Lançamento" para adicionar.' : ''}</div>
            : periodoTab === 'lancamentos' && (
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Data</th><th>Fornecedor</th><th>Descrição</th><th>Por</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th>Status</th><th>Anexos</th><th>Coments</th>
                      {(canValidate && periodo.status === 'aguardando_validacao') && <th style={{ whiteSpace: 'nowrap' }}>Validação</th>}
                      {(periodo.status === 'aberto' && canValidate || isAdmin) && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map(l => (
                      <tr key={l.id} onClick={() => openDrawer(l.id)} style={{ cursor: 'pointer' }}>
                        <td>{fmtDate(l.data)}</td>
                        <td>{l.fornecedor || '—'}</td>
                        <td><button className="pc-entry-open" onClick={e => { e.stopPropagation(); void openDrawer(l.id); }}>{l.descricao}</button></td>
                        <td style={{ fontSize: 12, color: 'var(--pc-muted)' }}>{l.autor_nome || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(l.valor)}</td>
                        <td><span style={statusStyle(l.status || 'pendente')}>{l.status || 'pendente'}</span></td>
                        <td>{l.qtd_anexos > 0 ? `📎 ${l.qtd_anexos}` : '—'}</td>
                        <td>{l.qtd_comentarios > 0 ? `💬 ${l.qtd_comentarios}` : '—'}</td>
                        {(canValidate && periodo.status === 'aguardando_validacao') && (
                          <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                            {l.status === 'pendente' && (
                              <>
                                <button
                                  className="pc-btn pc-btn-sm"
                                  style={{ background: '#16a34a', color: '#fff', marginRight: 4, padding: '2px 8px' }}
                                  onClick={() => aprovarLancamento(l.id)}
                                  title="Aprovar lançamento"
                                >✓ OK</button>
                                <button
                                  className="pc-btn pc-btn-sm"
                                  style={{ background: '#f97316', color: '#fff', padding: '2px 8px' }}
                                  onClick={() => inconsistenteLancamento(l.id)}
                                  title="Marcar inconsistente"
                                >✗ Inc.</button>
                              </>
                            )}
                            {l.status === 'aprovado' && <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>✓ Aprovado</span>}
                            {l.status === 'inconsistente' && <span style={{ color: '#f97316', fontWeight: 700, fontSize: 12 }}>⚠ Inconsistente</span>}
                          </td>
                        )}
                        {(periodo.status === 'aberto' && canValidate || isAdmin) && (
                          <td onClick={e => e.stopPropagation()}>
                            {(periodo.status === 'aberto' && canValidate || isAdmin || (periodo.status === 'aguardando_validacao' && user?.id === periodo.responsavel_user_id)) && (
                              <button
                                className="pc-btn pc-btn-ghost pc-btn-sm"
                                onClick={() => openEditDirect(l.id)}
                                title="Editar lançamento"
                              >✏️ Editar</button>
                            )}
                            {isAdmin && (
                              <button
                                className="pc-btn pc-btn-danger pc-btn-sm"
                                onClick={ev => deletarLancamentoById(l.id, ev)}
                                title="Excluir lançamento"
                              >🗑️</button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--pc-muted)', fontSize: 13 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{fmt(totalLancs)}</td>
                      <td colSpan={3} />
                      {(periodo.status === 'aberto' && canValidate || isAdmin) && <td />}
                      {(canValidate && periodo.status === 'aguardando_validacao') && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── FATURA ── */}
      {!loading && !error && view === 'fatura' && (
        <div>
          {!fatura
            ? <div className="pc-empty">Carregando fatura...</div>
            : (() => {
              const { periodo: p, lancamentos: ll, total } = fatura;
              return (
                <>
                  <div className="pc-page-hd">
                    <div>
                      <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => periodo && navLancamentos(periodo)} style={{ marginBottom: 6, fontWeight: 600 }}>← Voltar</button>
                      <h1>Fatura — {p.periodo}</h1><p>{p.setor_nome}</p>
                    </div>
                    <button className="pc-btn pc-btn-ghost" onClick={() => window.print()}>🖨️ Imprimir</button>
                  </div>
                  <div className="pc-fatura-header">
                    <div><strong>Setor:</strong> {p.setor_nome}</div>
                    {p.card_last4 && <div><strong>Cartão:</strong> •••• {p.card_last4}</div>}
                    <div><strong>Período:</strong> {fmtDate(p.data_inicio)} — {fmtDate(p.data_fim)}</div>
                    <div>
                      <strong>Status:</strong>{' '}
                      {(() => { const si = periodoStatusInfo(p.status); return (
                        <span style={{ color: si.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: si.dot, display: 'inline-block', flexShrink: 0 }} />
                          {si.label}
                        </span>
                      ); })()}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}><strong>Total:</strong> {fmt(total)}</div>
                  </div>
                  <div className="pc-table-wrap">
                    <table className="pc-table">
                      <thead>
                        <tr><th>#</th><th>Data</th><th>Fornecedor</th><th>Descrição</th><th>Doc</th><th>Forma Pgto</th><th>Valor</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {ll.map((l, i) => (
                          <tr key={l.id}>
                            <td>{i + 1}</td>
                            <td>{fmtDate(l.data)}</td>
                            <td>{l.fornecedor || '—'}</td>
                            <td>{l.descricao}</td>
                            <td>{l.numero_documento || '—'}</td>
                            <td>{l.forma_pagamento || '—'}</td>
                            <td>{fmt(l.valor)}</td>
                            <td><span style={statusStyle(l.status || 'pendente')}>{l.status || 'pendente'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL</td>
                          <td style={{ fontWeight: 700 }}>{fmt(total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              );
            })()}
        </div>
      )}

      {/* ── BI ── */}
      {view === 'bi' && (
        <div>
          <div className="pc-page-hd">
            <div>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={navSetores} style={{ marginBottom: 6, fontWeight: 600 }}>← Voltar</button>
              <h1>BI — Visão Geral</h1><p>Todos os setores e períodos</p>
            </div>
            {loading && <span className="pc-spinner" />}
          </div>
          <div className="pc-bi-kpis">
            <div className="pc-bi-card"><span className="pc-kpi-label">Total Geral</span><span className="pc-kpi-value">{fmt(totalBI)}</span></div>
            <div className="pc-bi-card"><span className="pc-kpi-label">Setores</span><span className="pc-kpi-value">{biSetores.length}</span></div>
            <div className="pc-bi-card"><span className="pc-kpi-label">Períodos</span><span className="pc-kpi-value">{biPeriodos.length}</span></div>
            <div className="pc-bi-card"><span className="pc-kpi-label">Lançamentos</span><span className="pc-kpi-value">{biLancs.length}</span></div>
          </div>
          {biReady && biLancs.length === 0 && <div className="pc-empty">Nenhum lançamento encontrado para análise.</div>}
          {biReady && biLancs.length > 0 && (
            <Suspense fallback={<div className="pc-empty" role="status">Preparando gráficos…</div>}>
              <PrestacaoFinanceCharts setores={biSetores} periodos={biPeriodos} lancamentos={biLancs} />
            </Suspense>
          )}
        </div>
      )}

      {/* ── LOG ── */}
      {view === 'log' && (
        <div>
          <div className="pc-page-hd">
            <div>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={navSetores} style={{ marginBottom: 6, fontWeight: 600 }}>← Voltar</button>
              <h1>Log — Histórico de Lançamentos</h1><p>Todos os setores e períodos, mais recentes primeiro</p>
            </div>
            {loading && <span className="pc-spinner" />}
          </div>
          {!biReady && loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <span className="pc-spinner" />
            </div>
          )}
          {biReady && biLancs.length === 0 && <div className="pc-empty">Nenhum lançamento encontrado.</div>}
          {biReady && biLancs.length > 0 && (() => {
            const sorted = [...biLancs].sort((a, b) =>
              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );
            return (
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Lançado em</th><th>Por</th><th>Setor</th><th>Período</th>
                      <th>Descrição</th><th style={{ textAlign: 'right' }}>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(l => (
                      <tr key={l.id} onClick={() => openDrawer(l.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          <div>{fmtDateTime(l.created_at)}</div>
                          {l.data && <div style={{ color: 'var(--pc-muted)', fontSize: 11 }}>Despesa: {fmtDate(l.data)}</div>}
                        </td>
                        <td>{l.autor_nome || '—'}</td>
                        <td>{l.setor_nome}</td>
                        <td>{l.periodo_nome}</td>
                        <td>
                          <button className="pc-entry-open" onClick={e => { e.stopPropagation(); void openDrawer(l.id); }}>{l.descricao}</button>
                          {l.fornecedor && <div style={{ color: 'var(--pc-muted)', fontSize: 11 }}>{l.fornecedor}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(l.valor)}</td>
                        <td>
                          <span style={statusStyle(l.status || 'pendente')}>{l.status || 'pendente'}</span>
                          {(l.status === 'aprovado' || l.status === 'inconsistente') && l.validado_por_nome && (
                            <div style={{ fontSize: 11, color: 'var(--pc-muted)', marginTop: 2 }}>
                              {l.validado_por_nome} · {fmtDate(l.validado_em)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--pc-muted)', fontSize: 13 }}>TOTAL ({biLancs.length} lançamentos)</td>
                      <td />
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{fmt(biLancs.reduce((s, l) => s + parseFloat(l.valor), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── DRAWER ── */}
      {drawerOpen && (
        <>
          <div className="pc-drawer-overlay open" onClick={closeDrawer} />
          <div className="pc-drawer open">
            <div className="pc-drawer-hd">
              <strong>Detalhe do Lançamento</strong>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={closeDrawer}>✕</button>
            </div>
            {drawerLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <span className="pc-spinner" />
              </div>
            )}
            {!drawerLoading && drawerLanc && (
              <div className="pc-drawer-body">
                {/* Status badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={statusStyle(drawerLanc.status || 'pendente')}>{drawerLanc.status || 'pendente'}</span>
                  {drawerLanc.validado_por && drawerLanc.validado_em && (
                    <span style={{ fontSize: 11, color: 'var(--pc-muted)' }}>
                      por {drawerLanc.validado_por_nome || drawerLanc.validado_por} · {fmtDateTime(drawerLanc.validado_em)}
                    </span>
                  )}
                  {drawerLanc.validacao_obs && (
                    <span style={{ fontSize: 12, color: '#fda4af' }}>— {drawerLanc.validacao_obs}</span>
                  )}
                </div>

                <div className="pc-form-static"><label>Descrição</label><span>{drawerLanc.descricao}</span></div>
                <div className="pc-form-static"><label>Valor</label><span>{fmt(drawerLanc.valor)}</span></div>
                <div className="pc-form-static"><label>Data</label><span>{fmtDate(drawerLanc.data)}</span></div>
                {drawerLanc.data_compra && <div className="pc-form-static"><label>Data Compra</label><span>{fmtDate(drawerLanc.data_compra)}</span></div>}
                {drawerLanc.fornecedor && <div className="pc-form-static"><label>Fornecedor</label><span>{drawerLanc.fornecedor}</span></div>}
                {drawerLanc.numero_documento && <div className="pc-form-static"><label>Documento</label><span>{drawerLanc.numero_documento}</span></div>}
                {drawerLanc.forma_pagamento && <div className="pc-form-static"><label>Forma Pgto</label><span>{drawerLanc.forma_pagamento}</span></div>}
                {drawerLanc.parcelado && <div className="pc-form-static"><label>Parcelado</label><span>Sim — {drawerLanc.num_parcelas}x</span></div>}
                {drawerLanc.setor_area && <div className="pc-form-static"><label>Área</label><span>{drawerLanc.setor_area}</span></div>}
                {drawerLanc.observacoes && <div className="pc-form-static"><label>Observações</label><span>{drawerLanc.observacoes}</span></div>}
                <div className="pc-form-static"><label>Autor</label><span>{drawerLanc.autor_nome}</span></div>

                {/* Ações do validador */}
                {canValidate && drawerLanc.status === 'pendente' && (
                  <div className="pc-drawer-actions" style={{ marginTop: 8 }}>
                    <button
                      className="pc-btn pc-btn-sm pc-btn-positive"
                      onClick={() => validarLancamento('aprovado')}
                    >✓ Aprovar</button>
                    <button
                      className="pc-btn pc-btn-sm pc-btn-negative"
                      onClick={async () => {
                        const obs = prompt('Observação sobre inconsistência (opcional):');
                        if (obs === null) return;
                        await validarLancamento('inconsistente', obs || undefined);
                      }}
                    >⚠ Inconsistente</button>
                  </div>
                )}
                {canValidate && drawerLanc.status === 'aprovado' && (
                  <div className="pc-drawer-actions" style={{ marginTop: 8 }}>
                    <button
                      className="pc-btn pc-btn-sm pc-btn-negative"
                      onClick={async () => {
                        const obs = prompt('Observação sobre inconsistência (opcional):');
                        if (obs === null) return;
                        await validarLancamento('inconsistente', obs || undefined);
                      }}
                    >⚠ Marcar Inconsistente</button>
                    <button
                      className="pc-btn pc-btn-sm pc-btn-warning"
                      onClick={() => validarLancamento('pendente')}
                    >↩ Desfazer</button>
                  </div>
                )}
                {canValidate && drawerLanc.status === 'inconsistente' && (
                  <div className="pc-drawer-actions" style={{ marginTop: 8 }}>
                    <button
                      className="pc-btn pc-btn-sm pc-btn-positive"
                      onClick={() => validarLancamento('aprovado')}
                    >✓ Aprovar</button>
                    <button
                      className="pc-btn pc-btn-sm pc-btn-warning"
                      onClick={() => validarLancamento('pendente')}
                    >↩ Desfazer</button>
                  </div>
                )}

                {/* Editar/Excluir */}
                {(periodo?.status === 'aberto' && canValidate || isAdmin) && (
                  <div className="pc-drawer-actions" style={{ marginTop: 4 }}>
                    {periodo?.status === 'aberto' && canValidate && <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={openEditLancamento}>✏️ Editar</button>}
                    {isAdmin && <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={deletarLancamento}>🗑️ Excluir</button>}
                  </div>
                )}

                {/* Anexos */}
                <div className="pc-drawer-section">
                  <div className="pc-drawer-section-hd">
                    <strong>Anexos ({drawerAnexos.length})</strong>
                    {periodo?.status === 'aberto' && (
                      <label className="pc-file-label pc-btn-sm">
                        📎 Adicionar
                        <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }}
                          onChange={e => { if (e.target.files) uploadAnexo(e.target.files); e.target.value = ''; }}
                        />
                      </label>
                    )}
                  </div>
                  {drawerAnexos.length === 0
                    ? <p className="pc-drawer-empty">Nenhum anexo</p>
                    : (
                      <ul className="pc-anexos-list">
                        {drawerAnexos.map(a => (
                          <li key={a.id}>
                            <a href={a.public_url || `/${a.caminho}`} target="_blank" rel="noreferrer">
                              📄 {a.nome_original}
                            </a>
                            <span style={{ color: 'var(--pc-muted)', fontSize: 12 }}>({(a.tamanho / 1024).toFixed(0)}KB)</span>
                            {isAdmin && periodo?.status === 'aberto' && (
                              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => excluirAnexo(a.id)}>✕</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>

                {/* Comentários */}
                <div className="pc-drawer-section">
                  <strong>Comentários ({drawerComs.length})</strong>
                  <div className="pc-comentarios">
                    {drawerComs.map(c => (
                      <div key={c.id} className="pc-comentario">
                        <div className="pc-com-hd">
                          <strong>{c.autor_nome}</strong>
                          <span>{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <p>{c.texto}</p>
                      </div>
                    ))}
                  </div>
                  <div className="pc-comentario-input">
                    <input
                      value={comentario}
                      onChange={e => setComentario(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                      placeholder="Adicionar comentário..."
                    />
                    <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={sendComment}>Enviar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MODAL ── */}
      {modal && modal !== 'permissoes' && (
        <div className="pc-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="pc-modal">
            <div className="pc-modal-hd">
              <strong>
                {modal === 'novo-setor' && 'Novo Setor'}
                {modal === 'edit-setor' && 'Editar Setor'}
                {modal === 'novo-periodo' && 'Novo Período'}
                {modal === 'novo-lancamento' && 'Novo Lançamento'}
                {modal === 'edit-lancamento' && 'Editar Lançamento'}
              </strong>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="pc-modal-body">
              {(modal === 'novo-setor' || modal === 'edit-setor') && (
                <div className="pc-form-grid">
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Nome *</label>
                    <input value={String(form.nome || '')} onChange={e => setF('nome', e.target.value)} placeholder="Ex: TI" />
                  </div>
                  <div className="pc-form-group">
                    <label>Últimos 4 dígitos do cartão</label>
                    <input value={String(form.card || '')} onChange={e => setF('card', e.target.value)} placeholder="1234" maxLength={4} />
                  </div>
                  <div className="pc-form-group">
                    <label>Bandeira do Cartão</label>
                    <select value={String(form.card_brand || '')} onChange={e => setF('card_brand', e.target.value)}>
                      <option value="">— Padrão —</option>
                      <option value="kamino">Kamino</option>
                    </select>
                  </div>
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Responsável</label>
                    <select value={String(form.resp_user_id || '')} onChange={e => setF('resp_user_id', e.target.value)}>
                      <option value="">— Nenhum —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Validador do Setor</label>
                    <select value={String(form.validador_user_id || '')} onChange={e => setF('validador_user_id', e.target.value)}>
                      <option value="">— Nenhum —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {modal === 'novo-periodo' && (
                <div className="pc-form-grid">
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Nome do Período *</label>
                    <input value={String(form.periodo || '')} onChange={e => setF('periodo', e.target.value)} placeholder="Ex: Setembro/2026" />
                  </div>
                  <div className="pc-form-group">
                    <label>Data Início *</label>
                    <input type="date" value={String(form.inicio || '')} onChange={e => setF('inicio', e.target.value)} />
                  </div>
                  <div className="pc-form-group">
                    <label>Data Fim *</label>
                    <input type="date" value={String(form.fim || '')} onChange={e => setF('fim', e.target.value)} />
                  </div>
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Responsável</label>
                    <select value={String(form.resp_user_id || '')} onChange={e => setF('resp_user_id', e.target.value)}>
                      <option value="">— Nenhum —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {(modal === 'novo-lancamento' || modal === 'edit-lancamento') && (
                <div className="pc-form-grid">
                  <div className="pc-form-group">
                    <label>Data Lançamento *</label>
                    <input type="date" value={String(form.data || '')} onChange={e => setF('data', e.target.value)} />
                  </div>
                  <div className="pc-form-group">
                    <label>Data Compra</label>
                    <input type="date" value={String(form.compra || '')} onChange={e => setF('compra', e.target.value)} />
                  </div>
                  <div className="pc-form-group">
                    <label>Fornecedor</label>
                    <input value={String(form.forn || '')} onChange={e => setF('forn', e.target.value)} placeholder="Nome do fornecedor" />
                  </div>
                  <div className="pc-form-group">
                    <label>Número Documento</label>
                    <input value={String(form.doc || '')} onChange={e => setF('doc', e.target.value)} placeholder="NF, recibo..." />
                  </div>
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Descrição *</label>
                    <input value={String(form.desc || '')} onChange={e => setF('desc', e.target.value)} placeholder="Descreva o gasto" />
                  </div>
                  <div className="pc-form-group">
                    <label>Valor (R$) *</label>
                    <input type="number" step="0.01" min="0" value={String(form.valor || '')} onChange={e => setF('valor', e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="pc-form-group">
                    <label>Área/Setor</label>
                    <input value={String(form.setor_area || '')} onChange={e => setF('setor_area', e.target.value)} placeholder="Área beneficiada" />
                  </div>
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="pc-checkbox-label">
                      <input type="checkbox" checked={!!form.parcelado} onChange={e => setF('parcelado', e.target.checked)} />
                      Compra Parcelada
                    </label>
                  </div>
                  {!!form.parcelado && (
                    <div className="pc-form-group">
                      <label>Número de Parcelas</label>
                      <input type="number" min="2" value={String(form.parcelas || '')} onChange={e => setF('parcelas', e.target.value)} placeholder="Ex: 3" />
                    </div>
                  )}
                  <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Observações</label>
                    <textarea value={String(form.obs || '')} onChange={e => setF('obs', e.target.value)} rows={2} placeholder="Observações adicionais..." />
                  </div>
                  {(modal === 'novo-lancamento' || modal === 'edit-lancamento') && (
                    <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Anexos</label>
                      {modal === 'edit-lancamento' && editModalAnexos.length > 0 && (
                        <ul style={{ margin: '4px 0 8px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {editModalAnexos.map(a => (
                            <li key={a.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <a href={a.public_url || `/${a.caminho}`} target="_blank" rel="noreferrer" style={{ color: 'var(--pc-primary)' }}>📄 {a.nome_original}</a>
                              <span style={{ color: 'var(--pc-muted)', fontSize: 11 }}>({(a.tamanho / 1024).toFixed(0)} KB)</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <label className="pc-file-label">
                        📎 {fileNames || 'Selecionar arquivos'}
                        <input type="file" multiple style={{ display: 'none' }}
                          onChange={e => {
                            selectedFiles.current = e.target.files;
                            setFileNames(e.target.files?.length ? Array.from(e.target.files).map(f => f.name).join(', ') : '');
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="pc-modal-ft">
              <button className="pc-btn pc-btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="pc-btn pc-btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PERMISSÕES ── */}
      {modal === 'permissoes' && isAdmin && (
        <div className="pc-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="pc-modal" style={{ maxWidth: 560 }}>
            <div className="pc-modal-hd">
              <strong>🔑 Permissões — Prestação de Contas</strong>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="pc-modal-body">
              <p style={{ fontSize: 13, color: 'var(--pc-muted)', marginBottom: 16 }}>
                Gerencie quem tem acesso ao módulo e qual o papel de cada colaborador.
              </p>

              {/* Adicionar permissão */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <select
                  value={permForm.user_id}
                  onChange={e => setPermForm(p => ({ ...p, user_id: e.target.value }))}
                  style={{ flex: 1, minWidth: 160 }}
                >
                  <option value="">— Selecionar colaborador —</option>
                  {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
                <select
                  value={permForm.papel}
                  onChange={e => setPermForm(p => ({ ...p, papel: e.target.value }))}
                  style={{ width: 130 }}
                >
                  <option value="padrao">Padrão</option>
                  <option value="validador">Validador</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={addPermissao} disabled={permSaving || !permForm.user_id}>
                  {permSaving ? '...' : '+ Adicionar'}
                </button>
              </div>

              {/* Lista de permissões */}
              {pcPermList.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--pc-muted)', textAlign: 'center', padding: 16 }}>Nenhum usuário com acesso.</p>
                : (
                  <table className="pc-table">
                    <thead>
                      <tr><th>Colaborador</th><th>E-mail</th><th>Papel</th><th></th></tr>
                    </thead>
                    <tbody>
                      {pcPermList.map(p => (
                        <tr key={p.id}>
                          <td>{p.user_name || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--pc-muted)' }}>{p.user_email || '—'}</td>
                          <td>
                            <span style={{
                              ...{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 },
                              ...(p.papel === 'admin' ? { background: '#a78bfa17', color: '#c4b5fd' } :
                                p.papel === 'validador' ? { background: '#60a5fa17', color: '#93c5fd' } :
                                  { background: '#94a3b817', color: '#b1bfd0' })
                            }}>
                              {p.papel === 'admin' ? '👑 Admin' : p.papel === 'validador' ? '✓ Validador' : '👤 Padrão'}
                            </span>
                          </td>
                          <td>
                            <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={() => removePermissao(p.id, p.user_name || p.user_id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              <p style={{ fontSize: 11, color: 'var(--pc-muted)', marginTop: 12 }}>
                <strong>Padrão:</strong> cria e visualiza lançamentos &nbsp;·&nbsp;
                <strong>Validador:</strong> aprova, marca inconsistências e fecha períodos &nbsp;·&nbsp;
                <strong>Admin:</strong> acesso completo
              </p>
            </div>
            <div className="pc-modal-ft">
              <button className="pc-btn pc-btn-ghost" onClick={() => setModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEXT MONTH CONFIRM POPUP ── */}
      {nextMonthConfirm && modal === 'novo-lancamento' && periodo && (
        <div className="pc-modal-overlay open" style={{ zIndex: 1100 }} onClick={e => { if (e.target === e.currentTarget) setNextMonthConfirm(null); }}>
          <div className="pc-modal" style={{ maxWidth: 440 }}>
            <div className="pc-modal-hd">
              <strong>⚠️ Atenção — Corte Mensal</strong>
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setNextMonthConfirm(null)}>✕</button>
            </div>
            <div className="pc-modal-body" style={{ lineHeight: 1.7 }}>
              <p>O período <strong>{periodo.periodo}</strong> já encerrou. O corte ocorre sempre no dia <strong>01 do mês seguinte</strong>.</p>
              <p style={{ marginTop: 8 }}>
                {nextMonthConfirm.existingPeriodoId
                  ? <>✅ O período <strong>{nextMonthConfirm.label}</strong> já existe. O lançamento será adicionado lá.</>
                  : <>Este lançamento vai para <strong>{nextMonthConfirm.label}</strong> ({nextMonthConfirm.inicio} — {nextMonthConfirm.fim}). O período será criado automaticamente.</>
                }
              </p>
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--pc-muted)' }}>Deseja continuar?</p>
            </div>
            <div className="pc-modal-ft">
              <button className="pc-btn pc-btn-ghost" onClick={() => setNextMonthConfirm(null)}>Cancelar</button>
              <button className="pc-btn pc-btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Salvando...' : nextMonthConfirm.existingPeriodoId
                  ? `Lançar em ${nextMonthConfirm.label}`
                  : `Criar ${nextMonthConfirm.label} e Lançar`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ── */}
      <div className="pc-toast-container">
        {toasts.map(t => <div key={t.id} className="pc-toast">{t.msg}</div>)}
      </div>
    </div>
  );
}
