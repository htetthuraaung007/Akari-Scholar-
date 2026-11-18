/**
 * Dedicated Reader AI Service (Strict Under-the-Hood Gemini Model Architecture)
 * - Instant Anti-Bot Security Check Bypass via Jina Reader proxy + Academic Markdown Sanitizer
 * - A. One-Time Live Fetch from v1beta/models stored in `modelCache`
 * - B. Strict Filtering: supportedGenerationMethods includes "generateContent"; excludes embeddings & audio-only
 * - C. Zero 404 Speculative Attempts: Only uses confirmed active names from the live list
 * - D. Ascending Token Efficiency Sorting: flash-lite -> flash -> other active generation models
 * - E. In-Memory Reuse: Reuses `modelCache` across clicks without duplicate `/models` fetches
 * - F. Streaming Execution: Streams tokens directly chunk-by-chunk via streamGenerateContent SSE
 */

import { cleanGeminiKey } from './geminiService';
import { sanitizeAcademicQuestionStem } from '../utils/textbookStripper';

export interface SynthesisSummaryData {
  executiveSynthesis: string;
  studyNotesMarkdown: string;
  coreTakeaways: Array<{ concept: string; explanation: string }>;
  methodologyAndMetrics: string;
  selfAssessmentQuestions: string[];
}

export interface ReaderQuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface CleanedReaderDocument {
  title: string;
  markdown: string;
  sourceUrl: string;
}

// =========================================================================
// 1. INSTANT ANTI-BOT SECURITY CHECK BYPASS & CLEAN MARKDOWN EXTRACTION
// =========================================================================

const CLOUDFLARE_AND_NOISE_LINE_PATTERNS: RegExp[] = [
  /performing security verification/i,
  /checking (your|if the site) (browser|connection)/i,
  /just a moment\.{0,3}/i,
  /verify you are human/i,
  /enable javascript and cookies to continue/i,
  /ddos protection by cloudflare/i,
  /cloudflare ray id/i,
  /attention required!\s*\|\s*cloudflare/i,
  /^(accept all|reject all|manage)\s+cookies?/i,
  /cookie\s+(preferences|settings|policy|consent)/i,
  /we use cookies to/i,
  /^skip to (main )?(content|navigation|footer)/i,
  /^(sign in|log in|register|subscribe|institutional access|get access|purchase pdf)$/i,
  /^(previous|next)\s+(section|chapter|page|article)$/i,
  /^(home|about|contact|privacy policy|terms of use|accessibility)\s*\|?/i,
  /<script[\s\S]*?<\/script>/i,
  /^(Title|URL Source|Published Time|Markdown Content):\s*/i,
];

function isRawBreadcrumbOrTocLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Repeated URL breadcrumbs like: * [Home](https://...) / [Journal](https://...)
  if (/^(\*\s*)?\[[^\]]+\]\(https?:\/\/[^)]+\)(\s*[>/|›»]\s*\[[^\]]+\]\(https?:\/\/[^)]+\)){2,}$/.test(trimmed)) {
    return true;
  }
  // Raw table-of-contents bullet links without explanatory prose
  if (/^[-*•]\s+\[[^\]]{2,90}\]\((https?:\/\/[^)]+|#[^)]+)\)\s*$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Strips Cloudflare challenges, cookie banners, nav sidebars, breadcrumbs,
 * raw TOC link lists, and tracking scripts while preserving headings (#, ##, ###),
 * structured paragraphs, educational diagrams (![]()), and markdown tables (|---|---|).
 */
export function sanitizeReaderMarkdown(rawContent: string, sourceUrl: string): CleanedReaderDocument {
  const normalized = (rawContent || '')
    .replace(/\r\n/g, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const lines = normalized.split('\n');
  let extractedTitle = '';
  const cleanedLines: string[] = [];
  let consecutiveTocLinks = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^Title:\s*/i.test(trimmed)) {
      const candidate = trimmed.replace(/^Title:\s*/i, '').trim();
      if (candidate && !/just a moment|cloudflare|security verification/i.test(candidate)) {
        extractedTitle = candidate;
      }
      continue;
    }

    if (CLOUDFLARE_AND_NOISE_LINE_PATTERNS.some((rx) => rx.test(trimmed))) {
      continue;
    }

    if (isRawBreadcrumbOrTocLine(trimmed)) {
      consecutiveTocLinks++;
      continue;
    } else {
      consecutiveTocLinks = 0;
    }

    // Preserve markdown headings (#, ##, ###), tables (|---|---|), images (![]()), and prose
    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('|') ||
      /^!\[[^\]]*\]\([^)]+\)/.test(trimmed)
    ) {
      if (!extractedTitle && /^#\s+/.test(trimmed)) {
        extractedTitle = trimmed.replace(/^#\s+/, '').trim();
      }
      cleanedLines.push(rawLine);
      continue;
    }

    // Strip tracking query parameters from inline links while keeping readable markdown
    const cleanTracking = rawLine.replace(
      /([?&])(utm_[^=&\s]+|fbclid|gclid|mc_cid|mc_eid|_ga)=[^&\s)]+/gi,
      ''
    );

    if (consecutiveTocLinks < 2) {
      cleanedLines.push(cleanTracking);
    }
  }

  const body = cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    title: extractedTitle || sourceUrl.split('/').filter(Boolean).pop() || 'Academic Document',
    markdown: body,
    sourceUrl,
  };
}

/**
 * Fetches an Open Access / Web URL through Jina Reader proxy to bypass Cloudflare
 * anti-bot checks silently and returns sanitized academic markdown.
 */
export async function fetchAndCleanReaderUrl(rawUrl: string): Promise<CleanedReaderDocument> {
  const trimmedUrl = (rawUrl || '').trim();
  if (!trimmedUrl) {
    throw new Error('Please enter a valid academic article or Open Access URL.');
  }

  const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
  const proxyUrl = `https://r.jina.ai/${encodeURIComponent(normalizedUrl)}`;

  const res = await fetch(proxyUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'text/plain, text/markdown',
      'X-Return-Format': 'markdown',
      'X-No-Cache': 'true',
      Connection: 'keep-alive',
    },
  });

  if (!res.ok) {
    throw new Error('Unable to retrieve readable academic content from this link. Try another Open Access URL or upload a PDF.');
  }

  const rawText = await res.text();
  if (!rawText || rawText.trim().length < 60) {
    throw new Error('Extracted page content was empty or blocked by publisher restrictions.');
  }

  const sanitized = sanitizeReaderMarkdown(rawText, normalizedUrl);
  if (!sanitized.markdown || sanitized.markdown.length < 60) {
    throw new Error('Could not extract clean academic paragraphs from this URL.');
  }

  return sanitized;
}

// =========================================================================
// 2. UNDER-THE-HOOD FAST AI ARCHITECTURE & IN-MEMORY MODEL CACHE
// =========================================================================

let modelCache: string[] | null = null;
let modelCacheKeySignature = '';
let inFlightModelFetch: Promise<string[]> | null = null;

function readUnifiedGeminiKey(explicitApiKey?: string): string {
  const direct = cleanGeminiKey(explicitApiKey || '');
  if (direct) return direct;
  if (typeof window !== 'undefined') {
    const stored =
      localStorage.getItem('akari_gemini_api_key_v1') ||
      localStorage.getItem('gemini_api_key') ||
      '';
    return cleanGeminiKey(stored);
  }
  return '';
}

function isExcludedModel(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('embedding') ||
    lower.includes('gecko') ||
    lower.includes('aqa') ||
    lower.includes('bison') ||
    lower.includes('tts') ||
    lower.includes('audio') ||
    lower.includes('live') ||
    lower.includes('transcribe') ||
    lower.includes('imagen') ||
    lower.includes('veo') ||
    lower.includes('lyria') ||
    lower.includes('image-generation') ||
    lower.includes('robotics') ||
    lower.includes('computer-use') ||
    lower.includes('deep-research') ||
    lower === 'gemini-pro'
  );
}

