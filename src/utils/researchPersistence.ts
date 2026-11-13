// Persistent session + in-memory cache for the 4 Research Hub sub-tabs.
// Ensures zero accidental data loss across sub-tab navigation and workspace switching,
// wiping ONLY when the user explicitly triggers Clear All / Reset Data.

const memoryFallbackStore = new Map<string, unknown>();

export function loadPersistedTabState<T>(storageKey: string, fallback: T): T {
  if (memoryFallbackStore.has(storageKey)) {
    return memoryFallbackStore.get(storageKey) as T;
  }
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    memoryFallbackStore.set(storageKey, parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

export function savePersistedTabState<T>(storageKey: string, value: T): void {
  memoryFallbackStore.set(storageKey, value);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Quota exceeded (e.g., very large PDF text): memoryFallbackStore still retains full state
    // across sub-tab and workspace navigation in the active session.
  }
}

export function clearPersistedTabState(storageKey: string): void {
  memoryFallbackStore.delete(storageKey);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors
  }
}

// Separate in-memory slot for non-serializable objects such as PDF.js document proxies
const objectStore = new Map<string, unknown>();

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
