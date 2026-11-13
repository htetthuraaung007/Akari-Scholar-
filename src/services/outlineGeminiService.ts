export interface RubricCriterion {
  criterionTitle: string;
  weightOrPoints: string;
  howToGetGradeA: string;
}

export interface OutlineSection {
  sectionTitle: string;
  recommendedWordCount: string;
  keyPointsToCover: string[];
  rubricFocus: string;
}

export interface MultiImageOutlineResult {
  assignmentType: string;
  estimatedTargetWords: string;
  coreResearchQuestion: string;
  rubricChecklist: RubricCriterion[];
  structuredOutline: OutlineSection[];
  insiderAdviceForMaxGrade: string;
}

import { CASCADE_MODEL_PRIORITY as VISION_MODELS } from './geminiService';

export function sanitizeJsonOutput(raw: string): string {
  if (!raw) return '{}';
  return raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

export async function runMultiImageOutlineAnalysis(
  textPayload: string,
  images: { base64: string; mimeType: string }[],
  apiKey?: string
): Promise<MultiImageOutlineResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey.trim().length >= 15) {
    headers['x-gemini-key'] = apiKey.trim();
  }

  const response = await fetch('/api/academic/assist', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'outline_analysis',
      payload: {
        textPayload,
        images
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Outline ခွဲခြမ်းစိတ်ဖြာခြင်း မအောင်မြင်ပါ (HTTP ${response.status})`);
  }

  const data = await response.json();
  const rawResult = data.result || data;

  let parsed: any = rawResult;
  if (typeof rawResult === 'string') {
    const cleaned = sanitizeJsonOutput(rawResult);
    parsed = JSON.parse(cleaned);
  }

  return normalizeMultiImageResult(parsed);
}

function normalizeMultiImageResult(parsed: any): MultiImageOutlineResult {
  return {
    assignmentType: parsed.assignmentType || 'Academic Assignment',
    estimatedTargetWords: parsed.estimatedTargetWords || 'N/A',
    coreResearchQuestion: parsed.coreResearchQuestion || 'Address the fundamental inquiry defined in the rubric.',
    rubricChecklist: Array.isArray(parsed.rubricChecklist) ? parsed.rubricChecklist : [],
    structuredOutline: Array.isArray(parsed.structuredOutline) ? parsed.structuredOutline : [],
    insiderAdviceForMaxGrade: parsed.insiderAdviceForMaxGrade || 'Ensure thorough alignment with all sequential rubric criteria.'
  };
}
