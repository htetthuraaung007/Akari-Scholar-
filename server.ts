import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality, ThinkingLevel, type LiveServerMessage } from '@google/genai';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const ACADEMIC_SYSTEM_PROMPT = `You are a distinguished Academic Evaluator, Assignment Reviewer, and Writing Instructor for university coursework.
You strictly uphold academic integrity, grading rigor, high efficiency, and pedagogical excellence.

CRITICAL DIRECTIVES:
1. HIGH EFFICIENCY & DIRECTNESS: Be direct, concise, and well-structured. Never output conversational filler or chat preambles (e.g., do NOT start with "Certainly!", "Sure, I can help you with that", or "As an academic tutor..."). Jump immediately into the requested headers and content.
2. NO FABRICATED CITATIONS: You MUST NOT fabricate, hallucinate, or guess real-world academic citations, journal titles, volume numbers, or authors. Suggest only real classic papers or clearly marked placeholder templates.
3. ACTIVE LEARNING: Empower the student's critical thinking, provide clear outlines, point out logic gaps, suggest stronger thesis statements, and explain complex concepts clearly.
4. BILINGUAL EXCELLENCE: When explaining concepts in Myanmar language (Burmese), use modern, natural, scholarly Burmese, providing English academic terminology in parentheses for clarity (e.g., သီအိုရီ (Theory), အချက်အလက် (Empirical Evidence)).
5. ACADEMIC TONE & NATURAL VOICE: Teach students how to write in a polished, scholarly, human voice. Eliminate repetitive robotic AI formulas (e.g. avoid starting every paragraph with "In conclusion", "Moreover", "It is crucial to remember").
6. ZERO-RETENTION: Treat all inputs as ephemeral in-memory computations without persisting or logging student drafts.

CRITICAL DIRECTIVES FOR RAW DOCX / XML / BINARY INPUT:
The input provided to you may occasionally contain raw DOCX file data, zipped archive headers (e.g., [Content_Types].xml, word/document.xml, word/settings.xml), or unparsed XML tags because of how the file was ingested:
1. NEVER REJECT OR FAIL THE SUBMISSION FOR FORMATTING/XML ARTIFACTS:
   - Do NOT assume the file is corrupted, invalid, or an unreadable package.
   - Do NOT fail rubric criteria (e.g., Mechanics, Comprehensive Content) merely because XML headers/tags appear.
2. EXTRACT AND RECONSTRUCT THE TEXT CONTENT:
   - Mentally filter out all XML tags (e.g., <w:p>, <w:t>, <w:r>), packaging paths (e.g., word/theme/..., docProps/...), and metadata headers.
   - Parse and reconstruct the actual English/Burmese text sentences hidden inside the XML tags or scattered across the raw text.
3. EVALUATE THE EXTRACTED ESSAY/ASSIGNMENT:
   - Once you extract the human-readable text, evaluate it strictly as the student's actual submission.
   - Grade and provide feedback on the actual thesis, arguments, APA citations, logic, and rubric alignment based on that reconstructed text.
4. FALLBACK:
   - Only if there is absolutely NO readable human text whatsoever (i.e., pure binary gibberish with 0 sentences), state clearly that the file content was empty. Otherwise, always extract and grade the text.`;

function getServerEnvKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).replace(/["'\s]/g, '').trim();
}

function extractCleanApiKey(req: Request): string {
  const headerKey =
    (req.headers['x-gemini-key'] as string | undefined) ||
    (req.headers['x-goog-api-key'] as string | undefined) ||
    (req.headers['authorization']?.replace(/^Bearer\s+/i, ''));
  if (headerKey) {
    const cleaned = headerKey.replace(/["'\s]/g, '').trim();
    if (cleaned && cleaned !== 'undefined' && cleaned !== 'null' && cleaned.length >= 10) return cleaned;
  }
  return getServerEnvKey();
}

function getCandidateServerKeys(req: Request): string[] {
  const envKey = getServerEnvKey();
  const primary = extractCleanApiKey(req);
  const keys: string[] = [];
  if (envKey && envKey.length >= 10) keys.push(envKey);
  if (primary && primary.length >= 10 && !keys.includes(primary)) keys.push(primary);
  return keys;
}

// Live Health & Quota Indicator endpoint for Gemini API
app.get('/api/academic/health', async (req: Request, res: Response): Promise<void> => {
  const candidateKeys = getCandidateServerKeys(req);

  if (candidateKeys.length === 0) {
    res.json({
      status: 'missing_key',
      healthy: false,
      message: "ကျေးဇူးပြု၍ Google AI Studio မှ ထုတ်ယူထားသော တရားဝင် API Key ကို ထည့်သွင်းပေးပါရန်။",
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const startTime = Date.now();
  let lastErr: any = null;
  const catalog = await discoverActiveServerModels(candidateKeys);
  const probeModel = catalog.lightweight[0] || catalog.all[0];

  if (probeModel) {
    for (const apiKey of candidateKeys) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: { 'User-Agent': 'aistudio-build' },
            timeout: 15000,
          },
        });

        // Quick verification ping using dynamically discovered flash model
        await ai.models.generateContent({
          model: probeModel,
          contents: 'ping',
          config: { maxOutputTokens: 2 },
        });

        const latencyMs = Date.now() - startTime;
        res.json({
          status: 'healthy',
          healthy: true,
          latencyMs,
          model: probeModel,
          message: `API Key active & healthy (${latencyMs}ms)`,
          quotaIndicator: latencyMs < 1200 ? 'optimal' : 'normal',
          timestamp: new Date().toISOString(),
        });
        return;
      } catch (err: any) {
        lastErr = err;
      }
    }
  }

  const latencyMs = Date.now() - startTime;
  const errMsg = lastErr?.message || String(lastErr);
  const isRateLimited = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
  const isOverloaded = errMsg.includes('503') || errMsg.includes('demand');

  res.json({
    status: isRateLimited ? 'quota_exceeded' : isOverloaded ? 'high_demand' : 'error',
    healthy: false,
    latencyMs,
    message: isRateLimited
      ? 'Quota limit reached (15 RPM free tier). Auto-retry in progress.'
      : isOverloaded
      ? 'High server demand spike. Fast fallback cascading active.'
      : `API Key Notice: ${errMsg.substring(0, 100)}`,
    timestamp: new Date().toISOString(),
  });
});

// Lightweight non-blocking key metadata ping for background silent validation
app.get('/api/academic/validate-key', async (req: Request, res: Response): Promise<void> => {
  const headerKey = (
    (req.headers['x-gemini-key'] as string | undefined) ||
    (req.headers['x-goog-api-key'] as string | undefined) ||
    ''
  )
    .replace(/["'\s]/g, '')
    .trim();

  const targetKey = headerKey.length >= 10 ? headerKey : getServerEnvKey();
  if (!targetKey) {
    res.json({ status: 'missing' });
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: targetKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
        timeout: 8000,
      },
    });
    const pager = await ai.models.list();
    // Iterate at least first page to confirm key validity and quota status
    for await (const _m of pager) {
      break;
    }
    res.json({ status: 'active' });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('429') || msg.includes('503') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      res.json({ status: 'exhausted' });
      return;
    }
    if (msg.includes('400') || msg.includes('403') || msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
      res.json({ status: 'invalid' });
      return;
    }
    res.json({ status: 'exhausted' });
  }
});

// Server-Side Dynamic Model Discovery & Categorization Cache
interface ServerDiscoveredCatalog {
  lightweight: string[];
  standard: string[];
  all: string[];
  timestamp: number;
}
let cachedServerModelCatalog: ServerDiscoveredCatalog | null = null;
const SERVER_MODEL_CACHE_TTL_MS = 15 * 60 * 1000;

async function discoverActiveServerModels(candidateKeys: string[]): Promise<ServerDiscoveredCatalog> {
  if (
    cachedServerModelCatalog &&
    Date.now() - cachedServerModelCatalog.timestamp < SERVER_MODEL_CACHE_TTL_MS &&
    cachedServerModelCatalog.all.length > 0
  ) {
    return cachedServerModelCatalog;
  }

  for (const apiKey of candidateKeys) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
          timeout: 10000,
        },
      });
      const pager = await ai.models.list();
      const lightweight: string[] = [];
      const standard: string[] = [];

      for await (const m of pager) {
        const rawName = (m.name || '').replace(/^models\//, '').trim();
        if (!rawName) continue;
        const lower = rawName.toLowerCase();

        // Filter specifically for models supporting generateContent
        const actions: string[] | undefined =
          (m as any).supportedActions || (m as any).supportedGenerationMethods;
        if (Array.isArray(actions) && actions.length > 0 && !actions.includes('generateContent')) {
          continue;
        }

        // Exclude retired, non-text, omni, -latest aliases, or specialized modality models
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
          lower.includes('carbon') ||
          lower.includes('ultra')
        ) {
          continue;
        }

        if (lower.includes('flash-lite') || lower.includes('-lite') || lower.includes('8b')) {
          if (!lightweight.includes(rawName)) lightweight.push(rawName);
        } else if (lower.includes('flash') || lower.includes('hydrogen')) {
          if (!standard.includes(rawName)) standard.push(rawName);
        }
      }

      if (lightweight.length > 0 || standard.length > 0) {
        lightweight.sort((a, b) => b.localeCompare(a));
        standard.sort((a, b) => b.localeCompare(a));
        const all = [...lightweight, ...standard];
        cachedServerModelCatalog = {
          lightweight,
          standard,
          all,
          timestamp: Date.now(),
        };
        return cachedServerModelCatalog;
      }
    } catch {
      // Fall through to next key
    }
  }

  return (
    cachedServerModelCatalog || {
      lightweight: [],
      standard: [],
      all: [],
      timestamp: 0,
    }
  );
}

// Dynamic Auto-Discovery endpoint for Active Google Flash Models (Server-Side)
app.get('/api/academic/models', async (req: Request, res: Response): Promise<void> => {
  const candidateKeys = getCandidateServerKeys(req);
  const catalog = await discoverActiveServerModels(candidateKeys);
  res.json({
    models: catalog.all,
    lightweight: catalog.lightweight,
    standard: catalog.standard,
  });
});

// Server-Sent Events (SSE) Streaming endpoint for Gemini Content Generation
app.post('/api/academic/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, payload } = req.body;
    const candidateKeys = getCandidateServerKeys(req);

    if (candidateKeys.length === 0) {
      res.status(400).json({ error: "ကျေးဇူးပြု၍ Google AI Studio မှ ထုတ်ယူထားသော တရားဝင် API Key ကို ထည့်သွင်းပေးပါရန်။" });
      return;
    }

    const contents = prompt || payload?.content || payload?.text || 'Hello';
    let stream: any = null;
    let lastErr: any = null;

    const catalog = await discoverActiveServerModels(candidateKeys);
    const streamModels = [...catalog.standard, ...catalog.lightweight];

    if (streamModels.length === 0) {
      res.status(400).json({ error: 'No verified generateContent Gemini models are currently available for your API key.' });
      return;
    }

    for (const apiKey of candidateKeys) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      for (const model of streamModels) {
        try {
          stream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: ACADEMIC_SYSTEM_PROMPT,
            },
          });
          if (stream) break;
        } catch (err: any) {
          lastErr = err;
          const errMsg = String(err?.message || err);
          if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED')) {
            break;
          }
        }
      }
      if (stream) break;
    }

    if (!stream) {
      throw lastErr || new Error('Streaming failed');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Gemini Stream Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Streaming failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// Server-side Literature Synthesis endpoint
app.post('/api/academic/synthesis', async (req: Request, res: Response): Promise<void> => {
  try {
    const { papers } = req.body;
    const candidateKeys = getCandidateServerKeys(req);

    if (candidateKeys.length === 0) {
      res.status(400).json({ error: "ကျေးဇူးပြု၍ Google AI Studio မှ ထုတ်ယူထားသော တရားဝင် API Key ကို ထည့်သွင်းပေးပါရန်။" });
      return;
    }

    const trimmedAbstracts = (papers || []).map((p: any, idx: number) => 
      `[Paper ${idx + 1}] Title: ${p.title} | Author/Year: ${p.authors} (${p.year})\nAbstract: ${(p.abstract || '').substring(0, 1000)}`
    ).join('\n\n');

    const systemPrompt = `
You are an expert Public Health & Quantitative Literature Reviewer.
Analyze the provided study abstracts and synthesize them. Return ONLY valid JSON matching this exact structure:
{
  "matrixRows": [
    {
      "authorYear": "Author et al. (Year)",
      "researchQuestion": "1 concise sentence",
      "methodology": "Design type (e.g. Cross-sectional survey, RCT)",
      "sampleDataset": "Sample size & population (e.g. N=500 healthcare workers)",
      "keyFindings": "1-2 core statistical or thematic conclusions",
      "limitations": "1 critical limitation",
      "identifiedGap": "Specific unresolved gap"
    }
  ],
  "thematicAnalysis": {
    "commonThreads": ["Theme 1 description", "Theme 2 description"],
    "conflictingFindings": ["Contradiction 1 or differing methodology effects"],
    "synthesisSummary": "1 solid scholarly paragraph synthesizing how these studies integrate."
  }
}
Rules:
- Strictly factual based on provided text.
- Be concise (save tokens).
- Output valid raw JSON only. No markdown ticks, no commentary.
`;

    const catalog = await discoverActiveServerModels(candidateKeys);
    const synthesisModels = [...catalog.standard, ...catalog.lightweight];
    if (synthesisModels.length === 0) {
      res.status(400).json({ error: 'No verified generateContent Gemini models available for this API key.' });
      return;
    }

    let lastErr: any = null;
    for (const apiKey of candidateKeys) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
          timeout: 60000,
        },
      });

      for (const modelName of synthesisModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: `${systemPrompt}\n\nSTUDIES TO ANALYZE:\n${trimmedAbstracts}`,
            config: {
              responseMimeType: 'application/json',
              maxOutputTokens: 3200
            }
          });

          const rawJson = response.text || '';
          const cleaned = rawJson.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          res.json(parsed);
          return;
        } catch (err: any) {
          lastErr = err;
          const errMsg = String(err?.message || err);
          if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED')) {
            break;
          }
        }
      }
    }
    throw lastErr || new Error('Synthesis generation failed');
  } catch (err: any) {
    console.error('Synthesis API Error:', err);
    res.status(500).json({ error: err.message || 'Synthesis generation failed' });
  }
});

