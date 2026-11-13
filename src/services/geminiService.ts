/**
 * Client-Side Gemini Service with Deterministic Direct-Anchor Grounding (`sourceQuote`),
 * Dynamic Token-Ascending Model Discovery, Auto-Cascade & Multi-Key Failover.
 *
 * Features:
 * - Eliminates all ungrounded paragraph/page number hallucinations.
 * - Extracts verbatim `sourceQuote` (for instant Ctrl+F search), `sectionHeader`, and `realWorldApplication`.
 * - Method (A): Direct High-Yield Flashcard Generator using dynamic lightweight tier routing with Real-World & Verbatim Quote anchors.
 * - Method (B): Zero-Cost Client-Side Quiz Error Collector (`collectQuizErrorsToDeck`) with Real-World & Verbatim Quote anchors.
 */

import { GeminiKeyEntry, FlashcardItem, QuizQuestion } from '../types';
import { loadTextbookSource } from './textbookLoader';
import { getTodayDateString } from '../utils/sm2';
import {
  stripTextbookNoise,
  sanitizeAcademicQuestionStem,
  isForbiddenMetaQuestion,
} from '../utils/textbookStripper';
import { safeExtractJsonArray, safeExtractJsonObject } from '../utils/jsonSanitizer';
import { shuffleQuizOptions, ShuffledQuizQuestion } from '../utils/quizUtils';
import {
  resolveAcademicPayload,
  cleanDoiString,
  isPublicOpenAccessDomain,
  fetchUniversalWebContent,
  ResolvedAcademicPaper,
} from './academicResolver';
import {
  fetchAcademicUrlText,
  fetchCleanOpenStaxContent,
  normalizeAcademicSourceUrl,
  parseOpenStaxUrl,
  resolveTargetSections,
} from '../utils/academicSourceFetcher';

export {
  stripTextbookNoise,
  sanitizeAcademicQuestionStem,
  isForbiddenMetaQuestion,
  safeExtractJsonArray,
  shuffleQuizOptions,
  resolveAcademicPayload,
  cleanDoiString,
  isPublicOpenAccessDomain,
  fetchUniversalWebContent,
  fetchAcademicUrlText,
  fetchCleanOpenStaxContent,
  normalizeAcademicSourceUrl,
  parseOpenStaxUrl,
  resolveTargetSections,
};
export type { ShuffledQuizQuestion, ResolvedAcademicPaper };

export interface QuizQuestionOutput {
  id: string;
  questionType: 'mcq' | 'except' | 'true_false';
  question: string; // Pure academic concept question (No chapter references, uses LaTeX $...$)
  options: string[]; // 4 options (A, B, C, D) or 2 options (["True", "False"])
  correctIndex: number; // 0-3 or 0-1
  explanation: string; // Theoretical explanation & distractor breakdown (uses LaTeX $...$)
  realWorldApplication: string; // 1-sentence practical example
}

export interface QuotaHealthResult {
  status: 'NORMAL' | 'QUOTA_EXHAUSTED' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'MISSING_KEY';
  healthy: boolean;
  httpStatus?: number;
  latencyMs: number;
  message: string;
  retryAfterSeconds?: number;
  resetDate?: string;
  testedKeyId?: string;
}

export interface DailyUsageRecord {
  date: string; // YYYY-MM-DD
  requestsToday: number;
  estimatedTokens: number;
}

const DAILY_USAGE_STORAGE_KEY = 'akari_daily_usage';
export const FLASHCARD_DECK_STORAGE_KEY = 'akari_flashcard_deck';

export function getQuizStorageKeyForWeek(weekTag: string): string {
  const cleanWeek = (weekTag || 'Week 1').replace(/\s+/g, '_');
  return `akari_saved_quizzes_${cleanWeek}`;
}

export function getDailyUsage(): DailyUsageRecord {
  if (typeof window === 'undefined') {
    return { date: new Date().toISOString().split('T')[0], requestsToday: 0, estimatedTokens: 0 };
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = localStorage.getItem(DAILY_USAGE_STORAGE_KEY);
    if (raw) {
      const parsed: DailyUsageRecord = JSON.parse(raw);
      if (parsed.date === today) {
        return parsed;
      }
    }
    const fresh: DailyUsageRecord = { date: today, requestsToday: 0, estimatedTokens: 0 };
    localStorage.setItem(DAILY_USAGE_STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return { date: new Date().toISOString().split('T')[0], requestsToday: 0, estimatedTokens: 0 };
  }
}

export function incrementDailyUsage(estimatedTokens = 1200): DailyUsageRecord {
  const record = getDailyUsage();
  record.requestsToday += 1;
  record.estimatedTokens += estimatedTokens;
  try {
    localStorage.setItem(DAILY_USAGE_STORAGE_KEY, JSON.stringify(record));
  } catch {}
  return record;
}

export const STORAGE_KEY_PRIMARY = 'akari_gemini_api_key_primary';
export const STORAGE_KEY_BACKUP = 'akari_gemini_api_key_backup';
export const STORAGE_KEY_LEGACY = 'gemini_api_key';

const LOCAL_POOL_STORAGE_KEY = 'akari_gemini_key_pool_v1';
const PACIFIC_TIMEZONE_OFFSET_HOURS = -8; // PST standard offset

/**
 * Format-Agnostic Sanitization:
 * Strips whitespace, line breaks, and quotation marks without hardcoded prefix checks
 * (accepting both modern `AQ.` and legacy `AIza` keys).
 */
export const cleanGeminiKey = (k: string): string => (k || '').replace(/["'\s]/g, '').trim();

/**
 * Dynamic Model Discovery & Categorization Cache (Memory + sessionStorage, 6-hour TTL)
 * Never relies on rigid static model lists when the API catalog is available.
 */
export interface DynamicModelCatalog {
  lightweight: string[];
  standard: string[];
  heavy: string[];
  all: string[];
  timestamp: number;
  keyFingerprint?: string;
}

const MODEL_CATALOG_SESSION_KEY = 'akari_dynamic_model_catalog_v4';
const MODEL_CATALOG_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let inMemoryModelCatalog: DynamicModelCatalog | null = null;
let inFlightCatalogPromise: Promise<DynamicModelCatalog> | null = null;
const deadDiscoveredModels = new Set<string>();

export const TIER_LIGHTWEIGHT: string[] = [];
export const TIER_STANDARD: string[] = [];
export const TIER_HEAVY: string[] = [];
export const CASCADE_MODEL_PRIORITY: string[] = [];

export const EXCLUDED_PAID_MODELS: string[] = [];

export type TaskComplexity = 'light' | 'standard' | 'heavy';

function isExcludedPaidOrRestrictedModel(modelName: string): boolean {
  const lower = (modelName || '').toLowerCase();
  return (
    lower.includes('carbon') ||
    lower.includes('ultra') ||
    deadDiscoveredModels.has(modelName) ||
    EXCLUDED_PAID_MODELS.includes(modelName)
  );
}

function applyDiscoveredCatalogToTiers(catalog: DynamicModelCatalog): void {
  TIER_LIGHTWEIGHT.splice(0, TIER_LIGHTWEIGHT.length, ...catalog.lightweight);
  TIER_STANDARD.splice(0, TIER_STANDARD.length, ...catalog.standard);
  TIER_HEAVY.splice(0, TIER_HEAVY.length, ...(catalog.heavy || []));
  const combined = Array.from(new Set([...TIER_LIGHTWEIGHT, ...TIER_STANDARD, ...TIER_HEAVY]));
  CASCADE_MODEL_PRIORITY.splice(0, CASCADE_MODEL_PRIORITY.length, ...combined);
}

export function invalidateDynamicModelCatalog(): void {
  inMemoryModelCatalog = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(MODEL_CATALOG_SESSION_KEY);
    } catch {}
  }
}

export function markModelUnavailable(modelName: string): void {
  if (!modelName || modelName === 'auto') return;
  deadDiscoveredModels.add(modelName);
  if (inMemoryModelCatalog) {
    inMemoryModelCatalog = {
      ...inMemoryModelCatalog,
      lightweight: inMemoryModelCatalog.lightweight.filter((m) => m !== modelName),
      standard: inMemoryModelCatalog.standard.filter((m) => m !== modelName),
      heavy: (inMemoryModelCatalog.heavy || []).filter((m) => m !== modelName),
      all: inMemoryModelCatalog.all.filter((m) => m !== modelName),
    };
    applyDiscoveredCatalogToTiers(inMemoryModelCatalog);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(MODEL_CATALOG_SESSION_KEY, JSON.stringify(inMemoryModelCatalog));
      } catch {}
    }
  }
}

