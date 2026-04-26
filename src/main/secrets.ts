import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { AccountMetadata } from '@shared/types';

const SECRETS_FILE = 'secrets.enc';
const FALLBACK_KEY_FILE = 'secrets.key';
const ACCOUNTS_FILE = 'accounts.json';

// First byte of the on-disk secrets file identifies the encryption backend.
// Files written by older builds have no marker (raw safeStorage payload) and
// are detected by absence of these bytes.
const MODE_SAFE_STORAGE = 0x01;
const MODE_LOCAL_AES = 0x02;

interface SecretsStore {
  [key: string]: string;
}

function storePath(filename: string): string {
  return join(app.getPath('userData'), filename);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

let cachedFallbackKey: Buffer | null = null;
let warnedAboutFallback = false;

async function getOrCreateFallbackKey(): Promise<Buffer> {
  if (cachedFallbackKey) return cachedFallbackKey;
  const path = storePath(FALLBACK_KEY_FILE);
  try {
    cachedFallbackKey = await fs.readFile(path);
    return cachedFallbackKey;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const key = randomBytes(32);
  await fs.writeFile(path, key, { mode: 0o600 });
  cachedFallbackKey = key;
  return key;
}

function localEncrypt(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([MODE_LOCAL_AES]), iv, tag, ciphertext]);
}

function localDecrypt(buffer: Buffer, key: Buffer): string {
  const iv = buffer.subarray(1, 13);
  const tag = buffer.subarray(13, 29);
  const ciphertext = buffer.subarray(29);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function warnFallbackOnce(): void {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn(
    'safeStorage is unavailable on this platform; falling back to local AES-256-GCM ' +
      'with a key stored at userData/secrets.key. Protect your user-data directory ' +
      '(e.g. install gnome-keyring or kwallet for stronger OS-backed encryption).',
  );
}

async function readSecrets(): Promise<SecretsStore> {
  const path = storePath(SECRETS_FILE);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }

  const marker = buffer[0];
  if (marker === MODE_LOCAL_AES) {
    const key = await getOrCreateFallbackKey();
    warnFallbackOnce();
    return JSON.parse(localDecrypt(buffer, key)) as SecretsStore;
  }

  // MODE_SAFE_STORAGE (0x01) marker, or a legacy file with no marker — both
  // are safeStorage payloads. For the marker case we strip the leading byte;
  // legacy files are passed through as-is.
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Existing secrets were encrypted with safeStorage, but safeStorage is no ' +
        'longer available on this system. Re-enable your OS keyring (e.g. ' +
        'gnome-keyring/kwallet) or remove the secrets file to start fresh.',
    );
  }
  const payload = marker === MODE_SAFE_STORAGE ? buffer.subarray(1) : buffer;
  return JSON.parse(safeStorage.decryptString(payload)) as SecretsStore;
}

async function writeSecrets(store: SecretsStore): Promise<void> {
  const json = JSON.stringify(store);
  const path = storePath(SECRETS_FILE);
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    const out = Buffer.concat([Buffer.from([MODE_SAFE_STORAGE]), encrypted]);
    await fs.writeFile(path, out);
    return;
  }
  warnFallbackOnce();
  const key = await getOrCreateFallbackKey();
  await fs.writeFile(path, localEncrypt(json, key), { mode: 0o600 });
}

export async function getSecret(key: string): Promise<string | null> {
  const store = await readSecrets();
  return store[key] ?? null;
}

export async function setSecret(key: string, value: string): Promise<void> {
  const store = await readSecrets();
  store[key] = value;
  await writeSecrets(store);
}

export async function deleteSecret(key: string): Promise<void> {
  const store = await readSecrets();
  delete store[key];
  await writeSecrets(store);
}

export async function listAccounts(): Promise<AccountMetadata[]> {
  return readJson<AccountMetadata[]>(storePath(ACCOUNTS_FILE), []);
}

export async function upsertAccount(account: AccountMetadata): Promise<AccountMetadata[]> {
  const accounts = await listAccounts();
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) accounts[idx] = account;
  else accounts.push(account);
  await writeJson(storePath(ACCOUNTS_FILE), accounts);
  return accounts;
}

export async function deleteAccount(id: string): Promise<AccountMetadata[]> {
  const accounts = (await listAccounts()).filter((a) => a.id !== id);
  await writeJson(storePath(ACCOUNTS_FILE), accounts);
  await deleteSecret(`access-token:${id}`);
  await deleteSecret(`pickle-key:${id}`);
  return accounts;
}