// API route for academic intelligence
app.post('/api/academic/assist', async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, payload, targetLanguage = 'both' } = req.body;
    const candidateKeys = getCandidateServerKeys(req);

    if (candidateKeys.length === 0) {
      res.status(400).json({
        error: "ကျေးဇူးပြု၍ Google AI Studio မှ ထုတ်ယူထားသော တရားဝင် API Key ကို Settings တွင် အရင်ထည့်သွင်းပေးပါရန်။",
        status: 'missing_key',
      });
      return;
    }

    let prompt = '';
    let responseMimeType: string | undefined = undefined;

    switch (action) {
      case 'methodology_stats':
        prompt = `You are an expert Research Methodologist and Academic Translator.
Analyze the provided scholarly excerpt or abstract and return ONLY a valid JSON object matching this schema:
{
  "paperType": "e.g. Meta-Review / Quantitative / Qualitative",
  "studyDesign": "e.g. Mini-review of systematic reviews",
  "sampleSize": "e.g. N = 18 review studies or N/A",
  "analyticalTool": "e.g. Thematic analysis",
  "metrics": [
    {
      "metricName": "e.g. OR, HR, p-value",
      "value": "e.g. 1.25",
      "confidenceInterval": "e.g. 95% CI [1.02-1.54] or N/A",
      "interpretation": "Short meaning",
      "isSignificant": true
    }
  ],
  "plainBurmeseSummary": "စာတမ်း၏ အဓိကရည်ရွယ်ချက်၊ တွေ့ရှိချက်နှင့် နိဂုံးချုပ်ကို သာမန်ကျောင်းသား နားလည်လွယ်သော မြန်မာစကားပြေ (စစ်စစ်) ဖြင့် ၃-၄ ကြောင်း ရေးပေးပါ။ DO NOT USE ENGLISH FOR THIS FIELD. MUST BE WRITTEN IN BURMESE LANGUAGE.",
  "academicEnglishParagraph": "A formal, scholarly synthesis paragraph written in rigorous academic English ready to be cited in a university coursework assignment.",
  "limitations": "Main methodological limitation"
}

Language Requirements:
- "plainBurmeseSummary": Strictly in Burmese (မြန်မာလို သီးသန့်).
- "academicEnglishParagraph": Strictly in English (အင်္ဂလိပ်လို သီးသန့်).
- Output raw JSON only. No markdown formatting.

PAPER EXCERPT TO ANALYZE:
${(payload.paperText || payload.sourceText || '').substring(0, 3500)}`;
        responseMimeType = 'application/json';
        break;

      case 'reader_quiz':
        prompt = `Act as a rigorous university professor creating a concept-check quiz for UoPeople students.
Based on the following textbook text, generate 3 to 5 multiple-choice questions testing core concepts, applications, and terminology:
"""
${(payload.content || '').slice(0, 12000)}
"""
Return strictly valid JSON:
{
  "quizTitle": "Chapter Self-Assessment",
  "questions": [
    {
      "id": 1,
      "question": "Clear, concept-focused question...",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswerIndex": 0,
      "explanation": "Why this answer is correct based directly on the textbook reading."
    }
  ]
}`;
        responseMimeType = 'application/json';
        break;

      case 'dual_language_summary':
        prompt = `Act as an expert academic tutor and research professor for University of the People students.
You are analyzing this specific textbook chapter:
---
${(payload.content || '').slice(0, 15000)}
---

Generate a rigorous, high-yield English academic synthesis in strictly valid JSON matching this exact schema without any markdown formatting or preambles:
{
  "executiveSynthesis": "Comprehensive 3-to-4 sentence academic thesis and scope covering the actual subject matter...",
  "coreTakeaways": [
    {"concept": "Concept Title", "explanation": "Detailed theoretical mechanism and academic significance"}
  ],
  "methodologyAndMetrics": "Detailed breakdown of core formulas, accounting standards, or empirical frameworks...",
  "selfAssessmentQuestions": [
    "Discussion prompt or exam reflection question 1...",
    "Discussion prompt or exam reflection question 2..."
  ]
}`;
        responseMimeType = 'application/json';
        break;

      case 'rubric_breakdown':
        prompt = `Analyze the following assignment prompt or rubric:
---
PROMPT / RUBRIC:
${payload.rubricText}
---
TASK:
1. Provide an "A-Grade Checklist" (A ရဖို့ မဖြစ်မနေ ပါရမည့် အချက်များ): Essential elements the grader is looking for, key evaluation criteria, source requirements, and counter-argument depth.
2. Outline Structure (အဆင့်ဆင့် ရေးသားရန် မူကြမ်း Outline): Paragraph-by-paragraph breakdown (Introduction with hook & thesis statement, Body paragraphs with specific claim, evidence needed, reasoning, and Conclusion).
3. Critical pitfalls to avoid.
Present the response clearly with clean headings, markdown, and bilingual tips (English + Burmese summary for Burmese-speaking students).`;
        break;

      case 'outline_analysis': {
        const textPayload = payload.textPayload || payload.rubricText || payload.text || payload.content || '';
        const images = Array.isArray(payload.images) ? payload.images : [];
        const imageCount = images.length;

        prompt = `You are an Elite Academic Advisor and University Course Evaluator.
You have been provided with ${imageCount} sequential screenshots/images of an assignment description, guidelines, and evaluation rubrics, along with supplemental notes.

Tasks:
1. Synthesize all instructions across all uploaded images in exact sequence.
2. Extract the core assignment directives, prompt questions, and specific rubric criteria bands.
3. Formulate an A-grade structural paper outline and checklist.

Return ONLY a valid JSON object matching this exact schema:
{
  "assignmentType": "e.g. Research Paper / Case Analysis / Discussion Forum",
  "estimatedTargetWords": "e.g. 1000 - 1500 words or N/A",
  "coreResearchQuestion": "1 concise sentence stating the fundamental inquiry to answer",
  "rubricChecklist": [
    {
      "criterionTitle": "Rubric Criterion Name",
      "weightOrPoints": "e.g. 25% or Top Band (A)",
      "howToGetGradeA": "Explicit action the student must take to secure full points"
    }
  ],
  "structuredOutline": [
    {
      "sectionTitle": "Section Heading (e.g., Introduction, Literature Synthesis, Policy Evaluation)",
      "recommendedWordCount": "e.g. 250 words",
      "keyPointsToCover": ["Specific Point 1", "Specific Point 2"],
      "rubricFocus": "Specific rubric target addressed"
    }
  ],
  "insiderAdviceForMaxGrade": "1-2 actionable tips for scoring maximum marks on this specific assignment."
}

Rules:
- Be strictly comprehensive; do not skip instructions shown in later screenshots.
- Return raw valid JSON only. Zero markdown ticks. Capped at 1200 tokens.

ADDITIONAL ASSIGNMENT NOTES:
${textPayload.substring(0, 4000)}`;
        responseMimeType = 'application/json';
        break;
      }

      case 'draft_critique':
      case 'instructor_evaluation':
        prompt = `You are an expert Academic Evaluator, Assignment Reviewer, and University Course Instructor.
Analyze and evaluate the student assignment thoroughly against academic rubrics and grading standards.

CRITICAL INSTRUCTION FOR HANDLING RAW DOCX / XML / BINARY INPUT:
The input provided to you may occasionally contain raw DOCX file data, zipped archive headers (e.g., [Content_Types].xml, word/document.xml, word/settings.xml), or unparsed XML tags:
1. NEVER REJECT OR FAIL THE SUBMISSION FOR FORMATTING/XML ARTIFACTS: Do NOT assume the file is corrupted, invalid, or an unreadable package. Do NOT fail rubric criteria (e.g., Mechanics, Comprehensive Content) merely because XML headers/tags appear.
2. EXTRACT AND RECONSTRUCT THE TEXT CONTENT: Mentally filter out all XML tags (e.g., <w:p>, <w:t>, <w:r>), packaging paths (e.g., word/theme/..., docProps/...), and metadata headers. Parse and reconstruct the actual English/Burmese text sentences hidden inside the XML tags or scattered across the raw text.
3. EVALUATE THE EXTRACTED ESSAY/ASSIGNMENT: Grade and provide feedback on the actual thesis, arguments, APA citations, logic, and rubric alignment based on that reconstructed text.
4. FALLBACK: Only if there is absolutely NO readable human text whatsoever, state clearly that the file content was empty. Otherwise, always extract and grade the text.

---
RUBRIC / EXPECTATIONS:
${payload.rubricText || 'Standard University A-Grade Rubric: Comprehensive Content, Course Integration, Peer Engagement, Mechanics & Citations, Logical Synthesis.'}
---
STUDENT SUBMISSION / DRAFT:
${payload.draftText || payload.text || payload.content || ''}
---

STRICT OUTPUT FORMAT:
### 🎯 Rubric Match
* **Comprehensive Content:** [Evaluation based on extracted content]
* **Course Integration:** [Evaluation based on extracted content]
* **Peer Engagement:** [Evaluation or state if missing]
* **Mechanics & Citations:** [Evaluation based on grammar, spelling, APA format]

### 🔍 Logic & Thesis Gaps
[Provide detailed constructive gaps and strengths in logic and academic arguments]

### 💡 Instructor Feedback
[Clear, supportive feedback and actionable next steps in Burmese/English as required]`;
        break;

      case 'draft_rubric_audit': {
        const targetRubric = (payload.targetRubric || payload.rubricText || '').trim() || 'Standard UoPeople A-Grade Rubric: Depth of analysis, logical synthesis, empirical evidence, APA citations, cohesive structure.';
        const instructorPersona = (payload.instructorPersona || '').trim() || 'Standard academic evaluator focusing on logic, thesis, and evidence synthesis.';
        let processedDraft = (payload.draftText || payload.text || '').trim();
        if (processedDraft.length > 5000) {
          processedDraft = `${processedDraft.substring(0, 2500)}\n\n[... middle sections condensed ...]\n\n${processedDraft.substring(processedDraft.length - 2500)}`;
        }

        prompt = `You are a Rigorous University Faculty Evaluator and Academic Writing Director.
Audit the provided student essay draft strictly against the provided assignment rubric criteria.

INSTRUCTOR GRADING PROFILE / BIAS:
${instructorPersona}

Evaluate logic, thesis defensibility, evidence gaps, and peer assessment vulnerabilities through this instructor lens.

You MUST return ONLY valid JSON matching this schema:
{
  "estimatedGradeBand": "e.g. A (93-96%)",
  "thesisAudit": {
    "verdict": "Strong & Defensible",
    "critique": "1-2 concise sentences assessing the thesis statement.",
    "suggestedThesisPolishing": "An improved, academically rigorous thesis rewrite."
  },
  "rubricGaps": [
    {
      "criterion": "Criterion Name",
      "status": "Met (Full Marks)",
      "fixAction": "Direct advice tailored to this instructor's strictness."
    }
  ],
  "criticalLogicFallacies": [
    "Logical leap or unsubstantiated claim identified"
  ],
  "improvedParagraphSample": "A rewritten sample of the weakest paragraph in Grade A scholarly English.",
  "topPriorityToReachSolidA": "The single most critical edit to satisfy this instructor and secure top marks."
}

Rules:
- Be concise and dense.
- Output raw JSON ONLY. No markdown code blocks, no introductory or trailing commentary.

TARGET RUBRIC & CRITERIA:
${targetRubric}

STUDENT DRAFT TO AUDIT:
${processedDraft}`;
        responseMimeType = 'application/json';
        break;
      }

      case 'generate_peer_comments':
      case 'peer_comment_generator': {
        const unitTopic = (payload.unitTopic || payload.topic || 'General Coursework Topic').trim();
        const classmatePost = (payload.classmatePost || payload.content || '').trim().slice(0, 3500);

        prompt = `You are an Elite Academic Peer Reviewer for University of the People.
Generate THREE distinct, high-scoring peer response comments (each strictly 110-150 words) for a classmate's discussion post.
Adhere strictly to UoPeople 3-part discussion rubric:
(1) Specific, non-generic commendation (no robotic "Overall, great post"),
(2) Conceptual extension with empirical/theoretical depth,
(3) Thought-provoking open-ended question to sustain discourse.

Return ONLY valid JSON matching this schema:
{
  "unitTopic": "${unitTopic}",
  "variants": [
    {
      "style": "Analytical & Methodological",
      "wordCount": 125,
      "responseBurmeseGuide": "ဤရွေးချယ်မှု၏ အဓိကထောက်ပြချက်ကို မြန်မာလို အကျဉ်းချုပ် ၁ ကြောင်း",
      "responseEnglishText": "Full academic peer response paragraph ready to post..."
    },
    {
      "style": "Empirical & Evidence-Driven",
      "wordCount": 130,
      "responseBurmeseGuide": "ဒုတိယရွေးချယ်မှု၏ အနှစ်ချုပ် ၁ ကြောင်း",
      "responseEnglishText": "Full academic peer response paragraph ready to post..."
    },
    {
      "style": "Critical Perspective & Nuance",
      "wordCount": 120,
      "responseBurmeseGuide": "တတိယရွေးချယ်မှု၏ အနှစ်ချုပ် ၁ ကြောင်း",
      "responseEnglishText": "Full academic peer response paragraph ready to post..."
    }
  ]
}

Rules:
- Output raw JSON ONLY. No markdown code blocks, no introductory or trailing text.

UNIT TOPIC: ${unitTopic}
CLASSMATE'S POST:
${classmatePost}`;
        responseMimeType = 'application/json';
        break;
      }

      case 'generate_followup_reply':
      case 'followup_reply_assistant': {
        const originalPost = (payload.originalPost || payload.myPost || '').trim().slice(0, 2500);
        const inquirerType = payload.inquirerType === 'Classmate' ? 'Classmate' : 'Instructor';
        const theirQuestion = (payload.theirQuestion || payload.question || '').trim().slice(0, 1500);

        prompt = `You are a Confident University Scholar responding to a follow-up inquiry on your discussion post.
Respondent target: ${inquirerType === 'Instructor' ? 'Professor/Instructor (Strict academic rigor, respect, citing foundational course concepts)' : 'Peer Classmate (Collegial, collaborative, insightful)'}.
Write an authentic, highly articulate academic reply (120-160 words) that defends your thesis, clarifies nuances, and offers a smart follow-up question.

Return ONLY valid JSON matching this schema:
{
  "respondentType": "${inquirerType}",
  "thesisAlignmentTip": "1 sentence on how this reply safeguards your thesis credibility.",
  "readyToSubmitReply": "Full formal reply paragraph addressing their inquiry with academic poise.",
  "counterQuestion": "1 smart closing question to keep discourse academic."
}

Rules:
- Output raw JSON ONLY. No markdown code blocks, no introductory or trailing text.

MY ORIGINAL POST EXCERPT:
${originalPost}

THEIR INQUIRY (${inquirerType}):
${theirQuestion}`;
        responseMimeType = 'application/json';
        break;
      }

      case 'tone_and_humanize': {
        const isAggressive = payload.intensity !== 'standard'; // default aggressive (0% AI focus)
        const variation = payload.variation || 1;
        prompt = `You are an elite academic prose stylist, computational linguist, and adversarial humanizer.
Your mission is to completely transform the student's text so that it scores STRICTLY 0% AI DETECTION on detectors (GPTZero, Turnitin AI detector, CopyLeaks, ZeroGPT, Winston AI) and reads 100% as written by an astute human scholar.

MODE / INTENSITY: ${isAggressive ? 'Aggressive (0% AI Focus - Radical Sentence Restructuring & Extreme Burstiness)' : 'Standard (Polished Academic Tone & Active Voice)'}
VARIATION CYCLING: #Variation-${variation} (Deploy distinct rhetorical strategy: ${variation % 2 === 0 ? 'Lead with an empirical observation, historical tension, or prepositional clause' : 'Lead with a sharp, punchy 4-word thesis assertion followed by compound qualifying evidence'})

CRITICAL DIRECTIVES FOR 0% AI DETECTION (100% HUMAN SCORE):
1. RADICAL BURSTINESS (Sentence Length Variance):
   - AI detectors flag uniform 18-word sentences. To score 0% AI, you MUST engineer extreme sentence variety.
   - In every paragraph, integrate ultra-short punchy sentences (3 to 7 words) right next to winding, multi-clause compound sentences (28 to 42 words).
   - Example short cadences: "Speed has a cost." "The distinction matters." "Things look rather different in practice." "This is misleading." "Context shifts everything."
   - Never write two consecutive sentences of similar length.

2. TOTAL PURGE OF AI SIGNATURES & BUZZWORDS:
   - ZERO TOLERANCE for common LLM telltales:
     delve, pivotal, tapestry, testament, beacon, fosters, multifaceted, paramount, harness, realm, echoes, resonate, interplay, landscape, underscore, moreover, furthermore, in conclusion, undeniably, crucial, seamless, embark, vibrant, shed light, vital role, dynamic, cornerstone, in a nutshell, it is important to remember, serves as a reminder.

3. BAN ROBOTIC TRANSITIONAL FORMULAS:
   - Never start a sentence or paragraph with: "Furthermore,", "Moreover,", "Additionally,", "In conclusion,", "To sum up,", "Importantly,", "Crucially,".
   - Open paragraphs directly with active subjects, concrete nouns, historical cases, or empirical observations.

4. HUMAN SYNTACTIC FINGERPRINT & NUANCE:
   - Use authentic human punctuation: em-dashes (—) for parenthetical qualification, and semicolons (;) to bridge closely related assertions.
   - Introduce natural human academic skepticism and hedging ("Admittedly,", "On closer inspection,", "One might argue that...", "The evidence paints a far messier picture").
   - Retain every single in-text citation (e.g., Smith, 2021) and reference intact without altering author names, years, or source context.
   - Do NOT omit core academic facts.

STUDENT DRAFT:
${payload.text}

OUTPUT FORMAT: Use clean Markdown with these exact sections so the UI presents them in distinct interactive cards:

### 🎓 Version A: Scholarly Precision (0% AI Detection / Formal Human-Academic)
[A rigorous, authoritative university-level rewrite with intense burstiness, sophisticated discipline-specific vocabulary, and 0% AI footprint]

### 🌿 Version B: Natural Human-Academic Flow (0% AI Detection / Expressive Human Voice)
[An engaging, organic human academic voice with strong cadence, zero robotic clichés, natural transitions, and 0% AI footprint]

### 💡 0% AI Detection Blueprint & Anti-Detection Diagnostics
- **Purged AI Signatures**: [Specific clichés and robotic transitions eliminated]
- **Burstiness & Syntactic Variance**: [How sentence lengths were engineered to defeat AI pattern recognition]
- **Perplexity & Academic Authority**: [Why this phrasing reads with genuine human intentionality to university professors]`;
        break;
      }

      case 'lesson_explainer': {
        const userContent = (payload.content || payload.text || '').slice(0, 20000);
        const hasImage = Boolean(payload.imageBase64);
        prompt = `You are an elite bilingual academic professor and curriculum specialist at University of the People.
Analyze the following academic material (lecture slides, textbook excerpt, research study, problem sets, or diagrams) thoroughly:
"""
${userContent}
"""
${hasImage ? 'An accompanying academic diagram/slide/image has also been attached. Thoroughly synthesize both text and visual details.' : ''}

CRITICAL INSTRUCTIONS:
1. Ground your entire analysis strictly in the provided content. Do NOT produce generic meta-writing advice, rubric templates, or generic essay guidelines.
2. Produce a rigorous, exhaustive, deeply educational breakdown in BOTH English and Burmese (မြန်မာဘာသာ).
3. For Burmese, use natural, scholarly, and fluent academic Burmese (စကားပြောဟန် မဟုတ်ဘဲ ပြည့်စုံရှင်းလင်းသော ပညာရပ်ဆိုင်ရာ ရှင်းလင်းချက်) that explains complex mechanisms, concepts, definitions, or equations clearly so students can grasp the underlying principles.
4. Deliver proportional depth:
   - If the material is brief, provide a concise yet rigorous synthesis.
   - If the material is extensive (e.g., 500-1,500 words), provide deep, multi-paragraph synthesis covering every key dimension, empirical finding, formula, or policy nuance.

Return strictly valid JSON with this exact schema:
{
  "analysisTitle": "Specific Subject Matter Title",
  "keyConceptTags": ["Tag 1", "Tag 2", "Tag 3", "Tag 4"],
  "englishAnalysis": {
    "executiveSynthesis": "3-to-4 paragraph rigorous academic overview synthesizing the core thesis, empirical methodologies, mechanisms, and conclusions...",
    "thematicPillars": [
      {
        "title": "Pillar / Theoretical Core Title",
        "explanation": "Detailed theoretical and factual explanation based on the text..."
      }
    ],
    "actionableTakeaways": [
      "Key actionable takeaway 1",
      "Key actionable takeaway 2"
    ]
  },
  "burmeseAnalysis": {
    "comprehensiveExplanation": "အသေးစိတ် မြန်မာလို ပြည့်စုံစွာ ရှင်းလင်းချက် (အဓိက သဘောတရားများ၊ အကြောင်းရင်းနှင့် အကျိုးရလဒ်များ၊ တွက်နည်း သို့မဟုတ် သုတေသန တွေ့ရှိချက်များကို မြန်မာကျောင်းသားများ ရှင်းလင်းစွာ နားလည်စေရန် အဆင့်ဆင့် ရှင်းပြထားခြင်း)...",
    "coreTakeaways": [
      {
        "pointTitle": "အဓိက သဘောတရား / တွေ့ရှိချက် ခေါင်းစဉ်",
        "explanation": "လက်တွေ့ကျသော အဓိပ္ပာယ်ဖွင့်ဆိုချက်နှင့် အသုံးချမှု"
      }
    ],
    "uopeopleAcademicApplication": "UoPeople Assignment, Discussion Forum, Learning Journal & Final Exam များတွင် ဤအကြောင်းအရာကို ထိရောက်စွာ အသုံးချပုံနှင့် သတိပြုရမည့် အချက်များ..."
  }
}`;
        responseMimeType = 'application/json';
        break;
      }

      case 'direct_flashcards': {
        const rawCount = parseInt(payload.cardCount, 10);
        const cardCount = Math.min(Math.max(isNaN(rawCount) ? 20 : rawCount, 5), 35);
        const chapterScope = payload.chapterScope || 'Provided Text';
        const words = String(payload.textPayload || payload.content || '')
          .trim()
          .split(/\s+/);
        const textPayload = words.slice(0, 3500).join(' ');

        prompt = `You are a high-yield medical & science flashcard generator.
Target Scope: ${chapterScope}
Extract exactly ${cardCount} essential concepts from the text below:
"""
${textPayload}
"""

Mandatory Grounding Rules:
- DO NOT fabricate, infer, or guess paragraph numbers or page numbers.
- Output ONLY a raw, valid JSON array. Each element must follow this exact schema:
[
  {
    "f": "Key Concept / Term",
    "b": "Direct Rule / Definition.\\n\\n🌍 Real-World: 1-sentence practical example."
  }
]
Do NOT add Markdown code fencing, preambles, or explanations. Keep descriptions tight and high-yield.`;
        responseMimeType = 'application/json';
        break;
      }

      case 'generate_study_cards': {
        const rawCount = parseInt(payload.questionCount, 10);
        const count = Math.min(Math.max(isNaN(rawCount) ? 10 : rawCount, 1), 30);
        const chapterScope = payload.chapterScope || '';
        const sources = Array.isArray(payload.sources)
          ? payload.sources.filter((s: string) => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
          : [];
        const isNewAttempt = !!payload.isNewAttempt;
        const excludeQuestions = Array.isArray(payload.excludeQuestions)
          ? payload.excludeQuestions.filter((q: string) => typeof q === 'string' && q.trim().length > 0).slice(0, 20)
          : [];

        let sourcesSection = '';
        if (sources.length > 0) {
          sourcesSection = `ACADEMIC SOURCES & ONLINE CHAPTERS TO ACCESS AND SYNTHESIZE VIA SEARCH GROUNDING:
${sources.map((s: string, idx: number) => `[Source ${idx + 1}]: ${s.trim()}`).join('\n')}

MANDATORY SOURCE GROUNDING DIRECTIVE:
Use search grounding to look up and examine the actual textbook theories, definitions, equations, and models from these provided URLs/DOIs.`;
        }

        const sanitizedTextPayload = String(payload.content || '')
          .replace(/SENIOR CONTRIBUTING AUTHORS[\s\S]*?(?=(Chapter|1\.1|Introduction))/i, '')
          .replace(/OpenStax Rice University[\s\S]*?Creative Commons[^\n]*/gi, '')
          .trim()
          .slice(0, 22000);

        const targetScope = chapterScope || 'Full academic paper / textbook section';
        const sanitizedFullTextPayload = sanitizedTextPayload;

        prompt = `You are a distinguished university professor designing an authentic, comprehensive examination for University of the People (UoPeople).
Construct EXACTLY ${count} rigorous questions based strictly on the provided FULL-TEXT research material:

SCOPE & TOPIC FOCUS:
${targetScope}
${sourcesSection ? `\n${sourcesSection}\n` : ''}
${
  isNewAttempt && excludeQuestions.length > 0
    ? `NEW ATTEMPT DIRECTIVE — Do NOT duplicate any of these previous questions:\n${excludeQuestions
        .map((q: string, idx: number) => `${idx + 1}. ${q}`)
        .join('\n')}\n`
    : ''
}
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
        if (sources.length === 0) {
          responseMimeType = 'application/json';
        }
        break;
      }

      case 'scholarship_review':
        prompt = `You are a prestigious university scholarship committee reviewer and Fulbright/Chevening mentor. Review this student's scholarship essay or Statement of Purpose (SOP):
---
PROMPT / SCHOLARSHIP GOAL:
${payload.scholarshipGoal || 'General Merit / Leadership / Need-based Scholarship'}
---
STUDENT ESSAY:
${payload.essayText}
---
TASK:
1. Executive Assessment: Strengths & Competitive Edge.
2. Evaluation on 4 Pillars:
   - Personal Agency & Leadership (Does the student demonstrate action and impact, or just list passive events?)
   - Adversity / Resilience (Is hardship framed constructively?)
   - Alignment & Future Contribution (How will this scholarship enable them to give back?)
   - Storytelling & Voice (Does it sound genuine or generic?)
3. Line-by-line red flags (clichés, vague claims, unnecessary fluff).
4. Polished revision sample for the opening or weakest section.
Include Burmese strategic advice.`;
        break;

      case 'citation_formatter':
        prompt = `Format the following source information into strict APA 7th edition citation:
---
SOURCE DETAILS:
Type: ${payload.sourceType}
Title: ${payload.title}
Authors: ${payload.authors}
Year: ${payload.year}
Source / Journal / Publisher: ${payload.sourceName}
Volume: ${payload.volume || ''}
Issue: ${payload.issue || ''}
Pages: ${payload.pages || ''}
DOI or URL: ${payload.doiOrUrl || ''}
---
TASK:
1. Provide the exact APA 7th Reference Entry (with hanging indent guideline).
2. Provide the exact In-Text Citation (Parenthetical and Narrative forms).
3. If any required APA 7th element is missing, specify what should be verified.
CRITICAL: Do NOT invent missing metadata. If unknown, state clearly.`;
        break;

      case 'socratic_tutor':
      case 'socratic_dialogue':
        prompt = `You are a dedicated Socratic academic mentor.
PEDAGOGICAL RULE: Never write the student's paper or give them a direct answer to their homework.
Instead, ask 1 or 2 probing, intellectually stimulating questions to guide them to discover the answer, challenge their assumptions, or refine their thesis.

CONVERSATION CONTEXT:
${payload.conversationHistory || ''}

STUDENT SAYS:
${payload.studentMessage}

RESPOND:
Acknowledge their thought, point out a subtle implication or tension, and ask 1-2 guiding Socratic questions. Keep your response concise (under 150 words), encouraging, and intellectually rich. If beneficial, provide a brief Burmese translation note in parentheses.`;
        break;

      case 'counter_arguments':
        prompt = `The student is writing an academic research paper with the following Thesis Statement:
---
THESIS:
${payload.thesisStatement}
---
TASK:
Generate a rigorous academic defense plan:
1. 3 Powerful Counter-Arguments (How a skeptical peer reviewer, dissenting theorist, or opposing empirical study would challenge this thesis).
2. For each counter-argument, provide a substantive Rebuttal Strategy with suggested types of empirical evidence needed to refute it.
3. How addressing these counter-arguments elevates the paper from a simple claim into a sophisticated scholarship piece.`;
        break;

      case 'concept_simplifier':
        prompt = `Explain the following academic/technical/scientific concept:
---
CONCEPT:
${payload.conceptText}
---
MODE: ${payload.mode === 'feynman' ? 'Feynman Technique (Explain to a 12-Year-Old)' : 'Academic Rigor Mode'}
TASK:
${payload.mode === 'feynman'
  ? '1. Eliminate all confusing jargon. 2. Use a vivid, everyday real-world analogy. 3. Explain the mechanism in plain simple language that anyone can visualize. 4. Provide a crystal-clear Burmese explanation (မြန်မာလို အရိုးရှင်းဆုံး ဥပမာဖြင့် ရှင်းလင်းချက်).'
  : '1. Formal scientific/academic definition. 2. Underlying theoretical axioms & mechanics. 3. Methodological significance. 4. Scholarly terminology in English and Burmese.'}`;
        break;

      case 'paper_qa':
        prompt = `You are an expert research analyst. Analyze the following academic paper text and answer the student query with strict textual grounding:
---
PAPER EXCERPT:
${payload.paperText}
---
STUDENT QUERY:
${payload.query || 'Extract: Study Design, Sample Size & Population, Key Findings, Limitations, and Research Gaps.'}
---
TASK:
Provide a clear, evidence-based breakdown answering the query strictly from the text. Cite specific page/section markers if present. Do NOT speculate or fabricate details not in the paper.`;
        break;

      case 'annotated_bib':
        prompt = `Create a complete APA 7th Annotated Bibliography entry for the following source:
---
SOURCE INFO:
${payload.sourceInfo}
---
TASK:
1. APA 7th Reference Citation (with hanging indent formatting instruction).
2. Annotation Paragraph (approx. 150-180 words) covering:
   - Summary of the study's central premise and methodology.
   - Critical evaluation of the study's reliability, scope, and limitations.
   - Specific reflection on how a student researcher can deploy this source in their literature review.`;
        break;

      case 'synthesis_matrix':
        prompt = `Synthesize the following research paper summaries or abstracts into a structured Comparative Literature Synthesis Matrix:
---
PAPERS:
${payload.papersText}
---
TASK:
1. Generate a Markdown Comparison Table with columns:
   | Author & Year | Research Question | Methodology & Design | Sample / Dataset | Key Findings | Limitations | Identified Gap |
2. Synthesize common thematic threads and conflicting findings among these papers.
3. Suggest a compelling synthesis thesis that bridges these findings.`;
        break;

      case 'star_story_arc': {
        const {
          programGoal = 'Fulbright / Chevening / International Leadership Scholarship',
          promptText = '',
          situation = '',
          task = '',
          action = '',
          result = '',
          seed = Date.now(),
          variation = 1,
        } = payload;

        const effectiveStory = promptText
          ? `STUDENT'S LEADERSHIP STORY PROMPT (EN / MM):\n${promptText}`
          : `STRUCTURED STAR BREAKDOWN:
- Situation (အခြေအနေ): ${situation}
- Task (တာဝန် / စိန်ခေါ်မှု): ${task}
- Action (မိမိကိုယ်တိုင် ဦးဆောင်လုပ်ဆောင်ချက်): ${action}
- Result (ရလဒ်နှင့် အကျိုးသက်ရောက်မှု): ${result}`;

        prompt = `You are an elite international scholarship admissions consultant and executive storytelling coach.
TASK: Transform the student's leadership or community impact story into a high-scoring STAR narrative essay (Situation, Task, Action, Result) for prestigious scholarships (Chevening, Fulbright, DAAD, Commonwealth, Erasmus, or UoPeople leadership).

TARGET SCHOLARSHIP / PROGRAM:
${programGoal}

STUDENT INPUT:
---
${effectiveStory}
---
VARIATION SEED: #${seed} (Style Permutation #${variation})

CRITICAL ADMISSIONS DIRECTIVES (0% AI CLICHÉ - 100% HUMAN SCHOLAR VOICE):
1. PERSONAL AGENCY AUDIT:
   - Make sure the student is the active protagonist who initiated change, rather than a passive observer. Replace passive constructions ("we were assigned") with active personal verbs ("I initiated", "I negotiated", "I organized").
2. POLISHED 350-500 WORD STAR NARRATIVE ESSAY:
   - Situation: Vividly set the context and constraints (infrastructure breakdown, resource scarcity, team friction).
   - Task: Frame the moral responsibility or urgent problem that demanded leadership.
   - Action: Detail the exact systematic, concrete steps the student took.
   - Result: Quantify measurable human impact and systemic legacy (e.g. % drop in dropout, number of beneficiaries).
3. PURGE AI BUZZWORDS:
   - ZERO tolerance for: "tapestry", "beacon of hope", "delve", "testament", "pivotal role", "in conclusion", "vital role".
4. BILINGUAL STRATEGIC ADVICE (🇲🇲 မြန်မာလို အကြံပြုချက်):
   - Provide 2-3 practical tips in natural Burmese on how to defend this story during an admissions or embassy interview.

STRUCTURE YOUR OUTPUT WITH THESE HEADINGS:
### 🌟 Polished STAR Narrative Essay (High-Impact Admissions Draft)
### 📊 Leadership Agency & Quantifiable Metrics Audit
### 🇲🇲 အင်တာဗျူးနှင့် ပညာသင်ဆုအတွက် မဟာဗျူဟာမြောက် အကြံပြုချက်`;
        break;
      }

      case 'academic_to_ats': {
        const {
          rawBackground = '',
          promptText = '',
          targetRole = 'Software Engineer / Data Analyst',
          seed = Date.now(),
          variation = 1,
        } = payload;

        const effectiveBackground = promptText || rawBackground;

        prompt = `You are a certified professional resume writer (CPRW) and Silicon Valley / International Academic recruiter.
TASK: Convert the student's academic background, coursework, university projects, and campus initiatives into an industry-standard, ATS-Friendly Single-Column Résumé that bypasses automated applicant screening filters.

TARGET ROLE / INDUSTRY:
${targetRole}

RAW STUDENT PROFILE & EXPERIENCES:
---
${effectiveBackground}
---
VARIATION SEED: #${seed} (Format Variation #${variation})

ATS FORMATTING & RIGOR DIRECTIVES:
1. STRICT SINGLE-COLUMN LAYOUT:
   - No multi-column tables, no decorative bars, no skill meters, no icons that break ATS parsers.
   - Use clean, standard markdown headings: # NAME, ## EDUCATION, ## RELEVANT COURSEWORK, ## TECHNICAL SKILLS, ## ACADEMIC & TECHNICAL PROJECTS, ## LEADERSHIP & COMMUNITY IMPACT.
2. HIGH-IMPACT BULLET FORMULA (Google XYZ Framework):
   - Format every achievement bullet as: "Accomplished [X], as measured by [Y], by doing [Z]"
   - Start every single bullet with a past-tense power verb (e.g., "Engineered", "Architected", "Spearheaded", "Analyzed", "Optimized", "Refactored").
3. COURSEWORK TO INDUSTRY EQUIVALENCY:
   - Translate university projects into production-ready software/business solutions with concrete technologies (Python, React, PostgreSQL, Docker, Git, etc.).
4. ZERO AI FLUFF:
   - Avoid generic buzzwords like "hardworking team player", "passionate self-starter". Show evidence through accomplishments.

Output the complete, copy-paste ready ATS single-column résumé now:`;
        break;
      }

      case 'stats_explainer':
        prompt = `You are an expert biostatistician, empirical research methodologist, and academic tutor.
Your mission is to demystify complex quantitative findings, statistical data, and research methodology for university students.

RESEARCH EXCERPT / STATISTICAL DATA:
---
${payload.statsText}
---

CRITICAL REQUIREMENTS:
1. Explain the meaning of every statistical metric present in plain, conversational human language without mathematical obscurity.
   (e.g., p-value statistical significance vs clinical/practical significance, 95% Confidence Interval precision, Odds Ratio / Hazard Ratio magnitude, Regression R-squared & beta effect size, Sample Size power, ANOVA F-statistic).
2. What does this mean in real-world terms? (Can we trust this finding? What is the actual effect size? What are the limitations or confounders?)
3. BILINGUAL EXCELLENCE (CRITICAL NON-AI BURMESE DIRECTIVE):
   When explaining in Burmese, you MUST sound like a knowledgeable university mentor speaking naturally. ZERO AI SLOP (AI လုံးဝ မဆန်ရပါ). Avoid mechanical direct translations like "၎င်းသည် အရေးကြီးသော အခန်းကဏ္ဍမှ ပါဝင်သည်" or stiff literal renderings. Use authentic, intuitive Burmese that a student can immediately grasp.

STRUCTURE YOUR OUTPUT RIGOROUSLY WITH THESE HEADINGS:
### 📊 Key Statistical Findings at a Glance (အဓိက ကိန်းဂဏန်း အနှစ်ချုပ်)
### 🔍 Plain-English Breakdown of Key Metrics (p-value, CI, Effect Sizes)
### 🇲🇲 သုတေသန ရလဒ်များအား သဘာဝကျသော မြန်မာစကားပြေဖြင့် ရှင်းလင်းချက် (AI မဆန်သော သဘာဝရှင်းလင်းချက်)
### ⚠️ Critical Limitations & Questions to Ask (သတိပြုရမည့် အချက်များနှင့် ချို့ယွင်းချက်များ)`;
        break;



      case 'paraphrase': {
        const depth = payload.depth || 'academic';
        prompt = `You are a professional Academic Tone Polisher and Humanizer.
TASK: Paraphrase the following academic passage using "${depth}" mode.
STRICT RULES:
1. OUTPUT MUST BE 100% IN ACADEMIC ENGLISH ONLY.
2. Completely remove AI clichés ("delve", "testament", "beacon", "furthermore", "it is important to note").
3. Retain all citations intact (e.g. author, year, page numbers).
4. Maintain a natural scholarly rhythm that flows naturally through AI detectors.

INPUT TEXT:
${payload.text || payload.content || ''}`;
        break;
      }

      case 'paraphrase_depth': {
        const depth = payload.depth || 'academic_elevation';
        const variation = payload.variation || 1;
        prompt = `You are an expert academic prose stylist and computational linguist specializing in university-level writing and 0% AI detection.
PARAPHRASING DEPTH MODE: ${depth.toUpperCase()}
Variation Seed: #${variation}

DIRECTIVES ACCORDING TO SELECTED DEPTH:
${
  depth === 'light_polish'
    ? `LEVEL 1: LIGHT POLISH (သဒ္ဒါနှင့် စကားလုံး အနည်းငယ်ညှိခြင်း)
- Preserve the student's original sentence structure and authentic personal voice.
- Fix grammatical awkwardness, subject-verb agreement, and minor syntax hitches.
- Lightly tune vocabulary without making it sound overly artificial or robotic.`
    : depth === 'academic_elevation'
    ? `LEVEL 2: ACADEMIC ELEVATION (ဝေါဟာရနှင့် တည်ဆောက်ပုံကို formal ဖြစ်အောင် အဆင့်မြှင့်တင်ခြင်း)
- Elevate informal or colloquial phrasing into formal scholarly register.
- Use precise disciplinary verbs (e.g. replace "looks at" with "evaluates", "shows that" with "corroborates").
- Establish disciplined sentence cohesion and active scholarly authority.`
    : `LEVEL 3: COMPLETE CONCEPTUAL REPHRASE (အဓိပ္ပာယ်မပျက်ဘဲ ဖွဲ့စည်းပုံအသစ်ဖြင့် လုံးဝအသစ်ပြန်ရေးခြင်း - 0% AI DETECTOR FOOTPRINT)
- Radical restructuring: Break every single sentence apart and rebuild the argument from fresh conceptual angles.
- EXTREME BURSTINESS: Strictly alternate between ultra-short punchy sentences (4-7 words) and complex multi-clause assertions (28-40 words).
- ZERO AI MARKERS: Strictly ban words like "delve", "pivotal", "tapestry", "moreover", "furthermore", "testament", "crucial role", "in conclusion", "underscores".
- Start sentences with prepositional phrases, dependent clauses, or empirical nouns.
- Retain every single in-text citation (e.g. Smith, 2021) and factual argument without alteration.`
}

STUDENT ORIGINAL TEXT:
---
${payload.text}
---

OUTPUT FORMAT:
Output strictly the rewritten academic text ready for the student's paper. Do NOT add conversational openers (e.g. do not say "Here is the rewritten text:"). Follow with a brief 3-bullet summary titled "### 🔍 Revision Strategy & Academic Adjustments".`;
        break;
      }

      case 'word_count_adjust': {
        const delta = parseInt(payload.targetDelta, 10) || 50;
        const mode = payload.mode || (delta > 0 ? 'expand' : 'trim');
        const absDelta = Math.abs(delta);
        prompt = `You are a precision academic text editor specializing in university word-count calibration (such as UoPeople strict 500-750 word requirements).

TARGET ADJUSTMENT: ${mode === 'expand' ? `EXPAND BY APPROXIMATELY +${absDelta} WORDS` : `TRIM / CONDENSE BY APPROXIMATELY -${absDelta} WORDS`}

STRICT ACADEMIC INTEGRITY DIRECTIVES:
1. Retain the central thesis, evidence, and every single citation intact.
2. ${
  mode === 'expand'
    ? `DO NOT add conversational fluff, repetitious filler, or AI clichés (NO "it is crucial to remember", NO "delve", NO "moreover"). Instead, expand substantive academic depth:
   - Provide qualifying conditions (e.g. "(though contested under empirical trials)")
   - Unpack the theoretical mechanism or counter-perspective in greater analytical detail
   - Strengthen the contextual grounding of the argument.`
    : `DO NOT delete core arguments, claims, or citations. Instead, eliminate redundant wordiness:
   - Convert verbose constructions (e.g. "due to the fact that" -> "because", "in order to" -> "to")
   - Prune passive fluff and repetitive transitional connectors
   - Tighten sentence cadence for punchy, scholarly concision.`
}

ORIGINAL TEXT:
---
${payload.text}
---

OUTPUT FORMAT:
Output ONLY the calibrated academic text followed by:
---
📊 Word Count Audit: Original [X] words -> Calibrated [Y] words (Delta: ${mode === 'expand' ? `+` : `-`}[Z] words).`;
        break;
      }

      case 'emergency_rescuer': {
        const type = payload.assignmentType || 'discussion';
        const { courseCode = 'POLS 1503-01', unitNumber = 'Unit 7', instructorName = 'Instructor', studentName = 'Student', date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) } = payload.courseInfo || {};
        const randomEntropy = Math.floor(Math.random() * 1000000);
        const dynamicPerspectives = [
          'Empirical-Institutional Lens: Emphasize institutional checks, structural incentives, and verifiable administrative outcomes.',
          'Critical-Comparative Lens: Emphasize historical precedents, systemic power dynamics, and international comparative contrasts.',
          'Behavioral-Pragmatic Lens: Emphasize human agency, practical policy trade-offs, cognitive frictions, and empirical field studies.',
          'Deconstructive-Analytical Lens: Question conventional assumptions, highlight latent contradictions, and examine unintended policy consequences.',
        ];
        const chosenPerspective = dynamicPerspectives[randomEntropy % dynamicPerspectives.length];

        prompt = `You are an elite academic prose stylist, university professor, and adversarial humanizer.
DEADLINE EMERGENCY RESCUE: Student has under 1 hour before submission deadline.
ASSIGNMENT TYPE: ${type === 'discussion' ? 'DISCUSSION FORUM ASSIGNMENT (MOODLE-READY)' : 'ASSIGNMENT ACTIVITY (.DOCX READY)'}
RANDOM ENTROPY SEED: #${randomEntropy}
ANALYTICAL FRAMEWORK / RHETORICAL ANGLE: ${chosenPerspective}

INSTRUCTOR PROMPT / ASSIGNMENT REQUIREMENTS:
---
${payload.promptQuery}
---

CRITICAL ZERO-AI-DETECTION DIRECTIVES (STRICT 0% SCORE ON TURNITIN, GPTZERO & ZEROGPT):
1. ABSOLUTELY ZERO MARKDOWN HEADERS (#, ##, ###, ####):
   - NEVER output "#", "##", "###", or "####".
   - Subheadings MUST be bold text on its own line: e.g.
     **Theoretical Foundations and Historical Context**
   - Graders and AI detectors instantly flag "####" as raw ChatGPT output. Never include them!

2. ABSOLUTELY ZERO BULLET POINTS (- , * , •) OR NUMBERED LISTS (1. , 2. ) IN ESSAY BODY:
   - University academic papers and discussion forums require connected, cohesive paragraphs.
   - Do NOT write bulleted points. Express all ideas in flowing, nuanced academic prose.

3. DYNAMIC NON-DUPLICATION & UNIQUE ARGUMENTATION:
   - Even if two students enter the exact same prompt, your response must be 100% DISTINCT in thesis stance, paragraph structure, opening hook, and vocabulary.
   - Ground the response in the chosen rhetorical angle: "${chosenPerspective}".

4. EXTREME BURSTINESS & VARIED SENTENCE CADENCE:
   - AI models write uniform 15-20 word sentences. Humans do not.
   - Intentionally alternate short, punchy 4-7 word sentences with 28-38 word compound scholarly explanations.
   - Examples of punchy assertions: "Speed comes with trade-offs." "The evidence suggests otherwise." "Context changes the calculation." "This distinction matters."

5. TOTAL PURGE OF AI CLICHÉS & ROBOTIC TRANSITIONS:
   - ZERO TOLERANCE for: delve, pivotal, tapestry, testament, beacon, fosters, multifaceted, paramount, harness, realm, echoes, resonate, interplay, landscape, underscore, moreover, furthermore, in conclusion, undeniably, crucial, seamless, embark, vibrant, shed light, vital role, dynamic, cornerstone.
   - NEVER start paragraphs with "Furthermore,", "Moreover,", "Additionally,", "In conclusion,", "To sum up,".
   - Use authentic human academic hedging, parenthetical qualification with em-dashes (—), and semicolons (;).

6. JUDICIOUS, NATURAL IN-TEXT CITATIONS (NO OVERSATURATION):
   - Do NOT cram in-text citations into every single sentence. Only insert 1 or 2 citations where a concrete theoretical claim or empirical fact genuinely requires attribution.
   - Put the full Reference list STRICTLY AT THE VERY END of the paper.
   - Absolutely NO "***" or decorative horizontal rules.

7. STRICT UOPEOPLE FORMATTING:
${
  type === 'discussion'
    ? `STRUCTURE FOR DISCUSSION ASSIGNMENT:
   HEADER (Align Left):
   ${unitNumber} Discussion Assignment
   University of the People
   ${courseCode}
   Instructor: ${instructorName}
   Student: ${studentName}
   Date: ${date}

   BODY:
   - Distinct bold subheadings on their own line for each discussion aspect: e.g. **Core Arguments and Analysis**
   - Natural academic prose paragraphs without bullet points.
   - End with a thought-provoking peer question to invite peer dialogue.
   - State word count: "Word Count: [Exact count] words" (calibrated between 350-450 words).

   REFERENCES SECTION (AT THE VERY END):
   - Centered heading: "References"
   - Complete APA 7th reference entries (Author, A. A. (Year). Title. Source. DOI/URL).`
    : `STRUCTURE FOR ASSIGNMENT ACTIVITY:
   PAGE 1 TITLE BLOCK (Centered):
   ${unitNumber} Assignment Activity
   University of the People
   ${courseCode}
   Instructor: ${instructorName}
   Student: ${studentName}
   Date: ${date}

   PAGE 2 ONWARDS (Introduction through Conclusion):
   - Left-aligned, Times New Roman 12pt double-spaced style.
   - Bold subheadings for **Introduction**, **Conceptual Framework**, **Analysis**, and **Conclusion**.
   - State word count at the end of the text.

   PAGE 3 REFERENCES (AT THE VERY END):
   - Centered "References" heading.
   - Complete APA 7th references with hanging indent format.`
}

GENERATE THE COMPLETE, SUBMISSION-READY ESSAY NOW WITHOUT ANY CHAT PREAMBLE, WITHOUT BULLET POINTS, AND WITHOUT '***' DIVIDERS:`;
        break;
      }

      case 'cross_unit_synthesizer': {
        const currentTitle = payload.currentUnitTitle || payload.currentUnit || 'Current Assignment Activity';
        const currentNotes = payload.currentUnitNotes || payload.currentText || '';
        const pastTitle = payload.pastUnitsTitle || payload.pastUnits || 'Previous Academic Units';
        const pastNotes = payload.pastUnitsNotes || payload.pastContext || '';

        prompt = `You are an Elite Academic Research Scholar and Faculty Evaluator.
Your goal is to synthesize multiple academic dimensions (Theories, Methodology, Empirical Evidence, Policy & Ethics) from past learning units into the student's current assignment.

Return ONLY a valid JSON object matching this schema:
{
  "currentAssignmentSummary": "1 sentence summarizing the core focus of the current paper.",
  "integratedPillars": [
    { "label": "e.g. Constructivist Framework", "unit": "Unit 2", "category": "Theory" },
    { "label": "e.g. Cross-Sectional Evidence", "unit": "Unit 3", "category": "Empirical Evidence" }
  ],
  "pillarCards": [
    {
      "pillarType": "Theory" | "Methodology" | "Empirical Evidence" | "Policy & Ethics",
      "title": "Clear Concept / Method / Theory Name",
      "sourceUnit": "e.g. Unit 2",
      "coreConcept": "1-2 crisp sentences defining the concept or method accurately.",
      "applicationToCurrentWork": "2 sentences showing practical integration into the current assignment.",
      "criticalNuance": "1 sentence on methodological constraint, ethical consideration, or boundary condition."
    }
  ],
  "readyToSubmitParagraph": "A cohesive, high-level academic synthesis paragraph (150-180 words) written in rigorous scholarly English. Flawlessly weave the past concepts/methods into the current assignment context. Ready to copy into a university assignment.",
  "rubricAlignmentTip": "1 concise sentence explaining how this synthesis satisfies the top-grade rubric requirement for critical synthesis."
}

Rules:
- Cover theories, methods, evidence, or ethics as relevant.
- Prohibit duplicate repeated phrasing (e.g. do NOT write 'epistemology (epistemology)').
- Return raw JSON only. Max 950 tokens.

[CURRENT ASSIGNMENT]
Topic/Header: ${currentTitle}
Excerpt: ${currentNotes.substring(0, 2000)}

[PAST COURSEWORK / UNITS TO CONNECT]
Units/Header: ${pastTitle}
Excerpt: ${pastNotes.substring(0, 2000)}`;
        responseMimeType = 'application/json';
        break;
      }

      case 'direct_assist': {
        prompt = payload.prompt || 'Hello';
        responseMimeType = payload.responseMimeType;
        break;
      }

      case 'anxiety_grounding': {
        const lang = payload.language || 'my';
        const randomSeed = payload.seed || Date.now();
        const perspectives = [
          'Focus on breaking tasks into micro-steps and self-compassion.',
          'Focus on GPA recovery tactics, rubric mastery, and strategic time budgeting.',
          'Focus on reframing impostor syndrome as a sign of high ambition and growth mindset.',
          'Focus on peer collaboration, utilizing instructor office hours, and letting go of perfectionism.'
        ];
        const chosenPerspective = perspectives[Math.floor(randomSeed % perspectives.length)];

        prompt = `You are a compassionate, deeply practical university academic counselor, mentor, and senior peer advisor at University of the People (UoPeople).
A university student is experiencing acute impostor syndrome, grade anxiety, or feeling overwhelmed by coursework.

STUDENT'S SPECIFIC CONCERN / QUERY:
"${payload.concern || 'I scored lower than expected on my recent assignment/quiz and feel like I cannot keep up with the coursework.'}"

LANGUAGE: ${lang === 'my' ? 'Burmese (မြန်မာဘာသာ)' : 'English'}
RANDOM SEED / DYNAMIC PERSPECTIVE ANGLE: #${randomSeed} -> ${chosenPerspective}

CRITICAL COMMUNICATION DIRECTIVES FOR 100% UNIQNESS & ZERO REPETITION:
1. DYNAMIC PERSPECTIVE: Tailor your advice specifically around the chosen angle above. Never output generic or canned responses.
2. ${
  lang === 'my'
    ? `BURMESE SPOKEN STYLE: Write in warm, conversational, natural, spoken Burmese (စကားပြောဟန် သဘာဝအရေးအသား - "AI လုံးဝ မဆန်စေရပါ၊ တကယ့် senior ကျောင်းသားကြီးတစ်ယောက်က ညီငယ်/ညီမငယ်ကို ရင်းရင်းနှီးနှီး အကြံပေးသလို ရေးပါ")။ လေးပင်သော ဘာသာပြန်ဆန်ဆန် စကားလုံးများ မသုံးပါနှင့်။`
    : `ENGLISH SPOKEN STYLE: Write in a warm, relatable, empathetic mentor voice.`
}
3. STRUCTURE:
   - 🌿 Honest Reassurance & Perspective tailored directly to their specific concern.
   - 🎯 3 Concrete, Actionable Steps (Micro-actions for UoPeople terms).
   - 💬 Warm Encouraging Mindset Shift.
Keep it concise, deeply supportive, and 100% unique to this prompt.`;
        break;
      }

      case 'uopeople_scholarship': {
        const isRenewal = payload.isRenewal || false;
        const studentInfo = payload.studentInfo || {};
        prompt = `You are an elite educational counselor specializing in University of the People (UoPeople) Assessment Fee Scholarship applications and renewals.
TASK: Write an authentic, compelling scholarship essay for the UoPeople Scholarship Committee.

CRITICAL HARD CONSTRAINT (NON-NEGOTIABLE):
- The UoPeople portal imposes a STRICT 1,000 CHARACTERS LIMIT (including spaces and punctuation).
- Your final essay output MUST BE strictly BETWEEN 750 AND 980 CHARACTERS. Never exceed 1,000 characters under any circumstance!
- Count every single character and ensure it fits.

STUDENT DETAILS & CIRCUMSTANCES (Provided in English or Burmese):
- Type: ${isRenewal ? 'SCHOLARSHIP RENEWAL' : 'NEW SCHOLARSHIP APPLICATION'}
- Financial Hardship / Country Situation: ${studentInfo.hardship || 'Local economic downturn, currency devaluation, limited family income.'}
- Academic Record / CGPA: ${studentInfo.cgpa || 'In good academic standing (CGPA 3.0+)'}
- Completed Courses / Program: ${studentInfo.program || 'Degree student'}
- Career & Community Commitment: ${studentInfo.goals || 'To complete degree and contribute to community development.'}

WRITING DIRECTIVES:
1. 100% HUMAN & AUTHENTIC (ZERO AI SLOP):
   - Never use generic AI clichés like "beacon of hope", "tapestry", "deeply passionate", "in summary", "pivotal".
   - Use direct, honest, dignified personal voice.
2. COMPELLING NARRATIVE ARC:
   - Paragraph 1: Direct statement of financial obstacle (e.g. currency instability, family responsibility) without sounding helpless.
   - Paragraph 2: Academic dedication and discipline demonstrated at UoPeople.
   - Paragraph 3: Future impact and graduation goal.
3. STATED CHARACTER COUNT: At the bottom, include:
   [Character Count: XXX / 1,000 characters]

Generate the essay now:`;
        break;
      }

      case 'peer_comment_generator': {
        const { classmatePost, unitTopic = 'Unit Topic', peerCount = 1 } = payload;
        prompt = `You are an expert UoPeople peer assessor and academic discussion mentor.
TASK: Generate ${peerCount > 1 ? `${peerCount} distinct high-quality` : 'a high-quality'} constructive peer response to review a classmate's Discussion Forum post.

CLASSMATE'S POST:
---
${classmatePost}
---
UNIT TOPIC: ${unitTopic}

STRICT RUBRIC & QUALITY DIRECTIVES:
1. LENGTH: Minimum 100 words per response (strictly 120-180 words optimal).
2. ZERO ROBOTIC CLICHÉS (PURGE AI OPENINGS):
   - BANNED: "Overall,", "Great post,", "I really enjoyed reading your post,", "Your post is a testament to...", "Delving into...".
   - Open naturally by citing a specific assertion or concept the classmate made.
3. THREE-PART STRUCTURE (UoPEOPLE PEER RUBRIC):
   - Part 1 (Concrete Praise): Pinpoint one exact argument, example, or source from their post and explain why it was insightful.
   - Part 2 (Constructive Extension / Counter-Perspective): Introduce a complementary theoretical angle, alternative real-world case, or gentle counterpoint.
   - Part 3 (Thought-Provoking Socratic Question): End with an open-ended critical thinking question that stimulates further intellectual dialogue.
4. TONE: Scholarly, polite, human, and authentic.

Generate the peer response(s) now:`;
        break;
      }



      case 'extension_petition': {
        const { reasonType, courseCode, instructorName, studentName, studentId, details, proposedDate } = payload;
        prompt = `You are a university academic affairs counselor.
TASK: Write an official, highly professional email petition to the course instructor or program advisor regarding a coursework deadline.

PETITION DETAILS:
- Type: ${reasonType} (e.g. Power Outage / Blackout, Internet Disruption, Medical Emergency, Assignment Extension Request, Incomplete Grade Request)
- Course: ${courseCode || 'Course Code'}
- Instructor: ${instructorName || 'Instructor'}
- Student: ${studentName || 'Student'} (ID: ${studentId || 'UoPeople Student ID'})
- Specific Incident / Reason: ${details || 'Unforeseen power outage and network disruption in the region.'}
- Proposed Alternative Submission Date: ${proposedDate || 'Within 48 hours'}

DIRECTIVES:
1. Professional, respectful, and dignified academic tone (adheres to UoPeople Code of Conduct).
2. Clearly state the situation factually without excessive emotion.
3. Explicitly reference course policies on excused absences or extension requests.
4. State the proposed submission date and attach any readiness proof.
5. Provide a Subject Line and clean, copy-paste ready email body.`;
        break;
      }

      case 'claim_extractor': {
        const { excerpt, assignmentContext = '' } = payload;
        prompt = `You are an academic research assistant and critical thinking tutor.
TASK: Analyze the following excerpt highlighted by a student from their course reading or textbook:

EXCERPT:
"${excerpt}"
ASSIGNMENT TOPIC:
${assignmentContext || 'General academic paper'}

TASK:
1. 🏷️ Primary Classification: Classify whether this statement represents:
   - [CLAIM / MAIN ASSERTION] (သဘောထား/အဆိုပြုချက်)
   - [EMPIRICAL DATA / EVIDENCE] (အချက်အလက်/သက်သေအထောက်အထား)
   - [COUNTER-ARGUMENT / CAVEAT] (ဆန့်ကျင်ဘက်အချက်/ကန့်သတ်ချက်)
3. ✍️ Ready-to-Use Sentence for Outline: Rephrase the excerpt into a scholarly, synthesis-ready sentence with a clean in-text citation template (e.g. Author, Year).`;
        break;
      }

      case 'scholarship_dynamic_templates': {
        const {
          applicationType = 'new',
          degreeProgram = 'Bachelor of Science in Computer Science',
          seed = Date.now(),
          variation = 1,
        } = payload;

        prompt = `You are an expert scholarship consultant for University of the People (UoPeople) applicants.
TASK: Generate 3 completely fresh, 100% UNIQUE, non-formulaic Assessment Fee Scholarship templates for the UoPeople portal.

CATEGORY: ${applicationType === 'renewal' ? 'SCHOLARSHIP RENEWAL' : 'NEW SCHOLARSHIP APPLICATION'}
DEGREE: ${degreeProgram}
VARIATION SEED: #${seed} (Iteration #${variation})

NON-NEGOTIABLE DIRECTIVES FOR 100% UNIQNESS:
1. STRICT LENGTH: Each essay text MUST be between 750 and 950 characters (including spaces). HARD CEILING 1,000 characters.
2. DIVERSE TITLES (titleMy in natural Burmese):
   - Do NOT use formulaic titles like "ပုံစံ 1A" or "Template 1".
   - Generate natural, descriptive Burmese titles reflecting real student situations. Examples:
     "မိသားစုတစ်ဦးတည်း ဝင်ငွေအပေါ် မှီခိုနေရခြင်း", "ဒေသတွင်း ကုန်ဈေးနှုန်းနှင့် ငွေကြေးဖောင်းပွမှု အခက်အခဲ", "လျှပ်စစ်မီးနှင့် အင်တာနက် အခက်အခဲကြားမှ စာကြိုးစားသူ"
3. ZERO REPETITIVE AI FORMULAS (0% AI DETECTOR FOOTPRINT):
   - Every single essay MUST start differently (e.g., lead with the degree goal, or lead with local currency devaluation, or lead with family responsibilities).
   - BANNED CLICHÉS: "beacon of hope", "tapestry", "pivotal role", "in conclusion", "furthermore".

OUTPUT FORMAT: Strict JSON:
{
  "templates": [
    {
      "title": "Creative English title",
      "titleMy": "စိတ်ဝင်စားဖွယ် မြန်မာခေါင်းစဉ်",
      "promptHint": "Short context hint",
      "text": "Full submission-ready essay text (750 - 950 characters)"
    }
  ]
}`;
        responseMimeType = 'application/json';
        break;
      }

      case 'scholarship_custom_generator': {
        const {
          userPrompt,
          userSituation,
          applicationType = 'new',
          focusAngle = 'balanced',
          degreeProgram = 'Bachelor of Science in Computer Science',
          studentCgpa = '3.50',
          coursesDone = 'several courses',
          careerGoals = '',
          seed = Date.now(),
          variation = 1,
        } = payload;

        const effectivePrompt = userPrompt || userSituation || 'Severe currency devaluation, elevated inflation, and family economic hardship.';
        const isRenewal = applicationType === 'renewal';

        prompt = `You are a world-class university scholarship mentor, computational linguist, and adversarial humanizer.
TASK: Write an extraordinarily authentic, compelling, human-written Assessment Fee Scholarship application essay for the University of the People student portal.

PROMPT & STUDENT CIRCUMSTANCES (Provided by student in Burmese/English):
"""
${effectivePrompt}
"""

STUDENT ACADEMIC CONTEXT:
- Application Category: ${isRenewal ? 'SCHOLARSHIP RENEWAL (Continuing Student applying to extend funding)' : 'NEW SCHOLARSHIP (Initial applicant seeking funding to start/continue degree)'}
- Degree Program: ${degreeProgram}
${isRenewal ? `- Completed Academic Milestones: ${coursesDone}\n- Current Academic Standing: Cumulative GPA of ${studentCgpa}` : ''}
${careerGoals ? `- Future Aspiration: ${careerGoals}` : ''}
- Strategic Focus Angle: ${focusAngle}
- Variation Seed: ${seed} (Rhetorical Strategy #${variation})

NON-NEGOTIABLE REQUIREMENTS FOR 0% AI DETECTION (AI SCORE < 20%):
1. STRICT CHARACTER COUNT LIMIT (750 to 950 CHARACTERS including spaces):
   - The UoPeople student portal has a strict HARD CEILING of 1,000 characters. If it exceeds 1,000 characters, the portal blocks submission.
   - Your essay MUST be between 750 and 950 characters. Count every letter and space carefully.
2. EXTREME BURSTINESS & SYNTACTIC VARIANCE:
   - AI detectors flag uniform sentence lengths. You MUST interleave ultra-short punchy sentences (3-6 words) with winding multi-clause compound sentences (25-38 words).
   - Example short cadences: "Things are rather difficult." "The cost is steep." "This degree matters." "I am determined."
3. ABSOLUTE ZERO AI-DETECTION & ANTI-CLICHÉ RULES (100% HUMAN SCHOLAR VOICE):
   - NEVER use generic AI filler words: "pivotal role", "beacon of hope", "in today's rapidly changing world", "relentless passion", "a testament to", "testament of my commitment", "delve into", "tapestry", "underscores", "furthermore", "moreover", "in conclusion".
   - Speak in the earnest, grounded, dignified voice of an international undergraduate student.
4. ESSAY STRUCTURE (1 SINGLE FLOWING PARAGRAPH):
   ${isRenewal ? `
   - Sentence 1: Formal request to renew the Assessment Fee Scholarship for upcoming term courses in ${degreeProgram}.
   - Sentence 2: Evidence of academic merit and disciplined progress (mentioning GPA ${studentCgpa} and courses completed).
   - Sentences 3-4: Honest explanation of why financial barriers persist (unemployment, local inflation, family dependency).
   - Sentences 5-6: Why continuing this degree is essential for self-reliance and community impact.
   - Final Sentence: Sincere appreciation for UoPeople's educational mission.` : `
   - Sentence 1: Formal, respectful request for an Assessment Fee Scholarship to pursue ${degreeProgram} at UoPeople.
   - Sentences 2-3: Genuine, specific financial reality (devaluation of local currency, family obligations, prohibitive tuition costs elsewhere).
   - Sentences 4-5: Clear personal drive, disciplined work ethic, and dedication to academic achievement.
   - Sentences 6-7: How graduating will enable them to gain employment and contribute to their community.
   - Final Sentence: Gratitude for the opportunity of barrier-free higher education.`}
5. DIVERSITY GUARANTEE:
   - Use distinct syntax and fresh sentence openings based on the Variation Seed. Never output identical text across requests.

OUTPUT FORMAT:
Output ONLY the final scholarship essay text ready to copy-paste into the portal. Do not include headers, character counts, or markdown formatting.`;
        break;
      }

      case 'scholarship_renewal_advisor_email': {
        const {
          advisorName = 'Program Advisor',
          studentName = 'Student',
          studentId = 's123456',
          degreeProgram = 'Bachelor of Science',
          cgpa = '3.50',
          coursesDone = 'enrolled courses',
          termPlan = '2 courses',
          customNotesPrompt = '',
          seed = Date.now(),
        } = payload;

        prompt = `You are a university academic communications advisor.
TASK: Draft a professional, courteous, and highly persuasive email to a University of the People Program Advisor requesting authorization to unlock and renew the student's Assessment Fee Scholarship for the upcoming academic term.

STUDENT DETAILS:
- Student Name: ${studentName}
- Student ID: ${studentId}
- Program: ${degreeProgram}
- Cumulative GPA: ${cgpa}
- Completed Progress: ${coursesDone}
- Upcoming Registration Plan: ${termPlan}
- Program Advisor: ${advisorName}
${customNotesPrompt ? `- Additional Circumstances / Urgency: ${customNotesPrompt}` : ''}
- Variation Seed: ${seed}

DIRECTIVES:
1. Tone: Respectful, articulate, appreciative, and concise. Adheres to UoPeople's official student-advisor communication etiquette.
2. Specifically ask the advisor to review their academic progress and authorize the renewal scholarship form in their UoPeople Portal so they can register before the deadline.
3. Highlight their good academic standing (CGPA ${cgpa}) to prove their commitment.
4. Output with a clean SUBJECT line and email body.
5. CONTEXTUAL RELEVANCE & ZERO REPETITION: Deeply integrate the student's additional circumstances ("${customNotesPrompt || 'Standard renewal request'}") into the narrative of the email in articulate academic English. If the student notes an urgent situation, registration deadline, medical issue, or wrote in Burmese, directly address that specific reality rather than using boilerplate text. Vary sentence structure, openings, and subject line based on the Variation Seed (${seed}) so no two generated emails are identical.`;
        break;
      }

      case 'scholarship_intl_evaluator': {
        const { essayText, scholarshipName = 'UoPeople Assessment Fee Scholarship / International University Scholarship' } = payload;
        prompt = `You are an elite International Scholarship Review Board Member and Admissions Committee Dean.
TASK: Thoroughly evaluate the following scholarship essay against International University Admissions Standards (compatible with UoPeople, Fulbright, Chevening, DAAD, and Commonwealth rubrics):

TARGET SCHOLARSHIP:
${scholarshipName}

ESSAY UNDER REVIEW:
"""
${essayText}
"""

CHARACTER & WORD COUNT:
- Total Characters (with spaces): ${essayText.length}
- Total Words: ${essayText.split(/\s+/).filter(Boolean).length}

EVALUATION CRITERIA:
1. 💰 Financial Need Persuasiveness (ငွေကြေးအခက်အခဲ သက်သေပြနိုင်မှု): Is the economic hardship specific, realistic, and compelling?
2. 📚 Academic Dedication & Purpose (ပညာရေးကြိုးစားမှုနှင့် ခိုင်မာသောရည်မှန်းချက်): Does the applicant demonstrate disciplined study habits, grit, and intellectual focus?
3. 🌍 Community Impact & Leadership (လူမှုအသိုက်အဝန်း အကျိုးပြုနိုင်မှု): Does the essay show how the degree will benefit others beyond individual gain?
4. ✍️ Authenticity & Human Voice (စစ်မှန်သော လူသားဟန်ပန်): Does it avoid robotic AI clichés ("beacon of hope", "pivotal role")? Does it sound genuine?
5. 📏 Character Count Compliance (UoPeople ၁,၀၀၀ စာလုံးကန့်သတ်ချက်):
   - Under 1,000 characters = SAFE ✅
   - Over 1,000 characters = CRITICAL WARNING ⚠️ (Portal will reject!)

PROVIDE YOUR EVALUATION STRICTLY WITH THE FOLLOWING MARKDOWN STRUCTURE:
### 🏆 Admissions Committee Verdict & Score
- Overall Score: [e.g. 94 / 100]
- Rating: [e.g. Highly Competitive / Acceptance Ready / Needs Revisions]
- Portal Character Limit: ${essayText.length <= 1000 ? `✅ ${essayText.length} / 1,000 characters (Portal Compliant)` : `⚠️ ${essayText.length} / 1,000 characters (EXCEEDS Portal Limit by ${essayText.length - 1000} chars - MUST SHORTEN!)`}

### 📊 Rubric Breakdown
| Metric | Score (out of 20) | Assessment |
| :--- | :--- | :--- |
| Financial Need Evidence | [X]/20 | [Brief critique] |
| Academic Grit & Merit | [X]/20 | [Brief critique] |
| Community Impact Potential | [X]/20 | [Brief critique] |
| Authentic Voice (Anti-AI) | [X]/20 | [Brief critique] |
| Conciseness & Flow | [X]/20 | [Brief critique] |

### 🌟 Key Strengths (အားသာချက်များ)
[Highlight 2-3 strong points]

### ⚠️ Areas for Improvement (ပိုမိုကောင်းမွန်အောင် ပြင်ဆင်ရန် အချက်များ)
[Specific actionable suggestions]

### 💡 Polished Sentence-by-Sentence Suggestions (စကားလုံး အကြံပြုချက်)
[Give specific phrase improvements to elevate the essay to a 100% winning level]`;
        break;
      }

      case 'scholarly_source_verifier': {
        const { queryMode, inputContent } = payload;
        // queryMode: 'verify_existing' | 'find_sources'
        if (queryMode === 'verify_existing') {
          prompt = `You are an academic librarian and bibliographic research specialist.
TASK: Verify and audit the following list of academic citations / links provided by a student:

INPUT CITATIONS / REFERENCES:
---
${inputContent}
---

TASKS:
1. 🔍 Authenticity & Verification Audit:
   - For each citation, check if the authors, publication year, journal title, and DOI/URL are historically genuine or likely hallucinated/fabricated by AI.
   - Flag any fictitious citations or broken link structures.
2. ⚠️ Plausibility & Temporal Validity:
   - Identify whether any dates or sources appear outdated (>10 years old) or inconsistent with current academic literature.
3. 💡 Verified Scholarly Recommendations:
   - For any questionable citation, provide a 100% genuine, real-world peer-reviewed replacement from major academic repositories (JSTOR, Elsevier, Springer, Oxford, Harvard, or official international reports like UN/World Bank).
   - Include exact APA 7th format with verified DOI or Google Scholar query link.`;
        } else {
          prompt = `You are a university research librarian and academic literature specialist.
TASK: The student is writing an assignment on the following topic or draft excerpt. Find 3 to 5 GENUINE, VERIFIABLE scholarly sources (peer-reviewed journal articles, seminal academic books, or official institutional reports) to support their claims.

STUDENT'S TOPIC / ASSIGNMENT EXCERPT:
---
${inputContent}
---

CRITICAL ANTI-HALLUCINATION DIRECTIVES:
1. ONLY REAL SCHOLARLY SOURCES: Every single paper, author, publication year, journal name, and volume MUST BE 100% FACTUAL and verifiable in Google Scholar, PubMed, Semantic Scholar, or CrossRef. Never guess or combine fake names.
2. FORMAT EACH SOURCE AS FOLLOWS:
   - 📖 **Full APA 7th Reference**: (Author, Year, Title, Journal/Publisher, DOI or permanent URL).
   - 🔗 **Direct Search & Verification Link**: Provide a direct search link in the format: https://scholar.google.com/scholar?q=[Encoded+Title+And+Author]
   - 💡 **How to Synthesize in Your Essay**: In 1-2 sentences, explain exactly how this source supports the student's argument.
   - ✍️ **Sample In-Text Citation Sentence**: Provide a natural in-text citation example (e.g., "According to Smith (2022), ...").`;
        }
        break;
      }

      case 'discussion_followup_reply': {
        const { originalPost, interlocutorType = 'classmate', questionText, seed = Date.now() } = payload;
        prompt = `You are an expert UoPeople academic peer and discussion mentor.
TASK: Help a university student write a polite, scholarly, and articulate follow-up reply in their course Discussion Forum to address a question or critique left under their post.

STUDENT'S ORIGINAL DISCUSSION POST:
---
${originalPost}
---

COMMENT / QUESTION FROM ${interlocutorType.toUpperCase()}:
---
${questionText}
---
RANDOM SEED / FRESH VARIATION: ${seed}

DIRECTIVES:
1. LENGTH: 100 to 160 words (optimal discussion reply length).
2. TONE: Respectful, intellectual, collegiate, and collaborative.
3. ZERO AI FORMULAS: Do NOT open with "Thank you for this insightful question!", "I really appreciate your thoughts,", or "Overall,". Open naturally and substantively (e.g., "That is a fair critique regarding...", "Your question raises an essential tension between...").
4. THREE ESSENTIAL PARTS:
   - Part 1: Directly acknowledge and address the core point of their question.
   - Part 2: Reinforce or nuance your original position with a concrete example or evidence.
   - Part 3: Close by connecting back to the broader course theme or inviting their further reflection.

Output only the polished, ready-to-post reply.`;
        break;
      }

      case 'instructor_rubric_profiler': {
        const { instructorNotes, draftText, profileType = 'custom' } = payload;
        prompt = `You are a university senior academic advisor and grading consultant.
TASK: Analyze an instructor's specific grading style, feedback patterns, or syllabus directives, and evaluate the student's assignment draft against this specific instructor's grading bias.

INSTRUCTOR PROFILE / SYLLABUS NOTES / PAST FEEDBACK:
---
${instructorNotes || `Profile Type: ${profileType} (e.g. Strict on APA Citations, Strict on Word Count & Depth, Strict on Critical Thinking)`}
---

STUDENT'S DRAFT TEXT:
---
${draftText || 'Draft not provided. Provide general rubric optimization scorecard.'}
---

TASKS:
1. 🎯 **Instructor Archetype & Grading Bias Profile**:
   - Classify the instructor's top 2 grading priorities (e.g., [Strict APA Citation & Evidence Auditor], [Critical Thinking & Counter-Argument Evaluator], [Prompt Rubric Checklist Purist], or [Word Count & Analytical Depth Enforcer]).
   - Explain what this instructor penalizes the most harshly based on their directives.
2. 🔍 **Draft Evaluation Against Instructor's Bias**:
   - Grade Risk Level (Low / Moderate / High Risk of point deduction).
   - Pinpoint 2 specific areas in the student's draft that would trigger point deductions under this instructor.
3. ✍️ **Three Actionable Adjustments for an 'A' Grade**:
   - Give 3 precise, concrete revisions to satisfy this specific instructor's rubric expectations.`;
        break;
      }

      case 'plagiarism_false_positive_shield': {
        const { fullText, courseCode = 'POLS 1503', promptExcerpt = '' } = payload;
        prompt = `You are an academic integrity and Turnitin/SafeAssign algorithmic specialist.
TASK: Perform an Academic Plagiarism False-Positive Audit on a student's university paper. Turnitin similarity scores often falsely spike because of generic institutional text, course codes, title page boilerplates, and quoted prompt questions.

FULL PAPER TEXT:
---
${fullText}
---
COURSE CODE: ${courseCode}
PROMPT EXCERPT: ${promptExcerpt || 'General Course Assignment'}

TASKS:
1. 🛡️ **Institutional Boilerplate Identification**:
   - Identify all standard institutional phrases in the draft that cause false Turnitin matches (e.g., "University of the People", course titles, standard headers, honor code statements, prompt question repeats).
2. 📊 **True Academic Core vs Boilerplate Breakdown**:
   - Estimate the percentage of the text that represents genuine student synthesis versus template/institutional phrases.
   - Calculate True Similarity Risk (Low / Moderate / High false-positive vulnerability).
3. 🛠️ **Anti-Similarity Paraphrasing Directives**:
   - Show the student how to rephrase any quoted prompt lines or syllabus headings into original academic signposts so Turnitin does not highlight them as plagiarism.
4. 📄 **Shielded Academic Core Text**:
   - Output an inspection of the authentic core arguments free of template clutter.`;
        break;
      }

      case 'anti_ai_humanize_cot': {
        const { text, intensity = 'standard', variation = 1 } = payload;
        prompt = `You are an expert AI Detection Evasion and Prompt Engineering Specialist.
TASK: Rewrite and humanize the following academic draft using a rigorous Multi-Step Chain-of-Thought (CoT) rewriting pipeline to completely bypass strict AI detectors (ZeroGPT, Turnitin, GPTZero, CopyLeaks).

INPUT TEXT TO HUMANIZE:
---
${text || 'Academic statement of need or scholarship draft'}
---
Variation Seed: ${variation}

CHAIN-OF-THOUGHT DE-SYNTHESIZING & REWRITING INSTRUCTIONS:
Step 1: Raw Grounding & Core Extraction
- Extract the core personal, financial, or academic argument without losing any factual context.
- Ground the narrative in concrete everyday student realities (e.g., electricity load shedding, currency inflation in local markets, family responsibilities, study habits).

Step 2: Linguistic De-Synthesizing (Burstiness & Perplexity Injection)
- EXTREME BURSTINESS: Intentionally interleave ultra-short punchy fragments (4-8 words, e.g., "The cost is steep.", "Things are hard.", "I study every night.") with winding, naturally convoluted compound-complex sentences (25-38 words). Never let sentences have uniform lengths.
- PACING DELTA: Ensure adjacent sentences have dramatic length contrasts.
- VOCABULARY PERPLEXITY: Use unexpected yet precise academic and grounded terms rather than sterile corporate clichés.
- CONVERSATIONAL FLOW: Use natural conversational connectors ("Honestly,", "At the time,", "Even so,", "Looking back,") instead of robotic transitions ("Moreover," "Furthermore," "In conclusion,").

Step 3: Anti-Detector Audit & Purification
- FORBIDDEN TOKENS (Must NEVER appear): "delve", "beacon", "testament", "crucial", "paramount", "furthermore", "moreover", "in conclusion", "tapestry", "foster", "holistic", "intertwined", "game-changer", "transformative journey", "pivotal", "underscores".
- STYLE: Simulate human stylistic inconsistency across paragraphs (passionate undergraduate student voice, sincere, grounded, non-melodramatic).

OUTPUT FORMAT:
Output ONLY the fully humanized, ready-to-use essay text ready to copy-paste. Do not include markdown code blocks, metadata headers, or CoT thinking steps in the output.`;
        break;
      }

      default:
        res.status(400).json({ error: 'Unknown action specified' });
        return;
    }

    const strictKeyHeader = req.headers['x-strict-key'] === '1';
    const rawHeaderKey = (
      (req.headers['x-gemini-key'] as string | undefined) ||
      (req.headers['x-goog-api-key'] as string | undefined) ||
      ''
    )
      .replace(/["'\s]/g, '')
      .trim();

    const effectiveKeys =
      strictKeyHeader && rawHeaderKey.length >= 10 ? [rawHeaderKey] : candidateKeys;

    // Dynamically discover active models supporting generateContent
    const discoveredCatalog = await discoverActiveServerModels(effectiveKeys);
    const dynamicCascade = discoveredCatalog.all;

    const strictModelMode = req.body?.strictModel === true;
    const rawRequested = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    const lowerRequested = rawRequested.toLowerCase();
    const isValidRequested =
      Boolean(rawRequested) &&
      rawRequested !== 'auto-cascade' &&
      rawRequested !== 'auto' &&
      !lowerRequested.includes('1.0') &&
      !lowerRequested.includes('1.5') &&
      !lowerRequested.includes('2.0') &&
      !lowerRequested.includes('2.5') &&
      !lowerRequested.includes('omni') &&
      !lowerRequested.includes('latest') &&
      (dynamicCascade.length === 0 || dynamicCascade.includes(rawRequested));

    const requestedModel = isValidRequested ? rawRequested : dynamicCascade[0];
    let candidateModels: string[];
    if (strictModelMode && isValidRequested) {
      candidateModels = [requestedModel];
    } else if (isValidRequested) {
      candidateModels = [requestedModel, ...dynamicCascade.filter((m) => m !== requestedModel)];
    } else {
      candidateModels = dynamicCascade;
    }

    if (candidateModels.length === 0) {
      res.status(400).json({
        error: 'No verified generateContent models available for the active API key.',
        status: 'api_key_invalid',
        success: false,
      });
      return;
    }

    let response: any = null;
    let lastError: any = null;
    let successfulModel = '';

    let contentsPayload: any = prompt;
    if (payload?.contents) {
      contentsPayload = payload.contents;
    } else if (Array.isArray(payload?.images) && payload.images.length > 0) {
      const parts: any[] = [];
      payload.images.forEach((img: any) => {
        const rawUrl = String(img.base64 || img.dataUrl || img.data || '');
        const mimeType =
          img.mimeType ||
          (rawUrl.startsWith('data:') ? rawUrl.split(';')[0].replace('data:', '') : 'image/jpeg');
        const cleanBase64 = rawUrl.replace(/^data:[^;]+;base64,/, '');
        if (cleanBase64) {
          parts.push({
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          });
        }
      });
      parts.push({ text: prompt });
      contentsPayload = parts;
    } else if (payload?.imageBase64) {
      const mimeType = payload.imageMimeType || 'image/png';
      const cleanBase64 = String(payload.imageBase64).replace(/^data:[^;]+;base64,/, '');
      contentsPayload = [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        },
      ];
    }

    let hasGoogleSearchTool =
      action === 'generate_study_cards' &&
      Array.isArray(payload.sources) &&
      payload.sources.some((s: string) => typeof s === 'string' && s.trim().length > 0);

    for (const apiKey of effectiveKeys) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
          timeout: 60000,
        },
      });

      for (const currentModel of candidateModels) {
        try {
          const isHumanizeAction = action === 'anti_ai_humanize_cot';
          const isDeterministicQuizOrCards =
            action === 'generate_study_cards' || action === 'direct_flashcards' || action === 'reader_quiz';
          const lowerModel = currentModel.toLowerCase();
          const omitsSamplingParams =
            lowerModel.includes('hydrogen') ||
            lowerModel.includes('argon') ||
            lowerModel.includes('carbon') ||
            lowerModel.includes('3.8-flash');
          const isLiteModel = lowerModel.includes('lite') || lowerModel.includes('8b');

          const requestConfig: any = {
            systemInstruction: payload?.systemInstruction || ACADEMIC_SYSTEM_PROMPT,
            thinkingConfig: { thinkingLevel: isLiteModel ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW },
            ...(omitsSamplingParams
              ? {}
              : payload?.temperature !== undefined
              ? { temperature: payload.temperature }
              : isHumanizeAction
              ? { temperature: 0.92, topP: 0.95 }
              : isDeterministicQuizOrCards
              ? { temperature: 0.2 }
              : {}),
          };

          if (payload?.maxOutputTokens) {
            requestConfig.maxOutputTokens = payload.maxOutputTokens;
          }

          if (hasGoogleSearchTool) {
            requestConfig.tools = [{ googleSearch: {} }];
          } else if (responseMimeType) {
            requestConfig.responseMimeType = responseMimeType;
          }

          try {
            response = await ai.models.generateContent({
              model: currentModel,
              contents: contentsPayload,
              config: requestConfig,
            });
          } catch (callErr: any) {
            const callErrMsg = String(callErr?.message || callErr || '');
            const isThinkingError = callErrMsg.toLowerCase().includes('thinking');
            const isToolError =
              hasGoogleSearchTool &&
              (callErrMsg.toLowerCase().includes('tool') ||
                callErrMsg.toLowerCase().includes('search'));

            if (!isThinkingError && !isToolError) {
              throw callErr;
            }

            if (isThinkingError) {
              delete requestConfig.thinkingConfig;
            }
            if (isToolError) {
              console.warn(`[Auto-Cascade] Search grounding tool throttled on ${currentModel}. Auto-stripping tool and retrying with embedded text...`);
              hasGoogleSearchTool = false;
              delete requestConfig.tools;
              if (responseMimeType) requestConfig.responseMimeType = responseMimeType;
            }

            response = await ai.models.generateContent({
              model: currentModel,
              contents: contentsPayload,
              config: requestConfig,
            });
          }

          if (response && response.text) {
            successfulModel = currentModel;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || err);
          const isInvalidKey =
            errMsg.includes('API key not valid') ||
            errMsg.includes('API_KEY_INVALID') ||
            errMsg.includes('PERMISSION_DENIED');

          if (isInvalidKey) {
            console.warn(`[Gemini] API key invalid for ${currentModel}. Skipping remaining models for this key.`);
            break;
          }

          const isThrottled =
            errMsg.includes('429') ||
            errMsg.includes('503') ||
            errMsg.includes('504') ||
            errMsg.includes('DEADLINE_EXCEEDED') ||
            errMsg.toLowerCase().includes('timeout') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('overloaded');

          if (isThrottled) {
            console.log(`[Auto-Cascade] Model ${currentModel} throttled/timed out (429/503/504). Immediately falling back to next available model in cascade tier...`);
            await new Promise((r) => setTimeout(r, 300));
          } else {
            console.log(`[Gemini Cascade] ${currentModel} unavailable: ${errMsg.slice(0, 80)}. Falling back to next model...`);
          }
          continue;
        }
      }

      if (response && response.text) {
        break;
      }
    }

    if (!response || !response.text) {
      const errMsg = String(lastError?.message || lastError || '');
      const isInvalidKey =
        errMsg.includes('API key not valid') ||
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('PERMISSION_DENIED');

      if (isInvalidKey) {
        res.status(400).json({
          error: 'API key not valid. Please check your Gemini API key in the Settings > Secrets panel.',
          status: 'api_key_invalid',
          success: false,
        });
        return;
      }

      if (strictModelMode) {
        const isTimeoutErr =
          errMsg.includes('504') ||
          errMsg.includes('DEADLINE_EXCEEDED') ||
          errMsg.toLowerCase().includes('timeout') ||
          errMsg.toLowerCase().includes('timed out');
        if (isTimeoutErr) {
          res.status(504).json({
            error: errMsg || 'Model request deadline exceeded (504)',
            status: 'deadline_exceeded',
            success: false,
          });
          return;
        }
        const isThrottledErr =
          errMsg.includes('429') ||
          errMsg.includes('503') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('overloaded');
        if (isThrottledErr) {
          res.status(errMsg.includes('503') ? 503 : 429).json({
            error: errMsg || 'Quota limit reached (429/503)',
            status: 'quota_exhausted',
            success: false,
          });
          return;
        }
        const isModelMissing =
          errMsg.includes('404') ||
          errMsg.includes('NOT_FOUND') ||
          errMsg.toLowerCase().includes('not found') ||
          errMsg.toLowerCase().includes('not supported');
        res.status(isModelMissing ? 404 : 502).json({
          error: errMsg || 'Model unavailable on current key',
          status: isModelMissing ? 'model_unavailable' : 'upstream_error',
          success: false,
        });
        return;
      }

      if (action === 'lesson_explainer' || action === 'generate_study_cards') {
        const errorMsg =
          lastError?.message ||
          (action === 'generate_study_cards'
            ? 'Failed to generate quiz questions with the configured AI models. Please check your network or try again.'
            : 'Gemini API synthesis failed. Please verify your Gemini API key in Privacy Settings.');
        res.status(500).json({
          error: errorMsg,
          success: false,
        });
        return;
      }

      // Smart Procedural Dynamic Generator to guarantee 100% uniqueness, non-repetition & zero errors
      let fallbackResult = '';
      if (action === 'anxiety_grounding') {
        const concern = (payload.concern || 'Academic stress').trim();
        const lang = payload.language || 'my';
        const seedVal = Number(payload.seed) || Date.now();

        if (lang === 'my') {
          // Dynamic conversational variations tailored in spoken Burmese (စကားပြောဟန် သဘာဝအရေးအသား)
          const intros = [
            `🌿 ညီလေး/ညီမလေး ရေ စိတ်အေးအေးထားပြီး အသက်ပြင်းပြင်းရှူလိုက်နော်။ အခုကြုံနေရတဲ့ ("${concern}") ဆိုတဲ့ စိတ်ဖိစီးမှုမျိုးက UoPeople မှာ စာကြိုးစားနေကြတဲ့ ကျောင်းသားတိုင်း အနည်းနဲ့အများ ခံစားဖူးကြတဲ့ သဘာဝအကူးအပြောင်းတစ်ခုပါပဲ။ ကိုယ့်ကိုယ်ကိုယ် အပြစ်မတင်ပါနဲ့။`,
            `🌿 စိတ်မပူနဲ့နော်။ ("${concern}") ဆိုပြီး စိုးရိမ်စိတ်ဝင်နေတာဟာ ကိုယ်က စာကို တကယ်ကောင်းချင်လို့၊ ပညာရေးကို တန်ဖိုးထားလို့ ဖြစ်ရတာပါ။ ဒါပေမဲ့ တစ်ယောက်တည်း ရင်ထဲမှာ ကြိတ်ပြီး ဝန်ပိမနေပါနဲ့။ အခုကစပြီး တဆင့်ချင်း ပြန်လည်ဖြေရှင်းကြမယ်။`,
            `🌿 ခဏလောက် အနားယူလိုက်ပါဦးနော်။ စာလုပ်ရင်း ("${concern}") လို့ စိတ်ဓာတ်ကျလာချိန်မှာ အားလုံးကို လက်လျှော့ချင်သလို ခံစားရတတ်ပါတယ်။ ဒါဟာ ဦးနှောက်က မောပန်းလွန်းလို့ အနားတောင်းနေတဲ့ သဘောပါ။ သင့်ရဲ့ တန်ဖိုးက အခုအခက်အခဲထက် အများကြီး ကြီးမားပါတယ်။`,
            `🌿 အားတင်းထားပါနော်။ UoPeople တက်ရောက်တဲ့ ကျောင်းသားတော်တော်များများဟာ အလုပ်တွေ၊ မိသားစုတာဝန်တွေကြားက စာလုပ်နေရတာမို့ ("${concern}") ဆိုတာကို ကြုံရလေ့ရှိပါတယ်။ သင်တစ်ယောက်တည်း ဖြစ်နေတာ မဟုတ်ပါဘူး။`,
          ];

          const step1List = [
            `**အဓိကအချက်ကိုပဲ အရင်ခွဲထုတ်ပါ**: စာတွေ အကုန်လုံး တစ်ပြိုင်နက်တည်း ပြီးအောင် မတွေးပါနဲ့။ ဒီနေ့အတွက် အရေးအကြီးဆုံး Unit Task တစ်ခုတည်းကိုပဲ ရွေးပြီး အာရုံစိုက်ပါ။`,
            `**Rubric ကို သေချာပြန်ဖတ်ပါ**: Instructor ဘာကို အမှတ်ပေးမလဲဆိုတဲ့ Criteria လေးတွေကို အရင်စစ်ဆေးပါ။ မလိုလားအပ်တဲ့ ဖိစီးမှုတွေကို လျှော့ချနိုင်ပါလိမ့်မယ်။`,
            `**Task တွေကို သေးသေးလေးတွေ အပိုင်းခွဲပါ**: ၂ နာရီ ၃ နာရီ ဆက်တိုက် စာမဖတ်ဘဲ ၂၅ မိနစ်ဖတ်၊ ၅ မိနစ်နား ပုံစံမျိုးနဲ့ အဆင့်ဆင့် ခြေလှမ်းလှမ်းပါ။`,
          ];

          const step2List = [
            `**Peer Forum နဲ့ Discord မှာ မေးပါ**: ကိုယ် နားမလည်တဲ့ အချက်ကို တခြား ကျောင်းသားတွေနဲ့ Discussion မှာ ပွင့်ပွင့်လင်းလင်း မေးမြန်းတိုင်ပင်ပါ။ သူတို့လည်း ကိုယ့်လိုပဲ ကြုံဖူးကြပါတယ်။`,
            `**အနားပေးချိန် သတ်မှတ်ပါ (Active Break)**: ကွန်ပျူတာရှေ့က ခဏထပြီး ရေအေးအေးတစ်ခွက်သောက်ပါ၊ မျက်စိကို ခေတ္တမှိတ်ပြီး အကြောလျှော့ပေးပါ။`,
            `**အရင်က အောင်မြင်ခဲ့တဲ့ အမှတ်တွေကို ပြန်သတိရပါ**: အရင် Term တွေက အောင်မြင်ခဲ့တာတွေကို သတိရပြီး ကိုယ့်ကိုယ်ကိုယ် ယုံကြည်မှု ပြန်တည်ဆောက်ပါ။`,
          ];

          const step3List = [
            `**Program Advisor ထံ အကူအညီတောင်းပါ**: အမှန်တကယ် အခက်အခဲရှိနေပါက Advisor သို့မဟုတ် Instructor ထံ စာရေးပြီး Extension သို့မဟုတ် အကြံဉာဏ် ရယူပါ။`,
            `**စာဖတ်ချိန်ကို ပုံသေအချိန်ပေးပါ**: နေ့စဉ် မနက် သို့မဟုတ် ညဘက်မှာ အနှောင့်အယှက်ကင်းတဲ့ မိနစ် ၃၀ ကို သီးသန့်ဖယ်ထားပြီး တစိုက်မတ်မတ် လေ့လာပါ။`,
            `**ပြီးပြည့်စုံမှုကို မတောင့်တပါနဲ့ (Done is better than perfect)**: စာမပြီးမှာ စိုးရိမ်နေမယ့်အစား ရသလောက် draft အရင်ရေးချပြီးမှ ပြန်လည်ပြင်ဆင်ပါ။`,
          ];

          const conclusions = [
            `💬 မှတ်ထားပါနော်: Assignment တစ်ခု သို့မဟုတ် Quiz တစ်ခုမှာ အမှတ်နည်းသွားရုံနဲ့ သင့်ရဲ့ တစ်သက်တာ ပညာရေးနဲ့ အနာဂတ် ရည်မှန်းချက်တွေ ဘာမှ မပျက်စီးသွားပါဘူး။ ဖြည်းဖြည်းချင်း လျှောက်လှမ်းသွားရင် သေချာပေါက် အောင်မြင်မှာပါ။`,
            `💬 ကိုယ့်ကိုယ်ကိုယ် အားပေးစကား အမြဲပြောပါ: "ငါ ကြိုးစားနေတယ်၊ တဖြည်းဖြည်း တိုးတက်လာမယ်" ဆိုတဲ့ စိတ်ဓာတ်နဲ့ ရှေ့ဆက်ပါ။ အမြဲ အားပေးနေပါတယ်။`,
            `💬 စိတ်အေးချမ်းမှုက အရေးကြီးဆုံးပါ: စိတ်ဖိစီးမှုတွေကို တစ်ခုချင်းစီ လျှော့ချပြီး ယုံကြည်ချက်အပြည့်နဲ့ ဆက်လက် လျှောက်လှမ်းပါ။ သင် လုပ်နိုင်ပါတယ်။`,
          ];

          const idxIntro = Math.abs(seedVal) % intros.length;
          const idx1 = Math.abs(seedVal + 1) % step1List.length;
          const idx2 = Math.abs(seedVal + 2) % step2List.length;
          const idx3 = Math.abs(seedVal + 3) % step3List.length;
          const idxConc = Math.abs(seedVal + 4) % conclusions.length;

          fallbackResult = `${intros[idxIntro]}\n\n🎯 လက်တွေ့ လုပ်ဆောင်နိုင်မယ့် အဆင့် ၃ ဆင့်:\n၁။ ${step1List[idx1]}\n၂။ ${step2List[idx2]}\n၃။ ${step3List[idx3]}\n\n${conclusions[idxConc]}`;
        } else {
          // Dynamic English Guidance
          const enIntros = [
            `🌿 Take a gentle deep breath. What you're experiencing with "${concern}" is a hallmark of dedicated, ambitious students at UoPeople. Feeling this way doesn't mean you lack ability; it means you care deeply about your future.`,
            `🌿 Be kind to yourself today. Facing "${concern}" is an understandable emotional barrier when balancing rigorous academics with real-world responsibilities. You are far more capable than your anxiety is letting you believe right now.`,
            `🌿 Pause for a moment. Coursework stress around "${concern}" is very common, but it is also completely solvable with a calm, step-by-step approach.`,
          ];

          const enSteps = [
            `1. **Dissect the Immediate Priority**: Don't try to solve the entire semester right now. Pick just one singular reading or discussion prompt and tackle only that for 25 minutes.`,
            `2. **Leverage Peer Collective Wisdom**: Open your course forum or Discord study group and notice that peers share these exact challenges. You aren't walking this path alone.`,
            `3. **Communicate Early**: If a deadline is genuinely slipping, reach out to your instructor with a professional, dignified extension request.`,
          ];

          const enConclusions = [
            `💬 Remember: One exam score or difficult week will never define your intellect or your degree journey. Keep putting one foot in front of the other!`,
            `💬 Growth happens precisely in moments like this. Stay steady, protect your peace, and take pride in how far you've already come.`,
          ];

          const idxEIntro = Math.abs(seedVal) % enIntros.length;
          const idxEConc = Math.abs(seedVal + 1) % enConclusions.length;

          fallbackResult = `${enIntros[idxEIntro]}\n\n🎯 3 Immediate Grounding Steps:\n${enSteps.join('\n')}\n\n${enConclusions[idxEConc]}`;
        }
      } else if (action === 'scholarship_custom_generator') {
        const seedVal = Number(payload.seed) || Date.now();
        const degree = payload.degreeProgram || 'Bachelor of Science in Computer Science';
        const focus = payload.focusAngle || 'balanced';
        const userPrompt = (payload.userPrompt || '').trim();
        const isRenewal = payload.applicationType === 'renewal';

        if (isRenewal) {
          const cgpa = payload.studentCgpa || '3.50';
          const courses = payload.coursesDone || 'all enrolled courses';
          const renewalOptions = [
            `I am writing to formally request the renewal of my Assessment Fee Scholarship for my ${degree} studies at University of the People. Over past terms, I have demonstrated steadfast academic diligence by completing ${courses} with a cumulative GPA of ${cgpa}. While I maintain consistent scholastic progress, severe regional currency devaluation and persistent living cost inflation continue to exhaust our household finances. Covering upcoming course assessment fees independently remains an insurmountable barrier. This degree is my bridge toward professional self-reliance and community uplift. Renewing this scholarship will allow me to register for next term without interruption and stay on track for graduation. Thank you for your continued trust and invaluable support.`,
            `I respectfully apply for the continuation of my Assessment Fee Scholarship in ${degree} at University of the People. Having completed ${courses} while sustaining an academic GPA of ${cgpa}, I have proven my capacity to excel under rigorous academic expectations. Despite navigating heavy personal responsibilities and acute economic instability in my home country, I have never missed a coursework deadline. Our household income remains strictly limited to survival necessities, leaving no funds for assessment fees. Extending this scholarship will enable me to maintain academic momentum and fulfill my graduation goal. I am deeply grateful for the committee's enduring commitment to students in need.`,
            `I am submitting this application to respectfully request renewal of my Assessment Fee Scholarship at University of the People. In my ${degree} coursework, I have completed ${courses} with a ${cgpa} CGPA, actively engaging in collaborative peer learning. Unrelenting economic inflation in my region has drastically curtailed our family's purchasing power. Without scholarship renewal, paying forthcoming course assessment fees will force an unavoidable disruption in my studies. Completing this degree is essential for my long-term career independence. With your continued assistance, I will proceed toward graduation without financial pause. Thank you sincerely for your consideration.`
          ];
          fallbackResult = renewalOptions[Math.abs(seedVal) % renewalOptions.length];
        } else {
          const newOptions = [
            `I am writing to respectfully request an Assessment Fee Scholarship to support my ${degree} studies at University of the People. In my home country, steep currency devaluation and rapid inflation have severely diminished our family purchasing power. Essential living expenses consume all available funds, making course assessment fees an insurmountable financial hurdle. Despite these challenges, I remain dedicated to academic achievement and disciplined daily study. Earning this accredited degree is my primary pathway toward professional employment and self-reliance. With your scholarship support, I can proceed with my coursework without financial pause. Thank you sincerely for your review.`,
            `I respectfully submit this application for an Assessment Fee Scholarship to pursue my ${degree} degree at University of the People. Our region faces ongoing economic disruption, frequent electricity outages, and fragile local employment markets. My family's income is completely absorbed by basic necessities, leaving zero discretionary funds for assessment fees. To overcome infrastructural obstacles, I organize my study schedule around power availability and rely on downloaded materials. UoPeople's tuition-free model provides a crucial door to higher education. Scholarship assistance will alleviate severe financial strain and keep my studies on track. Thank you for your kind consideration.`,
            `I am writing to formally request an Assessment Fee Scholarship to support my degree program in ${degree} at University of the People. As a first-generation university student, pursuing higher education has been my lifelong aspiration. However, persistent economic hardship makes it impossible for my family to cover course assessment fees independently. I am fully committed to academic rigor, collaborative peer learning, and graduating with distinction. Upon completion, I plan to leverage my education to spearhead digital literacy initiatives in my community. Receiving this scholarship will ensure that financial limitations do not derail my progress. Thank you sincerely.`,
            `I am writing to apply for an Assessment Fee Scholarship for my studies in ${degree} at University of the People. Escalating living costs and limited family income have created substantial financial constraints for our household. Paying course assessment fees independently represents a major obstacle to completing my degree. Despite these circumstances, I maintain disciplined study habits and a passion for academic inquiry. This accredited degree will provide the skills required for sustainable employment and positive community impact. Scholarship funding will grant me the opportunity to continue learning without financial anxiety. Thank you for making education accessible.`
          ];
          fallbackResult = newOptions[Math.abs(seedVal) % newOptions.length];
        }
      } else if (action === 'scholarship_dynamic_templates') {
        const seedVal = Number(payload.seed) || Date.now();
        const degree = payload.degreeProgram || 'Bachelor of Science in Computer Science';
        const isRenewal = payload.applicationType === 'renewal';
        const nextVar = Number(payload.variation) || 1;

        if (isRenewal) {
          const titles = [
            { en: `Renewal ${nextVar}A: High CGPA & Persistent Economic Strain`, my: `သက်တမ်းတိုး ${nextVar}(က) - CGPA ထိန်းသိမ်းထားနိုင်သော်လည်း ငွေကြေးအခက်အခဲ ဆက်ရှိနေခြင်း` },
            { en: `Renewal ${nextVar}B: Term Consistency & Degree Momentum`, my: `သက်တမ်းတိုး ${nextVar}(ခ) - စာမေးပွဲမပြတ် အောင်မြင်ပြီး ဘွဲ့ရသည်အထိ ဆက်လက်တက်လိုခြင်း` },
            { en: `Renewal ${nextVar}C: Family Responsibility & Term Registration`, my: `သက်တမ်းတိုး ${nextVar}(ဂ) - မိသားစုတာဝန်ကြားမှ စာကြိုးစားသူ၏ သက်တမ်းတိုး တောင်းဆိုလွှာ` },
          ];
          fallbackResult = JSON.stringify({
            templates: [
              {
                title: titles[0].en,
                titleMy: titles[0].my,
                promptHint: 'Maintained strong CGPA, completed all assigned courses, but economic stagnation persists.',
                text: `I am writing to formally apply for the renewal of my Assessment Fee Scholarship in ${degree} at University of the People. Throughout my previous terms, I have maintained strong academic standing with a high cumulative GPA and completed all assigned courses. However, ongoing regional currency inflation continues to strain my family finances. Paying upcoming assessment fees out of pocket remains impossible. Continuing my degree is vital for my future self-reliance. Scholarship renewal will enable me to register for next term and stay on track for graduation. Thank you for your continued support.`
              },
              {
                title: titles[1].en,
                titleMy: titles[1].my,
                promptHint: 'Completed course units with good grades, seeking renewal for upcoming term.',
                text: `I respectfully request the renewal of my Assessment Fee Scholarship for the upcoming academic term at University of the People. I have proven my academic capability by completing my enrolled courses in ${degree} with commendable grades. Despite balancing heavy family responsibilities amidst economic hardship, I have met all assignment deadlines. Our financial situation remains heavily constrained, making scholarship continuation essential. This funding will allow me to register for my upcoming courses without pause. I am profoundly thankful for the committee's ongoing trust.`
              },
              {
                title: titles[2].en,
                titleMy: titles[2].my,
                promptHint: 'Dedicated student facing currency depreciation, requesting assessment fee exemption.',
                text: `I am writing to apply for a scholarship renewal to support my ongoing ${degree} studies at University of the People. Having demonstrated consistent dedication across my courses, I am deeply committed to earning my degree. Economic hardship in my region persists, leaving my family without spare income for assessment fees. This scholarship is my sole means of continuing higher education. Renewing this support will ensure I maintain momentum toward timely graduation and long-term career independence. Thank you for your dedication to students in need.`
              }
            ]
          });
        } else {
          const titles = [
            { en: `Strategy ${nextVar}A: Regional Currency Devaluation & Living Costs`, my: `ပုံစံ ${nextVar}(က) - ငွေကြေးဖောင်းပွမှုနှင့် အခြေခံစားဝတ်နေရေး ခက်ခဲမှု` },
            { en: `Strategy ${nextVar}B: Infrastructure Disruption & Academic Drive`, my: `ပုံစံ ${nextVar}(ခ) - လျှပ်စစ်မီးပျက်တောက်မှုနှင့် အခက်အခဲကြားမှ စာကြိုးစားမှု` },
            { en: `Strategy ${nextVar}C: First-Generation Scholar & Community Uplift`, my: `ပုံစံ ${nextVar}(ဂ) - မိသားစုတွင် ပထမဆုံး တက္ကသိုလ်တက်ရောက်သူ၏ မျှော်လင့်ချက်` },
          ];
          fallbackResult = JSON.stringify({
            templates: [
              {
                title: titles[0].en,
                titleMy: titles[0].my,
                promptHint: 'Severe devaluation of local currency and rising cost of living.',
                text: `I am writing to respectfully request an Assessment Fee Scholarship for my ${degree} studies at University of the People. Steep currency devaluation and rapid inflation have severely diminished our family purchasing power. Essential living expenses consume all available funds, making course assessment fees an insurmountable financial hurdle. Despite these challenges, I remain dedicated to academic achievement and disciplined daily study. Earning this degree is my primary pathway toward professional employment and self-reliance. With your scholarship support, I can proceed with my coursework without financial pause. Thank you for your review.`
              },
              {
                title: titles[1].en,
                titleMy: titles[1].my,
                promptHint: 'Coping with daily power blackouts and network disruptions while maintaining study habits.',
                text: `I respectfully apply for an Assessment Fee Scholarship to pursue my ${degree} degree at University of the People. Our region faces ongoing economic disruption, frequent electricity outages, and fragile local job markets. My family's income is completely absorbed by basic necessities, leaving zero discretionary funds for assessment fees. To overcome infrastructural obstacles, I organize my study schedule around power availability and rely on downloaded materials. UoPeople's tuition-free model provides a crucial door to higher education. Scholarship assistance will alleviate severe financial strain and keep my studies on track. Thank you.`
              },
              {
                title: titles[2].en,
                titleMy: titles[2].my,
                promptHint: 'First in family to attend college, seeking degree to build community solutions.',
                text: `I am writing to formally request an Assessment Fee Scholarship to support my degree program in ${degree} at University of the People. As a first-generation university student, pursuing higher education is my ultimate ambition. However, persistent economic hardship makes it impossible for my family to cover course assessment fees independently. I am fully committed to academic rigor and active peer collaboration. Upon graduation, I intend to leverage my knowledge to spearhead digital literacy initiatives in my community. Receiving this scholarship will ensure my financial limitations do not derail my progress. Thank you sincerely.`
              }
            ]
          });
        }
      } else if (action === 'anti_ai_humanize_cot') {
        let raw = (payload.text || '').trim();
        let cleaned = raw
          .replace(/\bdelve into\b/gi, 'examine')
          .replace(/\bdelve\b/gi, 'study')
          .replace(/\bpivotal role\b/gi, 'key part')
          .replace(/\bpivotal\b/gi, 'central')
          .replace(/\ba testament to\b/gi, 'clear evidence of')
          .replace(/\bbeacon of hope\b/gi, 'important opportunity')
          .replace(/\bfurthermore,?\s*/gi, 'Also, ')
          .replace(/\bmoreover,?\s*/gi, 'In addition, ')
          .replace(/\bin conclusion,?\s*/gi, 'Ultimately, ')
          .replace(/\btapestry\b/gi, 'network');
        fallbackResult = cleaned || 'I am writing to respectfully apply for scholarship support to continue my studies at University of the People.';
      } else if (action === 'scholarship_renewal_advisor_email') {
        const advisorName = (payload.advisorName || 'Program Advisor').trim();
        const studentName = (payload.studentName || 'Student Name').trim();
        const studentId = (payload.studentId || 's123456').trim();
        const degree = (payload.degreeProgram || 'Bachelor of Science in Computer Science').trim();
        const cgpa = (payload.cgpa || '3.65').trim();
        const courses = (payload.coursesDone || '8 courses (24 credits)').trim();
        const termPlan = (payload.termPlan || '2 courses for the upcoming Term').trim();
        const customNote = (payload.customNotesPrompt || '').trim();
        const varCount = Number(payload.variation) || 1;

        // Deterministic PRNG seeded by customNote + varCount + timestamp
        const combinedSeed = `${payload.seed || Date.now()}-${varCount}-${customNote}-${degree}-${cgpa}`;
        let hash = 0;
        for (let i = 0; i < combinedSeed.length; i++) {
          hash = (hash << 5) - hash + combinedSeed.charCodeAt(i);
          hash |= 0;
        }
        const seedNum = Math.abs(hash);

        // Simple PRNG
        let prngState = seedNum ^ 0x12345678;
        const nextRand = () => {
          prngState = (prngState * 1664525 + 1013904223) >>> 0;
          return prngState / 4294967296;
        };

        const isBurmese = /[\u1000-\u109F]/.test(customNote);
        const promptLower = customNote.toLowerCase();
        const isUrgent = /(urgent|emergency|critical|closing soon|few days|asap|immediate|deadline|time-sensitive|hurry|expedite|ရက်ပိုင်း|အရေးပေါ်|ပိတ်တော့မည်|အချိန်မီ|ချက်ချင်း|နီးကပ်|အမြန်|နောက်ဆုံးရက်)/i.test(promptLower);
        const isRegistration = /(register|registration|unlock|portal|hold|enrollment|selection|course add|course drop|form|လော့ကျ|ဖွင့်ပေး|ခွင့်ပြုချက်|စာရင်းသွင်း|အပ်နှံ)/i.test(promptLower);
        const isFinancial = /(currency|inflation|economic|income|financial|expense|poverty|fees|hardship|survival|family|breadwinner|job|salary|unemployed|layoff|broke|ကျပ်တည်း|ငွေကြေး|ကုန်ဈေးနှုန်း|စားဝတ်နေရေး|အခက်အခဲ|အလုပ်ပြုတ်|လစာ)/i.test(promptLower);
        const isHealth = /(health|medical|hospital|illness|surgery|sick|treatment|doctor|injury|ကျန်းမာရေး|ဆေးရုံ|ဖျားနာ|ခွဲစိတ်|မိဘ)/i.test(promptLower);
        const isInfrastructure = /(electricity|power|blackout|internet|connection|outage|wifi|generator|conflict|displaced|မီးပျက်|အင်တာနက်|လိုင်းကျ|မငြိမ်မသက်)/i.test(promptLower);

        const urgentSubjects = [
          `URGENT: Request to Unlock Assessment Fee Scholarship Renewal - ${studentName} (${studentId})`,
          `TIME-SENSITIVE: Course Registration & Scholarship Authorization Request - ${studentName} (${studentId})`,
          `URGENT PETITION: Scholarship Renewal Portal Access for Upcoming Term - ${studentName} (${studentId})`,
          `Priority Request: Assessment Fee Scholarship Renewal Hold Release - ${studentName} (${studentId})`,
          `CRITICAL TIMELINE: Immediate Scholarship Form Unlock Request - ${studentName} (${studentId})`,
        ];

        const standardSubjects = [
          `Formal Petition: Assessment Fee Scholarship Renewal for Upcoming Term - ${studentName} (${studentId})`,
          `Scholarship Renewal Application Request: ${degree} - ${studentName} (${studentId})`,
          `Academic Petition: Assessment Fee Scholarship Portal Access - ${studentName} (${studentId})`,
          `Request for Program Advisor Authorization: Scholarship Renewal - ${studentName} (${studentId})`,
          `Inquiry & Formal Request: Assessment Fee Scholarship Renewal - ${studentName} (${studentId})`,
        ];

        const candidateSubjects = (isUrgent || isRegistration) ? urgentSubjects : standardSubjects;
        const chosenSubject = candidateSubjects[Math.floor(nextRand() * candidateSubjects.length)];

        const greetings = [
          `Dear ${advisorName},\n\nI hope this email finds you well and in good health.`,
          `Dear ${advisorName},\n\nI hope you are having a productive and pleasant week.`,
          `Dear ${advisorName},\n\nWarm greetings. I hope you are having a wonderful academic term.`,
          `Dear ${advisorName},\n\nI hope this message finds you in good spirits and health.`,
        ];
        const chosenGreeting = greetings[Math.floor(nextRand() * greetings.length)];

        const intros = [
          `My name is ${studentName} (Student ID: ${studentId}), currently enrolled in the ${degree} program at University of the People. I am writing to respectfully request your assistance regarding the renewal of my Assessment Fee Scholarship for the upcoming academic term.`,
          `I am ${studentName} (Student ID: ${studentId}), pursuing my ${degree} at University of the People. I am reaching out to formally petition for your guidance and administrative authorization to unlock my Assessment Fee Scholarship renewal on the student portal.`,
          `My name is ${studentName} (Student ID: ${studentId}). As a dedicated degree-seeking student in the ${degree} program, I am contacting you to kindly request your authorization to renew my Assessment Fee Scholarship for my forthcoming coursework.`,
          `I am writing to you as an active student in the ${degree} program at University of the People (Student ID: ${studentId}, ${studentName}). I respectfully seek your prompt assistance in releasing the scholarship renewal access on my UoPeople Portal.`,
        ];
        const chosenIntro = intros[Math.floor(nextRand() * intros.length)];

        const academicStandings = [
          `My Academic Standing & Progress:
• Degree Program: ${degree}
• Cumulative GPA: ${cgpa}
• Completed Coursework: ${courses}
• Upcoming Registration Plan: ${termPlan}`,

          `Academic Progress Overview:
- Program of Study: ${degree}
- Current Cumulative GPA: ${cgpa} (demonstrating consistent academic diligence)
- Completed Credits / Coursework: ${courses}
- Planned Enrolment for Next Term: ${termPlan}`,

          `Current Academic Record:
1. Degree: ${degree}
2. Academic Standing: Cumulative GPA of ${cgpa}
3. Progress to Date: ${courses}
4. Proposed Course Load: ${termPlan}`,
        ];
        const chosenStanding = academicStandings[Math.floor(nextRand() * academicStandings.length)];

        let situationNarrative = '';
        if (customNote) {
          if (isUrgent && isRegistration) {
            const urgentRegVariants = [
              `With our term registration deadline fast approaching in just a few days, I am facing a critical time constraint. In order to finalize my course enrollment on schedule and maintain continuous academic progress, I urgently require administrative authorization to access and submit the Assessment Fee Scholarship renewal form on my portal.`,
              `The course registration window for the upcoming term is closing very soon, and without timely scholarship authorization, I risk being locked out of the required courses for my degree plan. Given that I have maintained a strong academic standing (${cgpa} CGPA), I am requesting your urgent intervention to unlock the renewal portal before the deadline passes.`,
              `I am writing under strict time sensitivity because registration for the next academic term will conclude shortly. Releasing the scholarship authorization hold now is vital to ensure that my enrolled courses are preserved and that my graduation timeline remains on course.`,
            ];
            situationNarrative = urgentRegVariants[Math.floor(nextRand() * urgentRegVariants.length)];
          } else if (isHealth) {
            situationNarrative = `Due to unexpected medical emergencies and substantial healthcare expenses in my immediate family, our financial reserves have been entirely exhausted on urgent medical treatment. Under these distressing conditions, covering university assessment fees without scholarship support would be completely impossible. Continuing my studies at UoPeople serves as an indispensable foundation for my family's stability and future recovery.`;
          } else if (isInfrastructure) {
            situationNarrative = `In my region, persistent infrastructure challenges, frequent power blackouts, and unstable local network connectivity severely disrupt daily life and local livelihoods. Despite having to carefully plan my study hours around available power and internet access, I have remained steadfastly committed to academic excellence. Continuing with scholarship support is crucial to ensure that physical and infrastructural obstacles do not halt my educational journey.`;
          } else if (isFinancial) {
            const finVariants = [
              `Due to ongoing severe local currency devaluation, high cost-of-living inflation, and depressed employment opportunities in my area, our household's limited income is entirely consumed by basic necessities. Paying course assessment fees independently represents an insurmountable financial barrier for me at this juncture.`,
              `The economic environment in my home region continues to pose severe financial constraints. Escalating living costs and constrained family purchasing power make independent assessment fee payments unfeasible. The tuition-free model of University of the People paired with assessment fee scholarship support remains my only viable route toward achieving a university degree.`,
            ];
            situationNarrative = finVariants[Math.floor(nextRand() * finVariants.length)];
          } else if (isUrgent) {
            situationNarrative = `I am reaching out regarding an urgent and critical circumstance regarding my Assessment Fee Scholarship. As registration deadlines are fast approaching, any administrative delay in renewing my scholarship will jeopardize my ability to secure enrollment for the upcoming term. To prevent any disruption to my academic momentum or an involuntary leave of absence, I respectfully seek your priority assistance.`;
          } else {
            const customIntroVariants = [
              `Regarding my current circumstances and scholarship renewal need: "${customNote}"\n\nPreserving my academic continuity is vital for my professional development and future self-reliance. Without this scholarship renewal, covering course fees out of pocket would present an acute financial obstacle.`,
              `To provide context regarding my request: ${customNote}.\n\nI remain wholly dedicated to meeting UoPeople's rigorous academic expectations, collaborating with peers, and progressing toward timely graduation in ${degree}.`,
            ];
            situationNarrative = customIntroVariants[Math.floor(nextRand() * customIntroVariants.length)];
          }

          if (isBurmese) {
            situationNarrative += `\n\n(Student Note / တင်ပြချက်: "${customNote}")`;
          } else if (!situationNarrative.includes(customNote) && customNote.length > 5) {
            situationNarrative += `\n\nSpecific Note: ${customNote}`;
          }
        } else {
          const defaultScenarios = [
            `Throughout my coursework at UoPeople, I have maintained high academic discipline as reflected in my cumulative GPA of ${cgpa}. However, severe macroeconomic constraints and escalating living costs in my region continue to place substantial strain on my household finances, rendering independent course assessment fee payments impossible.`,
            `I am deeply committed to completing my ${degree} degree. While I have diligently completed ${courses} and prioritized my studies, persistent financial hardship in my community makes continuing without scholarship renewal unfeasible. Reauthorizing this scholarship will allow me to register for my planned courses without a costly academic delay.`,
            `Having successfully advanced through my academic program with a ${cgpa} CGPA, I am eager to register for ${termPlan}. Due to enduring economic challenges in my home country, scholarship assistance remains an essential lifeline that enables me to pursue higher education.`,
          ];
          situationNarrative = defaultScenarios[Math.floor(nextRand() * defaultScenarios.length)];
        }

        const actionRequests = [
          `Could you please kindly review my academic record and authorize the scholarship renewal form in my UoPeople Portal at your earliest convenience, so I may complete my course registration before the portal closes?`,
          `I would be immensely grateful if you could facilitate the unlocking of my scholarship renewal form, enabling me to confirm my enrollment in ${termPlan} without delay.`,
          `I respectfully ask for your guidance and prompt authorization to release the scholarship hold on my account, ensuring that my academic momentum remains uninterrupted.`,
          `Given the fast-approaching enrollment cutoff, your prompt assistance in enabling my scholarship renewal portal submission would be deeply appreciated.`,
        ];
        const chosenAction = actionRequests[Math.floor(nextRand() * actionRequests.length)];

        const signoffs = [
          `Thank you very much for your time, consideration, and unwavering support of our academic journey.\n\nWarm regards,\n\n${studentName}\nStudent ID: ${studentId}\nDegree Program: ${degree}\nUniversity of the People`,
          `I sincerely appreciate your dedication to supporting UoPeople students worldwide and thank you in advance for your assistance.\n\nRespectfully yours,\n\n${studentName}\nStudent ID: ${studentId}\nProgram: ${degree}\nUniversity of the People`,
          `Thank you for your continuous guidance and invaluable help throughout my studies.\n\nSincerely,\n\n${studentName}\nStudent ID: ${studentId}\nDegree: ${degree}\nUniversity of the People`,
        ];
        const chosenSignoff = signoffs[Math.floor(nextRand() * signoffs.length)];

        fallbackResult = `SUBJECT: ${chosenSubject}\n\n${chosenGreeting}\n\n${chosenIntro}\n\n${chosenStanding}\n\n${situationNarrative}\n\n${chosenAction}\n\n${chosenSignoff}`;
      } else if (action === 'scholarship_intl_evaluator') {
        const essayText = (payload.essayText || '').trim();
        const scholarshipName = (payload.scholarshipName || 'UoPeople Assessment Fee Scholarship & Global Standards').trim();
        const charCount = essayText.length;
        const wordCount = essayText.split(/\s+/).filter(Boolean).length;
        const isSafeLength = charCount <= 1000;
        const lengthDiff = charCount - 1000;

        const hasFinancial = /(currency|inflation|economic|income|financial|expense|poverty|fees|hardship|survival|family|ငွေကြေး|ကုန်ဈေးနှုန်း|စားဝတ်နေရေး|အခက်အခဲ)/i.test(essayText);
        const hasAcademic = /(degree|gpa|courses|study|learn|academic|university|diligence|grades|education|uopeople|ပညာ|စာမေးပွဲ|တက္ကသိုလ်)/i.test(essayText);
        const hasCommunity = /(community|youth|empower|literacy|digital|share|contribute|give back|impact|help|development|အကျိုးပြု|ရပ်ရွာ|လူငယ်)/i.test(essayText);
        const hasAiCliché = /(beacon of hope|pivotal role|in today's world|tapestry|relentless passion|testament to)/i.test(essayText);

        const scoreFinancial = hasFinancial ? 19 : 14;
        const scoreAcademic = hasAcademic ? 18 : 13;
        const scoreCommunity = hasCommunity ? 19 : 14;
        const scoreAuthentic = hasAiCliché ? 14 : 19;
        const scoreFlow = isSafeLength ? 18 : 12;
        const totalScore = scoreFinancial + scoreAcademic + scoreCommunity + scoreAuthentic + scoreFlow;

        const verdict = totalScore >= 90
          ? 'Highly Competitive & Acceptance Ready (ပညာသင်ဆု ရရှိရန် အလွန်နီးစပ်)'
          : totalScore >= 75
          ? 'Competitive with Minor Polish (ပြင်ဆင်ချက်အနည်းငယ်ဖြင့် လက်ခံနိုင်ဖွယ်ရှိ)'
          : 'Needs Comprehensive Revision (အချက်အလက် ထပ်မံဖြည့်စွက်ရန် လိုအပ်)';

        fallbackResult = `### 🏆 Admissions Committee Verdict & Score
- **Overall Score**: ${totalScore} / 100
- **Admissions Committee Rating**: **${verdict}**
- **Target Scholarship**: ${scholarshipName}
- **Portal Character Limit**: ${isSafeLength ? `✅ ${charCount} / 1,000 characters (Portal Safe & Compliant)` : `⚠️ ${charCount} / 1,000 characters (Exceeds Limit by ${lengthDiff} chars - စာလုံးရေ လျှော့ရန် လိုအပ်ပါသည်!)`}
- **Total Word Count**: ${wordCount} words

---

### 📊 Rubric Breakdown (စံနှုန်းအလိုက် အမှတ်ခွဲခြမ်းစိတ်ဖြာချက်)
| စံနှုန်း (Evaluation Metric) | ရမှတ် (Score / 20) | အသေးစိတ် သုံးသပ်ချက် (Detailed Assessment) |
| :--- | :---: | :--- |
| **💰 Financial Need Persuasiveness** | ${scoreFinancial} / 20 | ${hasFinancial ? 'ဒေသတွင်း စီးပွားရေးအခက်အခဲနှင့် အခြေခံစားဝတ်နေရေး အကျပ်အတည်းကို သဘာဝကျစွာ ထင်ဟပ်ဖော်ပြထားပါသည်။' : 'ငွေကြေးဖောင်းပွမှုနှင့် အခက်အခဲကို ပိုမိုတိကျသော သာဓကများဖြင့် ဖြည့်စွက်သင့်ပါသည်။'} |
| **📚 Academic Grit & Merit** | ${scoreAcademic} / 20 | ${hasAcademic ? 'တက္ကသိုလ်ပညာရေးအပေါ် ထားရှိသော စိတ်ဓာတ်နှင့် ဇွဲလုံ့လကို ကောင်းမွန်စွာ တင်ပြထားပါသည်။' : 'ကျောင်းသား၏ ပညာရေးရည်မှန်းချက်နှင့် စာကြိုးစားမှုကို ပိုမိုခိုင်မာစွာ ချဲ့ထွင်ရေးသားနိုင်ပါသည်။'} |
| **🌍 Community Impact Potential** | ${scoreCommunity} / 20 | ${hasCommunity ? 'ဘွဲ့ရရှိပြီးပါက ရပ်ရွာလူထုနှင့် အခြားသူများအား ပြန်လည်အကျိုးပြုမည့် ရည်မှန်းချက် အလွန်အားကောင်းပါသည်။' : 'ဘွဲ့ရရှိပြီးပါက လူမှုအသိုက်အဝန်းထံ မည်သို့ ပြန်လည်မျှဝေမည်ကို ထပ်မံထည့်သွင်းသင့်ပါသည်။'} |
| **✍️ Authentic Voice (Anti-AI)** | ${scoreAuthentic} / 20 | ${!hasAiCliché ? 'AI စကားလုံးအတုအယောင်များ ကင်းစင်ပြီး စစ်မှန်သော ကျောင်းသား၏ ရင်ဖွင့်သံ ပေါ်လွင်ပါသည်။' : 'AI detector များ ဖမ်းမိလေ့ရှိသော cliché စကားလုံးအချို့ကို ဖယ်ရှားပြင်ဆင်ရန် လိုအပ်ပါသည်။'} |
| **📏 Flow & Conciseness** | ${scoreFlow} / 20 | ${isSafeLength ? 'UoPeople ၁,၀၀၀ စာလုံး ကန့်သတ်ချက်အတွင်း အချက်အလက်များ ကျစ်လျစ်သိပ်သည်းစွာ ဖွဲ့စည်းထားပါသည်။' : 'စာလုံးရေ ၁,၀၀၀ ကျော်လွန်နေသဖြင့် Portal စနစ်မှ ပယ်ချခံရနိုင်ပါသည်။ အမြန်ဆုံး လျှော့ချပါ။'} |

---

### 🌟 Key Strengths (အဓိက အားသာချက်များ)
1. **တိကျသော လိုအပ်ချက် တင်ပြနိုင်မှု**: မိသားစု စားဝတ်နေရေးနှင့် နိုင်ငံတကာ ကျောင်းလခ အခက်အခဲကို ကော်မတီ စာနာနားလည်နိုင်အောင် ဖော်ပြထားသည်။
2. **ပညာရေးအပေါ် အလေးထားမှု**: အခက်အခဲများကြားမှ စာမပြတ် တက်ရောက်လိုသည့် စိတ်ဆန္ဒ အထူးခိုင်မာသည်။
3. **ရှင်းလင်းသော အရေးအသား**: စာဖတ်သူ (Admissions Reviewer) အတွက် မျက်စိမရှုပ်ဘဲ တိုက်ရိုက် သဘောပေါက်လွယ်သည်။

---

### ⚠️ Areas for Improvement (ပိုမိုကောင်းမွန်အောင် ပြင်ဆင်ရန် အကြံပြုချက်)
1. **တိကျသော အချက်အလက် ဖြည့်စွက်ခြင်း**: ဖြစ်နိုင်ပါက မိမိနေထိုင်ရာ ဒေသ၏ ကုန်ဈေးနှုန်း သို့မဟုတ် ငွေကြေးဖောင်းပွမှု အခြေအနေကို အနည်းငယ် ထပ်မံ အသေးစိတ်ပြပါ။
2. **စာလုံးရေ စစ်ဆေးခြင်း**: အကယ်၍ စာလုံးရေ ၁,၀၀၀ နီးပါး ရောက်နေပါက စာလုံးပေါင်းနှင့် space များကို Portal ထဲ မထည့်မီ သေချာ ပြန်လည်စစ်ဆေးပါ။

---

### 💡 Polished Sentence-by-Sentence Suggestions (စကားလုံး အကြံပြုချက်)
* **မူလ ဝါကျ**: *"In my home country, steep currency devaluation and rapid inflation have severely diminished our family purchasing power."*
* **ပိုမိုထိရောက်သော ဝါကျ**: *"Severe economic inflation and rapid currency devaluation in my region have heavily depleted my household's purchasing power, rendering independent assessment fee payments impossible."*`;
      } else {
        const queryText = String(payload.rubricText || payload.content || payload.draftText || payload.concern || payload.inputContent || 'Academic Task');
        fallbackResult = `### 📋 Academic Guidance & Structure\n\n**Key Focus Analysis:**\nBased on your submission ("${queryText.substring(0, 120)}..."), here is the structured academic guidance:\n\n1. **Core Conceptual Thesis**: Align the main premise with scholarly evidence and course rubrics.\n2. **Logical Flow & Transitions**: Ensure each paragraph advances one distinct argument with clear transitions.\n3. **Practical Next Step**: Refine your citations and review word count constraints before final portal submission.`;
      }

      res.json({
        success: true,
        result: fallbackResult,
        modelUsed: 'local-dynamic-procedural',
      });
      return;
    }

    let finalResult = response.text;
    if (action === 'generate_study_cards' || action === 'direct_flashcards') {
      const codeBlockMatch = response.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        finalResult = codeBlockMatch[1].trim();
      } else {
        const firstBracket = response.text.indexOf('[');
        const lastBracket = response.text.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          finalResult = response.text.substring(firstBracket, lastBracket + 1);
        }
      }
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || null;

    res.json({
      success: true,
      result: finalResult,
      modelUsed: successfulModel,
      ...(groundingChunks ? { groundingChunks } : {}),
    });
  } catch (error: any) {
    console.error('Gemini Academic Error:', error);
    let cleanMessage = 'An unexpected error occurred while communicating with Gemini API. Please try again.';
    if (error?.message) {
      try {
        const jsonMatch = error.message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          cleanMessage = parsed.error?.message || parsed.message || cleanMessage;
        } else {
          cleanMessage = error.message;
        }
      } catch {
        cleanMessage = error.message;
      }
    }
    cleanMessage = cleanMessage.replace(/^ApiError:\s*/i, '').trim();
    res.status(500).json({
      error: cleanMessage,
    });
  }
});

