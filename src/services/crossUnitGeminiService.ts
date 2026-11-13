export interface SynthesisPillarCard {
  pillarType: 'Theory' | 'Methodology' | 'Empirical Evidence' | 'Policy & Ethics';
  title: string;
  sourceUnit: string;
  coreConcept: string;
  applicationToCurrentWork: string;
  criticalNuance: string;
}

export interface CrossUnitSynthesisResult {
  currentAssignmentSummary: string;
  integratedPillars: { label: string; unit: string; category: string }[];
  pillarCards: SynthesisPillarCard[];
  readyToSubmitParagraph: string;
  rubricAlignmentTip: string;
}

import { executeGeminiRequest } from './geminiService';
import { safeExtractJsonObject } from '../utils/jsonSanitizer';

export function sanitizeText(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/\(([a-zA-Z\s]+)\s*\(\1\)\)/gi, '($1)')
    .replace(/\b(\w+)\s+\1\b/gi, '$1')
    .trim();
  if (cleaned === '{}' || cleaned === '[]' || cleaned === 'null' || cleaned === 'undefined') {
    return '';
  }
  return cleaned;
}

export function sanitizeJsonOutput(raw: string): string {
  if (!raw) return '{}';
  return raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/\(([a-zA-Z\s]+)\s*\(\1\)\)/gi, '($1)')
    .replace(/\b(\w+)\s+\1\b/gi, '$1')
    .trim();
}

// Smart document compressor: preserves Executive/Intro head and core conclusions tail
export function preparePromptExcerpt(text: string, maxChars: number = 4500): string {
  if (!text || text.length <= maxChars) return text || '';
  const half = Math.floor(maxChars / 2);
  const head = text.substring(0, half);
  const tail = text.substring(text.length - half);
  return `${head}\n\n[... middle sections condensed ...]\n\n${tail}`;
}

export async function runCrossUnitSynthesis(
  currentUnitTitle: string,
  currentUnitNotes: string,
  pastUnitsTitle: string,
  pastUnitsNotes: string,
  _apiKey?: string
): Promise<CrossUnitSynthesisResult> {
  const currentTitleClean = currentUnitTitle.trim() || 'Current Coursework Activity';
  const pastTitleClean = pastUnitsTitle.trim() || 'Previous Academic Units';

  const preparedCurrentNotes = preparePromptExcerpt(currentUnitNotes, 4500);
  const preparedPastNotes = preparePromptExcerpt(pastUnitsNotes, 4500);

  const systemInstruction = `You are a Principal Curriculum Architect and University Professor.
Synthesize the student's Past Course Units (${pastTitleClean}) with their Current Assignment (${currentTitleClean}) to build a high-scoring Conceptual Bridge and publication-grade academic prose.

CRITICAL REQUIREMENTS:
1. Build 3-4 concrete Conceptual Bridge entries in "pillarCards" linking specific theories, methods, or evidence from Past Course Units directly to the problem/topic in the Current Assignment.
2. In "readyToSubmitParagraph", you MUST write 200-250 words (2 cohesive, well-structured scholarly paragraphs) in rigorous academic English that explicitly connect the current assignment's core problem to the theoretical frameworks and empirical insights from the past units. NEVER leave "readyToSubmitParagraph" empty or output "{}".
3. Return ONLY a valid JSON object (no markdown fences) matching this exact schema:
{
  "currentAssignmentSummary": "Concise 2-sentence bilingual (English + Burmese) executive summary of how past units elevate the current assignment.",
  "integratedPillars": [
    { "label": "Name of Past Theory/Method", "unit": "e.g., Unit 1 / Unit 2", "category": "Theory | Methodology | Empirical Evidence | Policy & Ethics" }
  ],
  "pillarCards": [
    {
      "pillarType": "Theory",
      "title": "Specific Theory, Framework, or Method Name",
      "sourceUnit": "e.g., Unit 1: Foundational Paradigms",
      "coreConcept": "Clear explanation of the past unit concept (English + natural Burmese).",
      "applicationToCurrentWork": "Conceptual Bridge: How to explicitly connect this past concept to the current assignment topic.",
      "criticalNuance": "Higher-order critical limitation or scholarly nuance that earns top rubric points."
    }
  ],
  "readyToSubmitParagraph": "200-250 words of fully developed, cohesive academic prose (2 paragraphs separated by \\n\\n) directly connecting the current assignment problem to past unit theories and frameworks.",
  "rubricAlignmentTip": "Actionable Burmese + English grading tip explaining why this cross-unit synthesis satisfies 'Outstanding / Critical Integration' rubric criteria."
}`;

  const prompt = `CURRENT ASSIGNMENT TOPIC: ${currentTitleClean}
CURRENT ASSIGNMENT PROMPT / NOTES:
"""
${preparedCurrentNotes}
"""

PAST UNITS ARCHIVE (${pastTitleClean}):
"""
${preparedPastNotes}
"""

Generate the complete Cross-Unit Synthesis JSON with 3-4 Conceptual Bridge pillars and a full 200-250 word "readyToSubmitParagraph" (Concrete Theoretical Application).`;

  const rawResult = await executeGeminiRequest(
    prompt,
    'standard',
    systemInstruction,
    undefined,
    3600,
    undefined,
    false,
    'application/json'
  );

  let parsed: any = safeExtractJsonObject<any>(rawResult);

  // If the model returned markdown/prose instead of JSON, recover the prose cleanly rather than returning "{}"
  if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
    const cleanProse = sanitizeText(typeof rawResult === 'string' ? rawResult : '');
    if (cleanProse && !cleanProse.startsWith('{')) {
      return {
        currentAssignmentSummary: `Cross-unit synthesis connecting ${pastTitleClean} to ${currentTitleClean}.`,
        integratedPillars: [
          { label: pastTitleClean, unit: 'Past Units', category: 'Theory' },
        ],
        pillarCards: [
          {
            pillarType: 'Theory',
            title: pastTitleClean,
            sourceUnit: 'Past Coursework',
            coreConcept: 'Core frameworks and analytical insights drawn from prior units.',
            applicationToCurrentWork: `Directly informs the analytical structure and problem framing of ${currentTitleClean}.`,
            criticalNuance: 'Requires explicit boundary evaluation when applied to new empirical contexts.',
          },
        ],
        readyToSubmitParagraph: cleanProse,
        rubricAlignmentTip:
          'Synthesizing past unit pillars fulfills advanced critical integration criteria for a top grade.',
      };
    }
    throw new Error('Cross-Unit Synthesis ထုတ်ယူရာတွင် ရလဒ် မပြည့်စုံပါ။ ထပ်မံကြိုးစားကြည့်ပါ။');
  }

  return normalizeSynthesisResult(parsed, currentTitleClean, pastTitleClean);
}

