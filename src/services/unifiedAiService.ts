/**
 * Pure Gemini-Native Autonomous Smart-Routing AI Service (`unifiedAiService.ts`)
 *
 * Engine:
 * - Drives Practice Quiz and SM-2 Flashcards primarily through `gemini-3.5-flash-lite`
 *   with zero/minimal thinking budget for maximum free-tier quota preservation.
 * - Auto-cascades across free-tier Gemini models (`gemini-3.5-flash-lite` -> `gemini-3.8-flash` -> `gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-4-argon`).
 * - Strictly excludes paid `gemini-4-carbon`.
 */

import { executeAcademicActionWithCascade, getActiveApiKey } from './geminiService';

export type TaskCategory = 'massive_input' | 'fast_response' | 'writing_deep_reasoning';
export type AiEngineProvider = 'gemini';

export interface UnifiedAiOptions {
  action: string;
  payload: any;
  taskCategory?: TaskCategory;
  targetLanguage?: string;
  primaryKey?: string;
  backupKey?: string;
  onCascadeToast?: (message: string, engineOrModel: string) => void;
  onQuotaExhausted?: (retryFn: () => Promise<void>) => void;
}

export interface UnifiedAiResult {
  result: any;
  providerUsed: AiEngineProvider;
  activeModeBadge: string;
}

/**
 * Clean up all legacy external provider storage keys (GitHub, Groq, OpenRouter)
 */
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('akari_github_token');
    localStorage.removeItem('akari_groq_api_key');
    localStorage.removeItem('akari_openrouter_api_key');
    localStorage.removeItem('akari_writing_streak_data');
    localStorage.removeItem('akari_unit_glossary_cache');
    localStorage.removeItem('akari_discussion_hooks_cache');
  } catch {}
}

/**
 * Heuristic Task Classifier
 */
export function inferTaskCategory(action: string, payload: any): TaskCategory {
  if (
    action === 'generate_study_cards' ||
    action === 'direct_flashcards' ||
    action === 'socratic_tutor' ||
    action === 'socratic_dialogue' ||
    action === 'followup_reply'
  ) {
    return 'fast_response';
  }

  if (
    action === 'reader_quiz' ||
    action === 'dual_language_summary' ||
    action === 'lesson_explainer' ||
    (payload && typeof payload.content === 'string' && payload.content.length > 8000)
  ) {
    return 'massive_input';
  }

  return 'writing_deep_reasoning';
}

import { getModelCascade, TaskComplexity } from './geminiService';

/**
 * Pure Gemini-Native Autonomous Smart-Routing Dispatcher
 */
export async function executeUnifiedAiAction(options: UnifiedAiOptions): Promise<UnifiedAiResult> {
  const { action, payload, targetLanguage, primaryKey, backupKey, onCascadeToast, onQuotaExhausted } = options;

  const category = options.taskCategory || inferTaskCategory(action, payload);
  const complexity: TaskComplexity =
    category === 'fast_response' ? 'light' : category === 'massive_input' ? 'heavy' : 'standard';

  const preferredModel = getModelCascade(complexity)[0];

  const geminiResult = await executeAcademicActionWithCascade({
    action,
    payload,
    complexity,
    targetLanguage,
    primaryKey: primaryKey || getActiveApiKey(),
    backupKey,
    preferredModel,
    onCascadeToast: (msg, model) => onCascadeToast?.(msg, model),
    onQuotaExhausted,
  });

  return {
    result: geminiResult,
    providerUsed: 'gemini',
    activeModeBadge: '⚡ Gemini Auto-Cascade',
  };
}