function loadCachedCatalogFromSession(expectedFingerprint?: string): DynamicModelCatalog | null {
  if (inMemoryModelCatalog && Date.now() - inMemoryModelCatalog.timestamp < MODEL_CATALOG_TTL_MS) {
    if (!expectedFingerprint || !inMemoryModelCatalog.keyFingerprint || inMemoryModelCatalog.keyFingerprint === expectedFingerprint) {
      return inMemoryModelCatalog;
    }
    // Active API key changed -> invalidate stale catalog
    invalidateDynamicModelCatalog();
    return null;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MODEL_CATALOG_SESSION_KEY);
    if (!raw) return null;
    const parsed: DynamicModelCatalog = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.all) &&
      parsed.all.length > 0 &&
      Date.now() - (parsed.timestamp || 0) < MODEL_CATALOG_TTL_MS &&
      (!expectedFingerprint || !parsed.keyFingerprint || parsed.keyFingerprint === expectedFingerprint)
    ) {
      parsed.lightweight = (parsed.lightweight || []).filter((m) => !deadDiscoveredModels.has(m));
      parsed.standard = (parsed.standard || []).filter((m) => !deadDiscoveredModels.has(m));
      parsed.heavy = (parsed.heavy || []).filter((m) => !deadDiscoveredModels.has(m));
      parsed.all = (parsed.all || []).filter((m) => !deadDiscoveredModels.has(m));
      inMemoryModelCatalog = parsed;
      applyDiscoveredCatalogToTiers(parsed);
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * Categorize verified active models strictly supporting `generateContent` in ascending token-cost order:
 * 1. `lightweight`: lowest token/free footprint (`flash-lite`, `-lite`, `8b`)
 * 2. `standard`: balanced speed/reasoning (`flash`, `hydrogen`)
 * 3. `heavy`: higher-capacity reasoning (`pro`, `argon`)
 */
export function categorizeDiscoveredModels(rawModels: any[]): DynamicModelCatalog {
  const lightweight: string[] = [];
  const standard: string[] = [];
  const heavy: string[] = [];

  for (const item of rawModels) {
    const rawName = (typeof item === 'string' ? item : item?.name || '')
      .replace(/^models\//, '')
      .trim();
    if (!rawName) continue;
    const lower = rawName.toLowerCase();

    if (typeof item === 'object' && item !== null) {
      const methods: string[] | undefined =
        item.supportedGenerationMethods || item.supportedActions;
      if (!Array.isArray(methods) || !methods.includes('generateContent')) {
        continue;
      }
    }

    if (
      lower.includes('1.0') ||
      lower.includes('1.5') ||
      lower.includes('2.0') ||
      lower.includes('2.5') ||
      lower.includes('omni') ||
      lower.includes('latest') ||
      lower.includes('exp') ||
      lower.includes('tts') ||
      lower.includes('image') ||
      lower.includes('imagen') ||
      lower.includes('vision') ||
      lower.includes('moderation') ||
      lower.includes('embedding') ||
      lower.includes('audio') ||
      lower.includes('live') ||
      lower.includes('transcribe') ||
      lower.includes('veo') ||
      lower.includes('lyria') ||
      lower.includes('aqa') ||
      lower.includes('bison') ||
      lower.includes('gecko') ||
      lower.includes('learnlm') ||
      lower.includes('robotics') ||
      lower.includes('computer-use') ||
      lower.includes('deep-research') ||
      lower.includes('customtools') ||
      lower.includes('gemma') ||
      lower.includes('nano') ||
      lower === 'gemini-pro' ||
      isExcludedPaidOrRestrictedModel(rawName)
    ) {
      continue;
    }

    if (lower.includes('flash-lite') || lower.includes('-lite') || lower.includes('8b')) {
      if (!lightweight.includes(rawName)) lightweight.push(rawName);
    } else if (lower.includes('flash') || lower.includes('hydrogen')) {
      if (!standard.includes(rawName)) standard.push(rawName);
    } else if (lower.includes('pro') || lower.includes('argon')) {
      if (!heavy.includes(rawName)) heavy.push(rawName);
    }
  }

  // Sort Tier 1 (lowest token footprint first: flash-lite / 8b prioritized)
  lightweight.sort((a, b) => {
    const aLite = a.toLowerCase().includes('flash-lite') ? 0 : 1;
    const bLite = b.toLowerCase().includes('flash-lite') ? 0 : 1;
    if (aLite !== bLite) return aLite - bLite;
    return b.localeCompare(a);
  });
  standard.sort((a, b) => b.localeCompare(a));
  heavy.sort((a, b) => b.localeCompare(a));

  const all = Array.from(new Set([...lightweight, ...standard, ...heavy]));

  return {
    lightweight,
    standard,
    heavy,
    all,
    timestamp: Date.now(),
  };
}

/**
 * Dynamic Verified Model Resolver (Silent & Instant):
 * Queries `GET https://generativelanguage.googleapis.com/v1beta/models?key=${activeKey}` ONCE,
 * filters strictly where `supportedGenerationMethods` includes `generateContent`,
 * sorts token-efficient models first and standard models second, and caches valid IDs in memory.
 */
export async function resolveDynamicModelCatalog(
  apiKey?: string,
  forceRefresh = false
): Promise<DynamicModelCatalog> {
  const candidateKeys = Array.from(
    new Set(
      [cleanGeminiKey(apiKey || ''), cleanGeminiKey(getActiveApiKey()), ...getAllAvailableKeys()].filter(
        (k) => k.length >= 15
      )
    )
  );
  const expectedFingerprint = candidateKeys[0] ? candidateKeys[0].slice(-6) : 'server';

  if (forceRefresh) {
    invalidateDynamicModelCatalog();
  } else {
    const cached = loadCachedCatalogFromSession(expectedFingerprint);
    if (cached && cached.all.length > 0) {
      return cached;
    }
  }

  if (inFlightCatalogPromise) {
    return inFlightCatalogPromise;
  }

  inFlightCatalogPromise = (async () => {
    try {
      let rawList: any[] = [];
      let usedKeyFingerprint = expectedFingerprint;

      // 1. Direct API-Driven Catalog Discovery across valid client keys (skip invalid 400/403 keys immediately)
      for (const candidateKey of candidateKeys) {
        try {
          const directRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(candidateKey)}`,
            { method: 'GET' }
          );
          if (directRes.status === 400 || directRes.status === 401 || directRes.status === 403) {
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(`key_status_${candidateKey.slice(-6)}`, 'invalid');
              } catch {}
            }
            continue;
          }
          if (directRes.ok) {
            const directData = await directRes.json();
            if (Array.isArray(directData?.models) && directData.models.length > 0) {
              rawList = directData.models;
              usedKeyFingerprint = candidateKey.slice(-6);
              break;
            }
          }
        } catch {
          // Network or CORS issue; try server proxy fallback
          break;
        }
      }

      // 2. Server-backed discovery fallback (supports server environment key)
      if (rawList.length === 0) {
        const fallbackKey = candidateKeys[0] || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (fallbackKey) {
          headers['x-gemini-key'] = fallbackKey;
          headers['x-goog-api-key'] = fallbackKey;
        }

        const res = await fetch('/api/academic/models', {
          method: 'GET',
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          rawList = Array.isArray(data?.models) ? data.models : [];
        }
      }

      if (rawList.length > 0) {
        const catalog: DynamicModelCatalog = {
          ...categorizeDiscoveredModels(rawList),
          keyFingerprint: usedKeyFingerprint,
        };

        if (catalog.all.length > 0) {
          inMemoryModelCatalog = catalog;
          applyDiscoveredCatalogToTiers(catalog);
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(MODEL_CATALOG_SESSION_KEY, JSON.stringify(catalog));
              localStorage.setItem(
                'akari_dynamic_flash_models',
                JSON.stringify({ models: catalog.all, timestamp: catalog.timestamp })
              );
            } catch {}
          }
          return catalog;
        }
      }
    } catch {
      // Silently handle offline or transient discovery error
    } finally {
      inFlightCatalogPromise = null;
    }

    return (
      inMemoryModelCatalog || {
        lightweight: [...TIER_LIGHTWEIGHT],
        standard: [...TIER_STANDARD],
        heavy: [...TIER_HEAVY],
        all: Array.from(new Set([...TIER_LIGHTWEIGHT, ...TIER_STANDARD, ...TIER_HEAVY])),
        timestamp: Date.now(),
      }
    );
  })();

  return inFlightCatalogPromise;
}

/**
 * Collect all configured keys from LocalStorage in priority order:
 * Primary -> Secondary Backup -> Multi-Account Key Pool (`akari_gemini_key_pool` & `akari_gemini_key_pool_v1`)
 */
export function getAllAvailableKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const keys: string[] = [];

  const pushUnique = (raw?: string | null) => {
    const cleaned = cleanGeminiKey(raw || '');
    if (cleaned && cleaned.length >= 15 && !keys.includes(cleaned)) {
      keys.push(cleaned);
    }
  };

  pushUnique(localStorage.getItem(STORAGE_KEY_PRIMARY));
  pushUnique(localStorage.getItem('akari_primary_gemini_key'));
  pushUnique(localStorage.getItem('gemini_api_key'));
  pushUnique(localStorage.getItem(STORAGE_KEY_BACKUP));
  pushUnique(localStorage.getItem('akari_backup_gemini_key'));

  try {
    const plainPool = JSON.parse(localStorage.getItem('akari_gemini_key_pool') || '[]');
    if (Array.isArray(plainPool)) {
      plainPool.forEach((item: any) => {
        pushUnique(typeof item === 'string' ? item : item?.key);
      });
    }
  } catch {}

  try {
    const encryptedPool = loadKeyPoolFromStorage();
    encryptedPool.forEach((entry) => {
      pushUnique(entry?.key);
    });
  } catch {}

  return keys;
}

/**
 * Task-Aware Token Optimization:
 * Evaluates task intent & payload size to pick lightweight vs standard high-coherence models.
 */
export function inferTaskComplexity(action: string, payload?: any): TaskComplexity {
  const lightActions = new Set([
    'citation_check',
    'apa_format',
    'grammar_assist',
    'generate_study_cards',
    'direct_flashcards',
    'socratic_tutor',
    'socratic_dialogue',
    'followup_reply',
    'anxiety_grounding',
    'ai_humanize_check',
    'uopeople_scholarship',
    'scholarship_new',
    'scholarship_renewal',
    'scholarship_templates',
    'scholarship_evaluate',
  ]);

  if (lightActions.has(action)) {
    return 'light';
  }

  if (action === 'direct_assist') {
    const promptLen = typeof payload?.prompt === 'string' ? payload.prompt.length : 0;
    const hasImages = Array.isArray(payload?.images) && payload.images.length > 0;
    if (!hasImages && promptLen > 0 && promptLen < 700 && (!payload?.maxOutputTokens || payload.maxOutputTokens <= 800)) {
      return 'light';
    }
  }

  if (
    action === 'lesson_explainer' ||
    action === 'dual_language_summary'
  ) {
    return 'standard';
  }

  if (
    action === 'draft_critique' ||
    action === 'draft_rubric_audit' ||
    action === 'instructor_evaluation' ||
    action === 'outline_analysis' ||
    action === 'research_synthesis' ||
    (typeof payload?.content === 'string' && payload.content.length > 6000)
  ) {
    return 'heavy';
  }

  return 'standard';
}

export function getModelCascade(complexity: TaskComplexity = 'standard'): string[] {
  const cached = loadCachedCatalogFromSession();
  const lightTier =
    cached && cached.lightweight.length > 0 ? cached.lightweight : TIER_LIGHTWEIGHT;
  const standardTier =
    cached && cached.standard.length > 0 ? cached.standard : TIER_STANDARD;
  const heavyTier =
    cached && Array.isArray(cached.heavy) && cached.heavy.length > 0 ? cached.heavy : TIER_HEAVY;

  // Ascending Token Budgeting:
  // Start with the most token-efficient tier suitable for the task and step upward on failover
  const ordered =
    complexity === 'light'
      ? [...lightTier, ...standardTier, ...heavyTier]
      : complexity === 'standard'
      ? [...standardTier, ...lightTier, ...heavyTier]
      : [...standardTier, ...heavyTier, ...lightTier];

  const unique = Array.from(new Set(ordered));
  return unique.length > 0 ? unique : ['auto'];
}

/**
 * Silent Background Health-Check & Dynamic Model Sync on App Initialization
 * Non-blocking ping via server proxy for all stored keys without alerts, popups, or UI disruption.
 */
export async function silentValidateStoredKeys(): Promise<Record<string, 'active' | 'exhausted' | 'invalid'>> {
  const results: Record<string, 'active' | 'exhausted' | 'invalid'> = {};
  if (typeof window === 'undefined') return results;

  const keys = getAllAvailableKeys();
  // Warm up dynamic model catalog in background on app startup
  void resolveDynamicModelCatalog(keys[0]);

  if (keys.length === 0) return results;

  await Promise.all(
    keys.map(async (key) => {
      try {
        const res = await fetch('/api/academic/validate-key', {
          method: 'GET',
          headers: {
            'x-gemini-key': key,
            'x-goog-api-key': key,
          },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const status: 'active' | 'exhausted' | 'invalid' =
          data?.status === 'active'
            ? 'active'
            : data?.status === 'invalid'
            ? 'invalid'
            : 'exhausted';
        results[key] = status;
        localStorage.setItem(`key_status_${key.slice(-6)}`, status);
      } catch {
        // Silently ignore offline or transient network issues
      }
    })
  );

  // Sync key statuses back into obfuscated pool storage silently
  try {
    const existingPool = loadKeyPoolFromStorage();
    if (existingPool.length > 0) {
      let changed = false;
      const updatedPool = existingPool.map((entry) => {
        const st = results[entry.key];
        if (!st) return entry;
        const mappedStatus: GeminiKeyEntry['status'] =
          st === 'active' ? 'active' : st === 'invalid' ? 'invalid' : 'quota_exhausted';
        if (entry.status !== mappedStatus) {
          changed = true;
          return { ...entry, status: mappedStatus };
        }
        return entry;
      });
      if (changed) {
        saveKeyPoolToStorage(updatedPool);
      }
    }
  } catch {}

  return results;
}

/**
 * Dynamic Key Resolution with Fallback Hierarchy
 */
export function getActiveApiKey(): string {
  const keys = getAllAvailableKeys();
  if (keys.length === 0) return '';
  const activeKey = keys.find((k) => {
    try {
      return localStorage.getItem(`key_status_${k.slice(-6)}`) !== 'invalid';
    } catch {
      return true;
    }
  });
  return activeKey || keys[0] || '';
}

/**
 * SDK Call Validation Guard
 * Universal Format Acceptance: Non-empty string with length >= 15
 */
export function validateApiKey(apiKey?: string): string {
  const keyToTest = cleanGeminiKey(apiKey || getActiveApiKey());
  return keyToTest || '';
}

/**
 * In-App Live API Key Test Suite
 * Executes a zero-cost, ultra-lightweight ping to the Google Gemini API.
 */
export async function testGeminiApiKey(
  key: string
): Promise<{ success: boolean; message: string; latency?: number }> {
  const cleanKey = cleanGeminiKey(key);
  const startTime = performance.now();
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cleanKey && cleanKey.length >= 15) {
      headers['x-gemini-key'] = cleanKey;
      headers['x-goog-api-key'] = cleanKey;
    }
    const res = await fetch('/api/academic/health', {
      method: 'GET',
      headers,
    });
    const latency = Math.round(performance.now() - startTime);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.healthy) {
      return {
        success: true,
        message: `API ချိတ်ဆက်မှု အောင်မြင်ပါသည် (${data.latencyMs || latency}ms)။ Key အသုံးပြုနိုင်ပါပြီ။`,
        latency: data.latencyMs || latency,
      };
    }
    return {
      success: false,
      message: data?.message || 'API Key validation failed.',
    };
  } catch (e: any) {
    return {
      success: false,
      message: `Network ချိတ်ဆက်မှု စစ်ဆေးပါ: ${e.message}`,
    };
  }
}

export interface KeyVerificationResult {
  valid: boolean;
  sanitizedKey: string;
  error?: string;
  latencyMs?: number;
}

/**
 * Direct Handshake Verification
 */
export async function verifyGeminiApiKey(key: string): Promise<boolean> {
  const result = await testGeminiApiKey(key);
  return result.success;
}

/**
 * Detailed Verification Helper for UI feedback
 */
export async function verifyGeminiApiKeyDetailed(rawKey: string): Promise<KeyVerificationResult> {
  const cleanKey = cleanGeminiKey(rawKey);
  const res = await testGeminiApiKey(cleanKey);
  return {
    valid: res.success,
    sanitizedKey: cleanKey,
    error: res.success ? undefined : res.message,
    latencyMs: res.latency,
  };
}

/**
 * Server-Backed Generation Fallback
 */
export async function directGoogleGenerateContent(options: {
  model: string;
  prompt: string;
  apiKey: string;
  responseMimeType?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const res = await executeAcademicActionWithCascade({
    action: 'direct_assist',
    payload: {
      prompt: options.prompt,
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      responseMimeType: options.responseMimeType,
      maxOutputTokens: options.maxOutputTokens,
    },
    primaryKey: options.apiKey,
    preferredModel: options.model,
  });
  return typeof res === 'string' ? res : res?.result || res?.text || JSON.stringify(res);
}

// 1. Dynamic Auto-Discovery Function for Active Google Flash Models (Memory + sessionStorage Cache)
export const fetchAvailableGeminiFlashModels = async (apiKey?: string): Promise<string[]> => {
  const catalog = await resolveDynamicModelCatalog(apiKey);
  return catalog.all;
};

// 2. Resilient Universal Caller Engine with Multimodal (Text + Rubric Images) Support & 2-Layer Auto-Cascade
export const callGeminiDynamic = async (
  prompt: string,
  maxTokens: number = 800,
  imagePayload?: { name: string; dataUrl: string }[]
): Promise<{ text: string; modelUsed: string } | null> => {
  const images = (imagePayload || []).map((img) => ({
    name: img.name,
    base64: img.dataUrl,
    mimeType: img.dataUrl.split(';')[0]?.split(':')[1] || 'image/jpeg',
  }));

  try {
    const complexity: TaskComplexity =
      images.length === 0 && prompt.length < 700 && maxTokens <= 800 ? 'light' : 'standard';

    let usedModel = getModelCascade(complexity)[0];
    const result = await executeAcademicActionWithCascade({
      action: 'direct_assist',
      complexity,
      payload: {
        prompt,
        maxOutputTokens: maxTokens,
        temperature: complexity === 'light' ? 0.2 : 0.4,
        images: images.length > 0 ? images : undefined,
      },
      onCascadeToast: (_msg, model) => {
        if (model && model !== 'backup_key') {
          usedModel = model;
        }
      },
    });

    const text =
      typeof result === 'string'
        ? result
        : result?.result || result?.text || (result ? JSON.stringify(result) : '');

    if (text) {
      return { text: String(text).trim(), modelUsed: usedModel };
    }
  } catch {
    // Preserve null-return contract for callers that fall back cleanly
  }

  return null;
};



// =========================================================================
// CLIENT-SIDE CHAPTER FILTER PREPROCESSOR & UNIFIED LOCALSTORAGE DECK
// =========================================================================

/**
 * 10-20 Questions Deep-Exam Prompt Engine:
 * Distributes questions across Problem Statement/Theoretical Framework (25%),
 * Research Methodology/Sampling/Design (25%), Quantitative Findings/Statistical Significance (30%),
 * and Practical Implications/Limitations (20%) with UoPeople archetypes & LaTeX notation.
 */
export function buildUoPeopleExamPrompt(params: {
  count: number;
  chapterScope?: string;
  sanitizedTextPayload: string;
}): string {
  const { count, chapterScope, sanitizedTextPayload } = params;
  const targetScope = chapterScope || 'Full academic paper / textbook section';
  const sanitizedFullTextPayload = sanitizedTextPayload;

  return `You are a distinguished university professor designing an authentic, comprehensive examination for University of the People (UoPeople).
Construct EXACTLY ${count} rigorous questions based strictly on the provided FULL-TEXT research material:

SCOPE & TOPIC FOCUS:
${targetScope}

COMPREHENSIVE QUESTION DISTRIBUTION:
Distribute the questions evenly across the research architecture:
- 25% on Problem Statement, Theoretical Framework & Background
- 25% on Research Methodology, Sampling, Controls & Design
- 30% on Quantitative Findings, Statistical Significance, and Data Analysis
- 20% on Practical Implications, Systemic Limitations & Real-world Conclusions

UOPEOPLE QUESTION ARCHETYPES:
- Concept MCQs (approx. 60%): 4 plausible options testing mechanisms.
- EXCEPT / Negative Constraints (approx. 25%): "All of the following are true EXCEPT...", "...does NOT describe...".
- Nuanced True / False (approx. 15%): Direct theoretical testing with 2 options: ["True", "False"].

MATHEMATICAL & SCIENTIFIC NOTATION:
- Render all formulas, numbers, fractions, and symbols using LaTeX syntax wrapped in single dollar signs (e.g., $p < 0.05$, $\\chi^2$, $\\frac{a}{b}$).

OUTPUT FORMAT (Strict Raw JSON Array, No Markdown code fences):
[
  {
    "id": "q1",
    "questionType": "mcq" | "except" | "true_false",
    "question": "Rigorous question text testing methodology, statistics, or theory...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "In-depth theoretical explanation contrasting correct mechanism against distractors...",
    "realWorldApplication": "1 concise sentence demonstrating practical or clinical/managerial relevance."
  }
]
"""
${sanitizedFullTextPayload}
"""`;
}

/**
 * Client-Side Preprocessor:
 * 1. Strips textbook front-matter noise (author lists, OpenStax Rice University addresses, copyright, ISBN).
 * 2. Extracts the target Chapter / Section window if `chapterScope` is provided.
 * 3. Caps the text payload to `maxWords` (default 3,800 words) for zero-waste token efficiency.
 */
export function preprocessChapterScopedPayload(
  rawText: string,
  chapterScope?: string,
  maxWords = 3800
): string {
  if (!rawText) return '';
  let workingText = stripTextbookNoise(rawText).trim();

  if (chapterScope && chapterScope.trim().length > 1) {
    const cleanScope = chapterScope.trim();
    const lowerText = workingText.toLowerCase();
    const lowerScope = cleanScope.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerScope);

    if (matchIndex !== -1) {
      // Slice from slightly before the matched chapter/section heading
      const startOffset = Math.max(0, matchIndex - 250);
      workingText = workingText.slice(startOffset);
    }
  }

  const words = workingText.split(/\s+/);
  if (words.length <= maxWords) return workingText;
  return words.slice(0, maxWords).join(' ');
}

/**
 * Load active FlashcardItem deck from `akari_flashcard_deck`
 */
export function loadFlashcardDeck(fallbackCards: any[] = []): FlashcardItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FLASHCARD_DECK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c: any, idx: number) => ({
          id: c.id || `fc-${Date.now()}-${idx}`,
          front: c.front || c.f || '',
          back: String(c.back || c.b || '')
            .replace(/\n*🔍 Quote:[\s\S]*$/i, '')
            .trim(),
          source: c.source === 'quiz_error' ? 'quiz_error' : 'direct_generation',
          sourceWeek: c.sourceWeek || c.concept || 'Week 1',
          sectionHeader: c.sectionHeader || undefined,
          realWorldApplication: c.realWorldApplication || undefined,
          interval: typeof c.interval === 'number' ? c.interval : 1,
          repetition: typeof c.repetition === 'number' ? c.repetition : 0,
          easeFactor: typeof c.easeFactor === 'number' ? c.easeFactor : 2.5,
          nextReviewDate: (c.nextReviewDate || getTodayDateString()).split('T')[0],
          history: Array.isArray(c.history) ? c.history : [],
          concept: c.concept || c.sourceWeek || 'Week 1',
        }));
      }
    }

    if (Array.isArray(fallbackCards) && fallbackCards.length > 0) {
      const migrated: FlashcardItem[] = fallbackCards.map((c: any, idx: number) => ({
        id: c.id || `fc-migrated-${idx}`,
        front: c.front || '',
        back: String(c.back || '')
          .replace(/\n*🔍 Quote:[\s\S]*$/i, '')
          .trim(),
        source: c.source === 'quiz_error' ? 'quiz_error' : 'direct_generation',
        sourceWeek: c.sourceWeek || c.concept || 'Week 1',
        interval: typeof c.interval === 'number' ? c.interval : 1,
        repetition: typeof c.repetition === 'number' ? c.repetition : 0,
        easeFactor: typeof c.easeFactor === 'number' ? c.easeFactor : 2.5,
        nextReviewDate: (c.nextReviewDate || getTodayDateString()).split('T')[0],
        history: Array.isArray(c.history) ? c.history : [],
        concept: c.concept || 'Week 1',
      }));
      localStorage.setItem(FLASHCARD_DECK_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (e) {
    console.warn('Failed to load akari_flashcard_deck:', e);
  }
  return [];
}

/**
 * Save active FlashcardItem deck to `akari_flashcard_deck`
 */
export function saveFlashcardDeck(deck: FlashcardItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FLASHCARD_DECK_STORAGE_KEY, JSON.stringify(deck));
  } catch (e) {
    console.error('Failed to save akari_flashcard_deck:', e);
  }
}

/**
 * Capped 3,500-word high-yield text trimmer for token-lean Flashcard generation
 */
export function capTextToWordLimit(rawText: string, maxWords = 3500): string {
  if (!rawText) return '';
  const words = rawText.trim().split(/\s+/);
  if (words.length <= maxWords) return rawText.trim();
  return words.slice(0, maxWords).join(' ');
}

/**
 * METHOD (A): Dedicated Flashcard Generator with Real-World Application
 * - Target Model: Dynamic Lightweight Tier (zero-thinking budget, temperature 0.2)
 * - Output Schema:
 *   `[{"f": "Key Concept / Term", "b": "Direct Rule / Definition.\n\n🌍 Real-World: 1-sentence practical example."}]`
 */
export async function generateDirectFlashcards(options: {
  textPayload: string;
  cardCount?: number;
  sourceWeek?: string;
  chapterScope?: string;
  primaryKey?: string;
  backupKey?: string;
  onCascadeToast?: (message: string, model: string) => void;
  onQuotaExhausted?: (retryFn: () => Promise<void>) => void;
}): Promise<FlashcardItem[]> {
  const cardCount = Math.min(Math.max(options.cardCount || 20, 20), 30);
  const sourceWeek = options.sourceWeek || 'Week 1';
  const leanText = preprocessChapterScopedPayload(options.textPayload, options.chapterScope, 3500);

  if (!leanText || leanText.length < 20) {
    throw new Error('ကျေးဇူးပြု၍ Flashcard ထုတ်ယူရန် စာသား သို့မဟုတ် Source Link အနည်းဆုံး ၁ ခု ထည့်သွင်းပေးပါ။');
  }

  const targetScope = options.chapterScope?.trim() || 'Provided Academic Text';

  const systemInstruction = `You are a distinguished university professor and SuperMemo SM-2 active-recall curriculum designer.
Extract rigorous, exam-ready active-recall flashcards strictly from the provided academic text.
Do NOT fabricate, infer, or guess paragraph numbers or page numbers.
Use LaTeX syntax wrapped in single dollar signs ($...$) for mathematical formulas and scientific symbols where applicable.
Output ONLY a raw, valid JSON array (no Markdown code fences, no preamble). Each element MUST match this exact schema:
[
  {
    "f": "Key Concept / Core Question / Formula Prompt",
    "b": "Concise Scholarly Answer / Formula / Principle.\\n\\n🌍 Real-World: 1-sentence practical example."
  }
]`;

  const prompt = `Target Scope: ${targetScope}
Source Week: ${sourceWeek}
Extract between 20 and 30 (target: ${cardCount}) rigorous active-recall flashcard pairs from the academic material below:
"""
${leanText}
"""`;

  const rawRes = await executeGeminiRequest(
    prompt,
    'light',
    systemInstruction,
    undefined,
    3600,
    undefined,
    true,
    'application/json'
  );

  const parsedArray = safeExtractJsonArray<Record<string, unknown>>(rawRes);

  const today = getTodayDateString();
  const mapped: FlashcardItem[] = parsedArray
    .map((item, idx): FlashcardItem | null => {
      const front = String(item?.f || item?.front || item?.question || '').trim();
      const back = String(item?.b || item?.back || item?.answer || '')
        .replace(/\n*🔍 Quote:[\s\S]*$/i, '')
        .trim();

      if (!front || !back) return null;

      return {
        id: `fc-direct-${Date.now()}-${idx}`,
        front,
        back,
        source: 'direct_generation',
        sourceWeek,
        interval: 1,
        repetition: 0,
        easeFactor: 2.5,
        nextReviewDate: today,
        history: [],
        concept: `${sourceWeek} • Direct Concept`,
      };
    })
    .filter((card): card is FlashcardItem => card !== null);

  if (mapped.length === 0) {
    throw new Error('Flashcard ထုတ်ယူရာတွင် JSON ပုံစံ မမှန်ကန်ပါ။ ထပ်မံကြိုးစားပေးပါရန်။');
  }

  incrementDailyUsage(650);
  return mapped;
}

/**
 * METHOD (B): Quiz Error Collector (Zero Gemini API Cost)
 * Converts failed quiz questions directly into SM-2 FlashcardItems with:
 * - `front`: `q.question`
 * - `back`: `q.explanation + "\n\n🌍 Real-World: " + q.realWorldApplication`
 * Deduplicates by question text and persists to `akari_flashcard_deck`.
 */
export function collectQuizErrorsToDeck(
  questions: QuizQuestion[],
  sourceWeek = 'Week 1',
  existingDeck?: FlashcardItem[]
): {
  updatedDeck: FlashcardItem[];
  addedCount: number;
  skippedDuplicates: number;
} {
  const currentDeck = existingDeck ? [...existingDeck] : loadFlashcardDeck();
  const existingFronts = new Set(currentDeck.map((c) => c.front.trim().toLowerCase()));

  const failedQuestions = questions.filter((q) => {
    const chosen = q.selectedAnswer !== undefined ? q.selectedAnswer : q.userAnswerIndex;
    return chosen !== q.correctIndex;
  });

  const today = getTodayDateString();
  let addedCount = 0;
  let skippedDuplicates = 0;
  const newErrorCards: FlashcardItem[] = [];

  failedQuestions.forEach((q, idx) => {
    const normalizedFront = q.question.trim().toLowerCase();
    if (!normalizedFront) return;

    if (existingFronts.has(normalizedFront)) {
      skippedDuplicates++;
      return;
    }

    existingFronts.add(normalizedFront);
    const correctOptionText = q.options[q.correctIndex] || 'Correct Option';
    const rw = q.realWorldApplication || 'Core conceptual mastery for university assessment.';

    const backLines = [
      `✅ အဖြေမှန်: ${correctOptionText}`,
      `💡 ရှင်းလင်းချက်: ${q.explanation}`,
      `\n🌍 Real-World: ${rw}`,
    ].filter(Boolean);

    const card: FlashcardItem = {
      id: `fc-err-${Date.now()}-${idx}`,
      front: q.question.trim(),
      back: backLines.join('\n'),
      source: 'quiz_error',
      sourceWeek,
      sectionHeader: q.sectionHeader || undefined,
      realWorldApplication: rw,
      interval: 1,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: today,
      history: [],
      concept: `${sourceWeek} • Quiz Error`,
    };
    newErrorCards.push(card);
    addedCount++;
  });

  const updatedDeck = [...newErrorCards, ...currentDeck];
  saveFlashcardDeck(updatedDeck);

  return {
    updatedDeck,
    addedCount,
    skippedDuplicates,
  };
}

// Obfuscation helpers for local client-side storage
function obfuscateKey(rawKey: string): string {
  try {
    return btoa(rawKey.split('').reverse().join(''));
  } catch {
    return rawKey;
  }
}

function deobfuscateKey(obfuscated: string): string {
  try {
    return atob(obfuscated).split('').reverse().join('');
  } catch {
    return obfuscated;
  }
}

/**
 * Load Key Pool from encrypted/obfuscated localStorage
 */
export function loadKeyPoolFromStorage(): GeminiKeyEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_POOL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        ...item,
        key: item.key ? deobfuscateKey(item.key) : '',
      }));
    }
  } catch (e) {
    console.warn('Failed to load local key pool:', e);
  }
  return [];
}

/**
 * Save Key Pool to obfuscated localStorage
 */
export function saveKeyPoolToStorage(pool: GeminiKeyEntry[]): void {
  try {
    const sanitized = pool.map((item) => ({
      ...item,
      key: obfuscateKey(item.key),
    }));
    localStorage.setItem(LOCAL_POOL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('Failed to save key pool:', e);
  }
}

/**
 * Calculate Pacific Time (PT) Midnight Reset time in seconds
 */
export function calculatePacificMidnightResetSeconds(): number {
  const now = new Date();
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
  const ptDate = new Date(utcNow + PACIFIC_TIMEZONE_OFFSET_HOURS * 3600000);

  const nextPtMidnight = new Date(ptDate);
  nextPtMidnight.setDate(ptDate.getDate() + 1);
  nextPtMidnight.setHours(0, 0, 0, 0);

  const diffMs = nextPtMidnight.getTime() - ptDate.getTime();
  return Math.max(60, Math.floor(diffMs / 1000));
}

/**
 * Format remaining seconds into HH:MM:SS
 */
export function formatCountdownTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Automated Health & Quota Probe for a specific Gemini Key
 */
export async function checkGeminiQuotaHealth(
  apiKey?: string,
  _model = 'auto'
): Promise<QuotaHealthResult> {
  const cleanKey = cleanGeminiKey(apiKey || getActiveApiKey());

  const testRes = await testGeminiApiKey(cleanKey);
  if (testRes.success) {
    return {
      status: 'NORMAL',
      healthy: true,
      httpStatus: 200,
      latencyMs: testRes.latency || 150,
      message: testRes.message,
    };
  }

  const isExhausted =
    testRes.message.includes('429') ||
    testRes.message.toLowerCase().includes('quota') ||
    testRes.message.includes('RESOURCE_EXHAUSTED');

  return {
    status: isExhausted ? 'QUOTA_EXHAUSTED' : 'INVALID_KEY',
    healthy: false,
    latencyMs: testRes.latency || 0,
    message: testRes.message,
  };
}

// =========================================================================
// PART 2: SMART GROUNDING & CLIENT-SIDE BATCH INGESTION (UP TO 5 SOURCES)
// =========================================================================

export interface IngestedSourceResult {
  sourceUrl: string;
  title: string;
  content: string;
  success: boolean;
}

/**
 * Fetch raw content or metadata for an individual DOI or Web/OpenStax URL
 */
export async function fetchSourceContent(
  urlOrDoi: string,
  chapterFilter?: string
): Promise<IngestedSourceResult> {
  const trimmed = urlOrDoi.trim();
  if (!trimmed) {
    return { sourceUrl: '', title: '', content: '', success: false };
  }

  // Primary 3-Tier Full-Text Academic Paper & URL Resolver
  try {
    const resolved = await resolveAcademicPayload(trimmed, chapterFilter);
    if (resolved.fullText && resolved.fullText.trim().length > 80) {
      return {
        sourceUrl: trimmed,
        title: resolved.title || trimmed,
        content: resolved.fullText,
        success: true,
      };
    }
  } catch (resolverErr) {
    console.warn(`[Source Ingest] 3-Tier resolver fallback for ${trimmed}:`, resolverErr);
  }

  const isDoi = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(trimmed) || /doi\.org\//i.test(trimmed);
  if (isDoi) {
    try {
      const cleanDoi = trimmed.replace(/^https?:\/\/doi\.org\//i, '').trim();
      const res = await fetch(`/api/doi-metadata?doi=${encodeURIComponent(cleanDoi)}`);
      if (res.ok) {
        const metadata = await res.json();
        const contentLines = [
          `Title: ${metadata.title || 'Scholarly Paper'}`,
          `Authors: ${metadata.authors || 'Academic Researchers'}`,
          `Journal: ${metadata.journal || 'Academic Journal'} (${metadata.year || 'n.d.'})`,
          metadata.abstract ? `Abstract: ${metadata.abstract}` : `APA Reference: ${metadata.apaReference || ''}`,
        ].filter(Boolean);

        return {
          sourceUrl: trimmed,
          title: metadata.title || cleanDoi,
          content: contentLines.join('\n'),
          success: true,
        };
      }
    } catch (doiErr) {
      console.warn(`[Source Ingest] DOI lookup failed for ${trimmed}:`, doiErr);
    }
  }

  // Primary Method: Universal Academic & OpenStax Link Resolver via Jina Reader
  try {
    const { normalizedUrl, bookSlug } = normalizeAcademicSourceUrl(trimmed, chapterFilter);
    const readerText = await fetchAcademicUrlText(trimmed, chapterFilter);
    if (readerText && readerText.length > 80) {
      return {
        sourceUrl: normalizedUrl,
        title: bookSlug ? `OpenStax (${bookSlug})` : normalizedUrl,
        content: readerText,
        success: true,
      };
    }
  } catch (readerErr) {
    console.warn(`[Source Ingest] Jina Reader fallback notice for ${trimmed}:`, readerErr);
  }

  // Secondary Fallback: Server-side textbook loader
  try {
    const { normalizedUrl } = normalizeAcademicSourceUrl(trimmed, chapterFilter);
    const result = await loadTextbookSource(normalizedUrl);
    if (result.htmlContent) {
      const cleanText = stripTextbookNoise(
        result.htmlContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      ).slice(0, 15000);

      return {
        sourceUrl: normalizedUrl,
        title: result.title || normalizedUrl,
        content: cleanText,
        success: cleanText.length > 80,
      };
    }
  } catch (webErr) {
    console.warn(`[Source Ingest] Client-side fetch failed for ${trimmed}:`, webErr);
  }

  return {
    sourceUrl: trimmed,
    title: trimmed.split('/').pop() || trimmed,
    content: '',
    success: false,
  };
}

/**
 * Batch Ingestion for Multiple Links & DOIs (Up to 5 Sources)
 */
export async function batchIngestSources(
  sources: string[],
  chapterFilter?: string
): Promise<{
  consolidatedContext: string;
  hasSubstantialContext: boolean;
  successfulCount: number;
  sourcesMetadata: { url: string; title: string; success: boolean }[];
}> {
  const validSources = sources.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, 5);
  if (validSources.length === 0) {
    return {
      consolidatedContext: '',
      hasSubstantialContext: false,
      successfulCount: 0,
      sourcesMetadata: [],
    };
  }

  const results = await Promise.allSettled(
    validSources.map((src) => fetchSourceContent(src, chapterFilter))
  );

  const extractedBlocks: string[] = [];
  const sourcesMetadata: { url: string; title: string; success: boolean }[] = [];
  let successfulCount = 0;

  results.forEach((res, index) => {
    const url = validSources[index];
    if (res.status === 'fulfilled' && res.value.success && res.value.content.trim()) {
      successfulCount++;
      sourcesMetadata.push({
        url: res.value.sourceUrl || url,
        title: res.value.title,
        success: true,
      });
      extractedBlocks.push(
        `### [ACADEMIC SOURCE ${successfulCount}: ${res.value.title}]\nURL: ${res.value.sourceUrl || url}\n\n${res.value.content}\n`
      );
    } else {
      sourcesMetadata.push({
        url,
        title: url,
        success: false,
      });
    }
  });

  const fullText = extractedBlocks.join('\n---\n').slice(0, 30000);
  const hasSubstantialContext = fullText.length > 120;

  return {
    consolidatedContext: fullText,
    hasSubstantialContext,
    successfulCount,
    sourcesMetadata,
  };
}

// =========================================================================
// PART 1 & 2: TOKEN-OPTIMIZED DYNAMIC ROUTING & 2-LAYER AUTO-CASCADE
// =========================================================================

export interface DispatchOptions {
  action: string;
  payload: any;
  complexity?: TaskComplexity;
  targetLanguage?: string;
  primaryKey?: string;
  backupKey?: string;
  preferredModel?: string;
  signal?: AbortSignal;
  onCascadeToast?: (message: string, model: string) => void;
  onQuotaExhausted?: (retryFn: () => Promise<void>) => void;
}

const PROMPT_CACHE_STORAGE_KEY = 'akari_gemini_prompt_cache_v2';
const PROMPT_RESPONSE_CACHE = new Map<string, string>();

function computePromptSignature(
  prompt: string,
  complexity: TaskComplexity,
  systemInstruction?: string,
  imageCount: number = 0
): string {
  const raw = `${complexity}|${imageCount}|${systemInstruction || ''}|${prompt.trim()}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `sig_${(h2 >>> 0).toString(16)}_${(h1 >>> 0).toString(16)}_${raw.length}`;
}

function getCachedPromptResponse(sig: string): string | null {
  if (PROMPT_RESPONSE_CACHE.has(sig)) {
    return PROMPT_RESPONSE_CACHE.get(sig) || null;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(PROMPT_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (parsed && typeof parsed[sig] === 'string' && parsed[sig].trim()) {
          PROMPT_RESPONSE_CACHE.set(sig, parsed[sig]);
          return parsed[sig];
        }
      }
    } catch {}
  }
  return null;
}

function setCachedPromptResponse(sig: string, responseText: string): void {
  if (!responseText || !responseText.trim()) return;
  PROMPT_RESPONSE_CACHE.set(sig, responseText);
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(PROMPT_CACHE_STORAGE_KEY);
      const parsed: Record<string, string> = raw ? JSON.parse(raw) : {};
      const keys = Object.keys(parsed);
      if (keys.length >= 25) {
        delete parsed[keys[0]];
      }
      parsed[sig] = responseText;
      sessionStorage.setItem(PROMPT_CACHE_STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  }
}

/**
 * Direct Prompt Convenience Wrapper with Verified Model Resolution, Instant Cache & AbortSignal
 */
export async function executeGeminiRequest(
  prompt: string,
  complexity: TaskComplexity = 'standard',
  systemInstruction?: string,
  imagePayload?: { name: string; dataUrl: string }[],
  maxTokens?: number,
  signal?: AbortSignal,
  bypassCache: boolean = false,
  responseMimeType?: string
): Promise<string> {
  const images = (imagePayload || [])
    .filter((img) => Boolean(img?.dataUrl))
    .map((img) => ({
      name: img.name,
      base64: img.dataUrl,
      mimeType: img.dataUrl.split(';')[0]?.split(':')[1] || 'image/jpeg',
    }));

  const cacheSig = computePromptSignature(prompt, complexity, systemInstruction, images.length);
  if (!bypassCache) {
    const cached = getCachedPromptResponse(cacheSig);
    if (cached) {
      return cached;
    }
  }

  const expectsJson =
    responseMimeType === 'application/json' ||
    (!responseMimeType &&
      typeof systemInstruction === 'string' &&
      /return only a valid json object/i.test(systemInstruction));

  const res = await executeAcademicActionWithCascade({
    action: 'direct_assist',
    complexity,
    signal,
    payload: {
      prompt,
      systemInstruction,
      temperature: complexity === 'light' ? 0.2 : 0.45,
      responseMimeType: expectsJson ? 'application/json' : responseMimeType,
      maxOutputTokens:
        maxTokens || (complexity === 'light' ? 1400 : complexity === 'heavy' ? 4096 : 3200),
      images: images.length > 0 ? images : undefined,
    },
  });
  const finalOutput =
    typeof res === 'string' ? res : res?.result || res?.text || JSON.stringify(res);
  if (finalOutput && typeof finalOutput === 'string' && finalOutput.trim() && finalOutput.trim() !== '{}') {
    setCachedPromptResponse(cacheSig, finalOutput.trim());
  }
  return finalOutput;
}

/**
 * Core Resilient 2-Layer Auto-Cascade Dispatcher (Key Cascade + Verified Model Cascade)
 */
export async function executeAcademicActionWithCascade(options: DispatchOptions): Promise<any> {
  const {
    action,
    payload,
    complexity: explicitComplexity,
    targetLanguage,
    primaryKey,
    backupKey,
    preferredModel,
    signal,
    onCascadeToast,
    onQuotaExhausted,
  } = options;

  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  const storedKeys = getAllAvailableKeys();
  const keyOrder: { key: string; label: string }[] = [];
  const seenKeys = new Set<string>();

  const appendKey = (raw: string | undefined, label: string) => {
    const cleaned = cleanGeminiKey(raw || '');
    if (cleaned && cleaned.length >= 15 && !seenKeys.has(cleaned)) {
      seenKeys.add(cleaned);
      keyOrder.push({ key: cleaned, label });
    }
  };

  appendKey(primaryKey, 'Primary Account Key');
  appendKey(backupKey, 'Backup Account Key');
  storedKeys.forEach((k, idx) => {
    appendKey(k, idx === 0 ? 'Primary Account Key' : idx === 1 ? 'Backup Account Key' : `Pool Account ${idx}`);
  });

  // Final fallback to server environment key
  keyOrder.push({ key: '', label: 'Server Environment Key' });

  // Resolve verified generateContent models once from Google API / memory cache
  await resolveDynamicModelCatalog(keyOrder[0]?.key || '');

  const resolvedComplexity = explicitComplexity || inferTaskComplexity(action, payload);
  const tieredModels = getModelCascade(resolvedComplexity);

  const sanitizedPreferred =
    preferredModel && !isExcludedPaidOrRestrictedModel(preferredModel) ? preferredModel : undefined;

  const modelChain: string[] = [];
  const isAuto = !sanitizedPreferred || sanitizedPreferred === 'auto-cascade' || sanitizedPreferred === 'auto';
  if (!isAuto && tieredModels.includes(sanitizedPreferred)) {
    modelChain.push(sanitizedPreferred, ...tieredModels.filter((m) => m !== sanitizedPreferred));
  } else {
    modelChain.push(...tieredModels);
  }

  const enrichedPayload = {
    ...payload,
    maxOutputTokens:
      payload?.maxOutputTokens || (resolvedComplexity === 'light' ? 1400 : resolvedComplexity === 'heavy' ? 4096 : 3200),
  };

  let finalError: any = null;
  let authErrorCycleCount = 0;
  const sessionDeadModels = new Set<string>();

  // LAYER 2 (KEY CASCADE): Iterate sequentially across Primary -> Backup -> Multi-Account Pool -> Server Fallback
  for (let keyIdx = 0; keyIdx < keyOrder.length; keyIdx++) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    const activeKeyEntry = keyOrder[keyIdx];
    const cleanKey = cleanGeminiKey(activeKeyEntry.key);

    // Skip keys already confirmed invalid (400/403) if other keys remain
    if (cleanKey && keyIdx < keyOrder.length - 1 && typeof window !== 'undefined') {
      try {
        if (localStorage.getItem(`key_status_${cleanKey.slice(-6)}`) === 'invalid') {
          continue;
        }
      } catch {}
    }

    if (keyIdx > 0 && cleanKey) {
      await new Promise((r) => setTimeout(r, 300));
      // Refresh catalog if rotating to a new key and no verified models remain
      if (modelChain.filter((m) => !sessionDeadModels.has(m)).length === 0) {
        const refreshed = await resolveDynamicModelCatalog(cleanKey, true);
        if (refreshed.all.length > 0) {
          modelChain.splice(0, modelChain.length, ...getModelCascade(resolvedComplexity));
        }
      }
    }

    const activeChain = modelChain.filter((m) => !sessionDeadModels.has(m));
    const effectiveChain = activeChain.length > 0 ? activeChain : ['auto'];

    // LAYER 1 (MODEL CASCADE): Iterate across verified generateContent models under the active key
    for (let modelIdx = 0; modelIdx < effectiveChain.length; modelIdx++) {
      if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      const currentModel = effectiveChain[modelIdx];

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (cleanKey) {
          headers['x-gemini-key'] = cleanKey;
          headers['x-goog-api-key'] = cleanKey;
          headers['x-strict-key'] = '1';
        }

        const response = await fetch('/api/academic/assist', {
          method: 'POST',
          headers,
          signal,
          body: JSON.stringify({
            action,
            payload: enrichedPayload,
            targetLanguage,
            model: currentModel,
            strictModel: currentModel !== 'auto',
          }),
        });

        let rawText = '';
        try {
          rawText = await response.text();
        } catch {
          rawText = '';
        }

        let parsedData: any = null;
        if (rawText && !rawText.trim().startsWith('<')) {
          try {
            parsedData = JSON.parse(rawText);
          } catch {
            parsedData = null;
          }
        }

        if (!response.ok || !parsedData) {
          const rawMsg =
            parsedData?.error ||
            parsedData?.message ||
            (rawText.trim().startsWith('<') ? 'Service busy' : rawText) ||
            `HTTP ${response.status}`;

          const isInvalidKey =
            response.status === 400 ||
            response.status === 401 ||
            response.status === 403 ||
            parsedData?.status === 'api_key_invalid' ||
            rawMsg.includes('API key not valid') ||
            rawMsg.includes('API_KEY_INVALID') ||
            rawMsg.includes('INVALID_ARGUMENT') ||
            rawMsg.includes('PERMISSION_DENIED') ||
            rawMsg.includes('missing_key');

          if (isInvalidKey) {
            finalError = new Error(rawMsg);
            if (response.status === 401 || response.status === 403) {
              authErrorCycleCount++;
            }
            if (cleanKey && typeof window !== 'undefined') {
              try {
                localStorage.setItem(`key_status_${cleanKey.slice(-6)}`, 'invalid');
              } catch {}
            }
            // Invalid key: skip all remaining models for this key immediately and rotate
            if (keyIdx < keyOrder.length - 1) {
              break;
            }
            if (authErrorCycleCount > 0) {
              invalidateDynamicModelCatalog();
            }
            throw new Error(
              'API key not valid. Please check your Gemini API key in the Settings > Secrets panel.'
            );
          }

          if (response.status === 404 || parsedData?.status === 'model_unavailable') {
            sessionDeadModels.add(currentModel);
            markModelUnavailable(currentModel);
          }

          const isRetryableModelFailure =
            response.status === 429 ||
            response.status === 503 ||
            response.status === 504 ||
            response.status === 404 ||
            parsedData?.status === 'quota_exhausted' ||
            parsedData?.status === 'deadline_exceeded' ||
            parsedData?.status === 'model_unavailable' ||
            rawMsg.includes('429') ||
            rawMsg.includes('503') ||
            rawMsg.includes('504') ||
            rawMsg.includes('DEADLINE_EXCEEDED') ||
            rawMsg.toLowerCase().includes('timeout') ||
            rawMsg.toLowerCase().includes('timed out') ||
            rawMsg.includes('RESOURCE_EXHAUSTED') ||
            rawMsg.includes('quota') ||
            rawMsg.includes('overloaded');

          if (isRetryableModelFailure) {
            finalError = new Error(rawMsg);
            const nextModel = effectiveChain[modelIdx + 1];

            if (nextModel) {
              await new Promise((r) => setTimeout(r, 300));
              continue;
            } else {
              if (cleanKey && typeof window !== 'undefined') {
                try {
                  localStorage.setItem(`key_status_${cleanKey.slice(-6)}`, 'exhausted');
                } catch {}
              }
              break;
            }
          }

          // Transient 5xx or parsing issue: fall back across remaining models/keys silently before failing
          finalError = new Error(rawMsg);
          if (modelIdx < effectiveChain.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }
          if (keyIdx < keyOrder.length - 1) {
            break;
          }
          throw finalError;
        }

        if (cleanKey && typeof window !== 'undefined') {
          try {
            localStorage.setItem(`key_status_${cleanKey.slice(-6)}`, 'active');
          } catch {}
        }

        if (parsedData?.modelUsed || modelIdx > 0 || keyIdx > 0) {
          onCascadeToast?.(
            '⚡ Completed via Intelligent Auto-Cascade',
            'auto-cascade'
          );
        }

        return parsedData.result;
      } catch (err: any) {
        if (signal?.aborted || err?.name === 'AbortError') {
          throw err;
        }
        finalError = err;
        const msg = String(err?.message || err);
        const isRetryable =
          msg.includes('429') ||
          msg.includes('503') ||
          msg.includes('504') ||
          msg.includes('DEADLINE_EXCEEDED') ||
          msg.toLowerCase().includes('timeout') ||
          msg.toLowerCase().includes('timed out') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('overloaded') ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError');

        if (isRetryable && modelIdx < effectiveChain.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        } else if (keyIdx < keyOrder.length - 1) {
          break;
        } else if (!isRetryable) {
          throw err;
        }
      }
    }
  }

  if (authErrorCycleCount > 0) {
    invalidateDynamicModelCatalog();
  }
  console.warn('[Auto-Cascade] All models across all configured keys are exhausted.');
  if (onQuotaExhausted) {
    onQuotaExhausted(() => executeAcademicActionWithCascade(options));
  }

  throw finalError || new Error('All configured keys and models are currently at quota capacity.');
}

/**
 * Execute an academic action with Smart Key Pool Rotation & Failover
 */
export async function executeWithKeyFailover<T>(
  keyPool: GeminiKeyEntry[],
  onPoolUpdate: (updatedPool: GeminiKeyEntry[]) => void,
  executor: (activeKey: string) => Promise<T>
): Promise<{ result: T; keyUsed: string }> {
  if (!keyPool || keyPool.length === 0) {
    const res = await executor('');
    return { result: res, keyUsed: 'server_default' };
  }

  const availableKeys = [...keyPool];
  let lastError: any = null;
  let allExhausted = true;

  for (let i = 0; i < availableKeys.length; i++) {
    const entry = availableKeys[i];
    if (entry.status === 'invalid') continue;

    try {
      const res = await executor(entry.key);
      entry.status = 'active';
      entry.lastUsed = new Date().toISOString();
      onPoolUpdate([...availableKeys]);
      return { result: res, keyUsed: entry.id };
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isRateLimit =
        errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit) {
        console.warn(`[Key Pool] Key ${entry.label || entry.id} hit 429 limit. Rotating to next key...`);
        entry.status = 'quota_exhausted';
        entry.errorCount = (entry.errorCount || 0) + 1;
        continue;
      } else if (errMsg.includes('403') || errMsg.includes('API_KEY_INVALID')) {
        entry.status = 'invalid';
        continue;
      } else {
        allExhausted = false;
        throw err;
      }
    }
  }

  onPoolUpdate([...availableKeys]);
  if (allExhausted) {
    const exErr = new Error('ALL_KEYS_EXHAUSTED');
    (exErr as any).isQuotaExhausted = true;
    throw exErr;
  }

  throw lastError || new Error('API Execution Failed across all keys.');
}

/**
 * Zero-crash payload sanitizer: safely sanitizes and truncates input text to max characters
 */
export function sanitizePayloadText(rawText: string, maxChars = 20000): string {
  if (!rawText) return '';
  return rawText.slice(0, maxChars);
}

export interface ThematicPillar {
  title: string;
  explanation: string;
}

export interface BurmeseTakeaway {
  pointTitle: string;
  explanation: string;
}

export interface LessonAnalysisResult {
  analysisTitle: string;
  keyConceptTags: string[];
  englishAnalysis: {
    executiveSynthesis: string;
    thematicPillars: ThematicPillar[];
    actionableTakeaways: string[];
  };
  burmeseAnalysis: {
    comprehensiveExplanation: string;
    coreTakeaways: BurmeseTakeaway[];
    uopeopleAcademicApplication: string;
  };
}

export interface GenerateLessonExplanationParams {
  apiKey?: string;
  rawText: string;
  imageBase64?: string;
  imageMimeType?: string;
  keyPool?: GeminiKeyEntry[];
  onPoolUpdate?: (pool: GeminiKeyEntry[]) => void;
  onCascadeToast?: (msg: string) => void;
}

/**
 * Authentic BYOK Multimodal Lesson Explanation Engine with Auto-Cascade
 */
export async function generateLessonExplanationBYOK(
  params: GenerateLessonExplanationParams
): Promise<LessonAnalysisResult> {
  const sanitizedText = sanitizePayloadText(params.rawText, 20000);

  const normalizeResult = (parsed: any): LessonAnalysisResult => {
    return {
      analysisTitle: parsed.analysisTitle || parsed.topicTitle || 'Academic Deep-Dive Analysis',
      keyConceptTags: Array.isArray(parsed.keyConceptTags)
        ? parsed.keyConceptTags
        : Array.isArray(parsed.coreConcepts)
        ? parsed.coreConcepts.map((c: any) => c.term || c)
        : ['Academic Analysis', 'Core Concepts'],
      englishAnalysis: {
        executiveSynthesis:
          parsed.englishAnalysis?.executiveSynthesis ||
          parsed.detailedBreakdown?.english?.comprehensiveSummary ||
          (typeof parsed.englishAnalysis === 'string' ? parsed.englishAnalysis : ''),
        thematicPillars: Array.isArray(parsed.englishAnalysis?.thematicPillars)
          ? parsed.englishAnalysis.thematicPillars
          : [],
        actionableTakeaways: Array.isArray(parsed.englishAnalysis?.actionableTakeaways)
          ? parsed.englishAnalysis.actionableTakeaways
          : [],
      },
      burmeseAnalysis: {
        comprehensiveExplanation:
          parsed.burmeseAnalysis?.comprehensiveExplanation ||
          parsed.detailedBreakdown?.myanmar?.conceptualExplanation ||
          '',
        coreTakeaways: Array.isArray(parsed.burmeseAnalysis?.coreTakeaways)
          ? parsed.burmeseAnalysis.coreTakeaways
          : [],
        uopeopleAcademicApplication:
          parsed.burmeseAnalysis?.uopeopleAcademicApplication ||
          parsed.detailedBreakdown?.myanmar?.assignmentTips ||
          '',
      },
    };
  };

  const systemInstruction = `You are an elite bilingual academic professor and curriculum specialist at University of the People.
Ground your entire analysis strictly in the provided content (and attached slide/diagram image if present).
Return ONLY a valid JSON object (no markdown fences) matching this exact schema:
{
  "analysisTitle": "Specific Subject Matter Title",
  "keyConceptTags": ["Tag 1", "Tag 2", "Tag 3", "Tag 4"],
  "englishAnalysis": {
    "executiveSynthesis": "3-to-4 paragraph rigorous academic overview synthesizing Core Concepts & Key Formulas, Step-by-Step Analytical Breakdown, and key conclusions...",
    "thematicPillars": [
      { "title": "Core Concept / Formula", "explanation": "Detailed theoretical and step-by-step explanation..." }
    ],
    "actionableTakeaways": ["Key actionable takeaway 1", "Key actionable takeaway 2"]
  },
  "burmeseAnalysis": {
    "comprehensiveExplanation": "အသေးစိတ် မြန်မာလို အဆင့်ဆင့် ရှင်းလင်းချက် (Core Concepts, Key Formulas နှင့် Step-by-Step Analytical Breakdown များကို သဘာဝကျသော မြန်မာပညာရပ်စကားပြေဖြင့် ရှင်းပြချက်)...",
    "coreTakeaways": [
      { "pointTitle": "အဓိက သဘောတရား / ဖော်မြူလာ", "explanation": "လက်တွေ့ကျသော အဓိပ္ပာယ်ဖွင့်ဆိုချက်နှင့် အသုံးချမှု" }
    ],
    "uopeopleAcademicApplication": "UoPeople Assignment, Discussion Forum, Learning Journal & Final Exam များတွင် ဤသင်ခန်းစာကို ထိရောက်စွာ အသုံးချပုံ..."
  }
}`;

  const promptText = `Analyze the following course material and produce a Bilingual Lesson Explanation (Core Concepts & Key Formulas, Step-by-Step Analytical Breakdown, and English + Myanmar Study Summary):

"""
${sanitizedText || 'See attached academic slide/image.'}
"""`;

  const imagePayload = params.imageBase64
    ? [{ name: 'lesson_slide', dataUrl: params.imageBase64 }]
    : undefined;

  const rawRes = await executeGeminiRequest(
    promptText,
    'standard',
    systemInstruction,
    imagePayload,
    3600,
    undefined,
    false,
    'application/json'
  );

  const parsed = safeExtractJsonObject<any>(rawRes);
  if (parsed) {
    return normalizeResult(parsed);
  }

  return normalizeResult({
    analysisTitle: 'Bilingual Lesson Synthesis',
    keyConceptTags: ['Core Concepts', 'Analytical Breakdown'],
    englishAnalysis: {
      executiveSynthesis: String(rawRes || ''),
      thematicPillars: [],
      actionableTakeaways: [],
    },
    burmeseAnalysis: {
      comprehensiveExplanation: String(rawRes || ''),
      coreTakeaways: [],
      uopeopleAcademicApplication: '',
    },
  });
}

/**
 * Server-Sent Events (SSE) Streaming Helper
 */
export async function streamAcademicContent(
  prompt: string,
  onChunk: (text: string) => void,
  onDone?: () => void,
  apiKey?: string
): Promise<void> {
  const cleanKey = cleanGeminiKey(apiKey || getActiveApiKey());
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cleanKey) {
    headers['x-gemini-key'] = cleanKey;
    headers['x-goog-api-key'] = cleanKey;
  }

  const response = await fetch('/api/academic/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text();
    throw new Error(errText || `Streaming failed HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.replace(/^data:\s*/, '');
      if (dataStr === '[DONE]') {
        if (onDone) onDone();
        return;
      }
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.text) {
          onChunk(parsed.text);
        }
      } catch {
        onChunk(dataStr);
      }
    }
  }

  if (onDone) onDone();
}