function normalizeSynthesisResult(
  parsed: any,
  defaultTopic: string,
  pastTopic: string
): CrossUnitSynthesisResult {
  const currentAssignmentSummary =
    sanitizeText(parsed.currentAssignmentSummary || '') ||
    `Cross-unit synthesis connecting ${pastTopic} to ${defaultTopic}.`;

  const integratedPillars = Array.isArray(parsed.integratedPillars)
    ? parsed.integratedPillars
    : Array.isArray(parsed.connectedTheoriesBadges)
    ? parsed.connectedTheoriesBadges.map((b: any) => ({
        label: b.label || 'Theoretical Foundation',
        unit: b.unit || 'Past Unit',
        category: 'Theory',
      }))
    : [];

  const pillarCards: SynthesisPillarCard[] = Array.isArray(parsed.pillarCards)
    ? parsed.pillarCards.map((c: any) => ({
        pillarType: c.pillarType || 'Theory',
        title: sanitizeText(c.title || '') || 'Core Concept',
        sourceUnit: sanitizeText(c.sourceUnit || '') || 'Past Unit',
        coreConcept: sanitizeText(c.coreConcept || c.definition || ''),
        applicationToCurrentWork: sanitizeText(
          c.applicationToCurrentWork || c.applicationToCurrentUnit || ''
        ),
        criticalNuance: sanitizeText(
          c.criticalNuance || c.criticalNuanceOrLimitation || ''
        ),
      }))
    : Array.isArray(parsed.theoryCards)
    ? parsed.theoryCards.map((tc: any) => ({
        pillarType: 'Theory',
        title: sanitizeText(tc.theoryName || tc.title || '') || 'Theoretical Framework',
        sourceUnit: sanitizeText(tc.sourceUnit || '') || 'Past Unit',
        coreConcept: sanitizeText(tc.definition || tc.coreConcept || ''),
        applicationToCurrentWork: sanitizeText(
          tc.applicationToCurrentUnit || tc.applicationToCurrentWork || ''
        ),
        criticalNuance: sanitizeText(
          tc.criticalNuanceOrLimitation || tc.criticalNuance || ''
        ),
      }))
    : [];

  let readyToSubmitParagraph = sanitizeText(
    parsed.readyToSubmitParagraph ||
      parsed.concreteTheoreticalApplication ||
      parsed.synthesisParagraph ||
      ''
  );

  // Guarantee developed scholarly prose if the model returned cards without populating readyToSubmitParagraph
  if (!readyToSubmitParagraph && pillarCards.length > 0) {
    const bridgeSentences = pillarCards
      .map(
        (card) =>
          `Drawing on ${card.title} (${card.sourceUnit}), ${card.coreConcept} Applied to ${defaultTopic}, ${card.applicationToCurrentWork} Nevertheless, scholarly rigor requires acknowledging that ${card.criticalNuance}`
      )
      .join(' ');
    readyToSubmitParagraph = `Evaluating ${defaultTopic} requires situating its core problem within the foundational principles established across ${pastTopic}. ${bridgeSentences}`;
  }

  const rubricAlignmentTip =
    sanitizeText(parsed.rubricAlignmentTip || '') ||
    'Synthesizing past unit pillars fulfills advanced critical integration criteria for a top grade.';

  return {
    currentAssignmentSummary,
    integratedPillars,
    pillarCards,
    readyToSubmitParagraph,
    rubricAlignmentTip,
  };
}