function getModelEfficiencyRank(modelName: string): number {
  const lower = modelName.toLowerCase();
  if (lower.includes('flash-lite')) return 1; // Priority 1: flash-lite
  if (lower.includes('flash')) return 2; // Priority 2: flash
  return 3; // Priority 3: other active generation models
}

function formatCleanReaderError(status: number, errPayload: any, fallbackMsg?: string): Error {
  const rpcMsg = String(errPayload?.error?.message || fallbackMsg || '').toLowerCase();
  const rpcStatus = String(errPayload?.error?.status || '').toLowerCase();

  if (
    status === 400 &&
    (rpcMsg.includes('api key') || rpcMsg.includes('api_key_invalid') || rpcStatus === 'invalid_argument')
  ) {
    return new Error(
      'INVALID_API_KEY: Your Gemini API Key appears invalid or missing. Please open the API Key Vault to verify or update your key.'
    );
  }
  if (status === 401 || status === 403 || rpcStatus === 'permission_denied' || rpcStatus === 'unauthenticated') {
    return new Error(
      'INVALID_API_KEY: API Key authorization failed (403). Please check your key permissions or VPN in the API Key Vault.'
    );
  }
  if (status === 429 || rpcStatus === 'resource_exhausted' || rpcMsg.includes('quota')) {
    return new Error(
      'API quota limit reached (429). Please wait briefly or switch to another key in the API Key Vault.'
    );
  }
  if (status === 500 || status === 503 || rpcStatus === 'unavailable') {
    return new Error('Gemini AI servers are temporarily busy. Please try regenerating in a few seconds.');
  }

  return new Error(
    'Unable to complete AI synthesis right now. Please verify your API key in the API Key Vault and try again.'
  );
}

/**
 * Step A–E: One-time live fetch of `/v1beta/models`, strict `generateContent` filtering,
 * ascending token efficiency sorting (flash-lite -> flash -> others), and in-memory caching.
 */
export async function getVerifiedReaderModels(explicitApiKey?: string): Promise<string[]> {
  const apiKey = readUnifiedGeminiKey(explicitApiKey);
  if (!apiKey) {
    throw new Error(
      'MISSING_API_KEY: No Gemini API Key found. Please add your personal API Key in the API Key Vault to enable AI synthesis and quizzes.'
    );
  }

  // Step E: Instant in-memory reuse without duplicate /models network requests
  if (modelCache && modelCache.length > 0 && modelCacheKeySignature === apiKey) {
    return modelCache;
  }

  if (inFlightModelFetch && modelCacheKeySignature === apiKey) {
    return inFlightModelFetch;
  }

  modelCacheKeySignature = apiKey;
  inFlightModelFetch = (async (): Promise<string[]> => {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Connection: 'keep-alive',
          },
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw formatCleanReaderError(res.status, data);
      }

      const rawModels: any[] = Array.isArray(data?.models) ? data.models : [];

      // Step B & C & D: Strict filtering + Zero 404 + Ascending efficiency sort
      const verified = rawModels
        .filter((m) => {
          const methods: unknown = m?.supportedGenerationMethods;
          if (!Array.isArray(methods) || !methods.includes('generateContent')) return false;
          const cleanName = String(m?.name || '').replace(/^models\//, '').trim();
          return Boolean(cleanName) && !isExcludedModel(cleanName);
        })
        .map((m) => String(m.name).replace(/^models\//, '').trim());

      const sorted = Array.from(new Set(verified)).sort((a, b) => {
        const rankDiff = getModelEfficiencyRank(a) - getModelEfficiencyRank(b);
        if (rankDiff !== 0) return rankDiff;
        return b.localeCompare(a);
      });

      if (sorted.length === 0) {
        throw new Error(
          'INVALID_API_KEY: No active text generation models are enabled for this API key. Please check your key in the API Key Vault.'
        );
      }

      modelCache = sorted;
      return sorted;
    } finally {
      inFlightModelFetch = null;
    }
  })();

  return inFlightModelFetch;
}