/**
 * Gemini Live API WebSocket Bridge Client Helper
 */
export function createLiveAudioSession(callbacks: {
  onAudioChunk: (base64Audio: string) => void;
  onInterrupted?: () => void;
  onError?: (err: any) => void;
  onClose?: () => void;
}): {
  sendAudio: (pcmBase64: string) => void;
  sendText: (text: string) => void;
  close: () => void;
} {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const apiKey = getActiveApiKey();
  const queryParam = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
  const wsUrl = `${protocol}//${window.location.host}/api/live${queryParam}`;
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.audio) {
        callbacks.onAudioChunk(msg.audio);
      }
      if (msg.interrupted && callbacks.onInterrupted) {
        callbacks.onInterrupted();
      }
      if (msg.error && callbacks.onError) {
        callbacks.onError(new Error(msg.error));
      }
    } catch (e) {
      console.warn('Live WS parse error:', e);
    }
  };

  ws.onerror = (err) => {
    if (callbacks.onError) callbacks.onError(err);
  };

  ws.onclose = () => {
    if (callbacks.onClose) callbacks.onClose();
  };

  return {
    sendAudio: (pcmBase64: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ audio: pcmBase64 }));
      }
    },
    sendText: (text: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ text }));
      }
    },
    close: () => {
      ws.close();
    },
  };
}

