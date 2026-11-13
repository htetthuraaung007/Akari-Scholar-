/**
 * Web Crypto API AES-GCM Client-Side Encryption
 * Zero data ever leaves the user's browser unencrypted.
 */

const STORAGE_KEY = 'students_suite_encrypted_store_v2';
const LEGACY_STORAGE_KEY = 'akari_encrypted_store_v1';
const SALT_KEY = 'students_suite_crypto_salt_v1';
const LEGACY_SALT_KEY = 'akari_crypto_salt_v1';
const DEFAULT_KEY_STORAGE = 'students_suite_device_key_v1';
const LEGACY_DEFAULT_KEY_STORAGE = 'akari_device_key_v1';

// Generate or derive AES-GCM key from passphrase or device entropy
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Get or generate a persistent local device salt
function getSalt(): Uint8Array {
  let stored = localStorage.getItem(SALT_KEY) || localStorage.getItem(LEGACY_SALT_KEY);
  if (!stored) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    stored = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(SALT_KEY, stored);
  }
  const match = stored.match(/.{1,2}/g) || [];
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

// Get default device-level passphrase if student doesn't set a custom PIN
function getDevicePassphrase(): string {
  let devKey = localStorage.getItem(DEFAULT_KEY_STORAGE) || localStorage.getItem(LEGACY_DEFAULT_KEY_STORAGE);
  if (!devKey) {
    const rand = window.crypto.getRandomValues(new Uint8Array(32));
    devKey = Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEFAULT_KEY_STORAGE, devKey);
  }
  return devKey;
}

export async function encryptAndSave(data: any, customPassphrase?: string): Promise<boolean> {
  try {
    const pass = customPassphrase || getDevicePassphrase();
    const salt = getSalt();
    const key = await deriveKey(pass, salt);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));

    const cipher = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const payload = {
      iv: Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join(''),
      cipher: Array.from(new Uint8Array(cipher)).map((b) => b.toString(16).padStart(2, '0')).join(''),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Encryption save error:', err);
    return false;
  }
}

export async function loadAndDecrypt<T>(customPassphrase?: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed.iv || !parsed.cipher) return null;

    const pass = customPassphrase || getDevicePassphrase();
    const salt = getSalt();
    const key = await deriveKey(pass, salt);

    const ivMatches = parsed.iv.match(/.{1,2}/g) || [];
    const iv = new Uint8Array(ivMatches.map((b: string) => parseInt(b, 16)));

    const cipherMatches = parsed.cipher.match(/.{1,2}/g) || [];
    const cipher = new Uint8Array(cipherMatches.map((b: string) => parseInt(b, 16)));

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipher
    );

    const decoded = new TextDecoder().decode(decrypted);
    return JSON.parse(decoded) as T;
  } catch (err) {
    console.warn('Decryption failed (possibly wrong passphrase or fresh session):', err);
    return null;
  }
}

/**
 * Clear All Local Data (Panic Button for Shared Computers / Library PCs)
 */
export async function clearAllLocalData(): Promise<void> {
  // Wipe all localStorage items
  localStorage.clear();
  // Wipe sessionStorage
  sessionStorage.clear();

  // Wipe IndexedDB databases if any exist
  if (window.indexedDB && indexedDB.databases) {
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (e) {
      console.warn('IndexedDB wipe caught:', e);
    }
  }
}
