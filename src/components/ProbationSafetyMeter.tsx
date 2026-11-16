import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Gauge,
  Image as ImageIcon,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { resolveLiveAcademicContext } from '../utils/uopeopleCalendar';

export interface SyllabusWeights {
  discussion: number;
  assignmentActivity: number;
  quizzes: number;
  finalExam: number;
}

export interface WeekGrades {
  discussion: string;
  assignmentActivity: string;
  quiz: string;
  finalExam: string;
}

type GradesByWeek = Record<number, WeekGrades>;

interface ExtractedSyllabusState {
  courseName: string;
  weights: SyllabusWeights;
  modelUsed: string;
}

interface SyllabusFileMeta {
  name: string;
  type: string;
  sizeLabel: string;
}

interface CourseSlotState {
  slotId: number;
  defaultLabel: string;
  extractedSyllabus: ExtractedSyllabusState | null;
  currentWeek: number;
  gradesByWeek: GradesByWeek;
  syllabusFileMeta: SyllabusFileMeta | null;
}

interface PersistedSafetyMeterData {
  activeCourseIndex: number;
  courses: CourseSlotState[];
}

const STORAGE_KEY = 'uopeople_safety_meter_courses_v1';
const COURSE_SLOTS = [1, 2, 3, 4] as const;
const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const C_PASSING_THRESHOLD = 73;

const SYLLABUS_MODEL_CACHE_KEY = 'akari_syllabus_live_models_v1';
const SYLLABUS_MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ACCEPTED_SYLLABUS_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const ACCEPTED_SYLLABUS_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const MAX_SYLLABUS_FILE_BYTES = 7 * 1024 * 1024;

const SYLLABUS_EXTRACTION_PROMPT = `You are an exact academic grading auditor for University of the People course syllabi. Extract the exact grading breakdown percentages from this image/PDF. UoPeople uses 'Assignment Activity' (NOT Learning Journals). Output strictly a JSON object without markdown formatting: {"courseName": "string", "discussionWeight": number, "assignmentActivityWeight": number, "quizzesWeight": number, "finalExamWeight": number}. Total must sum to 100. If any category is absent, set its weight to 0.`;

interface CachedModelEntry {
  models: string[];
  timestamp: number;
  keyHint: string;
}

interface ExtractedSyllabusPayload {
  courseName: string;
  discussionWeight: number;
  assignmentActivityWeight: number;
  quizzesWeight: number;
  finalExamWeight: number;
}

let inMemorySyllabusModels: CachedModelEntry | null = null;
const deadSyllabusModels = new Set<string>();

function createEmptyGrades(): GradesByWeek {
  const initial: GradesByWeek = {};
  for (const w of WEEKS) {
    initial[w] = {
      discussion: '',
      assignmentActivity: '',
      quiz: '',
      finalExam: '',
    };
  }
  return initial;
}

function createDefaultCourseSlot(slotId: number): CourseSlotState {
  return {
    slotId,
    defaultLabel: `Course ${slotId}`,
    extractedSyllabus: null,
    currentWeek: 1,
    gradesByWeek: createEmptyGrades(),
    syllabusFileMeta: null,
  };
}

function createDefaultCoursesList(): CourseSlotState[] {
  return COURSE_SLOTS.map((slotId) => createDefaultCourseSlot(slotId));
}

function sanitizeGradesByWeek(raw: unknown): GradesByWeek {
  const fallback = createEmptyGrades();
  if (!raw || typeof raw !== 'object') return fallback;
  const record = raw as Record<string, unknown>;

  for (const w of WEEKS) {
    const item = record[w] ?? record[String(w)];
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      fallback[w] = {
        discussion: typeof obj.discussion === 'string' ? obj.discussion : '',
        assignmentActivity:
          typeof obj.assignmentActivity === 'string' ? obj.assignmentActivity : '',
        quiz: typeof obj.quiz === 'string' ? obj.quiz : '',
        finalExam: typeof obj.finalExam === 'string' ? obj.finalExam : '',
      };
    }
  }
  return fallback;
}

function sanitizeCourseSlot(raw: unknown, slotId: number): CourseSlotState {
  const base = createDefaultCourseSlot(slotId);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  let extractedSyllabus: ExtractedSyllabusState | null = null;
  if (obj.extractedSyllabus && typeof obj.extractedSyllabus === 'object') {
    const ext = obj.extractedSyllabus as Record<string, unknown>;
    const rawWeights =
      ext.weights && typeof ext.weights === 'object'
        ? (ext.weights as Record<string, unknown>)
        : null;

    if (rawWeights) {
      const discussion = Number(rawWeights.discussion) || 0;
      const assignmentActivity = Number(rawWeights.assignmentActivity) || 0;
      const quizzes = Number(rawWeights.quizzes) || 0;
      const finalExam = Number(rawWeights.finalExam) || 0;
      if (discussion + assignmentActivity + quizzes + finalExam > 0) {
        extractedSyllabus = {
          courseName:
            typeof ext.courseName === 'string' && ext.courseName.trim()
              ? ext.courseName.trim()
              : `Course ${slotId}`,
          weights: {
            discussion,
            assignmentActivity,
            quizzes,
            finalExam,
          },
          modelUsed: typeof ext.modelUsed === 'string' ? ext.modelUsed : 'cached',
        };
      }
    }
  }

  const rawWeek = Number(obj.currentWeek);
  const currentWeek =
    Number.isInteger(rawWeek) && rawWeek >= 1 && rawWeek <= 9 ? rawWeek : 1;

  let syllabusFileMeta: SyllabusFileMeta | null = null;
  if (obj.syllabusFileMeta && typeof obj.syllabusFileMeta === 'object') {
    const meta = obj.syllabusFileMeta as Record<string, unknown>;
    if (typeof meta.name === 'string' && meta.name.trim()) {
      syllabusFileMeta = {
        name: meta.name,
        type: typeof meta.type === 'string' ? meta.type : 'application/octet-stream',
        sizeLabel: typeof meta.sizeLabel === 'string' ? meta.sizeLabel : '',
      };
    }
  }

  return {
    slotId,
    defaultLabel: `Course ${slotId}`,
    extractedSyllabus,
    currentWeek,
    gradesByWeek: sanitizeGradesByWeek(obj.gradesByWeek),
    syllabusFileMeta,
  };
}

function loadSavedSafetyMeterState(): PersistedSafetyMeterData {
  const defaultState: PersistedSafetyMeterData = {
    activeCourseIndex: 0,
    courses: createDefaultCoursesList(),
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return {
        activeCourseIndex: 0,
        courses: COURSE_SLOTS.map((slotId, idx) => sanitizeCourseSlot(parsed[idx], slotId)),
      };
    }

    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const rawCourses = Array.isArray(obj.courses) ? obj.courses : [];
      const rawActiveIdx = Number(obj.activeCourseIndex);
      const activeCourseIndex =
        Number.isInteger(rawActiveIdx) && rawActiveIdx >= 0 && rawActiveIdx < 4
          ? rawActiveIdx
          : 0;

      return {
        activeCourseIndex,
        courses: COURSE_SLOTS.map((slotId, idx) =>
          sanitizeCourseSlot(rawCourses[idx], slotId)
        ),
      };
    }
  } catch {
    // Ignore storage read or JSON parse errors
  }

  return defaultState;
}

function parseScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, num));
}

function getUoPeopleLetterGrade(percent: number): { letter: string; gpa: string } {
  if (percent >= 93) return { letter: 'A', gpa: '4.00' };
  if (percent >= 90) return { letter: 'A-', gpa: '3.67' };
  if (percent >= 88) return { letter: 'B+', gpa: '3.33' };
  if (percent >= 83) return { letter: 'B', gpa: '3.00' };
  if (percent >= 80) return { letter: 'B-', gpa: '2.67' };
  if (percent >= 78) return { letter: 'C+', gpa: '2.33' };
  if (percent >= 73) return { letter: 'C', gpa: '2.00' };
  if (percent >= 70) return { letter: 'C-', gpa: '1.67' };
  if (percent >= 68) return { letter: 'D+', gpa: '1.33' };
  if (percent >= 63) return { letter: 'D', gpa: '1.00' };
  if (percent >= 60) return { letter: 'D-', gpa: '0.67' };
  return { letter: 'F', gpa: '0.00' };
}