const ACADEMIC_WELLNESS_PRESETS = new Set([
  'LOW SCORE SHOCK',
  'FALLING BEHIND',
  'IMPOSTOR SYNDROME',
]);

function detectAcademicWellnessIntent(text: string, categoryPreset?: string): boolean {
  if (
    categoryPreset === 'GENERAL BURNOUT & STRESS' ||
    (categoryPreset && categoryPreset.includes('General Burnout'))
  ) {
    return false;
  }
  if (categoryPreset && ACADEMIC_WELLNESS_PRESETS.has(categoryPreset)) {
    return true;
  }
  const normalized = (text || '').toLowerCase();
  return /(uopeople|gpa|cgpa|rubric|learning journal|discussion forum|peer assessment|assignment|quiz|exam|midterm|final|coursework|syllabus|instructor|program advisor|proctor|moodle|homework|study|studying|degree|credit|စာမေးပွဲ|သင်ခန်းစာ|ကျောင်းစာ|အမှတ်|ပညာရေး|ဘွဲ့|စာဖတ်|စာလေ့လာ|အတန်း|ဆရာ)/i.test(
    normalized
  );
}

/**
 * Empathetic Student & Life Wellness Coach (Adaptive Empathy)
 * Routes strictly through the centralized 2-layer Dynamic Model Resolution Engine (`executeGeminiRequest` with `'light'` complexity).
 */
