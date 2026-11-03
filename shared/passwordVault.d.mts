export const VAULT_ITERATIONS: number;
export interface VaultEntry { id: string; title: string; username: string; password: string; url: string; notes: string }
export interface VaultEnvelope { version: 1; iterations: number; salt: string; iv: string; ciphertext: string }
export function validateVaultEnvelope(value: unknown): VaultEnvelope;
export function safeVaultUrl(value: string): string | null;
export function validateVaultEntries(value: unknown): VaultEntry[];
export function createVault(master: string, ownerId: string): Promise<{ key: CryptoKey; salt: string; envelope: VaultEnvelope }>;
export function encryptVault(key: CryptoKey, salt: string, ownerId: string, entries: VaultEntry[]): Promise<VaultEnvelope>;
export function unlockVault(master: string, ownerId: string, envelope: VaultEnvelope): Promise<{ key: CryptoKey; salt: string; entries: VaultEntry[] }>;
export function generateVaultPassword(length?: number): string;
