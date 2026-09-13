
import { useCallback, useEffect, useRef, useState } from 'react';
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
  pcSubmitPeriodo, pcValidarPeriodo, pcInconsistenciaPeriodo, pcCorrigirPeriodo,
  pcListComentariosPeriodo, pcCreateComentarioPeriodo,
} from '../lib/prestacaoContasApi';
import type { Setor, Periodo, Lancamento, Comentario, Anexo, FaturaData, PcPermissao, ComentarioPeriodo } from '../lib/prestacaoContasApi';
import './prestacao-contas.css';

const SETOR_ICONS = ['🏢', '💼', '🖥️', '📦', '🔧', '📊', '🏗️', '🎯', '💡', '🌐'];
const SETOR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16', '#ef4444'];
const BI_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16'];

const fmt = (v: string | number) =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const fmtShort = (v: string | number) => {
  const n = Number(v);
  if (n >= 1_000_000) return 'R$ ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1_000) return 'R$ ' + (n / 1_000).toFixed(1).replace('.', ',') + 'k';
  return fmt(v);
};

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

function useChartJs(): boolean {
  const [loaded, setLoaded] = useState(!!(window as Record<string, unknown>).Chart);
  useEffect(() => {
    if ((window as Record<string, unknown>).Chart) { setLoaded(true); return; }
    const s = document.createElement('script');
    s.src = '/prestacao-contas/chart.min.js';
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);
  return loaded;
}

const statusStyle = (status: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    pendente: { background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 },
    aprovado: { background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 },
    inconsistente: { background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 },
  };
  return map[status] || { background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4, fontSize: 12 };
};