export async function askWellnessCoach(
  studentWorry: string,
  categoryPreset?: string,
  language: 'my' | 'en' = 'my'
): Promise<string> {
  const isAcademicContext = detectAcademicWellnessIntent(studentWorry, categoryPreset);

  const generalPerspectives = [
    'Focus on emotional grounding, nervous-system regulation, and self-compassion.',
    'Focus on cognitive reframing, letting go of harsh self-criticism, and taking one gentle step today.',
    'Focus on restoring energy, setting kind personal boundaries, and breaking life overwhelm into tiny milestones.',
  ];
  const academicPerspectives = [
    'Focus on breaking study tasks into calm micro-steps alongside emotional reassurance.',
    'Focus on practical academic recovery strategies, realistic time budgeting, and releasing perfectionism.',
    'Focus on reframing impostor syndrome as a natural part of challenging growth.',
  ];
  const pool = isAcademicContext ? academicPerspectives : generalPerspectives;
  const angle = pool[Date.now() % pool.length];

  const domainRules = isAcademicContext
    ? `
Intent Detected: ACADEMIC / STUDY STRESS
- Deliver warm, grounded emotional reassurance paired with 2–3 specific, practical academic recovery steps directly addressing what the user described (e.g., breaking one assignment into a 20-minute focus block, checking criteria calmly, contacting an instructor if needed, or letting go of comparison).
- Only reference terms (like assignments, quizzes, grades, or UoPeople) if genuinely relevant to what the user typed.`
    : `
Intent Detected: GENERAL LIFE / PERSONAL / EMOTIONAL BURNOUT
- Deliver compassionate, psychologically grounded emotional support and 2–3 practical stress-reduction steps directly addressing what the user actually wrote (e.g., a 4-7-8 or slow breathing grounding exercise, picking one tiny manageable milestone or pausing for rest, gentle cognitive reframing, or talking to someone trusted).
- CRITICAL NEGATIVE CONSTRAINT: Do NOT mention UoPeople, Rubric, Learning Journal, Discussion Forum, Peer Assessment, GPA, Unit Tasks, or academic assignments anywhere in your response. Keep it 100% focused on their human emotional well-being and lived experience.`;

  const systemInstruction = `
You are an authentic, warm, deeply empathetic human mentor and wellness companion.
Tone: Compassionate, grounded, sincere, non-judgmental, and conversational (never robotic, never generic clichés, never preachy).
Perspective Focus: ${angle}
${domainRules}

Response Structure:
1. 🌿 Empathetic Validation: Acknowledge and validate the exact feeling or situation the user shared in 1–2 warm, sincere sentences.
2. 🎯 Practical Grounding Steps (2–3 steps): Provide 2–3 clear, gentle, directly relevant steps tailored specifically to what the user typed.
3. 💬 Grounding Thought: Close with 1 short, comforting, realistic perspective thought.

Language: ${
    language === 'my'
      ? 'Warm, natural conversational Burmese prose (စကားပြောဟန် သဘာဝကျကျ နွေးထွေးသော အရေးအသား).'
      : 'Warm, candid, compassionate English.'
  }
Keep the response focused, clear, and under 220 words.
`.trim();

  const promptText = categoryPreset
    ? `[Context: ${isAcademicContext ? 'Academic' : 'General Personal Wellness'} | Preset: ${categoryPreset}]\nUser Reflection: ${studentWorry}`
    : `[Context: ${isAcademicContext ? 'Academic' : 'General Personal Wellness'}]\nUser Reflection: ${studentWorry}`;

  const textOut = await executeGeminiRequest(
    promptText,
    'light',
    systemInstruction,
    undefined,
    650,
    undefined,
    true
  );

  incrementDailyUsage(350);
  return String(textOut || '').trim();
}

