// Persistent localStorage + sessionStorage + in-memory cache for Research Hub & Studio sub-tabs.
// Ensures zero accidental data loss across page refreshes, sub-tab navigation, and workspace switching,
// wiping ONLY when the user explicitly triggers Clear All / Emergency Wipe.

import { AKARI_EMERGENCY_WIPE_EVENT, AKARI_FEATURE_STORAGE_KEYS } from '../hooks/usePersistentState';

const memoryFallbackStore = new Map<string, unknown>();
const objectStore = new Map<string, unknown>();

const CANONICAL_KEY_ALIASES: Record<string, string> = {
  matrix_tab1_data_v2: AKARI_FEATURE_STORAGE_KEYS.PDF_READER_NOTES,
  matrix_tab2_data_v2: AKARI_FEATURE_STORAGE_KEYS.STATS_EXPLAINER,
  matrix_tab3_data_v2: AKARI_FEATURE_STORAGE_KEYS.BILINGUAL_EXPLAINER,
  matrix_tab4_data_v2: AKARI_FEATURE_STORAGE_KEYS.SYNTHESIS_LINKER,
  matrix_tab5_data_v2: AKARI_FEATURE_STORAGE_KEYS.FLASHCARDS,
  sop_tab3_state_v2: AKARI_FEATURE_STORAGE_KEYS.SCHOLAR_EMAIL_DRAFTS,
};

function resolveCanonicalKey(storageKey: string): string {
  return CANONICAL_KEY_ALIASES[storageKey] || storageKey;
}

if (typeof window !== 'undefined') {
  window.addEventListener(AKARI_EMERGENCY_WIPE_EVENT, () => {
    memoryFallbackStore.clear();
    objectStore.clear();
  });
}

export function loadPersistedTabState<T>(storageKey: string, fallback: T): T {
  const canonicalKey = resolveCanonicalKey(storageKey);
  if (memoryFallbackStore.has(canonicalKey)) {
    return memoryFallbackStore.get(canonicalKey) as T;
  }
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw =
      window.localStorage.getItem(canonicalKey) ??
      window.localStorage.getItem(storageKey) ??
      window.sessionStorage.getItem(canonicalKey) ??
      window.sessionStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    memoryFallbackStore.set(canonicalKey, parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

export function savePersistedTabState<T>(storageKey: string, value: T): void {
  const canonicalKey = resolveCanonicalKey(storageKey);
  memoryFallbackStore.set(canonicalKey, value);
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(canonicalKey, serialized);
    if (canonicalKey !== storageKey) {
      window.localStorage.setItem(storageKey, serialized);
    }
  } catch {
    // Quota exceeded (e.g., very large PDF text): fallback to sessionStorage / memoryFallbackStore
  }
  try {
    window.sessionStorage.setItem(storageKey, serialized);
  } catch {
    // Ignore sessionStorage quota errors
  }
}

export function clearPersistedTabState(storageKey: string): void {
  const canonicalKey = resolveCanonicalKey(storageKey);
  memoryFallbackStore.delete(canonicalKey);
  memoryFallbackStore.delete(storageKey);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(canonicalKey);
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(canonicalKey);
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors
  }
}

export function getPersistedRuntimeObject<T>(key: string): T | null {
  return (objectStore.get(key) as T) ?? null;
}

export function setPersistedRuntimeObject<T>(key: string, value: T | null): void {
  if (value === null) {
    objectStore.delete(key);
  } else {
    objectStore.set(key, value);
  }
}

