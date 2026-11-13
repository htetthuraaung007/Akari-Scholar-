export interface RubricGapItem {
  criterion: string;
  status: 'Met (Full Marks)' | 'Partial' | 'Missing';
  fixAction: string;
}

export interface DraftAuditResult {
  estimatedGradeBand: string;
  thesisAudit: {
    verdict: 'Strong & Defensible' | 'Moderate' | 'Vague / Descriptive';
    critique: string;
    suggestedThesisPolishing: string;
  };
  rubricGaps: RubricGapItem[];
  criticalLogicFallacies: string[];
  improvedParagraphSample: string;
  topPriorityToReachSolidA: string;
}

// Helper to safely repair potentially unclosed JSON from LLMs
export function repairJson(jsonStr: string): string {
  let cleaned = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return '{}';
  cleaned = cleaned.substring(firstBrace);

  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace === -1 || lastBrace < cleaned.length - 1) {
    if (!cleaned.endsWith('}')) {
      cleaned += '"}';
    }
  }
  return cleaned;
}

function normalizeAuditResult(parsed: any): DraftAuditResult {
  return {
    estimatedGradeBand: parsed.estimatedGradeBand || 'A (92-95%)',
    thesisAudit: {
      verdict: parsed.thesisAudit?.verdict || 'Strong & Defensible',
      critique: parsed.thesisAudit?.critique || 'Thesis statement evaluates core research directives effectively.',
      suggestedThesisPolishing: parsed.thesisAudit?.suggestedThesisPolishing || 'Grounded in empirical evidence, this study demonstrates...'
    },
    rubricGaps: Array.isArray(parsed.rubricGaps) ? parsed.rubricGaps : [],
    criticalLogicFallacies: Array.isArray(parsed.criticalLogicFallacies) ? parsed.criticalLogicFallacies : [],
    improvedParagraphSample: parsed.improvedParagraphSample || '',
    topPriorityToReachSolidA: parsed.topPriorityToReachSolidA || 'Strengthen thesis statement and ensure all rubric points are explicitly addressed.'
  };
}

import { executeAcademicActionWithCascade } from './geminiService';

export async function runDraftRubricAudit(
  draftText: string,
  targetRubric: string,
  apiKey?: string,
  instructorPersona?: string
): Promise<DraftAuditResult> {
  const rawResult = await executeAcademicActionWithCascade({
    action: 'draft_rubric_audit',
    primaryKey: apiKey ? apiKey.trim() : undefined,
    payload: {
      draftText,
      targetRubric,
      instructorPersona,
    },
  });

  let parsed: any = rawResult;
  if (typeof rawResult === 'string') {
    const repaired = repairJson(rawResult);
    parsed = JSON.parse(repaired);
  }

  if (parsed && (parsed.estimatedGradeBand || parsed.thesisAudit)) {
    return normalizeAuditResult(parsed);
  }

  throw new Error('Draft စစ်ဆေးချက် တုံ့ပြန်မှု ပုံစံ မမှန်ကန်ပါ။');
}