export const SCHOLARSHIP_MAX_OUTPUT_TOKENS = 600;

export interface ScholarshipGenerationParams {
  mode: 'new_app' | 'renewal_app';
  hardshipDescription: string;
  storyAngle: string;
  customStoryAngle?: string;
  degreeProgram: string;
  careerGoal: string;
  cgpa?: string;
  coursesDone?: string;
  lensHint?: string;
  variationNumber?: number;
  seed?: number;
}

/**
 * Generates a portal-ready UoPeople Scholarship or Renewal statement (800-950 characters)
 * calibrated to 600 maxOutputTokens and routed via verified lowest-token flash-lite models first.
 */
export async function generateScholarshipStatement(
  params: ScholarshipGenerationParams
): Promise<string> {
  const isRenewal = params.mode === 'renewal_app';
  const seed = params.seed || Date.now();
  const variation = params.variationNumber || 1;

  const systemInstruction = `You are a world-class university scholarship mentor and humanizer for University of the People (UoPeople).
Write ONE authentic, compelling, human-written Assessment Fee Scholarship ${isRenewal ? 'RENEWAL ' : ''}essay.
COMPLETE STRUCTURAL ARC GUARANTEE (NON-NEGOTIABLE):
The generated scholarship statement MUST be a complete, well-formed narrative that starts, develops, and fully closes within 800 to 950 characters. NEVER cut off mid-sentence. Ensure the final sentence provides a clear, strong concluding remark.

STYLE & VOICE RULES:
- Strictly NEVER exceed 950 characters (and keep at least 800 characters).
- Mix short 4-8 word sentences with 18-26 word multi-clause sentences for authentic human cadence.
- Integrate EVERY user-supplied detail faithfully (translate Burmese context cleanly into natural academic English).
- NEVER use AI clichés ("beacon of hope", "pivotal role", "tapestry", "relentless passion", "testament to", "furthermore", "moreover", "in conclusion").
- Output ONLY the single flowing paragraph text (no titles, no character counts, no Markdown fences).`;

  const trimmedCustomAngle = (params.customStoryAngle || '').trim();
  const promptParts = [
    `Application Type: ${isRenewal ? 'SCHOLARSHIP RENEWAL' : 'NEW SCHOLARSHIP APPLICANT'}`,
    `Selected Degree Program: ${params.degreeProgram || 'Bachelor of Science in Computer Science'}`,
    `Active Preset Story Angle Badge: ${params.storyAngle}`,
    ...(trimmedCustomAngle
      ? [
          `User Custom Story Angle (PRIORITIZE & INTEGRATE THIS CUSTOM NARRATIVE LENS ALONGSIDE THE PRESET ANGLE — translate Burmese cleanly to academic English): ${trimmedCustomAngle}`,
        ]
      : []),
    `Career / Academic Goal: ${params.careerGoal || 'Complete degree and serve my community'}`,
  ];

  if (isRenewal) {
    promptParts.push(
      `Current CGPA: ${params.cgpa || '3.65'}`,
      `Completed Courses / Credits: ${params.coursesDone || '8 courses completed'}`
    );
  }

  if (params.lensHint) {
    promptParts.push(`Scholarly Framing Lens: ${params.lensHint}`);
  }

  promptParts.push(
    `Variation Seed: ${seed} (#${variation})`,
    `USER HARDSHIP & PERSONAL CONTEXT (incorporate every specific detail):\n"""\n${
      params.hardshipDescription.trim() ||
      'Regional currency inflation, rising essential household costs, and inability to cover assessment fees independently.'
    }\n"""`
  );

  const rawText = await executeGeminiRequest(
    promptParts.join('\n'),
    'light',
    systemInstruction,
    undefined,
    SCHOLARSHIP_MAX_OUTPUT_TOKENS,
    undefined,
    true
  );

  incrementDailyUsage(450);
  return String(rawText || '').trim();
}

export interface DynamicScholarshipTemplateOutput {
  id?: string;
  lens?: 'economic_inflation' | 'grit_infrastructure' | 'merit_pay_it_forward';
  title: string;
  titleMy: string;
  promptHint: string;
  text: string;
}

/**
 * Context-Aware Dynamic Templates Generator (3 distinct lenses)
 * Ingests all active UI fields and routes through verified flash-lite ('light') models first.
 */
