/**
 * Pure Gemini-Native AI Provider Configuration
 * Strictly uses active non-paid free-tier Gemini models:
 * - Primary Default: gemini-4-hydrogen
 * - Lightweight / Fast Tasks: gemini-3.1-flash-lite
 * - Secondary Fallback: gemini-3.8-flash
 */

export interface AiProviderInfo {
  id: 'gemini';
  name: string;
  description: string;
  keyUrl: string;
  burmeseHelper: string;
  isPrimary: boolean;
}

export const AI_PROVIDERS: Record<'gemini', AiProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini API (Native Multi-Key Vault)',
    description: 'Long-context academic reading, multi-source ingestion, and Free-Model Auto-Cascade resilience',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    burmeseHelper: 'စာအုပ်နှင့် စာတမ်းအရှည်ကြီးများ ဖတ်ရန် အခမဲ့ Key ထုတ်ယူပါ။',
    isPrimary: true,
  },
};