function sanitizeKeyString(raw?: string | null): string {
  return (raw || '').replace(/["'\s]/g, '').trim();
}

function collectConfiguredApiKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const keys: string[] = [];
  const pushUnique = (raw?: string | null) => {
    const cleaned = sanitizeKeyString(raw);
    if (cleaned.length >= 10 && !keys.includes(cleaned)) {
      keys.push(cleaned);
    }
  };

  try {
    pushUnique(localStorage.getItem('akari_gemini_api_key_primary'));
    pushUnique(localStorage.getItem('akari_primary_gemini_key'));
    pushUnique(localStorage.getItem('akari_custom_gemini_key'));
    pushUnique(localStorage.getItem('akari_gemini_api_key'));
    pushUnique(localStorage.getItem('gemini_api_key'));
    pushUnique(localStorage.getItem('akari_gemini_api_key_backup'));
    pushUnique(localStorage.getItem('akari_backup_gemini_key'));

    const rawPool = JSON.parse(localStorage.getItem('akari_gemini_key_pool') || '[]');
    if (Array.isArray(rawPool)) {
      rawPool.forEach((item: unknown) => {
        if (typeof item === 'string') pushUnique(item);
        else if (item && typeof item === 'object' && 'key' in item) {
          pushUnique(String((item as { key?: unknown }).key || ''));
        }
      });
    }
  } catch {
    // Ignore storage access errors
  }

  return keys;
}

function isPreviewOrServerHosted(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host.includes('googleusercontent.com') ||
    host.includes('web.dev') ||
    host.includes('run.app') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

function filterAndSortLiveModels(rawModels: unknown[]): string[] {
  const validModels: string[] = [];

  for (const item of rawModels) {
    let rawName = '';
    if (typeof item === 'string') {
      rawName = item;
    } else if (item && typeof item === 'object') {
      const obj = item as {
        name?: unknown;
        supportedGenerationMethods?: unknown;
        supportedActions?: unknown;
      };
      const methods = Array.isArray(obj.supportedGenerationMethods)
        ? obj.supportedGenerationMethods
        : Array.isArray(obj.supportedActions)
        ? obj.supportedActions
        : null;
      if (!methods || !methods.includes('generateContent')) {
        continue;
      }
      rawName = typeof obj.name === 'string' ? obj.name : '';
    }

    const cleanName = rawName.replace(/^models\//, '').trim();
    if (!cleanName) continue;
    const lower = cleanName.toLowerCase();

    // Exclude embeddings, audio-only, image/video-only, and text-only legacy models
    if (
      lower.includes('embedding') ||
      lower.includes('gecko') ||
      lower.includes('audio') ||
      lower.includes('tts') ||
      lower.includes('live') ||
      lower.includes('transcribe') ||
      lower.includes('lyria') ||
      lower.includes('veo') ||
      lower.includes('omni') ||
      lower.includes('imagen') ||
      lower.includes('image') ||
      lower.includes('moderation') ||
      lower.includes('aqa') ||
      lower.includes('bison') ||
      lower.includes('learnlm') ||
      lower.includes('robotics') ||
      lower.includes('computer-use') ||
      lower.includes('deep-research') ||
      lower.includes('gemma') ||
      lower.includes('nano') ||
      lower.includes('1.0') ||
      lower.includes('1.5') ||
      lower.includes('2.0-flash') ||
      lower.includes('2.0-pro') ||
      lower.includes('latest') ||
      lower.includes('exp') ||
      lower.includes('carbon') ||
      lower.includes('ultra') ||
      lower === 'gemini-pro' ||
      deadSyllabusModels.has(cleanName)
    ) {
      continue;
    }

    if (!validModels.includes(cleanName)) {
      validModels.push(cleanName);
    }
  }

  // Ascending token efficiency priority:
  // Priority 1: flash-lite
  // Priority 2: flash
  // Priority 3: other standard generation models
  const getPriorityRank = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower.includes('flash-lite')) return 0;
    if (lower.includes('flash')) return 1;
    return 2;
  };

  validModels.sort((a, b) => {
    const rankDiff = getPriorityRank(a) - getPriorityRank(b);
    if (rankDiff !== 0) return rankDiff;
    return b.localeCompare(a);
  });

  return validModels;
}

function getCachedLiveModels(keyHint: string): string[] | null {
  if (
    inMemorySyllabusModels &&
    inMemorySyllabusModels.keyHint === keyHint &&
    Date.now() - inMemorySyllabusModels.timestamp < SYLLABUS_MODEL_CACHE_TTL_MS
  ) {
    const active = inMemorySyllabusModels.models.filter((m) => !deadSyllabusModels.has(m));
    if (active.length > 0) return active;
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SYLLABUS_MODEL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedModelEntry;
        if (
          parsed &&
          parsed.keyHint === keyHint &&
          Array.isArray(parsed.models) &&
          Date.now() - (parsed.timestamp || 0) < SYLLABUS_MODEL_CACHE_TTL_MS
        ) {
          const active = parsed.models.filter((m) => !deadSyllabusModels.has(m));
          if (active.length > 0) {
            inMemorySyllabusModels = { ...parsed, models: active };
            return active;
          }
        }
      }
    } catch {
      // Ignore malformed cache
    }
  }
  return null;
}

function saveCachedLiveModels(models: string[], keyHint: string): void {
  const entry: CachedModelEntry = {
    models,
    timestamp: Date.now(),
    keyHint,
  };
  inMemorySyllabusModels = entry;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(SYLLABUS_MODEL_CACHE_KEY, JSON.stringify(entry));
    } catch {
      // Ignore sessionStorage write errors
    }
  }
}

async function resolveLiveSyllabusModels(apiKey: string, useDirectGoogle: boolean): Promise<string[]> {
  const keyHint = apiKey ? `${useDirectGoogle ? 'direct' : 'proxy'}_${apiKey.slice(-6)}` : 'server_env';
  const cached = getCachedLiveModels(keyHint);
  if (cached && cached.length > 0) {
    return cached;
  }

  if (useDirectGoogle && apiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) {
      throw new Error(`Model catalog fetch failed (HTTP ${res.status})`);
    }
    const data = await res.json();
    const rawList = Array.isArray(data?.models) ? data.models : [];
    const sorted = filterAndSortLiveModels(rawList);
    if (sorted.length > 0) {
      saveCachedLiveModels(sorted, keyHint);
    }
    return sorted;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['x-gemini-key'] = apiKey;
    headers['x-goog-api-key'] = apiKey;
  }
  const proxyRes = await fetch('/api/academic/models', { method: 'GET', headers });
  if (!proxyRes.ok) {
    throw new Error(`Proxy model catalog failed (HTTP ${proxyRes.status})`);
  }
  const proxyData = await proxyRes.json();
  const rawList = Array.isArray(proxyData?.models) ? proxyData.models : [];
  const sorted = filterAndSortLiveModels(rawList);
  if (sorted.length > 0) {
    saveCachedLiveModels(sorted, keyHint);
  }
  return sorted;
}

function readFileAsBase64(file: File): Promise<{ dataUrl: string; base64Data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:')) {
        reject(new Error('Could not read file contents.'));
        return;
      }
      const dataUrl = reader.result;
      const commaIdx = dataUrl.indexOf(',');
      const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
      const detectedMime =
        file.type || dataUrl.slice(5, dataUrl.indexOf(';')) || 'application/octet-stream';
      resolve({ dataUrl, base64Data, mimeType: detectedMime });
    };
    reader.onerror = () => reject(new Error('Failed to read uploaded file.'));
    reader.readAsDataURL(file);
  });
}

function parseExtractedSyllabusJson(rawText: string): ExtractedSyllabusPayload | null {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const obj = JSON.parse(candidate);
      return obj && typeof obj === 'object' && !Array.isArray(obj)
        ? (obj as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(cleaned);
  if (!parsed) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = tryParse(jsonMatch[0]);
    }
  }
  if (!parsed) return null;

  const toWeight = (val: unknown): number => {
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.min(100, Math.round(num * 100) / 100);
  };

  const discussionWeight = toWeight(parsed.discussionWeight);
  const assignmentActivityWeight = toWeight(parsed.assignmentActivityWeight);
  const quizzesWeight = toWeight(parsed.quizzesWeight);
  const finalExamWeight = toWeight(parsed.finalExamWeight);
  const sum = discussionWeight + assignmentActivityWeight + quizzesWeight + finalExamWeight;

  if (sum <= 0) {
    return null;
  }

  return {
    courseName: typeof parsed.courseName === 'string' ? parsed.courseName.trim() : '',
    discussionWeight,
    assignmentActivityWeight,
    quizzesWeight,
    finalExamWeight,
  };
}