// =========================================================================
// INCREMENTAL STREAM PARSERS FOR SUB-SECOND UI RENDERING
// =========================================================================

export function parseStreamingSynthesisMarkdown(rawText: string): SynthesisSummaryData {
  const clean = (rawText || '').replace(/\r\n/g, '\n');

  const extractSection = (tag: string): string => {
    const regex = new RegExp(
      `(?:^|\\n)##\\s*${tag}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s*[A-Z_]+|$)`,
      'i'
    );
    const match = clean.match(regex);
    return match && match[1] ? match[1].trim() : '';
  };

  const executiveSynthesis = extractSection('EXECUTIVE_SYNTHESIS');
  const studyNotesMarkdown = extractSection('STUDY_NOTES');
  const rawTakeaways = extractSection('CORE_TAKEAWAYS');
  const methodologyAndMetrics = extractSection('METHODOLOGY_METRICS');
  const rawQuestions = extractSection('SELF_ASSESSMENT');

  const coreTakeaways: Array<{ concept: string; explanation: string }> = [];
  if (rawTakeaways) {
    const lines = rawTakeaways.split('\n');
    for (const line of lines) {
      const t = line.trim().replace(/^[-*•]\s+/, '');
      if (!t) continue;
      const boldSplit = t.match(/^\*\*([^*]+)\*\*[:\s\-—]*(.*)$/);
      if (boldSplit) {
        coreTakeaways.push({
          concept: boldSplit[1].trim(),
          explanation: boldSplit[2].trim() || 'Core analytical concept from section.',
        });
      } else {
        const colonIdx = t.indexOf(':');
        if (colonIdx > 2 && colonIdx < 80) {
          coreTakeaways.push({
            concept: t.slice(0, colonIdx).replace(/\*\*/g, '').trim(),
            explanation: t.slice(colonIdx + 1).trim(),
          });
        } else {
          coreTakeaways.push({
            concept: 'Key Takeaway',
            explanation: t.replace(/\*\*/g, ''),
          });
        }
      }
    }
  }

  const selfAssessmentQuestions: string[] = [];
  if (rawQuestions) {
    rawQuestions.split('\n').forEach((line) => {
      const q = line.trim().replace(/^([-*•]|\d+[.)])\s+/, '').trim();
      if (q.length > 8) selfAssessmentQuestions.push(q);
    });
  }

  const hasAnySection =
    Boolean(executiveSynthesis) ||
    Boolean(studyNotesMarkdown) ||
    coreTakeaways.length > 0 ||
    Boolean(methodologyAndMetrics) ||
    selfAssessmentQuestions.length > 0;

  return {
    executiveSynthesis: hasAnySection ? executiveSynthesis : clean.replace(/^##\s*EXECUTIVE_SYNTHESIS\s*/i, '').trim(),
    studyNotesMarkdown,
    coreTakeaways,
    methodologyAndMetrics,
    selfAssessmentQuestions,
  };
}

export function extractCompletedQuizObjects(buffer: string): ReaderQuizQuestion[] {
  const results: ReaderQuizQuestion[] = [];
  if (!buffer) return results;

  let i = 0;
  while (i < buffer.length) {
    if (buffer[i] !== '{') {
      i++;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let endIdx = -1;

    for (let j = i; j < buffer.length; j++) {
      const ch = buffer[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            endIdx = j;
            break;
          }
        }
      }
    }

    if (endIdx === -1) {
      break;
    }

    const candidateStr = buffer.slice(i, endIdx + 1).replace(/,\s*([\]}])/g, '$1');
    try {
      const obj = JSON.parse(candidateStr);
      if (
        obj &&
        typeof obj.question === 'string' &&
        Array.isArray(obj.options) &&
        obj.options.length >= 2
      ) {
        const rawIdx =
          typeof obj.correctAnswerIndex === 'number'
            ? obj.correctAnswerIndex
            : typeof obj.correctIndex === 'number'
            ? obj.correctIndex
            : 0;
        const clampedIdx = Math.max(0, Math.min(rawIdx, obj.options.length - 1));
        results.push({
          id: typeof obj.id === 'number' ? obj.id : results.length + 1,
          question: sanitizeAcademicQuestionStem(String(obj.question).trim()),
          options: obj.options.map((opt: any) => String(opt || '').trim()).filter(Boolean),
          correctAnswerIndex: clampedIdx,
          explanation: String(obj.explanation || 'Derived directly from the active reading section.').trim(),
        });
      }
    } catch {
      // Ignore incomplete fragment
    }

    i = endIdx + 1;
  }

  return results;
}