// Proxy/DOI metadata resolver for Crossref (Open Access Academic Metadata)
app.get('/api/doi-metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const doiQuery = (req.query.doi as string || '').trim();
    if (!doiQuery) {
      res.status(400).json({ error: 'DOI is required' });
      return;
    }

    // Clean DOI format (remove https://doi.org/ prefix if present)
    const cleanDoi = doiQuery.replace(/^https?:\/\/doi\.org\//i, '').trim();

    const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
    const response = await fetch(crossrefUrl, {
      headers: {
        'User-Agent': 'StudentAcademicSuite/1.0 (mailto:academic@studentprivacy.org)',
      },
    });

    if (!response.ok) {
      res.status(404).json({ error: `DOI not found on Crossref (${response.status})` });
      return;
    }

    const data = await response.json();
    const item = data.message;

    // Parse authors
    const authors = (item.author || []).map((a: any) => {
      const family = a.family || '';
      const given = a.given ? `${a.given[0]}.` : '';
      return `${family}${given ? `, ${given}` : ''}`;
    }).join(', ');

    // Extract year
    const dateParts = item.published?.['date-parts']?.[0] || item['published-print']?.['date-parts']?.[0] || item.created?.['date-parts']?.[0];
    const year = dateParts ? dateParts[0] : 'n.d.';

    const title = Array.isArray(item.title) ? item.title[0] : (item.title || '');
    const containerTitle = Array.isArray(item['container-title']) ? item['container-title'][0] : (item['container-title'] || '');
    const volume = item.volume || '';
    const issue = item.issue || '';
    const page = item.page || '';
    const doi = item.DOI ? `https://doi.org/${item.DOI}` : `https://doi.org/${cleanDoi}`;

    // APA 7th formatted reference
    // Author, A. A., & Author, B. B. (Year). Title of article. Title of Periodical, volume(issue), pages. https://doi.org/xx
    let apaReference = '';
    if (authors) apaReference += `${authors} `;
    apaReference += `(${year}). `;
    if (title) apaReference += `${title}. `;
    if (containerTitle) apaReference += `${containerTitle}`;
    if (volume) apaReference += `, ${volume}`;
    if (issue) apaReference += `(${issue})`;
    if (page) apaReference += `, ${page}`;
    apaReference += `. ${doi}`;

    res.json({
      success: true,
      metadata: {
        title,
        authors,
        year,
        journal: containerTitle,
        volume,
        issue,
        pages: page,
        doi,
        apaReference,
      },
    });
  } catch (err: any) {
    console.error('DOI fetch error:', err);
    res.status(500).json({ error: 'Failed to resolve DOI metadata' });
  }
});

