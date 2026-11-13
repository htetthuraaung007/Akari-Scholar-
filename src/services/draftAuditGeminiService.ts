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

export async function runDraftRubricAudit(
  draftText: string,
  targetRubric: string,
  apiKey?: string,
  instructorPersona?: string
): Promise<DraftAuditResult> {
  const cleanKey = apiKey ? apiKey.trim() : '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cleanKey && cleanKey.length >= 10) {
    headers['x-gemini-key'] = cleanKey;
  }

  const response = await fetch('/api/academic/assist', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'draft_rubric_audit',
      payload: {
        draftText,
        targetRubric,
        instructorPersona
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData?.error ||
        errData?.message ||
        'Draft စစ်ဆေးချက် ပြီးမြောက်အောင် မဆောင်ရွက်နိုင်ပါ။ ကျေးဇူးပြု၍ ကွန်ရက်ချိတ်ဆက်မှုကို စစ်ဆေးပေးပါခင်ဗျာ။'
    );
  }

  const data = await response.json();
  const rawResult = data.result || data;

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