// =========================================================================
// STEP F: DIRECT STREAMING EXECUTION (generateContentStream / SSE)
// =========================================================================

async function consumeReaderStream(params: {
  prompt: string;
  systemInstruction: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
  onTextChunk: (accumulatedText: string, modelUsed: string) => void;
}): Promise<{ fullText: string; modelUsed: string }> {
  const { prompt, systemInstruction, maxOutputTokens, signal, onTextChunk } = params;

  const apiKey = readUnifiedGeminiKey();
  const verifiedModels = await getVerifiedReaderModels(apiKey);

  let lastError: Error | null = null;

  for (const modelName of verifiedModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelName
      )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens,
            temperature: 0.35,
          },
        }),
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => null);
        const mappedErr = formatCleanReaderError(res.status, errPayload);
        if (mappedErr.message.startsWith('INVALID_API_KEY')) {
          throw mappedErr;
        }
        lastError = mappedErr;
        continue;
      }

      if (!res.body) {
        const fullRaw = await res.text();
        let accumulated = '';
        for (const line of fullRaw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const p of parts) {
                if (typeof p?.text === 'string' && !p?.thought) {
                  accumulated += p.text;
                }
              }
            }
          } catch {
            // Skip malformed SSE line
          }
        }
        if (accumulated.trim()) {
          onTextChunk(accumulated, modelName);
          return { fullText: accumulated, modelUsed: modelName };
        }
        continue;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              let delta = '';
              for (const p of parts) {
                if (typeof p?.text === 'string' && !p?.thought) {
                  delta += p.text;
                }
              }
              if (delta) {
                accumulated += delta;
                onTextChunk(accumulated, modelName);
              }
            }
          } catch {
            // Wait for complete chunk
          }
        }
      }

      if (sseBuffer.trim().startsWith('data:')) {
        const dataStr = sseBuffer.trim().slice(5).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const p of parts) {
                if (typeof p?.text === 'string' && !p?.thought) {
                  accumulated += p.text;
                }
              }
              onTextChunk(accumulated, modelName);
            }
          } catch {
            // Ignore trailing fragment
          }
        }
      }

      if (accumulated.trim().length > 0) {
        return { fullText: accumulated, modelUsed: modelName };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      if (typeof err?.message === 'string' && err.message.startsWith('INVALID_API_KEY')) {
        throw err;
      }
      lastError =
        err instanceof Error && !err.message.trim().startsWith('{')
          ? err
          : new Error('Unable to connect to Gemini AI stream. Please check your internet or API Key.');
    }
  }

  throw lastError || new Error('Unable to generate response from verified Gemini models. Please retry.');
}

/**
 * Streams AI Academic Synthesis directly chunk-by-chunk into DualSummaryModal.
 */
