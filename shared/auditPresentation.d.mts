export function formatAuditValue(value: unknown, key?: string, present?: boolean): string;
export function auditFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null, action: string): { key: string; before: string; after: string }[];
export function matchesAuditLog(log: { actor_name: string | null; entity_type: string; entity_id: string; id: string; ip_address: string | null }, query: string, entityLabel?: string): boolean;
