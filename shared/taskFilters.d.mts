export type TaskScope='all'|'mine'|'observing'|'pending'|'overdue'|'today'|'done';
interface TaskFilterRecord {status?:string;deadline?:string|null;created_by?:string;owner_id?:string|null;owner?:{id:string}|null;assignees?:{id?:string;user_id?:string}[];observers?:{id?:string;user_id?:string}[]}
export function filterTaskScope<T extends TaskFilterRecord>(tasks:T[],options?:{scope?:TaskScope;userId?:string;status?:string;today?:string|null}):T[];