const periodoStatusInfo = (status: string) => {
  const map: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    aberto:               { label: 'Aberto',               color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
    aguardando_validacao: { label: 'Aguard. Validação',    color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
    atrasado:             { label: 'Atrasado',             color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
    validado:             { label: 'Validado',             color: '#166534', bg: '#dcfce7', dot: '#16a34a' },
    inconsistencia:       { label: 'Inconsistência',       color: '#7c2d12', bg: '#ffedd5', dot: '#f97316' },
    fechado:              { label: 'Fechado',              color: '#64748b', bg: '#f1f5f9', dot: '#94a3b8' },
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
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [fatura, setFatura] = useState<FaturaData | null>(null);
  const [biSetores, setBiSetores] = useState<Setor[]>([]);
  const [biPeriodos, setBiPeriodos] = useState<BiPeriodo[]>([]);
  const [biLancs, setBiLancs] = useState<BiLanc[]>([]);
  const [biReady, setBiReady] = useState(false);
  const chartJsLoaded = useChartJs();
  const biChartRefs = useRef<{ destroy(): void }[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLanc, setDrawerLanc] = useState<Lancamento | null>(null);
  const [drawerComs, setDrawerComs] = useState<Comentario[]>([]);
  const [drawerAnexos, setDrawerAnexos] = useState<Anexo[]>([]);
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

  // Destroy BI charts when leaving BI view
  useEffect(() => {
    if (view !== 'bi') {
      biChartRefs.current.forEach(c => { try { c.destroy(); } catch { /**/ } });
      biChartRefs.current = [];
    }
  }, [view]);

  // Render BI charts when data is ready
  useEffect(() => {
    if (view !== 'bi' || !biReady || !chartJsLoaded || !biLancs.length) return;
    type ChartCtor = new (el: HTMLCanvasElement, cfg: unknown) => { destroy(): void };
    const C = (window as Record<string, unknown>).Chart as ChartCtor;
    biChartRefs.current.forEach(c => { try { c.destroy(); } catch { /**/ } });
    biChartRefs.current = [];
    const refs: { destroy(): void }[] = [];

    const ttFmt = { callbacks: { label: (c: { raw: number }) => fmt(c.raw) } };
    const ttFmtH = { callbacks: { label: (c: { parsed: { x: number } }) => fmt(c.parsed.x) } };
    const xMoney = {
      ticks: { callback: (v: number) => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : fmt(v) },
      grid: { color: 'rgba(128,128,128,.15)' },
    };

    const mk = (id: string, cfg: unknown) => {
      const el = document.getElementById(id) as HTMLCanvasElement | null;
      if (!el) return;
      refs.push(new C(el, cfg));
    };

    const porSetor: Record<string, number> = {};
    biSetores.forEach(s => { porSetor[s.nome] = 0; });
    biLancs.forEach(l => { porSetor[l.setor_nome] = (porSetor[l.setor_nome] || 0) + parseFloat(l.valor); });
    const setorE = Object.entries(porSetor).sort((a, b) => b[1] - a[1]);
    if (setorE.length) mk('pc-chart-setor', {
      type: 'bar',
      data: { labels: setorE.map(([k]) => k), datasets: [{ data: setorE.map(([, v]) => v), backgroundColor: BI_COLORS.slice(0, setorE.length).map(c => c + 'bb'), borderColor: BI_COLORS.slice(0, setorE.length), borderWidth: 1, borderRadius: 5 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttFmtH }, scales: { x: xMoney, y: { grid: { color: 'rgba(128,128,128,.1)' } } } },
    });

    const porForma: Record<string, number> = {};
    biLancs.forEach(l => { const f = l.forma_pagamento || 'Não informado'; porForma[f] = (porForma[f] || 0) + parseFloat(l.valor); });
    const formaE = Object.entries(porForma).sort((a, b) => b[1] - a[1]);
    if (formaE.length) mk('pc-chart-forma', {
      type: 'doughnut',
      data: { labels: formaE.map(([k]) => k), datasets: [{ data: formaE.map(([, v]) => v), backgroundColor: BI_COLORS.map(c => c + 'cc'), borderColor: 'transparent', borderWidth: 3, hoverOffset: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } }, tooltip: ttFmt }, cutout: '62%' },
    });

    const porMes: Record<string, number> = {};
    biLancs.forEach(l => { if (!l.data) return; const m = l.data.slice(0, 7); porMes[m] = (porMes[m] || 0) + parseFloat(l.valor); });
    const mesE = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0]));
    const mesLabel = ([k]: [string]) => { const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }); };
    if (mesE.length) mk('pc-chart-mes', {
      type: 'line',
      data: { labels: mesE.map(mesLabel), datasets: [{ label: 'Gastos', data: mesE.map(([, v]) => v), borderColor: '#3b82f6', backgroundColor: '#3b82f610', fill: true, tension: 0.4, pointRadius: 5, pointHoverRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttFmt }, scales: { y: xMoney, x: { grid: { color: 'rgba(128,128,128,.1)' } } } },
    });

    const porForn: Record<string, number> = {};
    biLancs.forEach(l => { if (!l.fornecedor) return; porForn[l.fornecedor] = (porForn[l.fornecedor] || 0) + parseFloat(l.valor); });
    const topForn = Object.entries(porForn).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (topForn.length) mk('pc-chart-forn', {
      type: 'bar',
      data: { labels: topForn.map(([k]) => k), datasets: [{ data: topForn.map(([, v]) => v), backgroundColor: '#22c55e44', borderColor: '#22c55e', borderWidth: 1, borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttFmtH }, scales: { x: xMoney, y: { grid: { color: 'rgba(128,128,128,.1)' } } } },
    });

    const periSorted = [...biPeriodos].sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
    if (periSorted.length) mk('pc-chart-periodo', {
      type: 'bar',
      data: { labels: periSorted.map(p => `${p.setor_nome.slice(0, 10)} ${p.periodo}`), datasets: [{ data: periSorted.map(p => parseFloat(p.total_gasto || '0')), backgroundColor: BI_COLORS.map((_, i) => BI_COLORS[i % BI_COLORS.length] + '66'), borderColor: BI_COLORS, borderWidth: 1, borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttFmtH }, scales: { x: xMoney, y: { grid: { color: 'rgba(128,128,128,.1)' } } } },
    });

    biChartRefs.current = refs;
  }, [view, biReady, chartJsLoaded, biLancs, biSetores, biPeriodos]);

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

  const validarLancamento = async (status: 'aprovado' | 'inconsistente', obs?: string) => {
    if (!drawerLanc) return;
    try {
      await pcUpdateLancamentoStatus(drawerLanc.id, { status, obs });
      toast(status === 'aprovado' ? '✓ Lançamento aprovado.' : '⚠ Marcado como inconsistente.');
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

  const openEditLancamento = () => {
    const l = drawerLanc; if (!l) return;
    openModal('edit-lancamento', {
      data: l.data?.slice(0, 10) || '', compra: l.data_compra?.slice(0, 10) || '',
      forn: l.fornecedor || '', desc: l.descricao, doc: l.numero_documento || '',
      valor: l.valor, parcelado: l.parcelado, parcelas: l.num_parcelas?.toString() || '',
      setor_area: l.setor_area || '', obs: l.observacoes || '',
    });
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
          if (new Date() >= nextMonthStart) {
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

  const usersInPerm = new Set(pcPermList.map(p => p.user_id));
  const availableUsers = users.filter(u => !usersInPerm.has(u.id) && u.id !== user?.id);

  return (
    <div className="pc-page">
      {/* Breadcrumb */}
      <nav className="pc-breadcrumb">
        <button onClick={navSetores}>Setores</button>
        {setor && <><span>›</span><button onClick={() => navPeriodos(setor)}>{setor.nome}</button></>}
        {periodo && <><span>›</span><button onClick={() => navLancamentos(periodo)}>{periodo.periodo}</button></>}
        {view === 'fatura' && <><span>›</span><span>Fatura</span></>}
        {view === 'bi' && <><span>›</span><span>BI</span></>}
        {view === 'log' && <><span>›</span><span>Log</span></>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--pc-muted)', padding: '2px 6px', background: '#f1f5f9', borderRadius: 4 }}>
          {pcPapel === 'admin' ? '👑 Admin' : pcPapel === 'validador' ? '✓ Validador' : '👤 Padrão'}
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
          <div className="pc-page-hd">
            <div>
              <h1>Prestação de Contas</h1>
              <p>Gerencie gastos por setor e período</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pc-btn pc-btn-ghost" onClick={navLog}>📋 Log</button>
              <button className="pc-btn pc-btn-ghost" onClick={navBI}>📊 BI</button>
              {isAdmin && (
                <>
                  <button className="pc-btn pc-btn-ghost" onClick={() => setModal('permissoes')}>🔑 Permissões</button>
                  <button className="pc-btn pc-btn-primary" onClick={() => openModal('novo-setor', { nome: '', card: '', card_brand: '', resp_user_id: '', validador_user_id: '' })}>+ Novo Setor</button>
                </>
              )}
            </div>
          </div>
          <div className="pc-kpis">
            <div className="pc-kpi"><span className="pc-kpi-label">Total em Aberto</span><span className="pc-kpi-value">{fmtShort(totalSetoresAberto)}</span></div>
            <div className="pc-kpi"><span className="pc-kpi-label">Setores Ativos</span><span className="pc-kpi-value">{setores.length}</span></div>
            <div className="pc-kpi"><span className="pc-kpi-label">Períodos Abertos</span><span className="pc-kpi-value">{setores.reduce((s, x) => s + (Number(x.periodos_abertos) || 0), 0)}</span></div>
          </div>
          {setores.length === 0
            ? <div className="pc-empty">Nenhum setor cadastrado.{isAdmin ? ' Crie o primeiro!' : ''}</div>
            : (
              <div className="pc-setores-grid">
                {setores.map((s, i) => {
                  const isKamino = s.card_brand === 'kamino';
                  return (
                    <div
                      key={s.id}
                      className={`pc-setor-card${isKamino ? ' pc-setor-card--kamino' : ''}`}
                      style={isKamino ? undefined : { '--card-accent': s.periodos_inconsistentes > 0 ? '#ef4444' : SETOR_COLORS[i % SETOR_COLORS.length] } as React.CSSProperties}
                      onClick={() => navPeriodos(s)}
                    >
                      {isKamino ? (
                        <div className="pc-kamino-header">
                          <span className="pc-kamino-logo">⌘ KAMINO</span>
                          <span className="pc-kamino-chip">▪</span>
                        </div>
                      ) : (
                        <div className="pc-setor-card-bar" />
                      )}
                      <div className="pc-setor-card-body">
                        <div className="pc-setor-icon">{isKamino ? '💳' : SETOR_ICONS[i % SETOR_ICONS.length]}</div>
                        <div className="pc-setor-info">
                          <strong>{s.nome}</strong>
                          {s.card_last4 && <small>{isKamino ? '•••• •••• •••• ' : 'Cartão •••• '}{s.card_last4}</small>}
                          {(s.responsavel_nome || s.responsavel) && <small>👤 {s.responsavel_nome || s.responsavel}</small>}
                        </div>
                      </div>
                      <div className="pc-setor-card-foot">
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          {s.periodos_inconsistentes > 0 && (
                            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11 }}>⚠ {s.periodos_inconsistentes} inconsistência(s)</span>
                          )}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {fmtShort(s.saldo_aberto)}
                          {isAdmin && (
                            <button
                              className="pc-card-delete-btn"
                              title="Excluir setor"
                              onClick={ev => deletarSetor(s, ev)}
                            >🗑️</button>
                          )}
                        </span>
                      </div>
                    </div>
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
                  <button className="pc-btn" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }} onClick={handleValidarPeriodo}>✓ Validar</button>
                  <button className="pc-btn" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }} onClick={() => setIncDialogOpen(true)}>⚠ Inconsistência</button>
                </>
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
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '95vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Corrigir e Reenviar</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px' }}>
              Descreva o que foi corrigido para registrar no histórico do período.
            </p>
            <textarea
              value={corrigirTexto}
              onChange={e => setCorrigirTexto(e.target.value)}
              placeholder="Ex: Nota fiscal ajustada, valor corrigido de R$ X para R$ Y..."
              rows={4}
              style={{
                width: '100%', borderRadius: 8, border: '1.5px solid #e2e8f0',
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
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#9a3412', marginBottom: 8, fontSize: 14 }}>⚠ Descreva a inconsistência encontrada:</p>
                <textarea
                  value={incDialog}
                  onChange={e => setIncDialog(e.target.value)}
                  placeholder="Ex: Falta nota fiscal do lançamento de R$ 1.200 do dia 15/08..."
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 90 }}>
                <button className="pc-btn pc-btn-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }} onClick={handleInconsistenciaPeriodo} disabled={!incDialog.trim()}>Confirmar</button>
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
                      return (
                        <div key={c.id} className="pc-comentario" style={isInc ? { borderLeft: '3px solid #ef4444', background: '#fff1f2' } : isCor ? { borderLeft: '3px solid #22c55e', background: '#f0fdf4' } : {}}>
                          <div className="pc-com-hd">
                            <strong>{isInc ? '⚠ INCONSISTÊNCIA' : isCor ? '✔ CORREÇÃO' : ''} {c.autor_nome}</strong>
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
                      {(periodo.status === 'aberto' && canValidate || isAdmin) && <th>Ações</th>}
                      {(canValidate && periodo.status === 'aguardando_validacao') && <th style={{ whiteSpace: 'nowrap' }}>Validação</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map(l => (
                      <tr key={l.id} onClick={() => openDrawer(l.id)} style={{ cursor: 'pointer' }}>
                        <td>{fmtDate(l.data)}</td>
                        <td>{l.fornecedor || '—'}</td>
                        <td>{l.descricao}</td>
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
                            {periodo.status === 'aberto' && canValidate && (
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
                      <td colSpan={(periodo.status === 'aberto' && canValidate || isAdmin) ? 8 : (canValidate && periodo.status === 'aguardando_validacao') ? 8 : 7} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--pc-muted)', fontSize: 13 }}>TOTAL</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{fmt(totalLancs)}</td>
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
                          <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL</td>
                          <td style={{ fontWeight: 700 }}>{fmt(total)}</td>
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
            <div className="pc-bi-grid">
              <div className="pc-bi-chart-wrap" style={{ gridColumn: 'span 2' }}>
                <h3>Gastos por Setor</h3>
                <div className="pc-bi-canvas-wrap"><canvas id="pc-chart-setor" /></div>
              </div>
              <div className="pc-bi-chart-wrap">
                <h3>Forma de Pagamento</h3>
                <div className="pc-bi-canvas-wrap"><canvas id="pc-chart-forma" /></div>
              </div>
              <div className="pc-bi-chart-wrap">
                <h3>Evolução Mensal</h3>
                <div className="pc-bi-canvas-wrap"><canvas id="pc-chart-mes" /></div>
              </div>
              <div className="pc-bi-chart-wrap" style={{ gridColumn: 'span 2' }}>
                <h3>Top 10 Fornecedores</h3>
                <div className="pc-bi-canvas-wrap"><canvas id="pc-chart-forn" /></div>
              </div>
              <div className="pc-bi-chart-wrap" style={{ gridColumn: 'span 2' }}>
                <h3>Gastos por Período</h3>
                <div className="pc-bi-canvas-wrap"><canvas id="pc-chart-periodo" /></div>
              </div>
            </div>
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
                          <div>{l.descricao}</div>
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
          <div className="pc-drawer-overlay" onClick={closeDrawer} />
          <div className="pc-drawer">
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
                    <span style={{ fontSize: 11, color: '#991b1b' }}>— {drawerLanc.validacao_obs}</span>
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
                      className="pc-btn pc-btn-sm"
                      style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                      onClick={() => validarLancamento('aprovado')}
                    >✓ Aprovar</button>
                    <button
                      className="pc-btn pc-btn-sm"
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
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
                      className="pc-btn pc-btn-sm"
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
                      onClick={async () => {
                        const obs = prompt('Observação sobre inconsistência (opcional):');
                        if (obs === null) return;
                        await validarLancamento('inconsistente', obs || undefined);
                      }}
                    >⚠ Marcar Inconsistente</button>
                    <button
                      className="pc-btn pc-btn-sm"
                      style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                      onClick={() => validarLancamento('pendente')}
                    >↩ Desfazer</button>
                  </div>
                )}
                {canValidate && drawerLanc.status === 'inconsistente' && (
                  <div className="pc-drawer-actions" style={{ marginTop: 8 }}>
                    <button
                      className="pc-btn pc-btn-sm"
                      style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}
                      onClick={() => validarLancamento('aprovado')}
                    >✓ Aprovar</button>
                    <button
                      className="pc-btn pc-btn-sm"
                      style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
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
                  {modal === 'novo-lancamento' && (
                    <div className="pc-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Anexos</label>
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
                              ...(p.papel === 'admin' ? { background: '#ede9fe', color: '#5b21b6' } :
                                p.papel === 'validador' ? { background: '#dbeafe', color: '#1e40af' } :
                                  { background: '#f1f5f9', color: '#475569' })
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