function normalizeWeightsToExact100(payload: ExtractedSyllabusPayload): SyllabusWeights {
  const rawList = [
    payload.discussionWeight,
    payload.assignmentActivityWeight,
    payload.quizzesWeight,
    payload.finalExamWeight,
  ];
  const rawSum = rawList.reduce((acc, v) => acc + v, 0);
  if (rawSum <= 0) {
    return { discussion: 0, assignmentActivity: 0, quizzes: 0, finalExam: 0 };
  }

  // Scale proportionally onto 100 using largest-remainder integer allocation
  const exactScaled = rawList.map((v) => (v / rawSum) * 100);
  const floored = exactScaled.map((v) => Math.floor(v));
  let remainder = 100 - floored.reduce((acc, v) => acc + v, 0);

  const remainders = exactScaled
    .map((v, idx) => ({ idx, frac: v - floored[idx] }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainders.length && remainder > 0; i += 1) {
    floored[remainders[i].idx] += 1;
    remainder -= 1;
  }

  return {
    discussion: floored[0],
    assignmentActivity: floored[1],
    quizzes: floored[2],
    finalExam: floored[3],
  };
}

function isQuotaOrModelError(status: number, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    status === 404 ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('overloaded') ||
    lower.includes('not_found')
  );
}

async function extractSyllabusWeightsWithGemini(
  file: File
): Promise<{ payload: ExtractedSyllabusPayload; modelUsed: string }> {
  const { dataUrl, base64Data, mimeType } = await readFileAsBase64(file);
  const candidateKeys = collectConfiguredApiKeys();
  const primaryKey = candidateKeys[0] || '';
  const previewHosted = isPreviewOrServerHosted();

  const executeDirectRest = async (apiKey: string) => {
    const models = await resolveLiveSyllabusModels(apiKey, true);
    if (models.length === 0) {
      throw new Error('No active generateContent models available for this API key.');
    }

    let lastErr: Error | null = null;
    for (const modelId of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelId
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mimeType, data: base64Data } },
                  { text: SYLLABUS_EXTRACTION_PROMPT },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: 600,
            },
          }),
        }
      );

      const json = await res.json().catch(() => null);
      if (res.ok) {
        const textOutput =
          json?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p?.text || '')
            .join('') || '';
        const extracted = parseExtractedSyllabusJson(textOutput);
        if (!extracted) {
          throw new Error('UNREADABLE_SYLLABUS');
        }
        return { payload: extracted, modelUsed: modelId };
      }

      const errMsg = String(json?.error?.message || `HTTP ${res.status}`);
      if (res.status === 404) {
        deadSyllabusModels.add(modelId);
      }
      lastErr = new Error(errMsg);
      if (isQuotaOrModelError(res.status, errMsg)) {
        continue;
      }
      throw lastErr;
    }
    throw lastErr || new Error('All candidate Gemini models are unavailable.');
  };

  const executeServerProxy = async (apiKey: string) => {
    const models = await resolveLiveSyllabusModels(apiKey, false);
    if (models.length === 0) {
      throw new Error('No active generateContent models available.');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['x-gemini-key'] = apiKey;
      headers['x-goog-api-key'] = apiKey;
    }

    let lastErr: Error | null = null;
    for (const modelId of models) {
      const res = await fetch('/api/academic/assist', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'direct_assist',
          model: modelId,
          strictModel: true,
          payload: {
            prompt: SYLLABUS_EXTRACTION_PROMPT,
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 600,
            images: [{ name: file.name, base64: dataUrl, mimeType }],
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data && data.result !== undefined) {
        const textOutput =
          typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
        const extracted = parseExtractedSyllabusJson(textOutput);
        if (!extracted) {
          throw new Error('UNREADABLE_SYLLABUS');
        }
        return { payload: extracted, modelUsed: String(data.modelUsed || modelId) };
      }

      const errMsg = String(data?.error || data?.message || `HTTP ${res.status}`);
      if (res.status === 404) {
        deadSyllabusModels.add(modelId);
      }
      lastErr = new Error(errMsg);
      if (isQuotaOrModelError(res.status, errMsg)) {
        continue;
      }
      throw lastErr;
    }
    throw lastErr || new Error('All candidate Gemini models are currently unavailable.');
  };

  if (!previewHosted && primaryKey) {
    return executeDirectRest(primaryKey);
  }

  try {
    return await executeServerProxy(primaryKey);
  } catch (proxyErr) {
    const msg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
    if (msg === 'UNREADABLE_SYLLABUS') {
      throw proxyErr;
    }
    if (primaryKey && (msg.includes('404') || msg.includes('Failed to fetch'))) {
      return executeDirectRest(primaryKey);
    }
    throw proxyErr;
  }
}

