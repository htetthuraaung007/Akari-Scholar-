import { IngestedPaper } from './academicResolver';
import { executeGeminiRequest } from './geminiService';
import { safeExtractJsonObject } from '../utils/jsonSanitizer';

export interface MatrixRowItem {
  authorYear: string;
  researchDesign: string;
  researchQuestion: string;
  methodology: string;
  sampleDataset: string;
  keyFindings: string;
  limitations: string;
  directReplicabilityFit: string;
  identifiedGap: string;
}

export interface ThematicAnalysisItem {
  commonThreads: string[];
  conflictingFindings: string[];
  synthesisSummary: string;
}

export interface CompleteSynthesisResult {
  matrixRows: MatrixRowItem[];
  thematicAnalysis: ThematicAnalysisItem;
}

export async function generateStructuredSynthesis(
  papers: IngestedPaper[],
  _apiKey?: string
): Promise<CompleteSynthesisResult> {
  if (!Array.isArray(papers) || papers.length < 2) {
    throw new Error('ကျေးဇူးပြု၍ အနည်းဆုံး သုတေသနစာတမ်း (၂) စောင် ထည့်သွင်းပေးပါ။');
  }

  const condensedPapers = papers.slice(0, 6).map((p, idx) => ({
    index: idx + 1,
    title: p.title || `Paper ${idx + 1}`,
    authors: p.authors || 'Unknown Authors',
    year: p.year || 'n.d.',
    doi: p.doiOrUrl || '',
    excerpt: (p.abstract || '').slice(0, 4200),
  }));

  const systemInstruction = `You are a Principal Academic Research Synthesist and Peer-Reviewed Literature Reviewer.
Your task is to extract genuine, paper-specific data from EVERY provided scholarly source and build a rigorous Literature Synthesis Matrix and Thematic Analysis.

CRITICAL REQUIREMENTS:
1. NEVER emit generic placeholder sentences or omit papers. Every ingested paper (${condensedPapers.length} papers) MUST have its own row in "matrixRows".
2. For each paper in "matrixRows":
   - "authorYear": Exact short citation (e.g., "Roediger & Karpicke (2023)" or "Smith et al. (2024)").
   - "researchDesign": Specific study design & sample (e.g., "Qualitative Thematic Analysis, N=28" or "Randomized Controlled Cohort Study, N=680").
   - "keyFindings": 2-3 concrete empirical findings strictly grounded in that paper's text (include exact numbers, effect sizes, p-values, or core themes where present, plus a brief Burmese clarification in parentheses).
   - "limitations": Specific methodological constraints or bias risks identified in that paper.
   - "directReplicabilityFit": Actionable explanation of how this study's findings/methods fit or can be replicated in a university research assignment.
3. For "thematicAnalysis":
   - "commonThreads": 3-4 substantive, multi-sentence bullets citing specific authors/papers that demonstrate genuine consensus across the sources.
   - "conflictingFindings": 2-3 substantive bullets comparing methodological divergences, population gaps, or contrasting conclusions across the ingested papers.
   - "synthesisSummary": A cohesive, publication-ready 200-250 word Scholarly Synthesis Paragraph integrating the ingested studies by Author & Year (no generic one-sentence summaries!).

Return ONLY a valid JSON object (no markdown fences) matching this exact schema:
{
  "matrixRows": [
    {
      "authorYear": "Author(s) (Year)",
      "researchDesign": "Specific study design & N",
      "researchQuestion": "Core research objective",
      "methodology": "Analytical method & design",
      "sampleDataset": "Sample size / dataset context",
      "keyFindings": "2-3 concrete empirical findings from the text...",
      "limitations": "Specific methodological constraints...",
      "directReplicabilityFit": "Actionable relevance / fit to the student's topic...",
      "identifiedGap": "Unresolved research gap"
    }
  ],
  "thematicAnalysis": {
    "commonThreads": ["Substantive bullet 1...", "Substantive bullet 2...", "Substantive bullet 3..."],
    "conflictingFindings": ["Substantive divergence 1...", "Substantive divergence 2..."],
    "synthesisSummary": "Cohesive 200-250 word Scholarly Synthesis Paragraph citing the ingested papers..."
  }
}`;

  const rawText = await executeGeminiRequest(
    `Analyze and synthesize ALL ${condensedPapers.length} research papers below. Extract concrete paper-specific designs, 2-3 empirical findings per paper, limitations, replicability fit, multi-bullet thematic consensus/divergence, and a 200-250 word Scholarly Synthesis Paragraph:\n\n${JSON.stringify(condensedPapers, null, 2)}`,
    'heavy',
    systemInstruction,
    undefined,
    3800,
    undefined,
    false,
    'application/json'
  );

  const parsed = safeExtractJsonObject<any>(rawText);

  if (!parsed || (!Array.isArray(parsed.matrixRows) && !parsed.thematicAnalysis)) {
    throw new Error('AI မှ Synthesis Matrix ရလဒ်ကို ပြည့်စုံစွာ မထုတ်ပေးနိုင်ပါ။ ထပ်မံကြိုးစားကြည့်ပါ။');
  }

  const rawRows = Array.isArray(parsed.matrixRows) ? parsed.matrixRows : [];
  const matrixRows: MatrixRowItem[] = (rawRows.length > 0 ? rawRows : condensedPapers).map(
    (row: any, idx: number) => {
      const fallbackPaper = condensedPapers[idx];
      const fallbackAuthorYear = fallbackPaper
        ? `${fallbackPaper.authors} (${fallbackPaper.year})`
        : `Study ${idx + 1}`;
      const design = String(
        row?.researchDesign ||
          [row?.methodology, row?.sampleDataset].filter(Boolean).join(', ') ||
          (fallbackPaper?.excerpt ? fallbackPaper.excerpt.slice(0, 140) : 'Empirical Research Study')
      ).trim();
      const fit = String(
        row?.directReplicabilityFit ||
          row?.identifiedGap ||
          `Applicable as empirical evidence supporting ${fallbackPaper?.title || 'the target research inquiry'}.`
      ).trim();

      return {
        authorYear: String(row?.authorYear || fallbackAuthorYear).trim(),
        researchDesign: design,
        researchQuestion: String(row?.researchQuestion || fallbackPaper?.title || '').trim(),
        methodology: String(row?.methodology || design).trim(),
        sampleDataset: String(row?.sampleDataset || '').trim(),
        keyFindings: String(
          row?.keyFindings || fallbackPaper?.excerpt?.slice(0, 260) || ''
        ).trim(),
        limitations: String(row?.limitations || '').trim(),
        directReplicabilityFit: fit,
        identifiedGap: String(row?.identifiedGap || fit).trim(),
      };
    }
  );

  const thematic = parsed.thematicAnalysis || {};
  const commonThreads: string[] = Array.isArray(thematic.commonThreads)
    ? thematic.commonThreads.map((s: any) => String(s || '').trim()).filter(Boolean)
    : [];
  const conflictingFindings: string[] = Array.isArray(thematic.conflictingFindings)
    ? thematic.conflictingFindings.map((s: any) => String(s || '').trim()).filter(Boolean)
    : [];

  let synthesisSummary = String(thematic.synthesisSummary || '').trim();
  if (!synthesisSummary && matrixRows.length > 0) {
    synthesisSummary = matrixRows
      .map(
        (r) =>
          `${r.authorYear} employed ${r.researchDesign} and found that ${r.keyFindings} (noting ${r.limitations}).`
      )
      .join(' ');
  }

  return {
    matrixRows,
    thematicAnalysis: {
      commonThreads:
        commonThreads.length > 0
          ? commonThreads
          : matrixRows.map((r) => `${r.authorYear}: ${r.keyFindings}`),
      conflictingFindings:
        conflictingFindings.length > 0
          ? conflictingFindings
          : matrixRows.map((r) => `${r.authorYear} limitation/contrast: ${r.limitations}`),
      synthesisSummary,
    },
  };
}