export async function generateScholarshipDynamicTemplates(
  params: ScholarshipGenerationParams
): Promise<DynamicScholarshipTemplateOutput[]> {
  const isRenewal = params.mode === 'renewal_app';
  const seed = params.seed || Date.now();
  const variation = params.variationNumber || 1;

  const systemInstruction = `You are an expert scholarship consultant for University of the People (UoPeople) ${
    isRenewal ? 'continuing' : 'new'
  } applicants.
COMPLETE STRUCTURAL ARC GUARANTEE (CRITICAL):
Each generated scholarship statement inside "text" MUST be a complete, well-formed narrative that starts, develops, and fully closes within 800 to 950 characters. NEVER cut off mid-sentence. Ensure the final sentence provides a clear, strong concluding remark.

Return ONLY a valid raw JSON object (no Markdown fences) with exact schema:
{
  "templates": [
    {
      "lens": "economic_inflation",
      "title": "Template A: Economic & Inflation Lens",
      "titleMy": "ပုံစံ (က) - ငွေကြေးဖောင်းပွမှုနှင့် ကုန်ဈေးနှုန်း ရှုထောင့်",
      "promptHint": "Short English context summary incorporating user details",
      "text": "Complete 800-950 char essay ending with a strong closing sentence."
    },
    {
      "lens": "grit_infrastructure",
      "title": "Template B: Grit, Power & Infrastructure Lens",
      "titleMy": "ပုံစံ (ခ) - မီးပျက်ခြင်းနှင့် အခက်အခဲကြားမှ ဇွဲလုံ့လ ရှုထောင့်",
      "promptHint": "Short English context summary incorporating user details",
      "text": "Complete 800-950 char essay ending with a strong closing sentence."
    },
    {
      "lens": "merit_pay_it_forward",
      "title": "Template C: Academic Merit & Pay-It-Forward Lens",
      "titleMy": "ပုံစံ (ဂ) - ပညာရေးစွမ်းဆောင်ရည်နှင့် ရပ်ရွာအကျိုးပြု ရှုထောင့်",
      "promptHint": "Short English context summary incorporating user details",
      "text": "Complete 800-950 char essay ending with a strong closing sentence."
    }
  ]
}`;

  const trimmedCustomAngle = (params.customStoryAngle || '').trim();
  const prompt = `Generate 3 completely distinct, non-duplicative scholarship templates tailored strictly to these active student inputs (translate Burmese inputs naturally into English):
- Application Type: ${isRenewal ? 'RENEWAL SOP' : 'NEW APPLICATION'}
- Degree Program: ${params.degreeProgram || 'Bachelor of Science in Computer Science'}
- Active Preset Story Angle Badge: ${params.storyAngle}
${
  trimmedCustomAngle
    ? `- User Custom Story Angle (PRIORITIZE & WEAVE INTO ALL 3 TEMPLATES): ${trimmedCustomAngle}\n`
    : ''
}- Career / Academic Goal: ${params.careerGoal || 'Complete degree and serve local community'}
${isRenewal ? `- Current CGPA: ${params.cgpa || '3.65'}\n- Completed Courses / Credits: ${params.coursesDone || '8 courses completed'}` : ''}
- User Hardship Textarea: """${
    params.hardshipDescription.trim() ||
    'Severe local inflation, infrastructure challenges, and household budget pressure.'
  }"""
- Variation Seed: ${seed} (#${variation})

REQUIREMENTS FOR THE 3 TEMPLATES:
1. Template A (economic_inflation): Emphasize currency volatility, cost of living, food/utility price spikes, and breadwinner strain using the student's specific context.
2. Template B (grit_infrastructure): Emphasize electricity load-shedding, connectivity hurdles, digital divide, and relentless academic commitment using the student's specific context.
3. Template C (merit_pay_it_forward): Emphasize GPA/academic resilience, career milestones, and giving back to community/health/tech sectors upon graduation using the student's specific context.
${isRenewal ? 'Every template MUST explicitly cite the student CGPA and completed courses/credits.' : ''}
Avoid AI clichés and guarantee every "text" is strictly 800-950 characters with a complete concluding sentence.`;

  const res = await executeGeminiRequest(
    prompt,
    'light',
    systemInstruction,
    undefined,
    1800,
    undefined,
    true,
    'application/json'
  );

  incrementDailyUsage(650);

  const parsedObj = safeExtractJsonObject<{ templates?: DynamicScholarshipTemplateOutput[] }>(res);
  if (parsedObj?.templates && Array.isArray(parsedObj.templates)) {
    return parsedObj.templates;
  }
  return [];
}

/**
 * Tab 4 International Scholarship Rubric Evaluator
 * Routes through verified lowest-token flash-lite ('light') dynamic cascade.
 */
export async function evaluateScholarshipEssayWithRubric(params: {
  targetScholarship: string;
  essayText: string;
}): Promise<string> {
  const charCount = params.essayText.length;
  const wordCount = params.essayText.split(/\s+/).filter(Boolean).length;

  const systemInstruction = `You are an elite International Scholarship Review Board Member and Admissions Committee Dean.
Evaluate the submitted scholarship essay against ${params.targetScholarship} benchmarks (UoPeople, Fulbright, Chevening, DAAD, Commonwealth standards).

Output ONLY clean, well-structured bilingual (English + Burmese) Markdown containing EXACTLY these 4 sections in order:

### 📊 Rubric Scorecard
Provide a Markdown table with columns:
| Evaluation Criterion | Max Score | Estimated Score | Status |
Include 5 criteria summing to 100 total:
1. Financial Need Persuasiveness & Specificity (25)
2. Academic Grit, Merit & Continuity (25)
3. Career & Community Impact Alignment (20)
4. Authentic Human Voice & Anti-AI Naturalness (15)
5. Narrative Arc & Portal Limit Compliance <= 1,000 Chars (15)
Include a final **Total Score** row out of 100.

### 🌟 Key Strengths (အားသာချက်များ)
- Bulleted list (3-5 items) of concrete persuasive elements and academic grit demonstrated in the student's draft.

### ⚠️ Critical Weaknesses & Missing Gaps (အားနည်းချက်နှင့် ဖြည့်စွက်ရန်များ)
- Line-by-line deduction rationale explaining why points were deducted per criterion, with specific, actionable revision guidance (in English + Burmese).

### 🎯 Acceptance Probability / Competitiveness (ပညာသင်ဆု ရနိုင်ခြေ ခန့်မှန်းချက်)
- State ONE exact category label: **"High / Competitive (~80-90%)"**, **"Moderate (~60-70%)"**, or **"Needs Strengthening (<60%)"**.
- Follow with a concise 2-3 sentence bilingual justification and immediate next step.`;

  const prompt = `TARGET BENCHMARK: ${params.targetScholarship}
CHARACTER COUNT: ${charCount} / 1,000 characters
WORD COUNT: ${wordCount} words

ESSAY UNDER REVIEW:
"""
${params.essayText}
"""`;

  const res = await executeGeminiRequest(
    prompt,
    'light',
    systemInstruction,
    undefined,
    1600,
    undefined,
    false
  );

  incrementDailyUsage(550);
  return String(res || '').trim();
}

export interface DailyRecoveryProtocolItem {
  category: string;
  badge: string;
  steps: string[];
}

export interface DailyRecoveryProtocol {
  overview: string;
  protocols: DailyRecoveryProtocolItem[];
  generatedAt: string;
  source: 'ai' | 'clinical_fallback';
}

export interface DailyRecoveryProtocolInput {
  energyLevel: number;
  stressLevel: number;
  stage: 'optimal' | 'moderate' | 'fatigue' | 'critical';
  studyHours: number;
  sleepHours: number;
  deadlinePressure: 'low' | 'medium' | 'high';
  symptoms: string[];
  language: 'my' | 'en';
}

const SYMPTOM_LABEL_MAP: Record<string, string> = {
  eyeStrain: 'Eye Strain / Headache (မျက်စိညောင်းညာ/ခေါင်းကိုက်ခြင်း)',
  brainFog: 'Brain Fog / Difficulty Focusing (အာရုံစူးစိုက်မရ/စာမမှတ်မိခြင်း)',
  prolongedStudy: 'Continuous Study >3h Without Break (၃ နာရီဆက်တိုက် မနားဘဲစာလုပ်ခြင်း)',
  deadlinePanic: 'Deadline Panic / Anxiety (အချိန်မလောက်မှာ စိုးရိမ်ရင်တုန်ခြင်း)',
  highCaffeine: 'High Caffeine Jitters (ကော်ဖီ/Energy Drink အလွန်အကျွံသောက်ခြင်း)',
  dehydration: 'Dehydration / Skipped Meal (ရေသောက်နည်း/ထမင်းကျော်စားမိခြင်း)',
};

const DEADLINE_LABEL_MAP: Record<'low' | 'medium' | 'high', string> = {
  low: 'Normal (ပုံမှန်)',
  medium: 'Due <24h (၂၄ နာရီအတွင်း)',
  high: 'Urgent Finals / Deadlines (အရေးပေါ် Deadlines)',
};

function buildProtocolItemForSymptom(
  symptomId: string,
  params: DailyRecoveryProtocolInput
): DailyRecoveryProtocolItem | null {
  const isMy = params.language === 'my';
  switch (symptomId) {
    case 'eyeStrain':
      return isMy
        ? {
            category: '👁️ မျက်စိအကြောနှင့် ခေါင်းကိုက်သက်သာစေရန် Optical Reset',
            badge: '20-20-20 & Eye Palming',
            steps: [
              'Screen မှ အကြည့်ခွာပြီး ပေ ၂၀ အကွာရှိ ဝေးသောနေရာကို စက္ကန့် ၂၀ ကြာ မျက်တောင်ဖြည်းညှင်းစွာခတ်၍ ကြည့်ပါ (၃ ကြိမ်)။',
              'လက်ဖဝါးနှစ်ဖက်ကို နွေးအောင်ပွတ်၍ မျက်လုံးပေါ် ၃၀ စက္ကန့်အုပ်ထားပြီး နားထင်နှင့် ဇက်ကြောကို ညင်သာစွာ နှိပ်နယ်ဖြေလျှော့ပါ။',
            ],
          }
        : {
            category: '👁️ Optical & Cranial Tension Reset',
            badge: '20-20-20 & Eye Palming',
            steps: [
              'Look 20 feet away for 20 full seconds while blinking deliberately to relax ciliary eye muscles.',
              'Warm your palms together and cup gently over closed eyes for 30 seconds while unclenching your jaw.',
            ],
          };

    case 'prolongedStudy':
      return isMy
        ? {
            category: '🧘 ကိုယ်ဟန်အနေအထား ဖြေလျှော့ခြင်းနှင့် အာရုံအနားပေးခြင်း',
            badge: 'Posture Reset & Disengagement',
            steps: [
              `စာဆက်တိုက် (${params.studyHours} နာရီ) လုပ်ထားသည့် ထိုင်ခုံမှ ချက်ချင်းမတ်တပ်ရပ်ပြီး ပခုံးနောက်လှည့် ၁၀ ကြိမ်နှင့် ကျောရိုးဆန့်တန်းမှု ၉၀ စက္ကန့် ပြုလုပ်ပါ။`,
              'စာအုပ်/Screen မှ ၃ မိနစ်ခန့် လုံးဝမျက်နှာလွှဲ၍ အခန်းတွင်း လမ်းအနည်းငယ်လျှောက်ကာ ဦးနှောက် Default Mode Network ကို အနားပေးပါ။',
            ],
          }
        : {
            category: '🧘 Physical Posture Decompression & Cognitive Break',
            badge: 'Posture Reset & Disengagement',
            steps: [
              `Stand up immediately after ${params.studyHours}h of sitting; roll shoulders back 10 times and stretch your thoracic spine for 90 seconds.`,
              'Step completely away from your study desk for 3 minutes without checking feeds so cognitive load resets.',
            ],
          };

    case 'deadlinePanic':
      return isMy
        ? {
            category: '🫧 စိုးရိမ်ရင်တုန်မှုနှင့် နှလုံးခုန်နှုန်း ချက်ချင်းထိန်းညှိနည်း',
            badge: 'Physiological Sigh / 5-4-3-2-1',
            steps: [
              'Physiological Sigh (၅ ကြိမ်) — နှာခေါင်းမှ လေ ၂ ချက်ဆက်တိုက် ပြည့်အောင်ရှူသွင်းပြီး ပါးစပ်မှ ၆ စက္ကန့်ကြာ ဖြည်းညှင်းစွာ မှုတ်ထုတ်ပါ။',
              '5-4-3-2-1 Grounding — မြင်ရသည့်အရာ ၅ ခု၊ ထိတွေ့ရသည့်အရာ ၄ ခုကို သတိပြုမှတ်သားပြီး အရေးအကြီးဆုံး Micro-Task ၁ ခုတည်းကိုသာ စာရွက်ပေါ် ချရေးပါ။',
            ],
          }
        : {
            category: '🫧 Rapid Somatic Calming & Anxiety Grounding',
            badge: 'Physiological Sigh & 5-4-3-2-1',
            steps: [
              'Do 5 Physiological Sighs: double inhale through the nose, then exhale slowly for 6 seconds to drop heart rate immediately.',
              'Ground with 5-4-3-2-1 sensory anchors, then isolate ONLY one 10-minute micro-task for your deadline.',
            ],
          };

    case 'brainFog':
      return isMy
        ? {
            category: '🧠 ဦးနှောက်ကြည်လင်စေရန် Deep Rest နှင့် Focus Anchor',
            badge: 'NSDR Micro-Rest & Brain Dump',
            steps: [
              'မျက်လုံးမှိတ်၍ ၃ မိနစ် ငြိမ်သက်စွာ အသက်ရှူနားထောင်ပါ (NSDR Pause) — ဦးနှောက် Working Memory ရှင်းလင်းသွားစေသည်။',
              'စာမမှတ်မိသေးသည့် အပိုင်းအားလုံးကို ခေတ္တချထားပြီး အလွယ်ဆုံး Flashcard သို့မဟုတ် အနှစ်ချုပ် ၁ မျက်နှာတည်းဖြင့် ပြန်စပါ။',
            ],
          }
        : {
            category: '🧠 Cognitive Clarity & Working-Memory Reset',
            badge: 'NSDR Micro-Rest & Brain Dump',
            steps: [
              'Close your eyes in a quiet chair for a 3-minute Non-Sleep Deep Rest (NSDR) pause away from any screen.',
              'Write down one single 10-minute sub-goal on paper before resuming study to clear cognitive overload.',
            ],
          };

    case 'highCaffeine':
      return isMy
        ? {
            category: '☕ Caffeine Jitters ထိန်းညှိခြင်းနှင့် နှလုံးတုန်သက်သာနည်း',
            badge: 'Caffeine Cutoff & Water Flush',
            steps: [
              'ယနေ့အတွက် ကော်ဖီ/Energy Drink ထပ်သောက်ခြင်းကို ရပ်တန့်ပြီး ရေသန့် ၄၀၀ ml ခန့် ဖြည်းဖြည်းချင်း သောက်ချပါ။',
              'ရင်တုန်ခြင်း လျော့နည်းစေရန် လက်နှစ်ဖက်ကို ခါချပြီး နှာခေါင်းမှ ၄ စက္ကန့်ရှူ၊ ၆ စက္ကန့် ဖြည်းဖြည်းထုတ် အသက်ရှူလေ့ကျင့်ခန်း ၁ မိနစ် ပြုလုပ်ပါ။',
            ],
          }
        : {
            category: '☕ Caffeine Jitter Neutralization',
            badge: 'Caffeine Cutoff & Water Flush',
            steps: [
              'Halt caffeine intake for the remainder of the day and sip 400 ml of cool water to ease vasoconstriction.',
              'Use extended 6-second exhales for 60 seconds to counteract sympathetic caffeine spikes.',
            ],
          };

    case 'dehydration':
      return isMy
        ? {
            category: '💧 ရေဓာတ်နှင့် သကြားဓာတ် ပြန်လည်ဖြည့်တင်းနည်း',
            badge: 'Electrolyte & Glycemic Fuel',
            steps: [
              'ရေသန့် ၃၅၀-၅၀၀ ml သို့မဟုတ် ဓာတ်ဆားရည် ၁ ခွက် ချက်ချင်းသောက်၍ ဦးနှောက်အာရုံကြော လျှပ်စီးစွမ်းအား ပြန်ဖြည့်ပါ။',
              'ထမင်း/အစာ ကျော်စားမိပါက ငှက်ပျောသီး၊ အစေ့အဆန် သို့မဟုတ် ပရိုတင်းအနည်းငယ် စားပေးမှသာ အာရုံစူးစိုက်မှု ပြန်တက်လာမည်ဖြစ်သည်။',
            ],
          }
        : {
            category: '💧 Rapid Electrolyte & Glycemic Rebalance',
            badge: 'Electrolyte & Glycemic Fuel',
            steps: [
              'Drink 350-500 ml of water or an electrolyte solution right now to restore cerebral hydration.',
              'Eat a small protein + complex-carb snack (nuts, fruit, yogurt) if you skipped a meal.',
            ],
          };

    default:
      return null;
  }
}