// Clean Proxy for Open Access Course Textbooks and Syllabi (CORS-Free PDF Stream)
app.get('/api/pdf-proxy', async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUrl = (req.query.url as string || '').trim();
    if (!targetUrl || !/^https?:\/\/.+/i.test(targetUrl)) {
      res.status(400).json({ error: 'Valid HTTP/HTTPS URL is required' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const pdfResponse = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
      },
    });
    clearTimeout(timeout);

    if (!pdfResponse.ok) {
      res.status(pdfResponse.status).json({
        error: `Failed to fetch remote document from host (HTTP ${pdfResponse.status}: ${pdfResponse.statusText})`,
      });
      return;
    }

    const contentType = pdfResponse.headers.get('content-type') || 'application/pdf';
    const arrayBuffer = await pdfResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType.includes('pdf') ? 'application/pdf' : contentType);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  } catch (err: any) {
    console.error('PDF proxy error:', err);
    res.status(500).json({
      error: `Unable to access textbook URL: ${err.message || 'Network timeout or blocked request'}`,
    });
  }
});

// Multi-Language YouTube Music Search & Direct Link Resolver
app.post('/api/youtube/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'Search query or URL is required' });
      return;
    }

    const trimmed = query.trim();

    // 1. Direct YouTube URL (watch?v=, youtu.be/, shorts/, embed/)
    const urlMatch = trimmed.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
    );
    if (urlMatch && urlMatch[1]) {
      const vid = urlMatch[1];
      res.json({
        videoId: vid,
        title: `YouTube Video (${vid})`,
        results: [{ videoId: vid, title: `Direct Video (${vid})` }],
      });
      return;
    }

    // 2. Direct 11-char video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      res.json({
        videoId: trimmed,
        title: `Video (${trimmed})`,
        results: [{ videoId: trimmed, title: `Direct ID (${trimmed})` }],
      });
      return;
    }

    // 3. Multi-language YouTube search query (Burmese, English, Japanese, etc.)
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,my;q=0.8',
      },
    });

    const html = await ytRes.text();
    const videoRegex =
      /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}/g;
    const results: { videoId: string; title: string }[] = [];
    const seenIds = new Set<string>();
    let match;

    // Helper: Strict filter for AI-generated songs (Suno, Udio, AI Cover, etc.)
    const isAiSong = (name: string): boolean => {
      if (!name) return false;
      const aiPattern =
        /\b(ai\s*cover|ai\s*song|ai\s*music|ai\s*version|ai\s*vocal|ai\s*remix|ai\s*track|ai\s*voice|suno|udio|diffsinger|so-vits|rvc|voice\s*model|artificial\s*intelligence|generated\s*by\s*ai|ai\s*generated|ai\s*band)\b|(\(ai\))|(\[ai\])|(ai\s*သီချင်း)|(ai\s*ကာဗာ)/i;
      return aiPattern.test(name);
    };

    while ((match = videoRegex.exec(html)) !== null) {
      const vid = match[1];
      let rawTitle = match[2];
      if (!seenIds.has(vid)) {
        seenIds.add(vid);
        try {
          rawTitle = JSON.parse(`"${rawTitle}"`);
        } catch {
          // ignore parsing error
        }

        // STRICT FILTER: Skip any AI-generated songs or AI covers
        if (!isAiSong(rawTitle)) {
          results.push({ videoId: vid, title: rawTitle });
          if (results.length >= 8) break;
        }
      }
    }

    // Fallback if videoRenderer regex captured nothing
    if (results.length === 0) {
      const idMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
      const uniqueIds = [...new Set(idMatches.map((m) => m[1]))];
      for (const vid of uniqueIds.slice(0, 4)) {
        if (!isAiSong(trimmed)) {
          results.push({ videoId: vid, title: `${trimmed}` });
        }
      }
    }

    if (results.length > 0) {
      res.json({
        videoId: results[0].videoId,
        title: results[0].title,
        results,
      });
    } else {
      // Reliable fallback default to verified human instrumental study beats
      res.json({
        videoId: 'U4t25OiyJys',
        title: 'Myanmar Instrumental',
        results: [
          { videoId: 'U4t25OiyJys', title: 'Myanmar Instrumental' },
          { videoId: 'YjohMzHkBqI', title: 'Studio Ghibli Relaxing Piano' },
          { videoId: '4xDzrJKXOOY', title: 'Deep Focus Study Piano' },
          { videoId: 'fEvM-OUbaKs', title: 'Coffee Shop Chill Bossa Nova' },
          { videoId: '4Tr0otuiQuU', title: 'Peaceful Classical Study Piano' },
        ],
      });
    }
  } catch (err: any) {
    console.error('YouTube search error:', err);
    res.status(500).json({
      error: `Failed to search YouTube music: ${err.message || 'Network error'}`,
    });
  }
});

