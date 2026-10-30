import test from 'node:test';
import assert from 'node:assert/strict';
import { createVault, unlockVault, encryptVault, validateVaultEnvelope, validateVaultEntries, generateVaultPassword, safeVaultUrl } from '../shared/passwordVault.mjs';
const entry = { id: 'test-entry', title: 'Serviço fictício', username: 'teste@example.invalid', password: 'Senha-ficticia!847', url: 'https://example.invalid/login', notes: 'Somente dados de teste' };
test('vault encrypts all fields, uses fresh IVs and survives an encrypted round trip', async () => {
  const created = await createVault('Senha mestra de teste! 234', 'alice');
  assert.equal(created.key.extractable, false);
  const first = await encryptVault(created.key, created.salt, 'alice', [entry]);
  const second = await encryptVault(created.key, created.salt, 'alice', [entry]);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  for (const field of ['title', 'username', 'password', 'url', 'notes']) assert.ok(!JSON.stringify(first).includes(entry[field]));
  assert.deepEqual((await unlockVault('Senha mestra de teste! 234', 'alice', first)).entries, [entry]);
  await assert.rejects(unlockVault('Outra senha mestra! 123', 'alice', first), /Senha mestra/);
  await assert.rejects(unlockVault('Senha mestra de teste! 234', 'bob', first), /Senha mestra/);
  const bytes = Buffer.from(first.ciphertext, 'base64'); bytes[0] ^= 1;
  await assert.rejects(unlockVault('Senha mestra de teste! 234', 'alice', { ...first, ciphertext: bytes.toString('base64') }), /Senha mestra/);
});
test('vault rejects plaintext envelopes, KDF downgrades, unsafe links and duplicate entries', async () => {
  const created = await createVault('Senha mestra de teste! 234', 'alice');
  assert.throws(() => validateVaultEnvelope({ ...created.envelope, password: 'plaintext' }));
  assert.throws(() => validateVaultEnvelope({ ...created.envelope, iterations: 1 }));
  assert.throws(() => validateVaultEnvelope({ ...created.envelope, iv: 'bad' }));
  assert.throws(() => validateVaultEntries([{ ...entry, url: 'javascript:alert(1)' }]));
  assert.throws(() => validateVaultEntries([entry, entry]));
  assert.equal(safeVaultUrl('https://name:secret@example.invalid'), null);
  assert.equal(safeVaultUrl('data:text/html,hello'), null);
  assert.equal(safeVaultUrl('https://example.invalid'), 'https://example.invalid/');
  await assert.rejects(createVault('short', 'alice'), /12/);
});
test('password generator uses the cryptographic RNG and creates usable, different strong passwords', () => {
  const values = new Set(Array.from({ length: 30 }, () => generateVaultPassword()));
  assert.equal(values.size, 30);
  for (const value of values) { assert.equal(value.length, 24); assert.match(value, /[A-Z]/); assert.match(value, /[a-z]/); assert.match(value, /[0-9]/); assert.match(value, /[!@#$%&*_+=-]/); }
  assert.throws(() => generateVaultPassword(3));
});
