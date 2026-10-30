// Read-only chart projections. Never used to write or settle financial records.
export function pcFinanceSummary(setores, periodos, lancamentos) {
  const sector = new Map(setores.map(s => [s.nome, 0]));
  const payment = new Map(), month = new Map(), supplier = new Map();
  const add = (map, key, value) => map.set(key, (map.get(key) || 0) + value);
  const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  for (const l of lancamentos) {
    const value = amount(l.valor);
    add(sector, l.setor_nome, value);
    add(payment, l.forma_pagamento || 'Não informado', value);
    const key = String(l.data || '').slice(0, 7);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) add(month, key, value);
    if (l.fornecedor) add(supplier, l.fornecedor, value);
  }
  const rows = map => [...map].map(([name, value]) => ({ name, value }));
  const descending = map => rows(map).sort((a, b) => b.value - a.value);
  return {
    sectors: descending(sector),
    payments: descending(payment),
    months: rows(month).sort((a, b) => a.name.localeCompare(b.name)),
    suppliers: descending(supplier).slice(0, 10),
    periods: [...periodos].sort((a, b) => String(a.data_inicio).localeCompare(String(b.data_inicio)))
      .map(p => ({ name: `${p.setor_nome} · ${p.periodo}`, value: amount(p.total_gasto) })),
  };
}
