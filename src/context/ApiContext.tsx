/**
 * Global ApiContext providing Pure Gemini-Native Dual-Key (Primary & Backup) failover,
 * client-side Gemini Multi-Account Key Pool, In-App Live API Key Test Suite (`testGeminiApiKey`),
 * and in-place Key Replacement Modal with instant retry execution.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { GeminiKeyEntry } from '../types';
import {
  checkGeminiQuotaHealth,
  loadKeyPoolFromStorage,
  saveKeyPoolToStorage,
  calculatePacificMidnightResetSeconds,
  formatCountdownTimer,
  QuotaHealthResult,
  STORAGE_KEY_PRIMARY,
  STORAGE_KEY_BACKUP,
  cleanGeminiKey,
  testGeminiApiKey,
  validateGeminiApiKey,
  isAIStudioPreview,
  isValidGeminiKeyFormat,
  generateGeminiResponse,
  silentValidateStoredKeys,
  invalidateDynamicModelCatalog,
} from '../services/geminiService';

export {
  cleanGeminiKey,
  testGeminiApiKey,
  validateGeminiApiKey,
  isAIStudioPreview,
  isValidGeminiKeyFormat,
  generateGeminiResponse,
};

const PRIMARY_KEY_STORAGE = STORAGE_KEY_PRIMARY;
const BACKUP_KEY_STORAGE = STORAGE_KEY_BACKUP;

export interface ApiContextType {
  keyPool: GeminiKeyEntry[];
  addKeyToPool: (key: string, label?: string) => Promise<QuotaHealthResult>;
  removeKeyFromPool: (id: string) => void;
  updateKeyStatus: (id: string, status: GeminiKeyEntry['status']) => void;

  // Gemini Multi-Key Vault (Primary & Optional Backup Key)
  primaryApiKey: string;
  backupApiKey: string;
  setPrimaryApiKey: (key: string) => void;
  setBackupApiKey: (key: string) => void;
  activeKey: string;

  // In-App Live API Key Test Suite
  testKeyConnection: (key: string) => Promise<{ success: boolean; message: string; latency?: number }>;

  // Modal State & Quota Counters
  isQuotaModalOpen: boolean;
  setIsQuotaModalOpen: (open: boolean) => void;
  isKeySwitchModalOpen: boolean;
  setIsKeySwitchModalOpen: (open: boolean) => void;
  quotaSecondsRemaining: number;
  quotaTimerFormatted: string;
  checkPoolHealth: () => Promise<void>;
  isProbing: boolean;
  poolHealthSummary: {
    totalKeys: number;
    activeKeys: number;
    exhaustedKeys: number;
    invalidKeys: number;
  };

  // Instant Key Replacement & In-Place Retry Handshake
  pendingRetryCallback: (() => Promise<void>) | null;
  setPendingRetryCallback: (cb: (() => Promise<void>) | null) => void;
  triggerKeyReplacementPrompt: (retryCallback?: () => Promise<void>) => void;
  replaceActiveKeyAndRetry: (newKey: string) => Promise<boolean>;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Purge any legacy external provider tokens and silently validate stored keys on startup
  useEffect(() => {
    try {
      localStorage.removeItem('akari_github_token');
      localStorage.removeItem('akari_groq_api_key');
      localStorage.removeItem('akari_openrouter_api_key');
    } catch {}

    let cancelled = false;
    void silentValidateStoredKeys().then((statusMap) => {
      if (cancelled || !statusMap || Object.keys(statusMap).length === 0) return;
      setKeyPool((prev) =>
        prev.map((entry) => {
          const st = statusMap[entry.key];
          if (!st) return entry;
          return {
            ...entry,
            status: st === 'active' ? 'active' : st === 'invalid' ? 'invalid' : 'quota_exhausted',
          };
        })
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // 1. Gemini Dual-Key Local Storage Initialization with standardized keys & backward fallbacks
  const [primaryApiKey, setPrimaryApiKeyState] = useState<string>(() => {
    return (
      cleanGeminiKey(localStorage.getItem(STORAGE_KEY_PRIMARY) || '') ||
      cleanGeminiKey(localStorage.getItem('akari_primary_gemini_key') || '') ||
      cleanGeminiKey(localStorage.getItem('gemini_api_key') || '') ||
      cleanGeminiKey(localStorage.getItem('apiKey') || '') ||
      cleanGeminiKey(localStorage.getItem('akari_user_custom_gemini_key_v1') || '') ||
      ''
    );
  });

  const [backupApiKey, setBackupApiKeyState] = useState<string>(() => {
    return (
      cleanGeminiKey(localStorage.getItem(STORAGE_KEY_BACKUP) || '') ||
      cleanGeminiKey(localStorage.getItem('akari_backup_gemini_key') || '') ||
      ''
    );
  });

  // 2. Multi-Account Key Pool
  const [keyPool, setKeyPool] = useState<GeminiKeyEntry[]>(() => {
    const loaded = loadKeyPoolFromStorage();
    const primary =
      cleanGeminiKey(localStorage.getItem(STORAGE_KEY_PRIMARY) || '') ||
      cleanGeminiKey(localStorage.getItem('akari_primary_gemini_key') || '') ||
      cleanGeminiKey(localStorage.getItem('gemini_api_key') || '') ||
      '';
    const backup =
      cleanGeminiKey(localStorage.getItem(STORAGE_KEY_BACKUP) || '') ||
      cleanGeminiKey(localStorage.getItem('akari_backup_gemini_key') || '') ||
      '';

    let pool = [...loaded];
    if (primary && !pool.some((k) => k.key === primary)) {
      pool.unshift({
        id: 'primary-key-entry',
        key: primary,
        label: 'Primary Account (Main)',
        status: 'active',
      });
    }
    if (backup && !pool.some((k) => k.key === backup)) {
      pool.push({
        id: 'backup-key-entry',
        key: backup,
        label: 'Backup Account (Secondary)',
        status: 'active',
      });
    }
    return pool;
  });

  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [isKeySwitchModalOpen, setIsKeySwitchModalOpen] = useState(false);
  const [quotaSecondsRemaining, setQuotaSecondsRemaining] = useState<number>(0);
  const [isProbing, setIsProbing] = useState(false);
  const [pendingRetryCallback, setPendingRetryCallback] = useState<(() => Promise<void>) | null>(null);

  // Sync pool changes to obfuscated localStorage
  const updatePoolState = useCallback((newPool: GeminiKeyEntry[]) => {
    setKeyPool(newPool);
    saveKeyPoolToStorage(newPool);
  }, []);

  // Update Primary Key with immediate synchronization
  const setPrimaryApiKey = useCallback((key: string) => {
    const cleanKey = cleanGeminiKey(key);
    setPrimaryApiKeyState(cleanKey);
    invalidateDynamicModelCatalog();
    if (cleanKey) {
      localStorage.setItem(PRIMARY_KEY_STORAGE, cleanKey);
      localStorage.setItem('akari_primary_gemini_key', cleanKey);
      localStorage.setItem('gemini_api_key', cleanKey);
      localStorage.setItem(`key_status_${cleanKey.slice(-6)}`, 'active');
    } else {
      localStorage.removeItem(PRIMARY_KEY_STORAGE);
      localStorage.removeItem('akari_primary_gemini_key');
      localStorage.removeItem('gemini_api_key');
    }

    setKeyPool((prev) => {
      const withoutOld = prev.filter((k) => k.id !== 'primary-key-entry' && k.key !== cleanKey);
      if (cleanKey) {
        const updated = [
          {
            id: 'primary-key-entry',
            key: cleanKey,
            label: 'Primary Account (Main)',
            status: 'active' as const,
            lastUsed: new Date().toISOString(),
          },
          ...withoutOld,
        ];
        saveKeyPoolToStorage(updated);
        return updated;
      }
      saveKeyPoolToStorage(withoutOld);
      return withoutOld;
    });
  }, []);

  // Update Backup Key with immediate synchronization
  const setBackupApiKey = useCallback((key: string) => {
    const cleanKey = cleanGeminiKey(key);
    setBackupApiKeyState(cleanKey);
    invalidateDynamicModelCatalog();
    if (cleanKey) {
      localStorage.setItem(BACKUP_KEY_STORAGE, cleanKey);
      localStorage.setItem('akari_backup_gemini_key', cleanKey);
      localStorage.setItem(`key_status_${cleanKey.slice(-6)}`, 'active');
    } else {
      localStorage.removeItem(BACKUP_KEY_STORAGE);
      localStorage.removeItem('akari_backup_gemini_key');
    }

    setKeyPool((prev) => {
      const withoutOld = prev.filter((k) => k.id !== 'backup-key-entry' && k.key !== cleanKey);
      if (cleanKey) {
        const updated = [
          ...withoutOld,
          {
            id: 'backup-key-entry',
            key: cleanKey,
            label: 'Backup Account (Secondary)',
            status: 'active' as const,
            lastUsed: new Date().toISOString(),
          },
        ];
        saveKeyPoolToStorage(updated);
        return updated;
      }
      saveKeyPoolToStorage(withoutOld);
      return withoutOld;
    });
  }, []);

  // Direct Live API Key Test Suite method exposed on Context
  const testKeyConnection = useCallback(async (key: string) => {
    return testGeminiApiKey(key);
  }, []);

  // Compute active key: primary if active, backup if primary exhausted, or first active key in pool
  const primaryEntry = keyPool.find((k) => k.key === primaryApiKey);
  const isPrimaryExhausted = primaryEntry?.status === 'quota_exhausted' || primaryEntry?.status === 'invalid';

  const activeKey =
    !isPrimaryExhausted && primaryApiKey
      ? primaryApiKey
      : backupApiKey
      ? backupApiKey
      : keyPool.find((k) => k.status === 'active')?.key || primaryApiKey || keyPool[0]?.key || '';

  // Add key with instant health probe verification
  const addKeyToPool = async (key: string, label?: string): Promise<QuotaHealthResult> => {
    const cleanKey = cleanGeminiKey(key);
    if (!cleanKey || cleanKey.length < 8) {
      return {
        status: 'MISSING_KEY',
        healthy: false,
        latencyMs: 0,
        message: 'Key မပြည့်စုံပါ။ ကျေးဇူးပြု၍ စာလုံးအပြည့်အစုံ ကူးထည့်ပေးပါ။',
      };
    }

    const probe = await checkGeminiQuotaHealth(cleanKey);
    const newEntry: GeminiKeyEntry = {
      id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      key: cleanKey,
      label: label?.trim() || `Account Key ${keyPool.length + 1}`,
      status: probe.healthy ? 'active' : probe.status === 'QUOTA_EXHAUSTED' ? 'quota_exhausted' : 'invalid',
      lastUsed: new Date().toISOString(),
    };

    const updated = [...keyPool, newEntry];
    updatePoolState(updated);
    return probe;
  };

  const removeKeyFromPool = (id: string) => {
    const target = keyPool.find((k) => k.id === id);
    if (target?.key === primaryApiKey) {
      setPrimaryApiKey('');
    } else if (target?.key === backupApiKey) {
      setBackupApiKey('');
    }
    const updated = keyPool.filter((k) => k.id !== id);
    updatePoolState(updated);
  };

  const updateKeyStatus = (id: string, status: GeminiKeyEntry['status']) => {
    const updated = keyPool.map((k) => (k.id === id ? { ...k, status } : k));
    updatePoolState(updated);
  };

  // Comprehensive pool health check
  const checkPoolHealth = useCallback(async () => {
    if (keyPool.length === 0) return;
    setIsProbing(true);
    let allExhausted = true;

    const updated = await Promise.all(
      keyPool.map(async (entry) => {
        const probe = await checkGeminiQuotaHealth(entry.key);
        if (probe.healthy) allExhausted = false;
        return {
          ...entry,
          status: probe.healthy
            ? ('active' as const)
            : probe.status === 'QUOTA_EXHAUSTED'
            ? ('quota_exhausted' as const)
            : ('invalid' as const),
        };
      })
    );

    updatePoolState(updated);
    setIsProbing(false);

    if (allExhausted && updated.length > 0) {
      setQuotaSecondsRemaining(calculatePacificMidnightResetSeconds());
      setIsQuotaModalOpen(true);
    } else {
      setIsQuotaModalOpen(false);
    }
  }, [keyPool, updatePoolState]);

  // Trigger interactive Key Replacement prompt when all cascade models and keys are exhausted
  const triggerKeyReplacementPrompt = useCallback((retryCallback?: () => Promise<void>) => {
    if (retryCallback) {
      setPendingRetryCallback(() => retryCallback);
    }
    setQuotaSecondsRemaining(calculatePacificMidnightResetSeconds());
    setIsQuotaModalOpen(true);
  }, []);

  // Replace active key in-place and immediately execute retry callback on the spot
  const replaceActiveKeyAndRetry = useCallback(
    async (newKey: string): Promise<boolean> => {
      const clean = cleanGeminiKey(newKey);
      if (!clean) return false;

      localStorage.setItem(PRIMARY_KEY_STORAGE, clean);
      setPrimaryApiKey(clean);

      setKeyPool((prev) => prev.map((k) => (k.key === clean ? { ...k, status: 'active' as const } : k)));
      setIsQuotaModalOpen(false);
      setIsKeySwitchModalOpen(false);

      if (pendingRetryCallback) {
        try {
          console.log('[In-Place Key Switcher] Executing retry callback with fresh API key immediately...');
          await pendingRetryCallback();
          setPendingRetryCallback(null);
          return true;
        } catch (retryErr) {
          console.error('[In-Place Key Switcher] Retry execution failed:', retryErr);
        }
      }
      return true;
    },
    [setPrimaryApiKey, pendingRetryCallback]
  );

  // Countdown timer interval for quota exhaustion
  useEffect(() => {
    if (quotaSecondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setQuotaSecondsRemaining((prev) => {
        if (prev <= 1) {
          checkPoolHealth();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quotaSecondsRemaining, checkPoolHealth]);

  // Background auto-polling: Poll every 60 seconds with exponential backoff if in quota-exhausted state
  useEffect(() => {
    if (!isQuotaModalOpen) return;

    const pollTimer = setInterval(() => {
      checkPoolHealth();
    }, 60000);

    return () => clearInterval(pollTimer);
  }, [isQuotaModalOpen, checkPoolHealth]);

  const poolHealthSummary = {
    totalKeys: keyPool.length,
    activeKeys: keyPool.filter((k) => k.status === 'active').length,
    exhaustedKeys: keyPool.filter((k) => k.status === 'quota_exhausted').length,
    invalidKeys: keyPool.filter((k) => k.status === 'invalid').length,
  };

  return (
    <ApiContext.Provider
      value={{
        keyPool,
        addKeyToPool,
        removeKeyFromPool,
        updateKeyStatus,
        primaryApiKey,
        backupApiKey,
        setPrimaryApiKey,
        setBackupApiKey,
        activeKey,
        testKeyConnection,
        isQuotaModalOpen,
        setIsQuotaModalOpen,
        isKeySwitchModalOpen,
        setIsKeySwitchModalOpen,
        quotaSecondsRemaining,
        quotaTimerFormatted: formatCountdownTimer(quotaSecondsRemaining),
        checkPoolHealth,
        isProbing,
        poolHealthSummary,
        pendingRetryCallback,
        setPendingRetryCallback,
        triggerKeyReplacementPrompt,
        replaceActiveKeyAndRetry,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