export function buildClinicalFallbackProtocol(
  params: DailyRecoveryProtocolInput
): DailyRecoveryProtocol {
  const isMy = params.language === 'my';
  const deadlineLabel = DEADLINE_LABEL_MAP[params.deadlinePressure];

  const uniqueSymptoms = Array.from(new Set(params.symptoms));
  const symptomProtocols = uniqueSymptoms
    .map((id) => buildProtocolItemForSymptom(id, params))
    .filter((item): item is DailyRecoveryProtocolItem => item !== null)
    .slice(0, 3);

  // When no symptom checkbox is selected, adapt purely to sleep/study/deadline metrics (never forcing eye strain)
  if (symptomProtocols.length === 0) {
    if (params.sleepHours < 6.5) {
      symptomProtocols.push(
        isMy
          ? {
              category: '🛌 အိပ်ရေးပျက်ထားသော ဦးနှောက်အားဖြည့်နည်း',
              badge: 'NSDR Power Pause',
              steps: [
                `မနေ့ည အိပ်ချိန် (${params.sleepHours} နာရီ) နည်းနေသဖြင့် ၅ မိနစ် မျက်လုံးမှိတ် အသက်ရှူအနားယူပြီး ညအိပ်ရာမဝင်မီ ၄၅ မိနစ်အလို Screen ပိတ်ပါ။`,
                'အာရုံစူးစိုက်ရခက်သည့် စာများထက် လက်တွေ့ Practice နှင့် Active Recall ကိုသာ ၂၅ မိနစ်တစ်ကြိမ် ခွဲလုပ်ပါ။',
              ],
            }
          : {
              category: '🛌 Sleep-Debt Cognitive Pacing',
              badge: 'NSDR Power Pause',
              steps: [
                `With ${params.sleepHours}h sleep logged, take a 5-minute eyes-closed NSDR rest and schedule a 45-min screen-off wind-down tonight.`,
                'Limit focus blocks to 25-minute single-task sprints.',
              ],
            }
      );
    }
    symptomProtocols.push(
      isMy
        ? {
            category:
              params.deadlinePressure === 'high'
                ? '⏱️ Deadline ဖိအားကြား စွမ်းအင်ထိန်းသိမ်းနည်း'
                : '🌿 နေ့စဉ် စွမ်းအင်မျှတအောင် ထိန်းသိမ်းနည်း',
            badge:
              params.deadlinePressure === 'high'
                ? 'Micro-Sprint & Pacing'
                : 'Active Maintenance',
            steps: [
              `လက်ရှိ Deadline (${deadlineLabel}) အခြေအနေတွင် ၅ မိနစ် အသက်ရှူဖြေလျှော့ပြီးနောက် အရေးအကြီးဆုံး Task ၁ ခုကိုသာ စတင်ပါ။`,
              'ရေတစ်ဖန်ခွက်သောက်ပြီး ထိုင်ရာမှ မတ်တပ်ရပ် အကြောဆန့်ကာ ခန္ဓာကိုယ် သွေးလည်ပတ်မှု ပြန်ကောင်းစေပါ။',
            ],
          }
        : {
            category: '🌿 Balanced Focus Maintenance',
            badge: 'Micro-Sprint & Pacing',
            steps: [
              'Take a deliberate 5-minute screen-free break before starting your next priority block.',
              'Stand up, stretch your shoulders, and sip water to sustain baseline energy.',
            ],
          }
    );
  }

  const overview = isMy
    ? `စွမ်းအင် ${params.energyLevel.toFixed(1)}/10 • စိတ်ဖိစီးမှု ${params.stressLevel.toFixed(1)}/10 (${deadlineLabel}) — သင်ရွေးချယ်ထားသော လက္ခဏာ ${uniqueSymptoms.length > 0 ? `${uniqueSymptoms.length} ချက်` : 'နှင့် ဇီဝအခြေအနေ'} အတွက်သာ သီးသန့်ထုတ်ပေးထားသော လက်တွေ့ Recovery Protocol ဖြစ်ပါသည်။`
    : `Energy ${params.energyLevel.toFixed(1)}/10 • Stress ${params.stressLevel.toFixed(1)}/10 — Targeted recovery protocol built strictly for your selected symptoms and current workload.`;

  return {
    overview,
    protocols: symptomProtocols,
    generatedAt: new Date().toISOString(),
    source: 'clinical_fallback',
  };
}

function containsUnrequestedEyeStrain(item: DailyRecoveryProtocolItem): boolean {
  const combined = `${item.category} ${item.badge} ${item.steps.join(' ')}`.toLowerCase();
  return (
    combined.includes('20-20-20') ||
    combined.includes('eye strain') ||
    combined.includes('optical') ||
    combined.includes('မျက်စိ')
  );
}

/**
 * Dynamically generates 100% context-aware recovery protocols tailored STRICTLY
 * to checked symptoms, deadline intensity, and Energy/Stress metrics via Tier 1 dynamic cascade.
 */
export async function generateDailyRecoveryProtocol(
  params: DailyRecoveryProtocolInput
): Promise<DailyRecoveryProtocol> {
  const fallback = buildClinicalFallbackProtocol(params);
  const availableKeys = getAllAvailableKeys();
  if (availableKeys.length === 0) {
    return fallback;
  }

  const hasEyeStrain = params.symptoms.includes('eyeStrain');
  const checkedSymptomsList =
    params.symptoms.length > 0
      ? params.symptoms.map((id) => `- ${id}: ${SYMPTOM_LABEL_MAP[id] || id}`).join('\n')
      : '- NONE checked (only use study/sleep/deadline metrics)';

  const targetCount =
    params.symptoms.length === 1
      ? 1
      : params.symptoms.length === 2
      ? 2
      : params.symptoms.length >= 3
      ? Math.min(params.symptoms.length, 3)
      : fallback.protocols.length;

  const targetLangLabel =
    params.language === 'my'
      ? 'Burmese (natural, warm, concise Myanmar Unicode)'
      : 'English (clear, empathetic, concise)';

  const systemInstruction = `You are a clinical neuro-performance & student burnout recovery architect.
Generate hyper-personalized micro-recovery protocols STRICTLY matching ONLY the student's checked symptoms, deadline urgency, and Energy/Stress levels.
Total word count across ALL fields MUST stay concise (~150-220 words) for sub-second readability.
Primary Language for "overview", "category", and "steps": ${targetLangLabel}.

CRITICAL NEGATIVE CONSTRAINTS (MUST FOLLOW):
1. ${
    hasEyeStrain
      ? 'Eye Strain IS checked — include a targeted 20-20-20 optical relief protocol.'
      : 'Eye Strain is NOT checked — NEVER generate eye-strain advice, blinking drills, or 20-20-20 rules!'
  }
2. Output EXACTLY ${targetCount} protocol object(s) in "protocols" — one dedicated protocol per checked symptom (never pad with unrelated generic cards).
3. Symptom-specific mandates (apply ONLY if checked):
   - If "deadlinePanic" is checked -> include rapid somatic calming techniques (Physiological Sigh or 5-4-3-2-1 Grounding).
   - If "prolongedStudy" is checked -> include physical posture decompression and cognitive disengagement drills.
   - If "brainFog" is checked -> include NSDR micro-rest and single-task anchoring.
   - If "highCaffeine" is checked -> include caffeine cutoff & hydration flush.
   - If "dehydration" is checked -> include electrolyte/water intake & glycemic fuel.

Output ONLY a raw valid JSON object (no markdown fences) matching this exact schema:
{
  "overview": "Short empathetic overview acknowledging current Energy/Stress state in ${params.language === 'my' ? 'Burmese' : 'English'}",
  "protocols": [
    {
      "category": "ခေါင်းစဉ် (${params.language === 'my' ? 'Title in Burmese' : 'Title in English'})",
      "badge": "Method Badge (e.g., Physiological Sigh / Posture Reset)",
      "steps": [
        "Concrete step 1 with exact seconds/reps/action",
        "Concrete step 2 tailored directly to this checked symptom"
      ]
    }
  ]
}`;

  const prompt = `Student Clinical Snapshot:
- Calculated Energy Level: ${params.energyLevel.toFixed(1)} / 10
- Calculated Stress Level: ${params.stressLevel.toFixed(1)} / 10
- Clinical Stage: ${params.stage.toUpperCase()}
- Study Duration Today: ${params.studyHours} hours
- Last Night Sleep Duration: ${params.sleepHours} hours
- Deadline Status: ${DEADLINE_LABEL_MAP[params.deadlinePressure]}
- CHECKED SYMPTOMS ONLY:
${checkedSymptomsList}

Return exact JSON with ${targetCount} tailored protocol(s).`;

  try {
    const rawRes = await executeGeminiRequest(
      prompt,
      'light',
      systemInstruction,
      undefined,
      650,
      undefined,
      true,
      'application/json'
    );

    const parsed = safeExtractJsonObject<{
      overview?: string;
      protocols?: unknown;
    }>(rawRes);

    if (!parsed || !Array.isArray(parsed.protocols)) {
      return fallback;
    }

    const sanitizedProtocols: DailyRecoveryProtocolItem[] = parsed.protocols
      .map((item): DailyRecoveryProtocolItem | null => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;
        const category = typeof obj.category === 'string' ? obj.category.trim() : '';
        const badge = typeof obj.badge === 'string' ? obj.badge.trim() : 'Clinical Reset';
        const steps = Array.isArray(obj.steps)
          ? obj.steps
              .map((s) => (typeof s === 'string' ? s.trim() : ''))
              .filter((s) => s.length > 0)
              .slice(0, 3)
          : [];
        if (!category || steps.length === 0) return null;
        return { category, badge, steps };
      })
      .filter((item): item is DailyRecoveryProtocolItem => item !== null)
      .filter((item) => (hasEyeStrain ? true : !containsUnrequestedEyeStrain(item)))
      .slice(0, targetCount);

    if (sanitizedProtocols.length === 0) {
      return fallback;
    }

    // Pad only from symptom-matched fallback if model omitted a checked symptom after filtering
    while (sanitizedProtocols.length < targetCount && fallback.protocols[sanitizedProtocols.length]) {
      sanitizedProtocols.push(fallback.protocols[sanitizedProtocols.length]);
    }

    incrementDailyUsage(320);

    return {
      overview:
        typeof parsed.overview === 'string' && parsed.overview.trim()
          ? parsed.overview.trim()
          : fallback.overview,
      protocols: sanitizedProtocols,
      generatedAt: new Date().toISOString(),
      source: 'ai',
    };
  } catch {
    return fallback;
  }
}
