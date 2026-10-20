export const HR_PERMISSIONS = [
  { key: 'rh.view', label: 'Acessar o Módulo RH' },
  { key: 'rh.manage', label: 'Gerenciar cadastro de colaboradores do RH' },
  { key: 'aso.view', label: 'Visualizar ASO' },
  { key: 'aso.manage', label: 'Cadastrar e editar ASO' },
  { key: 'aso.export', label: 'Exportar ASO' },
  { key: 'vacations.view', label: 'Visualizar Férias' },
  { key: 'vacations.manage', label: 'Cadastrar e editar Férias' },
  { key: 'vacations.export', label: 'Exportar Férias' },
];
export function effectivePermissions(admin, role = {}, overrides = {}) {
  const result = Object.fromEntries(HR_PERMISSIONS.map(({ key }) => [key, admin || (overrides[key] ?? role[key] ?? false)]));
  for (const { key } of HR_PERMISSIONS) {
    if (key !== 'rh.view') result[key] = result[key] && result['rh.view'];
    if (key.startsWith('aso.') && key !== 'aso.view') result[key] = result[key] && result['aso.view'];
    if (key.startsWith('vacations.') && key !== 'vacations.view') result[key] = result[key] && result['vacations.view'];
  }
  return result;
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2200 && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function addDays(value, days) {
  if (!validDate(value)) return null;
  const date = new Date(value + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
export function addMonths(value, months) {
  if (!validDate(value)) return null;
  const date = new Date(value + 'T12:00:00Z'); const day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, end)); return date.toISOString().slice(0, 10);
}
export function asoSummary(row, today) {
  const due = addMonths(row.completed_on || row.last_exam_on, Number(row.periodicity_months));
  const remaining = due ? Math.round((Date.parse(due) - Date.parse(today)) / 86400000) : null;
  const status = remaining === null ? 'Sem referência' : remaining < 0 ? 'Vencido' : remaining <= 30 ? 'Vence em 30 dias' : 'Em dia';
  return { due, remaining, status };
}
export function vacationSummary(row, today) {
  const end = row.start_on ? addDays(row.start_on, Number(row.leave_days) - 1) : null;
  const returnOn = end ? addDays(end, 1) : null;
  const limit = addDays(row.concession_end, -(Math.max(1, Number(row.leave_days)) - 1));
  const notice = row.start_on ? addDays(row.start_on, -30) : null;
  const payment = row.start_on ? addDays(row.start_on, -2) : null;
  const warnings = [];
  if (end && end > row.concession_end) warnings.push('Programação ultrapassa o período concessivo');
  if (row.start_on && row.start_on <= row.acquisition_end) warnings.push('Início anterior ao fechamento do período aquisitivo');
  if (notice && notice < today && !row.checklist?.notice) warnings.push('Conferir aviso de férias');
  if (payment && payment < today && !row.checklist?.payment) warnings.push('Conferir pagamento');
  if (limit && limit < today && !row.start_on && row.status !== 'completed') warnings.push('Prazo de programação ultrapassado');
  return { end, returnOn, limit, notice, payment, warnings };
}
// Neutralize spreadsheet formulas, including whitespace-prefixed formulas.
export function csvCell(value) {
  let text = String(value ?? ''); if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
