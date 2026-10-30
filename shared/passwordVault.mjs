export const VAULT_ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fail = message => { throw new Error(message); };
const encode = bytes => { let text = ''; for (let i = 0; i < bytes.length; i += 4096) text += String.fromCharCode(...bytes.subarray(i, i + 4096)); return btoa(text); };
const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const base64 = (value, size) => typeof value === 'string' && value.length <= 1400000 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value) && (!size || value.length === size);
export function validateVaultEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'ciphertext,iterations,iv,salt,version'
    || value.version !== 1 || value.iterations !== VAULT_ITERATIONS || !base64(value.salt, 24) || decode(value.salt).length !== 16
    || !base64(value.iv, 16) || decode(value.iv).length !== 12 || !base64(value.ciphertext) || decode(value.ciphertext).length < 16) fail('Cofre criptografado inválido.');
  return value;
}
export function safeVaultUrl(value) {
  if (!value) return '';
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) return null; return url.href; } catch { return null; }
}
export function validateVaultEntries(entries) {
  if (!Array.isArray(entries) || entries.length > 500) fail('O cofre aceita até 500 acessos.');
  const ids = new Set();
  return entries.map(entry => {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) || ids.has(entry.id)) fail('Registro do cofre inválido.');
    ids.add(entry.id);
    for (const [field, max] of [['title', 120], ['username', 320], ['password', 2048], ['url', 2048], ['notes', 4000]]) {
      if (typeof entry[field] !== 'string' || entry[field].length > max) fail('Campos do acesso inválidos.');
    }
    if (!entry.title.trim() || !entry.password || safeVaultUrl(entry.url) === null) fail('Informe o nome, a senha e um link HTTP ou HTTPS válido.');
    return { id: entry.id, title: entry.title.trim(), username: entry.username, password: entry.password, url: safeVaultUrl(entry.url), notes: entry.notes };
  });
}
async function derive(master, salt) {
  if (typeof master !== 'string' || master.trim().length < 12 || master.length > 256) fail('Use uma senha mestra entre 12 e 256 caracteres.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(master), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: VAULT_ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const aad = ownerId => encoder.encode(`rede-nex:password-vault:v1:${ownerId}`);
export async function encryptVault(key, salt, ownerId, entries) {
  const plaintext = encoder.encode(JSON.stringify({ version: 1, entries: validateVaultEntries(entries) }));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(ownerId), tagLength: 128 }, key, plaintext);
    return validateVaultEnvelope({ version: 1, iterations: VAULT_ITERATIONS, salt, iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
  } finally { plaintext.fill(0); }
}
export async function createVault(master, ownerId) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(master, salt);
  const encodedSalt = encode(salt);
  return { key, salt: encodedSalt, envelope: await encryptVault(key, encodedSalt, ownerId, []) };
}
export async function unlockVault(master, ownerId, envelope) {
  validateVaultEnvelope(envelope);
  const key = await derive(master, decode(envelope.salt));
  let plaintext;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: aad(ownerId), tagLength: 128 }, key, decode(envelope.ciphertext)));
    const payload = JSON.parse(decoder.decode(plaintext));
    if (payload.version !== 1) fail('Formato desconhecido.');
    return { key, salt: envelope.salt, entries: validateVaultEntries(payload.entries) };
  } catch { fail('Senha mestra incorreta ou dados do cofre inválidos.'); }
  finally { plaintext?.fill(0); }
}
export function generateVaultPassword(length = 24) {
  if (!Number.isInteger(length) || length < 16 || length > 128) fail('Tamanho de senha inválido.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*_-+=';
  const limit = 256 - (256 % alphabet.length);
  for (;;) {
    let password = '';
    while (password.length < length) for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < limit && password.length < length) password += alphabet[byte % alphabet.length];
    }
    if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[!@#$%&*_+=-]/.test(password)) return password;
  }
}
