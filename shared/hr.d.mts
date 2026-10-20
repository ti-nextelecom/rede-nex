export const HR_PERMISSIONS: { key: string; label: string }[];
export function effectivePermissions(admin: boolean, role?: Record<string, boolean>, overrides?: Record<string, boolean | null>): Record<string, boolean>;
export function validDate(value: unknown): boolean;
export function addDays(value: string | null, days: number): string | null;
export function addMonths(value: string | null, months: number): string | null;
export function asoSummary(row: { completed_on?: string | null; last_exam_on?: string | null; periodicity_months: number }, today: string): { due: string | null; remaining: number | null; status: string };
export function vacationSummary(row: { start_on?: string | null; leave_days: number; concession_end: string; acquisition_end: string; checklist?: Record<string, boolean>; status?: string }, today: string): { end: string | null; returnOn: string | null; limit: string | null; notice: string | null; payment: string | null; warnings: string[] };
export function csvCell(value: unknown): string;