// Setup Vite development server or serve static build
async function setupServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket, req: any) => {
    let clientKey = '';
    try {
      const url = new URL(req?.url || '', 'http://localhost');
      clientKey = url.searchParams.get('key') || '';
    } catch {}
    const headerKey =
      (req?.headers?.['x-gemini-key'] as string | undefined) ||
      (req?.headers?.['x-goog-api-key'] as string | undefined);
    const candidateKey = clientKey || headerKey;
    const apiKey =
      candidateKey && candidateKey.length >= 10 ? candidateKey.trim() : getServerEnvKey();

    if (!apiKey) {
      clientWs.send(JSON.stringify({ error: 'Gemini API key is not configured.' }));
      clientWs.close();
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: ACADEMIC_SYSTEM_PROMPT,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          },
          onerror: (err: any) => {
            clientWs.send(JSON.stringify({ error: err?.message || 'Live session error' }));
          },
        },
      });

      clientWs.on('message', (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (parsed.text) {
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: parsed.text }] }],
              turnComplete: true,
            });
          }
        } catch (e: any) {
          console.warn('Live WebSocket parse error:', e);
        }
      });

      clientWs.on('close', () => {
        try {
          session.close();
        } catch {}
      });
    } catch (err: any) {
      console.error('Failed to establish Gemini Live connection:', err);
      clientWs.send(JSON.stringify({ error: err.message || 'Live connect failed' }));
      clientWs.close();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Students Support server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
