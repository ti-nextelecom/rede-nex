import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pcFinanceSummary, type FinanceRow } from '../../shared/pcFinanceSummary.mjs';
import type { Lancamento, Periodo, Setor } from '../lib/prestacaoContasApi';

const COLORS = ['#77b7d4', '#85cda9', '#f1b87c', '#a899dc', '#df9dad'];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const tick = { fill: '#adbed2', fontSize: 11 };
const tooltip = { background: '#1a2738', border: '1px solid #41566e', borderRadius: 12, color: '#e8eef6', fontSize: 13 };
const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
};

function FinanceChart({ title, data, monthly = false, wide = false }: { title: string; data: FinanceRow[]; monthly?: boolean; wide?: boolean }) {
  const rows = monthly ? data.map(row => ({ ...row, name: monthLabel(row.name) })) : data;
  const height = monthly ? 260 : Math.max(220, rows.length * 38 + 40);
  return <section className={`pc-bi-chart-wrap${wide ? ' pc-finance-wide' : ''}`} aria-label={title}>
    <h3>{title}</h3>
    <p className="pc-chart-caption">Valores em R$</p>
    {rows.length === 0 ? <p className="pc-chart-empty">Nenhum valor disponível para esta análise.</p> : <>
      <div className="pc-finance-scroll">
        <div style={{ height, minWidth: 0 }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {monthly ? <LineChart data={rows} margin={{ top: 16, right: 16, left: 0, bottom: 6 }}>
              <CartesianGrid stroke="#ffffff0d" vertical={false} />
              <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} tickFormatter={v => compact.format(Number(v))} axisLine={false} tickLine={false} width={52} />
              <Tooltip contentStyle={tooltip} labelStyle={{ color: '#e8eef6' }} formatter={v => [money.format(Number(v)), 'Total']} />
              <Line type="linear" dataKey="value" stroke="#85cda9" strokeWidth={3} dot={{ r: 4, fill: '#85cda9' }} isAnimationActive={false} />
            </LineChart> : <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 6 }} barSize={18}>
              <CartesianGrid stroke="#ffffff0d" horizontal={false} />
              <XAxis type="number" tick={tick} tickFormatter={v => compact.format(Number(v))} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={tick} width={112} axisLine={false} tickLine={false} interval={0} tickFormatter={(v: string) => v.length > 19 ? v.slice(0, 18) + '…' : v} />
              <Tooltip contentStyle={tooltip} labelStyle={{ color: '#e8eef6' }} cursor={{ fill: '#ffffff04' }} formatter={v => [money.format(Number(v)), 'Total']} />
              <Bar dataKey="value" radius={4} isAnimationActive={false}>
                {rows.map((row, index) => <Cell key={`${row.name}-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Bar>
            </BarChart>}
          </ResponsiveContainer>
        </div>
      </div>
      <details className="pc-chart-values">
        <summary>Ver valores de {title.toLocaleLowerCase('pt-BR')}</summary>
        <dl>{rows.map((row, index) => <div key={`${row.name}-${index}`}><dt>{row.name}</dt><dd>{money.format(row.value)}</dd></div>)}</dl>
      </details>
    </>}
  </section>;
}

/** Bundled with the app; replaces the missing public Chart.js asset. No global scripts or remote CDN. */
export default function PrestacaoFinanceCharts({ setores, periodos, lancamentos }: {
  setores: Setor[]; periodos: (Periodo & { setor_nome: string })[];
  lancamentos: (Lancamento & { setor_nome: string })[];
}) {
  const data = useMemo(() => pcFinanceSummary(setores, periodos, lancamentos), [setores, periodos, lancamentos]);
  return <div className="pc-bi-grid">
    <FinanceChart title="Gastos por Setor" data={data.sectors} wide />
    <FinanceChart title="Forma de Pagamento" data={data.payments} />
    <FinanceChart title="Evolução Mensal" data={data.months} monthly />
    <FinanceChart title="Top 10 Fornecedores" data={data.suppliers} wide />
    <FinanceChart title="Gastos por Período" data={data.periods} wide />
  </div>;
}
