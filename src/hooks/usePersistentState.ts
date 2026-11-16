import React, { useState, useEffect, useRef } from 'react';

export const AKARI_EMERGENCY_WIPE_EVENT = 'akari_emergency_wipe';

export const AKARI_FEATURE_STORAGE_KEYS = {
  CGPA_TRACKER: 'akari_cgpa_tracker_v1',
  STUDY_STREAK: 'akari_study_streak_v1',
  BURNOUT_MONITOR: 'akari_burnout_monitor_v1',
  FLASHCARDS: 'akari_flashcards_v1',
  ASSIGNMENT_HUB: 'akari_assignment_hub_v1',
  APA_CONFIGS: 'akari_apa_configs_v1',
  PDF_READER_NOTES: 'akari_pdf_reader_notes_v1',
  STATS_EXPLAINER: 'akari_stats_explainer_v1',
  SYNTHESIS_LINKER: 'akari_synthesis_linker_v1',
  BILINGUAL_EXPLAINER: 'akari_bilingual_explainer_v1',
  ACADEMIC_TASKS: 'akari_academic_tasks_v1',
  POMODORO_SETTINGS: 'akari_pomodoro_settings_v1',
  WELLNESS_SUPPORT: 'akari_wellness_support_v1',
  SCHOLAR_EMAIL_DRAFTS: 'akari_scholar_email_drafts_v1',
  STAR_SOP: 'akari_star_sop_v1',
  SOCRATIC_CHATS: 'akari_socratic_chats_v1',
} as const;

/**
 * Universal LocalStorage persistence hook that:
 * 1. Reads from window.localStorage on initial mount (with safe JSON parsing & optional legacy key fallback).
 * 2. Automatically writes back to window.localStorage on state change.
 * 3. Listens to window storage & custom Emergency Wipe events ('akari_emergency_wipe') to reset cleanly.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  legacyKey?: string
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const initialValueRef = useRef<T>(initialValue);
  const skipNextWriteRef = useRef<boolean>(false);

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
      if (legacyKey) {
        const legacyLocal = window.localStorage.getItem(legacyKey);
        if (legacyLocal !== null) {
          return JSON.parse(legacyLocal) as T;
        }
        const legacySession = window.sessionStorage.getItem(legacyKey);
        if (legacySession !== null) {
          return JSON.parse(legacySession) as T;
        }
      }
      return initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    try {
      const serialized = JSON.stringify(state);
      window.localStorage.setItem(key, serialized);
      if (legacyKey) {
        window.localStorage.setItem(legacyKey, serialized);
      }
    } catch (error) {
      console.warn(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, legacyKey, state]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWipe = () => {
      skipNextWriteRef.current = true;
      setState(initialValueRef.current);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === null || (e.key === key && e.newValue === null)) {
        skipNextWriteRef.current = true;
        setState(initialValueRef.current);
      } else if (e.key === key && e.newValue !== null) {
        try {
          skipNextWriteRef.current = true;
          setState(JSON.parse(e.newValue) as T);
        } catch {
          // ignore malformed external event
        }
      }
    };

    window.addEventListener(AKARI_EMERGENCY_WIPE_EVENT, handleWipe);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(AKARI_EMERGENCY_WIPE_EVENT, handleWipe);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [state, setState];
}

/**
 * Master Emergency Wipe helper:
 * Clears all akari_* and uopeople_* keys (plus legacy feature keys) from localStorage and sessionStorage,
 * and dispatches 'akari_emergency_wipe' so all mounted components immediately reset to initial defaults.
 */
export function executeEmergencyWipeAllStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('akari_') ||
        k.startsWith('uopeople_') ||
        k.startsWith('matrix_') ||
        k.startsWith('sop_') ||
        k.startsWith('star_') ||
        k.startsWith('socratic_')
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    window.sessionStorage.clear();
  } catch (err) {
    console.warn('Error clearing storage during Emergency Wipe:', err);
  }
  window.dispatchEvent(new CustomEvent(AKARI_EMERGENCY_WIPE_EVENT));
}
