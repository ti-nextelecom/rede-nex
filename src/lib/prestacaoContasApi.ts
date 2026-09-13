import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export interface Setor {
  id: string;
  nome: string;
  card_last4: string | null;
  responsavel: string | null;
  responsavel_user_id: string | null;
  responsavel_nome: string | null;
  validador_user_id: string | null;
  validador_nome: string | null;
  card_brand: string | null;
  ativo: boolean;
  periodos_abertos: number;
  periodos_atrasados: number;
  periodos_inconsistentes: number;
  saldo_aberto: string;
}

export interface Periodo {
  id: string;
  setor_id: string;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  responsavel: string | null;
  responsavel_user_id: string | null;
  responsavel_nome: string | null;
  status: 'aberto' | 'aguardando_validacao' | 'atrasado' | 'validado' | 'inconsistencia' | 'fechado';
  data_submissao: string | null;
  submetido_por: string | null;
  validado_por: string | null;
  validado_por_nome?: string | null;
  validado_em: string | null;
  total_gasto: string;
  qtd_lancamentos: number;
}

export interface Lancamento {
  id: string;
  periodo_id: string;
  data: string;
  data_compra: string | null;
  fornecedor: string | null;
  descricao: string;
  numero_documento: string | null;
  valor: string;
  forma_pagamento: string | null;
  parcelado: boolean;
  num_parcelas: number | null;
  setor_area: string | null;
  observacoes: string | null;
  created_by: string;
  autor_nome: string;
  qtd_comentarios: number;
  qtd_anexos: number;
  status: 'pendente' | 'aprovado' | 'inconsistente';
  validado_por: string | null;
  validado_por_nome?: string | null;
  validado_em: string | null;
  validacao_obs: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comentario {
  id: string;
  lancamento_id: string;
  autor_id: string;
  autor_nome: string;
  texto: string;
  created_at: string;
}

export interface ComentarioPeriodo {
  id: string;
  periodo_id: string;
  autor_id: string | null;
  autor_nome: string;
  tipo: 'comentario' | 'inconsistencia' | 'correcao';
  texto: string;
  created_at: string;
}

export interface Anexo {
  id: string;
  lancamento_id: string;
  nome_original: string;
  caminho: string;
  tamanho: number;
  mime_type: string | null;
  uploaded_by: string;
  autor_nome: string;
  created_at: string;
  public_url?: string;
}

export interface FaturaData {
  periodo: Periodo & { setor_nome: string; card_last4: string | null };
  lancamentos: Lancamento[];
  total: number;
}

export interface PcPermissao {
  id: string;
  user_id: string;
  papel: 'admin' | 'validador' | 'padrao';
  user_name?: string;
  user_email?: string;
  created_at: string;
}

export interface PcMinhasPermissoes {
  hasAccess: boolean;
  papel: 'admin' | 'validador' | 'padrao' | null;
}

type R<T> = Promise<{ data: T }>;

export const pcListSetores = (): R<Setor[]> => apiGet('/pc/setores');
export const pcCreateSetor = (b: { nome: string; card_last4?: string | null; responsavel?: string | null; responsavel_user_id?: string | null; card_brand?: string | null }): R<Setor> => apiPost('/pc/setores', b);
export const pcUpdateSetor = (id: string, b: { nome: string; card_last4?: string | null; responsavel?: string | null; responsavel_user_id?: string | null; ativo?: boolean; card_brand?: string | null }): R<Setor> => apiPut(`/pc/setores/${id}`, b);
export const pcDeleteSetor = (id: string): R<{ deleted: boolean }> => apiDelete(`/pc/setores/${id}`);

export const pcListPeriodos = (setorId: string): R<Periodo[]> => apiGet(`/pc/setores/${setorId}/periodos`);
export const pcCreatePeriodo = (b: { setor_id: string; periodo: string; data_inicio: string; data_fim: string; responsavel?: string | null; responsavel_user_id?: string | null }): R<Periodo> => apiPost('/pc/periodos', b);
export const pcFecharPeriodo = (id: string): R<Periodo> => apiPut(`/pc/periodos/${id}/fechar`, {});

export const pcListLancamentos = (periodoId: string): R<Lancamento[]> => apiGet(`/pc/periodos/${periodoId}/lancamentos`);
export const pcGetLancamento = (id: string): R<Lancamento> => apiGet(`/pc/lancamentos/${id}`);
export const pcCreateLancamento = (b: Record<string, unknown>): R<Lancamento> => apiPost('/pc/lancamentos', b);
export const pcUpdateLancamento = (id: string, b: Record<string, unknown>): R<Lancamento> => apiPut(`/pc/lancamentos/${id}`, b);
export const pcDeleteLancamento = (id: string) => apiDelete(`/pc/lancamentos/${id}`);
export const pcUpdateLancamentoStatus = (id: string, data: { status: string; obs?: string }): R<Lancamento> => apiPut(`/pc/lancamentos/${id}/status`, data);

export const pcListComentarios = (lancId: string): R<Comentario[]> => apiGet(`/pc/lancamentos/${lancId}/comentarios`);
export const pcCreateComentario = (lancId: string, texto: string): R<Comentario> => apiPost(`/pc/lancamentos/${lancId}/comentarios`, { texto });

export const pcListAnexos = (lancId: string): R<Anexo[]> => apiGet(`/pc/lancamentos/${lancId}/anexos`);
export const pcCreateAnexo = (lancId: string, b: { file_name: string; file_type: string; data: string }): R<Anexo> => apiPost(`/pc/lancamentos/${lancId}/anexos`, b);
export const pcDeleteAnexo = (id: string) => apiDelete(`/pc/anexos/${id}`);

export const pcGetFatura = (periodoId: string): R<FaturaData> => apiGet(`/pc/periodos/${periodoId}/fatura`);

export const pcGetMinhasPermissoes = (): R<PcMinhasPermissoes> => apiGet('/pc/minhas-permissoes');
export const pcListPermissoes = (): R<PcPermissao[]> => apiGet('/pc/permissoes');
export const pcCreatePermissao = (data: { user_id: string; papel: string }): R<PcPermissao> => apiPost('/pc/permissoes', data);
export const pcDeletePermissao = (id: string) => apiDelete(`/pc/permissoes/${id}`);

export const pcSubmitPeriodo = (id: string): R<Periodo> => apiPut(`/pc/periodos/${id}/submit`, {});
export const pcValidarPeriodo = (id: string): R<Periodo> => apiPut(`/pc/periodos/${id}/validar`, {});
export const pcInconsistenciaPeriodo = (id: string, data: { texto: string }): R<Periodo> => apiPut(`/pc/periodos/${id}/inconsistencia`, data);
export const pcCorrigirPeriodo = (id: string, texto?: string): R<Periodo> => apiPut(`/pc/periodos/${id}/corrigir`, { texto });
export const pcListComentariosPeriodo = (id: string): R<ComentarioPeriodo[]> => apiGet(`/pc/periodos/${id}/comentarios`);
export const pcCreateComentarioPeriodo = (id: string, texto: string): R<ComentarioPeriodo> => apiPost(`/pc/periodos/${id}/comentarios`, { texto });
