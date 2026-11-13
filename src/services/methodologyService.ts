import { executeGeminiRequest } from './geminiService';
import { safeExtractJsonObject } from '../utils/jsonSanitizer';

export interface ExtractedMetric {
  metricName: string;
  value: string;
  confidenceInterval?: string;
  effectSize?: string;
  interpretation: string;
  burmeseExplanation?: string;
  isSignificant: boolean;
}

export interface MethodologyOutput {
  paperType: string;
  studyDesign: string;
  sampleSize: string;
  alphaThreshold?: string;
  analyticalTool: string;
  effectSizeSummary?: string;
  metrics: ExtractedMetric[];
  plainBurmeseSummary: string;
  academicEnglishParagraph: string;
  limitations: string;
  limitationsList?: string[];
  riskOfBias?: string;
}

export async function runMethodologyExtraction(
  sourceText: string,
  _apiKey?: string
): Promise<MethodologyOutput> {
  const excerpt = (sourceText || '').trim().slice(0, 12000);
  if (excerpt.length < 40) {
    throw new Error('စာတမ်း၏ Methodology သို့မဟုတ် Results အပိုင်းကို ထည့်သွင်းပေးပါ။');
  }

  const systemInstruction = `You are a Principal Biostatistician and Research Methodologist for university students.
Analyze the provided research text and return ONLY a valid JSON object (no markdown fences) matching this exact structure:
{
  "paperType": "Quantitative Empirical Study / RCT / Cohort / Meta-Analysis",
  "studyDesign": "Concise research design (e.g., Randomized Controlled Trial, Cross-Sectional Survey)",
  "sampleSize": "Exact sample size (e.g., N = 450)",
  "alphaThreshold": "Alpha threshold (e.g., α = 0.05, two-tailed)",
  "analyticalTool": "Primary statistical test/software (e.g., Multivariate Regression, ANOVA, SPSS/R)",
  "effectSizeSummary": "Reported effect size (e.g., Cohen's d = 0.64, Odds Ratio = 2.15, R² = 0.42)",
  "metrics": [
    {
      "metricName": "Name of test/variable (e.g., Primary Outcome p-value, Effect Size, 95% CI)",
      "value": "Exact statistic (e.g., p = 0.003, t(448) = 3.12)",
      "confidenceInterval": "e.g., 95% CI [1.24, 3.18]",
      "effectSize": "e.g., d = 0.65 (Medium-to-Large)",
      "interpretation": "Clear scholarly English + natural Burmese explanation of what this statistic proves.",
      "isSignificant": true
    }
  ],
  "plainBurmeseSummary": "သုတေသန ဒီဇိုင်း၊ p-value၊ Confidence Interval နှင့် Effect Size တို့၏ အဓိပ္ပာယ်ကို ကျောင်းသားများ အလွယ်တကူ နားလည်နိုင်အောင် သဘာဝကျသော မြန်မာဘာသာဖြင့် အသေးစိတ် ရှင်းလင်းချက်။",
  "academicEnglishParagraph": "A formal, citation-ready academic paragraph synthesizing the study's research design, sample size, statistical significance, confidence intervals, and methodological rigor for direct inclusion in a Literature Review or Assignment.",
  "limitations": "Concise synthesis of methodological limitations, sampling constraints, and risk of bias.",
  "limitationsList": [
    "Specific limitation 1 (e.g., Selection bias or cross-sectional causality constraint)",
    "Specific limitation 2 (e.g., Sample generalizability or self-report measurement bias)",
    "Specific limitation 3 (e.g., Unmeasured confounding variables or attrition risk)"
  ],
  "riskOfBias": "Overall Risk of Bias assessment (e.g., Moderate Risk — Potential selection & self-report bias; internal validity remains robust)."
}`;

  const rawText = await executeGeminiRequest(
    `Extract the Research Design, Statistical Test Breakdown (p-values, Confidence Intervals, Effect Sizes), and Methodological Limitations & Risk of Bias from this research text:\n\n"""\n${excerpt}\n"""`,
    'standard',
    systemInstruction,
    undefined,
    2400
  );

  const result = safeExtractJsonObject<any>(rawText) || {};

  const limitationsList: string[] = Array.isArray(result.limitationsList)
    ? result.limitationsList.map((s: any) => String(s || '').trim()).filter(Boolean)
    : typeof result.limitations === 'string' && result.limitations.trim()
    ? result.limitations
        .split(/(?:\r?\n|•|;\s+)/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5)
    : [];

  return {
    paperType: result.paperType || 'Empirical Research Study',
    studyDesign: result.studyDesign || 'Quantitative / Analytical Design',
    sampleSize: result.sampleSize || 'N = Not explicitly stated',
    alphaThreshold: result.alphaThreshold || 'α = 0.05',
    analyticalTool:
      result.analyticalTool || result.primaryStatisticalTool || 'Inferential Statistical Analysis',
    effectSizeSummary: result.effectSizeSummary || 'Effect size evaluated across primary outcomes',
    metrics: Array.isArray(result.metrics)
      ? result.metrics.map((m: any) => ({
          metricName: String(m?.metricName || 'Statistical Metric'),
          value: String(m?.value || 'Reported in text'),
          confidenceInterval: m?.confidenceInterval ? String(m.confidenceInterval) : undefined,
          effectSize: m?.effectSize ? String(m.effectSize) : undefined,
          interpretation: String(
            m?.interpretation || 'Statistically evaluated outcome measure.'
          ),
          isSignificant: Boolean(m?.isSignificant ?? true),
        }))
      : [],
    plainBurmeseSummary:
      result.plainBurmeseSummary ||
      result.burmeseSummary ||
      'စာတမ်း၏ သုတေသနနည်းစနစ်၊ ကိန်းဂဏန်းအချက်အလက်များနှင့် အဓိကတွေ့ရှိချက်များကို မြန်မာဘာသာဖြင့် အနှစ်ချုပ် ရှင်းလင်းထားပါသည်။',
    academicEnglishParagraph:
      result.academicEnglishParagraph ||
      result.academicAssignmentText ||
      'The study employs a structured empirical methodology with defined statistical thresholds to evaluate primary outcomes.',
    limitations:
      result.limitations ||
      (limitationsList.length > 0
        ? limitationsList.join(' • ')
        : 'Potential constraints in sample generalizability and observational confounding.'),
    limitationsList,
    riskOfBias:
      result.riskOfBias ||
      'Moderate Risk of Bias — Consider sample representativeness and confounding controls when citing.',
  };
}

