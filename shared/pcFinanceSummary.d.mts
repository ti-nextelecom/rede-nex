export interface FinanceRow { name: string; value: number }
export function pcFinanceSummary(
  setores: { nome: string }[],
  periodos: { setor_nome: string; periodo: string; data_inicio: string; total_gasto: string | number }[],
  lancamentos: { setor_nome: string; valor: string | number; forma_pagamento?: string | null; data?: string | null; fornecedor?: string | null }[],
): { sectors: FinanceRow[]; payments: FinanceRow[]; months: FinanceRow[]; suppliers: FinanceRow[]; periods: FinanceRow[] };