export const ProbationSafetyMeter: React.FC = () => {
  const initialPersisted = useMemo(() => loadSavedSafetyMeterState(), []);
  const [activeCourseIndex, setActiveCourseIndex] = useState<number>(
    initialPersisted.activeCourseIndex
  );
  const [courses, setCourses] = useState<CourseSlotState[]>(initialPersisted.courses);

  // Per-slot transient object URLs for in-session previewing
  const [previewUrlsBySlot, setPreviewUrlsBySlot] = useState<Record<number, string | null>>({});
  const [isExtractingSyllabus, setIsExtractingSyllabus] = useState<boolean>(false);
  const [isDraggingSyllabus, setIsDraggingSyllabus] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-save all 4 courses + activeCourseIndex into localStorage whenever state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: PersistedSafetyMeterData = {
        activeCourseIndex,
        courses,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }, [activeCourseIndex, courses]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleWipe = () => {
      setActiveCourseIndex(0);
      setCourses(createDefaultCoursesList());
      setPreviewUrlsBySlot({ 1: null, 2: null, 3: null, 4: null });
      setExtractionError(null);
    };
    window.addEventListener('akari_emergency_wipe', handleWipe);
    return () => window.removeEventListener('akari_emergency_wipe', handleWipe);
  }, []);

  // Cleanup any created object URLs on unmount
  const previewUrlsRef = useRef<Record<number, string | null>>({});
  previewUrlsRef.current = previewUrlsBySlot;
  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const activeCourse = courses[activeCourseIndex] ?? courses[0];
  const { extractedSyllabus, currentWeek, gradesByWeek, syllabusFileMeta } = activeCourse;
  const activePreviewUrl = previewUrlsBySlot[activeCourse.slotId] ?? null;

  const updateActiveCourse = (updater: (prev: CourseSlotState) => CourseSlotState) => {
    setCourses((prevCourses) =>
      prevCourses.map((course, idx) => (idx === activeCourseIndex ? updater(course) : course))
    );
  };

  const handleSelectCourseTab = (index: number) => {
    if (index === activeCourseIndex) return;
    setActiveCourseIndex(index);
    setExtractionError(null);
    setIsDraggingSyllabus(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSetCurrentWeek = (week: number) => {
    updateActiveCourse((prev) => ({
      ...prev,
      currentWeek: week,
    }));
  };

  const handleScoreChange = (week: number, field: keyof WeekGrades, raw: string) => {
    if (raw !== '' && !/^\d{0,3}(\.\d{0,2})?$/.test(raw)) {
      return;
    }
    const num = Number(raw);
    if (raw !== '' && Number.isFinite(num) && num > 100) {
      return;
    }
    updateActiveCourse((prev) => ({
      ...prev,
      gradesByWeek: {
        ...prev.gradesByWeek,
        [week]: {
          ...prev.gradesByWeek[week],
          [field]: raw,
        },
      },
    }));
  };

  const runSyllabusExtraction = async (
    file: File,
    targetIndex: number,
    fileMeta: SyllabusFileMeta
  ) => {
    setIsExtractingSyllabus(true);
    setExtractionError(null);

    try {
      const { payload, modelUsed } = await extractSyllabusWeightsWithGemini(file);
      const normalizedWeights = normalizeWeightsToExact100(payload);
      const fallbackCourseName =
        file.name.replace(/\.[^.]+$/, '').trim() || `Course ${targetIndex + 1}`;

      setCourses((prevCourses) =>
        prevCourses.map((c, idx) =>
          idx === targetIndex
            ? {
                ...c,
                extractedSyllabus: {
                  courseName: payload.courseName || fallbackCourseName,
                  weights: normalizedWeights,
                  modelUsed,
                },
                gradesByWeek: createEmptyGrades(),
                currentWeek: 1,
                syllabusFileMeta: fileMeta,
              }
            : c
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || '');
      if (msg === 'UNREADABLE_SYLLABUS') {
        setExtractionError(
          '⚠️ တင်လိုက်သော Syllabus ဖိုင်သည် ဝါးနေခြင်း သို့မဟုတ် Grading Breakdown ဇယား မပါဝင်ခြင်း ဖြစ်နိုင်ပါသည်။ ကြည်လင်သော Grade Breakdown Screenshot (သို့မဟုတ်) Syllabus PDF ကို ထပ်မံထည့်သွင်းပေးပါ။'
        );
      } else {
        setExtractionError(
          `⚠️ Syllabus ဖိုင်ကို AI ဖြင့် ဖတ်ရှု၍ မရပါ (${msg.slice(0, 140)}) — ကျေးဇူးပြု၍ ကြည်လင်သော PDF/Screenshot ဖြင့် ထပ်မံကြိုးစားပေးပါ။`
        );
      }
    } finally {
      setIsExtractingSyllabus(false);
    }
  };

  const handleSyllabusFileSelect = (file: File | undefined) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ACCEPTED_SYLLABUS_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = !file.type || ACCEPTED_SYLLABUS_MIMES.has(file.type.toLowerCase());

    if (!hasValidExt && !hasValidMime) {
      setExtractionError(
        '⚠️ ဖိုင်အမျိုးအစား မမှန်ကန်ပါ — PDF (.pdf) သို့မဟုတ် ပုံ (.png, .jpg, .jpeg, .webp) ဖိုင်များကိုသာ ထည့်သွင်းပေးပါ။'
      );
      return;
    }

    if (file.size > MAX_SYLLABUS_FILE_BYTES) {
      setExtractionError(
        '⚠️ ဖိုင်အရွယ်အစား 7MB ထက် ကျော်လွန်နေပါသည် — Grade Breakdown ဇယား Screenshot ကို ဖြတ်တောက် (Crop) ၍ ထည့်သွင်းပေးပါ။'
      );
      return;
    }

    const slotId = activeCourse.slotId;
    const isPreviewable = file.type.startsWith('image/') || file.type === 'application/pdf';
    const previewUrl = isPreviewable ? URL.createObjectURL(file) : null;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const fileMeta: SyllabusFileMeta = {
      name: file.name,
      type: file.type,
      sizeLabel: sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
    };

    setPreviewUrlsBySlot((prev) => {
      const oldUrl = prev[slotId];
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return { ...prev, [slotId]: previewUrl };
    });

    void runSyllabusExtraction(file, activeCourseIndex, fileMeta);
  };

  const handleReuploadReset = () => {
    const slotId = activeCourse.slotId;
    setPreviewUrlsBySlot((prev) => {
      const oldUrl = prev[slotId];
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return { ...prev, [slotId]: null };
    });

    updateActiveCourse((prev) => ({
      ...prev,
      extractedSyllabus: null,
      syllabusFileMeta: null,
      gradesByWeek: createEmptyGrades(),
      currentWeek: 1,
    }));
    setExtractionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearScoresOnly = () => {
    updateActiveCourse((prev) => ({
      ...prev,
      gradesByWeek: createEmptyGrades(),
      currentWeek: 1,
    }));
  };

  const analytics = useMemo(() => {
    const wConfig = extractedSyllabus?.weights ?? {
      discussion: 0,
      assignmentActivity: 0,
      quizzes: 0,
      finalExam: 0,
    };

    const perWeekDiscWeight = wConfig.discussion / 8;
    const perWeekAssignWeight = wConfig.assignmentActivity / 8;
    const perQuizWeight = wConfig.quizzes / 2;
    const finalExamWeight = wConfig.finalExam;

    let completedWeight = 0;
    let earnedCoursePoints = 0;
    let completedItemsCount = 0;
    let totalActiveSlotsCount = 0;

    const processSlot = (week: number, slotWeight: number, rawScore: string) => {
      if (slotWeight <= 0) return;
      totalActiveSlotsCount += 1;
      if (week > currentWeek) {
        return;
      }
      const parsed = parseScore(rawScore);
      if (parsed !== null) {
        completedWeight += slotWeight;
        earnedCoursePoints += (parsed / 100) * slotWeight;
        completedItemsCount += 1;
      }
    };

    let completedCourseworkWeight = 0;
    let earnedCourseworkPoints = 0;

    for (const w of WEEKS) {
      const g = gradesByWeek[w];
      if (w >= 1 && w <= 8) {
        processSlot(w, perWeekDiscWeight, g.discussion);
        processSlot(w, perWeekAssignWeight, g.assignmentActivity);

        if (w <= currentWeek) {
          const discScore = parseScore(g.discussion);
          if (perWeekDiscWeight > 0 && discScore !== null) {
            completedCourseworkWeight += perWeekDiscWeight;
            earnedCourseworkPoints += (discScore / 100) * perWeekDiscWeight;
          }
          const assignScore = parseScore(g.assignmentActivity);
          if (perWeekAssignWeight > 0 && assignScore !== null) {
            completedCourseworkWeight += perWeekAssignWeight;
            earnedCourseworkPoints += (assignScore / 100) * perWeekAssignWeight;
          }
        }
      }
      if (w === 3 || w === 6) {
        processSlot(w, perQuizWeight, g.quiz);
        if (w <= currentWeek) {
          const quizScore = parseScore(g.quiz);
          if (perQuizWeight > 0 && quizScore !== null) {
            completedCourseworkWeight += perQuizWeight;
            earnedCourseworkPoints += (quizScore / 100) * perQuizWeight;
          }
        }
      }
      if (w === 9) {
        processSlot(w, finalExamWeight, g.finalExam);
      }
    }

    const remainingWeight = Math.max(0, 100 - completedWeight);
    const currentStanding =
      completedWeight > 0 ? (earnedCoursePoints / completedWeight) * 100 : null;
    const maxPossibleScore = earnedCoursePoints + remainingWeight;
    const projectedAtCurrentPace =
      currentStanding !== null
        ? earnedCoursePoints + (currentStanding / 100) * remainingWeight
        : null;

    const minRequiredRemainingAvg =
      remainingWeight > 0
        ? ((C_PASSING_THRESHOLD - earnedCoursePoints) / remainingWeight) * 100
        : null;

    // Required score for Weeks 5-8 remaining coursework & Week 6 Quiz
    const requiredCourseworkScore =
      minRequiredRemainingAvg !== null
        ? Math.max(0, Math.min(100, minRequiredRemainingAvg))
        : C_PASSING_THRESHOLD;

    // Required Final Exam score for Week 9 based on coursework standing
    const totalCourseworkWeight = Math.max(0, 100 - finalExamWeight);
    const estimatedCourseworkPoints =
      completedCourseworkWeight > 0
        ? completedCourseworkWeight >= totalCourseworkWeight - 0.01
          ? earnedCourseworkPoints
          : (earnedCourseworkPoints / completedCourseworkWeight) * totalCourseworkWeight
        : 0;

    const rawRequiredExamScore =
      finalExamWeight > 0
        ? completedCourseworkWeight > 0
          ? ((C_PASSING_THRESHOLD - estimatedCourseworkPoints) / finalExamWeight) * 100
          : C_PASSING_THRESHOLD
        : 0;
    const requiredExamScore = Math.max(0, Math.min(100, rawRequiredExamScore));

    const isCGuaranteed = earnedCoursePoints >= C_PASSING_THRESHOLD;
    const isMathematicallyFailed =
      currentWeek > 1 && maxPossibleScore < C_PASSING_THRESHOLD - 0.001;
    const isProjectedBelow73 =
      currentWeek > 1 &&
      completedItemsCount > 0 &&
      ((projectedAtCurrentPace !== null && projectedAtCurrentPace < C_PASSING_THRESHOLD) ||
        isMathematicallyFailed);

    const standingLetter =
      currentStanding !== null ? getUoPeopleLetterGrade(currentStanding) : null;
    const maxPossibleLetter = getUoPeopleLetterGrade(maxPossibleScore);

    return {
      completedWeight,
      remainingWeight,
      completedItemsCount,
      totalActiveSlotsCount,
      earnedCoursePoints,
      currentStanding,
      standingLetter,
      maxPossibleScore,
      maxPossibleLetter,
      projectedAtCurrentPace,
      minRequiredRemainingAvg,
      requiredCourseworkScore,
      requiredExamScore,
      isCGuaranteed,
      isMathematicallyFailed,
      isProjectedBelow73,
    };
  }, [extractedSyllabus, gradesByWeek, currentWeek]);

  const meterZone = useMemo(() => {
    if (currentWeek === 1) {
      return {
        label: 'WEEK 1 ORIENTATION PERIOD',
        badgeColor: 'text-cyan-300',
        barClass: 'from-indigo-500 to-cyan-400',
        cardBorder: 'border-cyan-500/40',
      };
    }
    if (analytics.isMathematicallyFailed) {
      return {
        label: 'CRITICAL RISK (< 73% Ceiling)',
        badgeColor: 'text-rose-300',
        barClass: 'from-rose-600 to-rose-400',
        cardBorder: 'border-rose-500/50',
      };
    }
    if (analytics.currentStanding === null) {
      return {
        label: 'AWAITING WEEK SCORES',
        badgeColor: 'text-slate-400',
        barClass: 'from-indigo-500 to-cyan-400',
        cardBorder: 'border-slate-800',
      };
    }
    if (analytics.isProjectedBelow73) {
      return {
        label: 'TURNAROUND NEEDED (< 73%)',
        badgeColor: 'text-amber-300',
        barClass: 'from-amber-500 to-orange-400',
        cardBorder: 'border-amber-500/45',
      };
    }
    if (analytics.currentStanding >= 83) {
      return {
        label: 'SAFE STANDING (SCHOLARSHIP SAFE)',
        badgeColor: 'text-emerald-300',
        barClass: 'from-emerald-500 to-cyan-400',
        cardBorder: 'border-emerald-500/40',
      };
    }
    return {
      label: 'PASSING ZONE (C+ / C RANGE)',
      badgeColor: 'text-cyan-300',
      barClass: 'from-cyan-500 to-indigo-400',
      cardBorder: 'border-cyan-500/40',
    };
  }, [analytics, currentWeek]);

  const formattedRequiredCourseworkScore = analytics.requiredCourseworkScore.toFixed(1);
  const formattedRequiredExamScore = analytics.requiredExamScore.toFixed(1);

  const currentTermName = useMemo(() => {
    const liveContext = resolveLiveAcademicContext();
    const activeCycle =
      liveContext.currentTerm || liveContext.upcomingTerm || liveContext.previousTerm;
    if (activeCycle) {
      return `${activeCycle.academicYear} ${activeCycle.termLabel}`;
    }
    return '2026-2027 Term 2';
  }, []);

  return (
    <section
      aria-label="Academic Standing and Probation Safety Meter"
      className="w-full space-y-5 text-slate-100"
    >
      {/* Multi-Course Tabs Bar: [Course 1] [Course 2] [Course 3] [Course 4] */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-[#0c1222]/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-1">
          <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
            Multi-Course Safety Tracker
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="text-xs text-slate-400">
            {courses.filter((c) => c.extractedSyllabus !== null).length}/4 Active
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Select course slot"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto"
        >
          {courses.map((courseSlot, idx) => {
            const isSelected = idx === activeCourseIndex;
            const isConfigured = courseSlot.extractedSyllabus !== null;
            const subtitle = courseSlot.extractedSyllabus?.courseName;

            return (
              <button
                key={courseSlot.slotId}
                role="tab"
                aria-selected={isSelected}
                type="button"
                onClick={() => handleSelectCourseTab(idx)}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-2 whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-lg shadow-indigo-950/40'
                    : isConfigured
                    ? 'bg-slate-900/90 border-emerald-500/35 text-slate-200 hover:border-emerald-400/60 hover:text-white'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span>{courseSlot.defaultLabel}</span>
                  {subtitle && (
                    <span
                      className={`text-[10px] font-mono truncate max-w-[90px] ${
                        isSelected ? 'text-indigo-100' : 'text-emerald-300'
                      }`}
                    >
                      ({subtitle})
                    </span>
                  )}
                </div>
                {isConfigured && (
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-white' : 'text-emerald-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          DEFAULT STATE FOR SELECTED COURSE: Before Syllabus Extraction
         ===================================================================== */}
      {!extractedSyllabus ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isExtractingSyllabus) setIsDraggingSyllabus(true);
          }}
          onDragLeave={() => setIsDraggingSyllabus(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingSyllabus(false);
            if (isExtractingSyllabus) return;
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) {
              handleSyllabusFileSelect(dropped);
            }
          }}
          className={`p-6 sm:p-10 rounded-3xl border-2 border-dashed transition-all text-center space-y-6 shadow-xl ${
            isDraggingSyllabus
              ? 'border-cyan-400 bg-cyan-950/30'
              : 'border-indigo-500/40 bg-[#0c1222]/90 hover:border-indigo-400/70'
          }`}
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center">
            <Gauge className="w-7 h-7" />
          </div>

          <div className="max-w-2xl mx-auto space-y-2.5">
            <div className="text-xs font-mono font-bold text-indigo-300">
              {activeCourse.defaultLabel} Slot
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight text-balance">
              🛡️ Academic Standing &amp; Probation Safety Meter
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              သင်ယူနေသော Course ၏ Syllabus PDF (သို့မဟုတ်) Grade Breakdown ဇယား Screenshot ကို ထည့်သွင်းပေးပါ (Screenshot ပုံထည့်ပြီးမှသာ အမှတ်တွက်ချက်မှုဇယား ပွင့်လာပါမည်)
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-3">
            <button
              type="button"
              disabled={isExtractingSyllabus}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-55 text-white text-sm font-bold shadow-lg shadow-indigo-950/40 inline-flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>
                {isExtractingSyllabus ? 'AI ဖြင့် Syllabus စိစစ်နေပါသည်...' : 'PDF / Screenshot ထည့်မည်'}
              </span>
            </button>
            <span className="text-xs text-slate-400">
              Drag &amp; Drop PDF, PNG, JPG, or WEBP (Max 7MB)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => handleSyllabusFileSelect(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          {isExtractingSyllabus && (
            <div className="max-w-xl mx-auto p-3.5 rounded-xl bg-indigo-950/45 border border-indigo-500/35 flex items-center justify-center gap-3 text-xs sm:text-sm text-indigo-200">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>
                Syllabus ဖိုင်မှ Discussion, Assignment Activity, Quizzes နှင့် Final Exam % အချိုးအစားများကို ထုတ်ယူနေပါသည်...
              </span>
            </div>
          )}

          {extractionError && !isExtractingSyllabus && (
            <div
              role="alert"
              className="max-w-2xl mx-auto p-4 rounded-xl bg-amber-950/45 border border-amber-500/45 text-xs sm:text-sm text-amber-200 leading-relaxed flex items-start justify-between gap-3 text-left"
            >
              <span>{extractionError}</span>
              <button
                type="button"
                onClick={() => setExtractionError(null)}
                className="text-amber-300 hover:text-white shrink-0 cursor-pointer p-1"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* =====================================================================
           ACTIVE STATE FOR SELECTED COURSE: After Gemini Extracted Weights
           ===================================================================== */
        <>
          {/* Compact Verified Summary Banner + Re-upload / Reset */}
          <div className="p-4 sm:p-5 rounded-3xl bg-emerald-950/35 border border-emerald-500/40 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="font-mono font-bold text-indigo-300">
                  [{activeCourse.defaultLabel}]
                </span>
                <span className="font-bold text-white">
                  🛡️ Academic Standing &amp; Probation Safety Meter
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span className={`font-semibold ${meterZone.badgeColor}`}>{meterZone.label}</span>
              </div>

              <p className="text-xs sm:text-sm font-bold text-emerald-200 leading-relaxed tabular-nums">
                ✅ Course: {extractedSyllabus.courseName} | Assignment Activity:{' '}
                {extractedSyllabus.weights.assignmentActivity}% | Discussion:{' '}
                {extractedSyllabus.weights.discussion}% | Quizzes:{' '}
                {extractedSyllabus.weights.quizzes}% | Final Exam:{' '}
                {extractedSyllabus.weights.finalExam}% (Total: 100%)
              </p>

              {syllabusFileMeta && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {syllabusFileMeta.type.startsWith('image/') ? (
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[260px]">{syllabusFileMeta.name}</span>
                  {syllabusFileMeta.sizeLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{syllabusFileMeta.sizeLabel}</span>
                    </>
                  )}
                  {activePreviewUrl && (
                    <>
                      <span aria-hidden="true">·</span>
                      <a
                        href={activePreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline font-semibold"
                      >
                        Preview
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleClearScoresOnly}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Clear Scores</span>
              </button>

              <button
                type="button"
                onClick={handleReuploadReset}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-md shadow-indigo-950/40"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span>Re-upload / Reset</span>
              </button>
            </div>
          </div>

          {/* Refined Timeline & Score-Aware Recommendation Banner */}
          {currentWeek === 1 && (
            <div
              role="status"
              className="p-5 sm:p-6 rounded-3xl bg-sky-950/45 border border-sky-500/45 text-sky-100 shadow-xl space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  ℹ️ {currentTermName} · Week {currentWeek}: စာသင်နှစ် စတင်ချိန် အသိပေးချက်
                </h3>
                <span className="text-xs font-mono text-sky-300 tabular-nums">
                  {currentTermName} · Week {currentWeek} · Initial Orientation &amp; Adjustment
                </span>
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-sky-100/95 leading-relaxed">
                <p>
                  သင်ယူမှု အဆင်ပြေချောမွေ့ပြီး စာလိုက်နိုင်ပါက မည်သည့် အဆင့်မှ လုပ်ဆောင်ရန် မလိုဘဲ ပုံမှန်အတိုင်း ဆက်လက် လေ့လာနိုင်ပါသည်။
                </p>
                <p>
                  အကယ်၍ အလုပ်မအားလပ်ခြင်း သို့မဟုတ် အကြောင်းအမျိုးမျိုးကြောင့် ဤဘာသာရပ်ကို အချိန်မပေးနိုင်တော့ဟု ယူဆပါက Transcript တွင် မှတ်တမ်းလုံးဝမကျန်စေမည့် Course Drop လုပ်ရန် စဉ်းစားနိုင်ပါသည်။
                </p>
              </div>
            </div>
          )}

          {currentWeek >= 2 && currentWeek <= 4 && !analytics.isProjectedBelow73 && (
            <div
              role="status"
              className="p-5 sm:p-6 rounded-3xl bg-emerald-950/40 border border-emerald-500/45 text-emerald-100 shadow-xl space-y-2.5"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  🟢 {currentTermName} · Week {currentWeek}: လက်ရှိ အခြေအနေ ကောင်းမွန်ပါသည်
                </h3>
                <span className="text-xs font-mono text-emerald-300 tabular-nums">
                  {currentTermName} · Week {currentWeek} ·{' '}
                  {analytics.projectedAtCurrentPace !== null
                    ? `Projected: ${analytics.projectedAtCurrentPace.toFixed(1)}% (≥ 73% C Grade)`
                    : 'On Track (≥ 73% C Grade Target)'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/95 leading-relaxed">
                ပုံမှန်အတိုင်း Discussion Forum Initial Post များကို စောစောတင်ပြီး Assignment Activity များတွင် Rubric စံနှုန်းနှင့်အညီ ဆက်လက် ထိန်းသိမ်းသွားပါ။
              </p>
            </div>
          )}

          {currentWeek >= 2 && currentWeek <= 4 && analytics.isProjectedBelow73 && (
            <div
              role="alert"
              className="p-5 sm:p-6 rounded-3xl bg-amber-950/45 border border-amber-500/55 text-amber-100 shadow-xl space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  📈 {currentTermName} · Week {currentWeek}: အမှတ်ပြန်လည်ဆွဲတင်ရန် အခွင့်အလမ်းရှိသော ကာလ
                </h3>
                <span className="text-xs font-mono text-amber-300 tabular-nums">
                  {currentTermName} · Week {currentWeek} · Projected:{' '}
                  {analytics.projectedAtCurrentPace !== null
                    ? `${analytics.projectedAtCurrentPace.toFixed(1)}%`
                    : '—'}{' '}
                  (&lt; 73% C Grade)
                </span>
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-amber-100/95 leading-relaxed">
                <p>
                  လက်ရှိ အမှတ် အနည်းငယ် လျော့နည်းနေသော်လည်း ဘာသာရပ်ပြီးဆုံးရန် အပတ်များစွာ ကျန်ရှိနေသေးသဖြင့် စနစ်တကျ ပြန်လည်ဆွဲတင်နိုင်ပါသေးသည်။
                </p>
                <p>
                  Week 3 Graded Quiz နှင့် Assignment Activities များကို အမှတ်အပြည့်နီးပါးရအောင် သေချာ အာရုံစိုက်ပါ။
                </p>
                <p>
                  အကယ်၍ အခက်အခဲများကြောင့် ဤ Term တွင် ဆက်မလိုက်နိုင်တော့ပါက CGPA မထိခိုက်စေရန် Week 4 မကုန်မီ Course Withdrawal (W) ပြုလုပ်ရန် စဉ်းစားပါ။ Withdrawal ပြုလုပ်ခြင်းသည် လက်ရှိ Scholarship ကို လုံးဝ မထိခိုက်ကြောင်းနှင့် အသေးစိတ် အချက်အလက်များကို အထက်ပါ{' '}
                  <strong className="text-white font-extrabold">
                    &apos;UoPeople Quick Guide&apos;
                  </strong>{' '}
                  ကဏ္ဍတွင် ဝင်ရောက်စစ်ဆေးဖတ်ရှုနိုင်ပါသည်။
                </p>
              </div>
            </div>
          )}

          {currentWeek >= 5 && currentWeek <= 8 && (
            <div
              role="region"
              aria-label="Weeks 5 to 8 Coursework Turnaround Guidance"
              className="p-5 sm:p-6 rounded-3xl bg-indigo-950/45 border border-indigo-500/50 text-indigo-100 shadow-xl space-y-3.5"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  ⚠️ {currentTermName} · Week {currentWeek}: အသေးစိတ် ပြင်ဆင်ပြီး စာပြန်လည်ဆွဲတင်ရမည့် အဆင့်
                </h3>
                <span className="text-xs font-mono text-indigo-300 tabular-nums">
                  {currentTermName} · Week {currentWeek} · Required Coursework Avg: {formattedRequiredCourseworkScore}%
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-indigo-500/35 text-xs sm:text-sm font-bold text-cyan-200 leading-relaxed tabular-nums">
                ဘာသာရပ်တစ်ခုလုံး C Grade (73% / 2.00) ပြည့်မီရန် ကျန်ရှိသော Coursework များနှင့် Week 6 Quiz တွင် အနည်းဆုံး ပျမ်းမျှ{' '}
                <span className="font-mono text-white underline decoration-cyan-400/80 underline-offset-4">
                  {formattedRequiredCourseworkScore}%
                </span>{' '}
                ရရှိရန် လိုအပ်ပါသည်
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Discussion အမှတ်နှင့် Assignment Activity များကို ဆရာ့ထံမှ Rubric Feedback ရယူကာ သေသေချာချာ အသေးစိတ် ပြင်ဆင်ရေးသားပါ။
              </p>

              <div className="p-3.5 rounded-2xl bg-indigo-900/25 border border-indigo-400/30 text-xs sm:text-sm text-indigo-100 leading-relaxed">
                💪 စိတ်ဓာတ်မကျပါနဲ့။ အွန်လိုင်းကနေ ကိုယ်တိုင်လေ့လာရတာ စိန်ခေါ်မှုတွေ များပြားတတ်ပါတယ်။ အခုအချိန်မှာ တစ်ပတ်ချင်းစီ အာရုံစိုက်ပြီး စာကို သေချာလိုက်လုပ်ရင် လုံလောက်တဲ့ အောင်မှတ်တစ်ခုကို သေချာပေါက် ပြန်လည်ရယူနိုင်ပါတယ်။ ကိုယ့်ကိုယ်ကိုယ် ယုံကြည်ပြီး ဆက်လက် ကြိုးစားပေးပါ။
              </div>
            </div>
          )}

          {currentWeek === 9 && (
            <div
              role="region"
              aria-label="Week 9 Final Exam Target and Encouragement"
              className="p-5 sm:p-6 rounded-3xl bg-purple-950/40 border border-purple-500/50 text-purple-100 shadow-xl space-y-3.5"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  🎯 {currentTermName} · Week 9: Final Exam ပစ်မှတ်နှင့် အောင်မြင်မှု ခရီး
                </h3>
                <span className="text-xs font-mono text-purple-300 tabular-nums">
                  {currentTermName} · Week 9 · Final Exam Weight: {extractedSyllabus.weights.finalExam}%
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-purple-500/35 text-xs sm:text-sm font-bold text-cyan-200 leading-relaxed tabular-nums">
                ဘာသာရပ် အောင်မြင်ရန် လာမည့် Final Exam တွင် အနည်းဆုံး{' '}
                <span className="font-mono text-white underline decoration-cyan-400/80 underline-offset-4">
                  {formattedRequiredExamScore}%
                </span>{' '}
                ရရှိရန် လိုအပ်ပါသည်
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Week 8 Review Quiz များကို အထပ်ထပ် ပြန်လည်ဖြေဆိုပြီး စာမေးပွဲ အချိန်ဇယားနှင့် Rosalyn AI စည်းကမ်းများကို သေချာ ပြန်လည်စစ်ဆေးပါ။
              </p>

              <div className="p-3.5 rounded-2xl bg-purple-900/25 border border-purple-400/30 text-xs sm:text-sm text-purple-100 leading-relaxed">
                🌟 ၉ ပတ်တာ ခရီးစဉ်တစ်ခုလုံးကို အကောင်းဆုံး ကြိုးစားဖြတ်သန်းလာခဲ့ပြီးပါပြီ။ နောက်ဆုံး အဆင့်တစ်ခုတည်းသာ ကျန်ပါတော့တယ်။ စိတ်အေးအေးထားပြီး ကိုယ်လေ့လာထားတာတွေကို အကောင်းဆုံး ချပြလိုက်ပါ။ ဤဘာသာရပ်ကို အောင်မြင်စွာ ကျော်လွှားနိုင်မယ်လို့ အပြည့်အဝ ယုံကြည်ပါတယ်!
              </div>
            </div>
          )}

          {/* Live Probation & Safety Engine Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Current Standing & 73% Safe Line Gauge */}
            <div
              className={`lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-[#0c1222]/90 border ${meterZone.cardBorder} shadow-xl space-y-5`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="font-bold text-slate-200">
                  Current Standing (ပြီးစီးသမျှ ပျမ်းမျှ)
                </span>
                <span className="font-mono tabular-nums text-slate-300">
                  {analytics.completedItemsCount}/{analytics.totalActiveSlotsCount} Graded
                </span>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight font-mono tabular-nums">
                    {currentWeek === 1 && analytics.currentStanding === null
                      ? 'W1'
                      : analytics.currentStanding !== null
                      ? `${analytics.currentStanding.toFixed(1)}%`
                      : '—'}
                  </span>
                  {analytics.standingLetter && (
                    <span className="text-sm font-mono font-bold text-indigo-300 tabular-nums">
                      {analytics.standingLetter.letter} ({analytics.standingLetter.gpa})
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Earned Weighted Points</div>
                  <div className="text-sm font-mono font-bold text-cyan-300 tabular-nums">
                    {analytics.earnedCoursePoints.toFixed(1)} / 100 pts
                  </div>
                </div>
              </div>

              {/* Safety Gauge Bar with 73% C-Threshold Marker */}
              <div className="space-y-2 pt-1">
                <div className="relative w-full h-3.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${meterZone.barClass} rounded-full transition-all duration-300`}
                    style={{
                      width: `${Math.min(100, Math.max(0, analytics.currentStanding ?? 0))}%`,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    title="C Grade / Good Standing Threshold (73%)"
                    className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    style={{ left: '73%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                  <span>0%</span>
                  <span className="text-slate-200 font-bold">▲ C Grade Safe Line (73% / 2.00)</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-950/75 border border-slate-800">
                  <div className="text-slate-400">Completed Weight</div>
                  <div className="text-sm font-mono font-bold text-slate-100 mt-0.5 tabular-nums">
                    {analytics.completedWeight.toFixed(1)}% / 100%
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/75 border border-slate-800">
                  <div className="text-slate-400">Remaining Weight</div>
                  <div className="text-sm font-mono font-bold text-cyan-300 mt-0.5 tabular-nums">
                    {analytics.remainingWeight.toFixed(1)}% Pending
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Minimum Required Remaining Average & Maximum Score Forecast */}
            <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-[#0c1222]/90 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Probation Recovery &amp; Score Forecast
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-300 tabular-nums">
                  Active Week: <strong className="text-indigo-300">Week {currentWeek}</strong> / 9
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-xs font-semibold text-slate-400">
                    {currentWeek === 9
                      ? 'Minimum Required Final Exam Score'
                      : 'Minimum Required Avg (Remaining)'}
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white tabular-nums">
                    {currentWeek === 1 && analytics.completedItemsCount === 0
                      ? 'Pending W1'
                      : currentWeek === 9
                      ? `${formattedRequiredExamScore}%`
                      : analytics.isCGuaranteed
                      ? '0.0%'
                      : analytics.minRequiredRemainingAvg !== null
                      ? analytics.minRequiredRemainingAvg > 100
                        ? `>100% (${analytics.minRequiredRemainingAvg.toFixed(1)}%)`
                        : `${Math.max(0, analytics.minRequiredRemainingAvg).toFixed(1)}%`
                      : '—'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentWeek === 1 && analytics.completedItemsCount === 0
                      ? 'ပထမပတ် အမှတ်များ မထွက်သေးပါ'
                      : analytics.isCGuaranteed
                      ? '✓ 73% C Grade အမှတ် ပြည့်မီပြီး ဖြစ်ပါသည်'
                      : currentWeek === 9
                      ? `Final Exam (${extractedSyllabus.weights.finalExam}%) ပစ်မှတ်`
                      : analytics.remainingWeight === 0
                      ? 'ကျန်ရှိသော Coursework မရှိတော့ပါ'
                      : `ကျန် ${analytics.remainingWeight.toFixed(1)}% အတွက် လိုအပ်ချက်`}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-xs font-semibold text-slate-400">
                    Maximum Possible Score (100% Ceiling)
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                        analytics.isMathematicallyFailed ? 'text-rose-400' : 'text-emerald-300'
                      }`}
                    >
                      {analytics.maxPossibleScore.toFixed(1)}%
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      ({analytics.maxPossibleLetter.letter})
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {analytics.projectedAtCurrentPace !== null
                      ? `လက်ရှိနှုန်းထားအတိုင်းဆိုလျှင် ခန့်မှန်း: ${analytics.projectedAtCurrentPace.toFixed(1)}%`
                      : 'ကျန်ရှိသမျှ 100% ရပါက ရနိုင်မည့် အမြင့်ဆုံးအမှတ်'}
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed font-medium ${
                  currentWeek === 1 && analytics.completedItemsCount === 0
                    ? 'bg-sky-950/35 border-sky-500/40 text-sky-100'
                    : analytics.isMathematicallyFailed
                    ? 'bg-rose-950/40 border-rose-500/45 text-rose-200'
                    : analytics.isCGuaranteed
                    ? 'bg-emerald-950/35 border-emerald-500/40 text-emerald-200'
                    : analytics.isProjectedBelow73
                    ? 'bg-amber-950/35 border-amber-500/40 text-amber-200'
                    : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100'
                }`}
              >
                {currentWeek === 1 && analytics.completedItemsCount === 0 ? (
                  <p>
                    Week 1 တွင် ဘာသာရပ် အမှတ်စာရင်းများ မထွက်ရှိသေးပါ။ သင်ရိုးညွှန်းတမ်းနှင့် အချိန်ဇယားကို လေ့လာပြီး ပုံမှန်အတိုင်း စတင်နိုင်ပါသည်။
                  </p>
                ) : analytics.isCGuaranteed ? (
                  <p>
                    🎉 ဂုဏ်ယူပါသည် — လက်ရှိရရှိပြီးသား အမှတ် (
                    {analytics.earnedCoursePoints.toFixed(1)}%) ဖြင့်ပင်{' '}
                    <strong>C Grade (73% / 2.00)</strong> ရရှိပြီး Probation မှ လွတ်မြောက်ရန် သေချာနေပြီ ဖြစ်ပါသည်။
                  </p>
                ) : currentWeek === 9 ? (
                  <p>
                    ဘာသာရပ် အောင်မြင်ရန် လာမည့် Final Exam တွင် အနည်းဆုံး{' '}
                    <strong className="font-mono text-white underline decoration-cyan-400/70 underline-offset-4 tabular-nums">
                      {formattedRequiredExamScore}%
                    </strong>{' '}
                    ရရှိရန် လိုအပ်ပါသည်
                  </p>
                ) : analytics.remainingWeight > 0 && analytics.minRequiredRemainingAvg !== null ? (
                  <p>
                    ဘာသာရပ်တစ်ခုလုံး C Grade (73% / 2.00) ပြည့်မီရန် ကျန်ရှိသော Coursework များနှင့် Week 6 Quiz တွင် အနည်းဆုံး ပျမ်းမျှ{' '}
                    <strong className="font-mono text-white underline decoration-cyan-400/70 underline-offset-4 tabular-nums">
                      {formattedRequiredCourseworkScore}%
                    </strong>{' '}
                    ရရှိရန် လိုအပ်ပါသည်
                  </p>
                ) : (
                  <p>
                    {analytics.earnedCoursePoints >= C_PASSING_THRESHOLD
                      ? `သင်တန်းပြီးဆုံးရမှတ် ${analytics.earnedCoursePoints.toFixed(1)}% ဖြင့် C Grade (73%) အထက် အောင်မြင်ပါသည်။`
                      : `သင်တန်းပြီးဆုံးရမှတ် ${analytics.earnedCoursePoints.toFixed(1)}% ဖြစ်ပြီး C Grade (73%) မပြည့်မီပါ။`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Week-by-Week Grade Tracking (Week 1 – Week 9): Discussion, Assignment Activity, Graded Quizzes, Final Exam */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#0c1222]/90 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Week-by-Week Grade Tracking (Week 1 – Week 9) · {extractedSyllabus.courseName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ရရှိပြီးသား အမှတ်များ (0–100%) ကို ဖြည့်သွင်းပါ — မရောက်သေးသော အပတ်များကို{' '}
                  <span className="text-slate-200 font-semibold">Projected/Pending</span> အဖြစ် သတ်မှတ်ထားပါသည်။
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-400 mr-1">Current Week:</span>
                {WEEKS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleSetCurrentWeek(w)}
                    className={`min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer tabular-nums ${
                      currentWeek === w
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/40'
                        : w < currentWeek
                        ? 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    W{w}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {WEEKS.map((week) => {
                const isFutureWeek = week > currentWeek;
                const isCurrent = week === currentWeek;
                const hasQuiz = week === 3 || week === 6;
                const isFinalWeek = week === 9;
                const wg = gradesByWeek[week];
                const { weights } = extractedSyllabus;

                return (
                  <div
                    key={week}
                    className={`p-4 rounded-2xl border transition-colors space-y-3 ${
                      isFinalWeek ? 'md:col-span-2' : ''
                    } ${
                      isFutureWeek
                        ? 'bg-slate-950/45 border-slate-800/70 opacity-75'
                        : isCurrent
                        ? 'bg-indigo-950/20 border-indigo-500/45'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`font-mono font-extrabold ${
                            isFutureWeek
                              ? 'text-slate-500'
                              : isCurrent
                              ? 'text-indigo-300'
                              : 'text-slate-100'
                          }`}
                        >
                          Week {week}
                        </span>

                        {hasQuiz && (
                          <>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className="font-semibold text-cyan-300">Graded Quiz</span>
                          </>
                        )}

                        {isFinalWeek && (
                          <>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className="font-semibold text-amber-300">Final Exam Week</span>
                          </>
                        )}
                      </div>

                      <span
                        className={`text-[11px] font-semibold ${
                          isFutureWeek
                            ? 'text-slate-400'
                            : isCurrent
                            ? 'text-indigo-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {isFutureWeek
                          ? 'Projected / Pending'
                          : isCurrent
                          ? 'Active Week'
                          : 'Completed / Open'}
                      </span>
                    </div>

                    {!isFinalWeek ? (
                      <div
                        className={`grid gap-2.5 ${
                          hasQuiz ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
                        }`}
                      >
                        <WeekScoreInput
                          id={`c${activeCourse.slotId}-w${week}-disc`}
                          label="Discussion"
                          weightHint={
                            weights.discussion > 0
                              ? `${(weights.discussion / 8).toFixed(2)}%`
                              : '0%'
                          }
                          value={wg.discussion}
                          disabled={isFutureWeek || weights.discussion === 0}
                          isPending={isFutureWeek}
                          onChange={(val) => handleScoreChange(week, 'discussion', val)}
                        />
                        <WeekScoreInput
                          id={`c${activeCourse.slotId}-w${week}-assign-activity`}
                          label="Assignment Activity"
                          weightHint={
                            weights.assignmentActivity > 0
                              ? `${(weights.assignmentActivity / 8).toFixed(2)}%`
                              : '0%'
                          }
                          value={wg.assignmentActivity}
                          disabled={isFutureWeek || weights.assignmentActivity === 0}
                          isPending={isFutureWeek}
                          onChange={(val) => handleScoreChange(week, 'assignmentActivity', val)}
                        />
                        {hasQuiz && (
                          <WeekScoreInput
                            id={`c${activeCourse.slotId}-w${week}-quiz`}
                            label={`Graded Quiz ${week === 3 ? '1' : '2'}`}
                            weightHint={
                              weights.quizzes > 0 ? `${(weights.quizzes / 2).toFixed(2)}%` : '0%'
                            }
                            value={wg.quiz}
                            disabled={isFutureWeek || weights.quizzes === 0}
                            isPending={isFutureWeek}
                            onChange={(val) => handleScoreChange(week, 'quiz', val)}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="max-w-sm">
                        <WeekScoreInput
                          id={`c${activeCourse.slotId}-w9-final`}
                          label="Final Exam (Week 9)"
                          weightHint={
                            weights.finalExam > 0 ? `${weights.finalExam}%` : '0% (No Exam)'
                          }
                          value={wg.finalExam}
                          disabled={isFutureWeek || weights.finalExam === 0}
                          isPending={isFutureWeek}
                          onChange={(val) => handleScoreChange(9, 'finalExam', val)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

interface WeekScoreInputProps {
  id: string;
  label: string;
  weightHint: string;
  value: string;
  disabled: boolean;
  isPending: boolean;
  onChange: (val: string) => void;
}

const WeekScoreInput: React.FC<WeekScoreInputProps> = ({
  id,
  label,
  weightHint,
  value,
  disabled,
  isPending,
  onChange,
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <label htmlFor={id} className="text-xs font-semibold text-slate-300 truncate">
          {label}
        </label>
        <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
          {weightHint}
        </span>
      </div>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={isPending ? '' : value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isPending ? 'Pending' : weightHint.startsWith('0%') ? 'N/A' : '0–100'}
          className="w-full min-h-[40px] px-3 py-2 pr-7 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:bg-slate-950/70 disabled:text-slate-500 disabled:border-slate-800 disabled:cursor-not-allowed tabular-nums"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-500 pointer-events-none">
          %
        </span>
      </div>
    </div>
  );
};

export default ProbationSafetyMeter;
