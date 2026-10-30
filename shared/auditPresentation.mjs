const sensitiveKeys = new Set(['password', 'passwordhash', 'senha', 'senhahash', 'token', 'accesstoken', 'refreshtoken', 'apikey', 'clientsecret', 'authorization', 'secret', 'twofactorsecret', 'totpsecret', 'resettoken', 'sessiontoken']);
const normalizeKey = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

// Display-only masking. This does not replace redaction/authorization at the API.
function mask(value, key = '') {
  if (sensitiveKeys.has(normalizeKey(key))) return '[valor oculto]';
  if (Array.isArray(value)) return value.map(item => mask(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mask(v, k)]));
  return value;
}
export function formatAuditValue(value, key = '', present = true) {
  if (!present) return 'Não registrado';
  const safe = mask(value, key);
  if (typeof safe === 'string') return safe === '' ? '""' : safe;
  return JSON.stringify(safe, null, 2) ?? 'Não registrado';
}
export function auditFields(oldData, newData, action) {
  const before = oldData || {}, after = newData || {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.filter(key => action === 'INSERT' ? Object.hasOwn(after, key) : action === 'DELETE' ? Object.hasOwn(before, key) : JSON.stringify(canonical(before[key])) !== JSON.stringify(canonical(after[key])))
    .map(key => ({ key, before: formatAuditValue(before[key], key, Object.hasOwn(before, key)), after: formatAuditValue(after[key], key, Object.hasOwn(after, key)) }));
}
export function matchesAuditLog(log, query, entityLabel = log.entity_type) {
  const term = normalize(query).trim();
  return !term || normalize([log.actor_name, entityLabel, log.entity_type, log.entity_id, log.id, log.ip_address].join(' ')).includes(term);
}
