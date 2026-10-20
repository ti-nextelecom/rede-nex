import { apiGet, apiPost, apiPut } from './apiClient';
export type HrTable = 'employees' | 'asos' | 'vacations';
export interface HrRecord {
  user_id?: string; photo_url?: string | null; user_status?: string;
  id: string; version: number; employee_id?: string; full_name?: string; employee_code?: string | null;
  short_name?: string; team?: string; area?: string; company?: string; position?: string; admission_on?: string | null; termination_on?: string | null;
  last_exam_on?: string | null; periodicity_months?: number; scheduled_on?: string | null; planned_month?: string | null; completed_on?: string | null;
  acquisition_start?: string; acquisition_end?: string; concession_end?: string; source_start_limit?: string | null;
  balance_days?: string | number; start_on?: string | null; leave_days?: number; bonus_days?: number; status?: string;
  awaiting_employee?: boolean; needs_review?: boolean; archived?: boolean; employee_archived?: boolean;
  notes?: string; checklist?: Record<string, boolean>; updated_at?: string;
}
export type HrList = { records: HrRecord[]; truncated: boolean };
export interface HrUser { id: string; name: string; photo_url?: string | null; position?: string; admission_date?: string | null; department_name?: string; status: string }
export const listHrUsers = () => apiGet<{ users: HrUser[] }>('/rh/users');
export const listHr = (table: HrTable) => apiGet<HrList>(`/rh/${table}`);
export type HrAuditRecord = { id: string; resource: string; entity_id: string; operation: string; created_at: string; actor_name?: string | null; entity_name?: string | null; before_data?: Record<string,unknown>|null; after_data?: Record<string,unknown>|null };
export const listHrHistory = () => apiGet<{ records: HrAuditRecord[] }>('/rh/history');
export const bulkGenerateVacations = (acquisition_year: number) => apiPost<{ created: number; skipped: number; total: number }>('/rh/vacations/bulk-generate', { acquisition_year });
export const saveHr = (table: HrTable, body: unknown, id?: string) => id ? apiPut<{ record: HrRecord }>(`/rh/${table}/${id}`,body) : apiPost<{ record: HrRecord }>(`/rh/${table}`,body);
export async function exportHr(table: 'asos' | 'vacations') {
  const { csv } = await apiGet<{ csv: string }>(`/rh/${table}/export`);
  const url = URL.createObjectURL(new Blob([csv],{ type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `rh-${table}-${new Date().toISOString().slice(0,10)}.csv`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url),1000);
}