export async function streamReaderSynthesis(params: {
  chapterTitle: string;
  content: string;
  signal?: AbortSignal;
  onProgress: (data: SynthesisSummaryData, modelUsed: string) => void;
}): Promise<{ data: SynthesisSummaryData; modelUsed: string }> {
  const excerpt = (params.content || '').slice(0, 14000).trim();
  const chapterHeading = (params.chapterTitle || 'Active Reading Section').trim();

  const systemInstruction = `You are an elite University Professor creating Distraction-Free Study Notes and an Executive Chapter Synthesis.
Never include scraping artifacts (Title:, URL Source:, Markdown Content:).
Respond immediately using these EXACT section headings so the UI streams each card live:

## EXECUTIVE_SYNTHESIS
Write a concise 3-4 sentence scholarly thesis and scope of the reading.

## STUDY_NOTES
### Core Theoretical Framework
- **Key Concept 1**: Clear academic definition and mechanism.
- **Key Concept 2**: Practical rule and scholarly significance.

### Essential Definitions & Principles
- **Term A**: Concise scholarly definition.

## CORE_TAKEAWAYS
- **Concept Name 1**: Clear academic explanation and real-world relevance.
- **Concept Name 2**: Clear academic explanation and real-world relevance.
- **Concept Name 3**: Clear academic explanation and real-world relevance.

## METHODOLOGY_METRICS
Summarize key formulas, empirical methods, analytical rules, or evaluation criteria in this reading.

## SELF_ASSESSMENT
- Rigorous review question 1 testing conceptual mastery?
- Rigorous review question 2 testing practical application?`;

  const prompt = `Reading Title: ${chapterHeading}\n\nSynthesize distraction-free study notes and scholarly overview from this academic text:\n"""\n${excerpt}\n"""`;

  const { fullText, modelUsed } = await consumeReaderStream({
    prompt,
    systemInstruction,
    maxOutputTokens: 2048,
    signal: params.signal,
    onTextChunk: (accumulated, usedModel) => {
      const partial = parseStreamingSynthesisMarkdown(accumulated);
      params.onProgress(partial, usedModel);
    },
  });

  const finalData = parseStreamingSynthesisMarkdown(fullText);
  return { data: finalData, modelUsed };
}

/**
 * Streams Concept-Check Quiz questions directly chunk-by-chunk into ReaderQuizModal.
 */
export async function streamReaderQuiz(params: {
  sectionTitle: string;
  content: string;
  signal?: AbortSignal;
  onProgress: (questions: ReaderQuizQuestion[], modelUsed: string) => void;
}): Promise<{ quizTitle: string; questions: ReaderQuizQuestion[]; modelUsed: string }> {
  const excerpt = (params.content || params.sectionTitle || '').slice(0, 12000).trim();
  const title = (params.sectionTitle || 'Chapter Self-Assessment').trim();

  const systemInstruction = `You are a rigorous University Professor creating a concept-check quiz for UoPeople students.
Output 4 to 5 multiple-choice questions as raw NDJSON — one complete, single-line JSON object per line, NO markdown code fences, NO outer array brackets, NO commentary.
Start outputting the first JSON object immediately.
Each line MUST strictly follow this exact JSON object schema:
{"id":1,"question":"Clear concept-focused question without 'According to the text' prefixes","options":["A) Option 1","B) Option 2","C) Option 3","D) Option 4"],"correctAnswerIndex":0,"explanation":"Concise rationale grounded directly in the reading."}`;

  const prompt = `Reading Section: ${title}\n\nGenerate 4-5 rigorous concept-check MCQs (1 JSON object per line) strictly grounded in:\n"""\n${excerpt}\n"""`;

  let lastCount = 0;
  const { fullText, modelUsed } = await consumeReaderStream({
    prompt,
    systemInstruction,
    maxOutputTokens: 2048,
    signal: params.signal,
    onTextChunk: (accumulated, usedModel) => {
      const completed = extractCompletedQuizObjects(accumulated);
      if (completed.length > lastCount) {
        lastCount = completed.length;
        params.onProgress(completed, usedModel);
      }
    },
  });

  const finalQuestions = extractCompletedQuizObjects(fullText);
  if (finalQuestions.length === 0) {
    throw new Error('Could not parse quiz questions from model stream. Please retry.');
  }

  return {
    quizTitle: `Self-Assessment: ${title}`,
    questions: finalQuestions,
    modelUsed,
  };
}
