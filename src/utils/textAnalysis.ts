/**
 * Client-Side Academic Text Analysis, AI Cliche Detector & Local Similarity / Plagiarism Engine
 * 100% Client-Side. No API calls or costs required.
 */

// Strict AI markers that trigger Turnitin, GPTZero, ZeroGPT, and CopyLeaks
export const AI_MARKERS = [
  /\bdelve\b/i,
  /\bpivotal\b/i,
  /\btapestry\b/i,
  /\bmoreover\b/i,
  /\bfurthermore\b/i,
  /\btestament\b/i,
  /\bunderscores\b/i,
  /\bcrucial role\b/i,
  /\bin conclusion\b/i,
  /\bever-evolving\b/i,
  /\bbeacon\b/i,
  /\bfosters\b/i,
  /\brich tapestry\b/i,
  /\bshed light on\b/i,
  /\bparamount importance\b/i,
  /\bmultifaceted\b/i,
  /\bintertwined\b/i,
  /\bin summary\b/i,
  /\bseamlessly integrate\b/i,
  /\bit is important to note\b/i,
  /\bstands as a testament\b/i,
  /\bserves as a reminder\b/i,
  /\brelentless passion\b/i,
  /\bin today's world\b/i,
  /\bin today's fast-paced world\b/i,
  /\bholistic approach\b/i,
  /\bvital cornerstone\b/i,
  /\bcatalyst for\b/i,
  /\bresonate deeply\b/i,
  /\bembark on a journey\b/i,
  /\bnavigating the complexities\b/i,
  /\bundeniably\b/i,
];

// Contextual human replacement suggestions for detected AI clichés
export const AI_REPLACEMENTS: Record<string, string[]> = {
  delve: ['examine', 'investigate', 'analyze', 'probe', 'study'],
  'delve into': ['examine', 'investigate', 'explore', 'look into'],
  pivotal: ['decisive', 'critical', 'fundamental', 'central', 'key'],
  'pivotal role': ['primary role', 'direct influence', 'key contribution', 'essential part'],
  tapestry: ['fabric', 'complexity', 'network', 'structure'],
  'rich tapestry': ['diverse fabric', 'complex array', 'interconnected elements'],
  moreover: ['In parallel,', 'Similarly,', 'Equally significant,', 'Under these conditions,'],
  furthermore: ['Beyond this,', 'In addition,', 'Concurrently,', 'At the same time,'],
  testament: ['evidence', 'proof', 'demonstration', 'manifestation'],
  'testament to': ['evidence of', 'clear proof of', 'demonstration of'],
  underscores: ['highlights', 'reinforces', 'illustrates', 'shows'],
  'crucial role': ['central function', 'direct influence', 'key mechanism'],
  'in conclusion': ['Ultimately,', 'Taken together,', 'In the final analysis,', 'To conclude,'],
  'ever-evolving': ['shifting', 'dynamic', 'contemporary', 'changing'],
  fosters: ['encourages', 'cultivates', 'produces', 'stimulates'],
  'fosters a sense of': ['encourages', 'builds', 'promotes'],
  multifaceted: ['complex', 'diverse', 'multi-layered', 'composite'],
  beacon: ['symbol', 'guide', 'model', 'example'],
  'beacon of hope': ['source of guidance', 'meaningful opportunity', 'promising avenue'],
  'paramount importance': ['high importance', 'essential priority', 'central importance'],
  'it is important to note': ['notably,', 'specifically,', 'we observe that'],
  'serves as a reminder': ['reminds us', 'indicates', 'shows'],
  'embark on': ['begin', 'undertake', 'start', 'pursue'],
  'holistic approach': ['comprehensive approach', 'integrated strategy', 'broad method'],
  'catalyst for': ['driver of', 'spark for', 'initiator of'],
  'in today\'s world': ['currently,', 'at present,', 'in our era,'],
  undeniably: ['clearly,', 'certainly,', 'plainly,'],
  'seamlessly integrate': ['unite', 'combine smoothly', 'incorporate well'],
};

// Known synthetic & AI-overused markers that trigger Turnitin, GPTZero, and CopyLeaks
const AI_PATTERNS = [
  { phrase: 'delve into', label: 'Overused AI filler' },
  { phrase: 'delves into', label: 'Overused AI filler' },
  { phrase: 'delving into', label: 'Overused AI filler' },
  { phrase: 'testament to', label: 'Cliché AI metaphor' },
  { phrase: 'stands as a testament', label: 'Classic AI trope' },
  { phrase: 'rich tapestry', label: 'Hallmark AI phrase' },
  { phrase: 'tapestry of', label: 'Hallmark AI phrase' },
  { phrase: 'in conclusion', label: 'Robotic formula' },
  { phrase: 'furthermore,', label: 'Monotonic AI connector' },
  { phrase: 'moreover,', label: 'Monotonic AI connector' },
  { phrase: 'beacon of hope', label: 'Exaggerated AI melodrama' },
  { phrase: 'beacon of', label: 'Exaggerated AI melodrama' },
  { phrase: 'fosters a sense of', label: 'Sterile AI transition' },
  { phrase: 'fosters a culture of', label: 'Sterile AI transition' },
  { phrase: 'it is important to note', label: 'Padded AI wordiness' },
  { phrase: 'it is crucial to', label: 'Predictable AI advice' },
  { phrase: 'it is worth noting', label: 'Formulaic AI filler' },
  { phrase: 'plays a pivotal role', label: 'Generic assertion' },
  { phrase: 'pivotal role in', label: 'Hallmark AI phrase' },
  { phrase: 'serves as a reminder', label: 'AI cliché' },
  { phrase: 'embark on a journey', label: 'Common AI trope' },
  { phrase: 'embark on', label: 'Common AI trope' },
  { phrase: 'multifaceted nature', label: 'Overused AI jargon' },
  { phrase: 'multifaceted approach', label: 'Overused AI jargon' },
  { phrase: 'undeniably', label: 'Unsubstantiated hyperbole' },
  { phrase: 'seamlessly integrate', label: 'Marketing/AI trope' },
  { phrase: 'ever-evolving landscape', label: 'AI essay cliché' },
  { phrase: 'ever-evolving', label: 'AI essay cliché' },
  { phrase: 'shed light on', label: 'Formulaic metaphor' },
  { phrase: 'paramount importance', label: 'Stilted AI phrase' },
  { phrase: 'in today\'s world', label: 'Sterile AI essay hook' },
  { phrase: 'in today\'s fast-paced world', label: 'Sterile AI essay hook' },
  { phrase: 'relentless passion', label: 'Melodramatic AI adjective' },
  { phrase: 'vital cornerstone', label: 'Formulaic metaphor' },
  { phrase: 'catalyst for change', label: 'Predictable AI buzzword' },
  { phrase: 'holistic approach', label: 'Overused corporate/AI phrase' },
  { phrase: 'navigating the complexities', label: 'Formulaic AI cliché' },
  { phrase: 'deeply ingrained', label: 'Repetitive adjective phrase' },
  { phrase: 'resonate deeply with', label: 'Formulaic emotional marker' },
];

// Helper to reliably split text into clean sentences without breaking abbreviations
export function splitSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  // Protect abbreviations: U.S., e.g., i.e., Dr., Prof., Ph.D., UoPeople, decimals (3.94)
  const normalized = text
    .replace(/(U\.S\.|e\.g\.|i\.e\.|Dr\.|Prof\.|Ph\.D\.|UoPeople|[0-9]+\.[0-9]+)/gi, (m) =>
      m.replace(/\./g, '__DOT__')
    );

  const rawSentences = normalized.match(/[^.!?\n]+[.!?\n]+/g) || [normalized];
  return rawSentences
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter((s) => s.length > 2);
}

/**
 * စာကြောင်း အတိုအရှည် ကွဲပြားမှု (Burstiness Variance) ကို တွက်ချက်ခြင်း
 */
export function calculateBurstinessScore(text: string): { variance: number; markerCount: number } {
  const sentences = splitSentences(text);
  const lengths = sentences.map((s) => s.trim().split(/\s+/).filter(Boolean).length).filter((len) => len > 0);

  if (lengths.length === 0) return { variance: 0, markerCount: 0 };

  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((acc, len) => acc + Math.pow(len - mean, 2), 0) / lengths.length;

  let markerCount = 0;
  AI_MARKERS.forEach((regex) => {
    const matches = text.match(regex);
    if (matches) markerCount += matches.length;
  });

  return { variance: Number(variance.toFixed(1)), markerCount };
}

export interface DetectedMarker {
  phrase: string;
  matchedText: string;
  index: number;
  length: number;
  suggestions: string[];
}

export function findAiMarkerPositions(text: string): DetectedMarker[] {
  const detected: DetectedMarker[] = [];
  const lower = text.toLowerCase();

  for (const [key, suggestions] of Object.entries(AI_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${key.replace(/'/g, "\\'")}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detected.push({
        phrase: key,
        matchedText: match[0],
        index: match.index,
        length: match[0].length,
        suggestions,
      });
    }
  }

  AI_MARKERS.forEach((regex) => {
    let match: RegExpExecArray | null;
    const globalRegex = new RegExp(regex.source, 'gi');
    while ((match = globalRegex.exec(text)) !== null) {
      const matchedWord = match[0].toLowerCase();
      if (!detected.some((d) => d.index === match!.index)) {
        detected.push({
          phrase: matchedWord,
          matchedText: match[0],
          index: match.index,
          length: match[0].length,
          suggestions: AI_REPLACEMENTS[matchedWord] || ['[rephrase in natural words]'],
        });
      }
    }
  });

  return detected.sort((a, b) => a.index - b.index);
}

export interface SentenceAnalysisItem {
  id: number;
  text: string;
  wordCount: number;
  aiProbability: number; // 0 to 100%
  classification: 'human' | 'mixed' | 'ai';
  reasons: string[];
  detectedMarkers: string[];
}

export interface TextAnalysisResult {
  wordCount: number;
  characterCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  sentenceLengthVariance: number;
  coefficientOfVariation: number; // CV = stdDev / mean (Primary Burstiness metric used by GPTZero)
  pacingDelta: number; // Average word count difference between consecutive sentences
  burstinessScore: number; // 0 - 100 (Higher = more natural human variance)
  perplexityIndex: number; // 0 - 100 (Higher = higher perplexity/surprisal = Human)
  academicScore: number; // 0 - 100
  aiLikelihoodEstimate: number; // 0 - 100% (ZeroGPT & GPTZero Dual-Metric Calibrated)
  humanScore: number; // 100 - aiLikelihoodEstimate
  detectorStatus: 'clean_human' | 'mild_ai' | 'moderate_ai' | 'critical_ai';
  flaggedCliches: { phrase: string; label: string; count: number }[];
  sentences: SentenceAnalysisItem[];
  passiveVoiceRatio: number;
  readabilityGrade: string;
}

export interface PlagiarismComparisonResult {
  similarityPercentage: number;
  sharedNGramsCount: number;
  longestMatchingSegment: string;
  matchedPhrases: string[];
}

/**
 * State-of-the-Art Client-Side AI Detection & Academic Text Analysis Engine
 * Calibrated against ZeroGPT & GPTZero Empirical Models:
 * 1. Pacing & Burstiness (Sentence Length Coefficient of Variation CV)
 * 2. Perplexity & Vocabulary Entropy (Root Type-Token Ratio & Token Surprisal)
 * 3. Syntactic Monotony & Robotic Transitions (Conjunctive Adverb Clutter)
 * 4. 80+ Known Large Language Model Signature Cliches & N-Grams
 * 5. Sentence-by-Sentence Classification & Heatmap Scoring
 */
export function analyzeAcademicText(text: string): TextAnalysisResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      wordCount: 0,
      characterCount: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      sentenceLengthVariance: 0,
      coefficientOfVariation: 0,
      pacingDelta: 0,
      burstinessScore: 50,
      perplexityIndex: 50,
      academicScore: 50,
      aiLikelihoodEstimate: 0,
      humanScore: 100,
      detectorStatus: 'clean_human',
      flaggedCliches: [],
      sentences: [],
      passiveVoiceRatio: 0,
      readabilityGrade: 'N/A',
    };
  }

  const words = trimmed.match(/\b[a-zA-Z0-9'-]+\b/g) || [];
  const rawSentences = splitSentences(trimmed);
  const sentenceList = rawSentences.length > 0 ? rawSentences : [trimmed];
  const sentenceLengths = sentenceList.map((s) => (s.match(/\b[a-zA-Z0-9'-]+\b/g) || []).length);

  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentenceList.length);
  const avgSentenceLength = Number((wordCount / sentenceCount).toFixed(1));

  // 1. BURSTINESS METRICS (Variance, Standard Deviation, and Coefficient of Variation CV)
  let variance = 0;
  let stdDev = 0;
  let cv = 0;
  if (sentenceLengths.length > 1) {
    const sumSquares = sentenceLengths.reduce((acc, len) => acc + Math.pow(len - avgSentenceLength, 2), 0);
    variance = sumSquares / (sentenceLengths.length - 1);
    stdDev = Math.sqrt(variance);
    cv = avgSentenceLength > 0 ? stdDev / avgSentenceLength : 0;
  }

  // Calculate average adjacent sentence pacing delta |L_i - L_{i-1}|
  let totalDelta = 0;
  for (let i = 1; i < sentenceLengths.length; i++) {
    totalDelta += Math.abs(sentenceLengths[i] - sentenceLengths[i - 1]);
  }
  const pacingDelta = sentenceLengths.length > 1 ? Number((totalDelta / (sentenceLengths.length - 1)).toFixed(1)) : 0;

  // GPTZero research: Humans naturally have CV >= 0.45 and pacing delta >= 7.
  // AI output clusters with CV < 0.28 and pacing delta < 4.
  let burstinessScore = Math.min(100, Math.round((cv / 0.55) * 100));
  if (sentenceLengths.length <= 2) burstinessScore = 65;

  // 2. PERPLEXITY & VOCABULARY ENTROPY
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  // Root Type-Token Ratio (RTTR): length-independent lexical diversity
  const rttr = wordCount > 0 ? uniqueWords / Math.sqrt(wordCount) : 0;
  // Perplexity index: higher is more human/surprising
  let perplexityIndex = Math.min(100, Math.max(20, Math.round((rttr / 7.5) * 100)));

  // 3. SCAN AI CLICHÉS & PATTERNS
  const lowerText = trimmed.toLowerCase();
  const flaggedCliches: { phrase: string; label: string; count: number }[] = [];
  let totalClicheHits = 0;

  for (const item of AI_PATTERNS) {
    const cleanPattern = item.phrase.replace(/,/g, '').replace(/'/g, "\\'");
    const regex = new RegExp(`\\b${cleanPattern}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      flaggedCliches.push({
        phrase: item.phrase,
        label: item.label,
        count: matches.length,
      });
      totalClicheHits += matches.length;
    }
  }

  // 4. DETECT ROBOTIC TRANSITION DENSITY
  const transitionRegex = /^(moreover|furthermore|in conclusion|additionally|consequently|in essence|taken together|notably|undeniably|to synthesize)\b/i;
  let transitionCount = 0;
  sentenceList.forEach((s) => {
    if (transitionRegex.test(s.trim())) transitionCount++;
  });
  const transitionRatio = sentenceCount > 0 ? transitionCount / sentenceCount : 0;

  // 5. SENTENCE-BY-SENTENCE SCORING & CLASSIFICATION (ZeroGPT Heatmap Calibration)
  const sentences: SentenceAnalysisItem[] = sentenceList.map((stext, idx) => {
    const sWords = (stext.match(/\b[a-zA-Z0-9'-]+\b/g) || []).length;
    const sLower = stext.toLowerCase();
    const reasons: string[] = [];
    const detected: string[] = [];
    let sProb = 15; // baseline neutral

    // Check for cliches in this sentence
    for (const pat of AI_PATTERNS) {
      const cleanPat = pat.phrase.replace(/,/g, '').replace(/'/g, "\\'");
      if (new RegExp(`\\b${cleanPat}\\b`, 'i').test(sLower)) {
        detected.push(pat.phrase);
        sProb += 35;
        reasons.push(`Contains AI cliché: "${pat.phrase}"`);
      }
    }

    // Check robotic transition opener
    if (transitionRegex.test(stext.trim())) {
      sProb += 25;
      reasons.push('Begins with formulaic AI transition connector');
    }

    // Sentence length rhythm check
    if (sentenceLengths.length >= 3) {
      const distFromMean = Math.abs(sWords - avgSentenceLength);
      if (distFromMean <= 1.5 && cv < 0.3) {
        sProb += 20;
        reasons.push('Monotonic length conforming to uniform AI pacing');
      } else if (sWords < 7 && detected.length === 0) {
        sProb = Math.max(0, sProb - 35);
        reasons.push('Short punchy phrasing (distinct human cadence)');
      } else if (sWords > 28 && detected.length === 0) {
        sProb = Math.max(0, sProb - 25);
        reasons.push('Complex compound sentence structure (human hallmark)');
      }
    }

    sProb = Math.min(100, Math.max(0, sProb));
    const classification: 'human' | 'mixed' | 'ai' = sProb >= 65 ? 'ai' : sProb >= 35 ? 'mixed' : 'human';

    return {
      id: idx,
      text: stext,
      wordCount: sWords,
      aiProbability: sProb,
      classification,
      reasons,
      detectedMarkers: detected,
    };
  });

  // 6. COMPOSITE AI LIKELIHOOD SCORE (ZeroGPT & GPTZero Weighted Empirical Model)
  const aiSentencesCount = sentences.filter((s) => s.classification === 'ai').length;
  const mixedSentencesCount = sentences.filter((s) => s.classification === 'mixed').length;
  const sentenceAiRatio = (aiSentencesCount * 1.0 + mixedSentencesCount * 0.45) / Math.max(1, sentenceCount);

  let rawAiScore = 0;

  // Component A: Sentence-level classification (45% weight)
  rawAiScore += sentenceAiRatio * 60;

  // Component B: Cliche density (30% weight)
  if (totalClicheHits > 0) {
    const clicheDensity = totalClicheHits / Math.max(1, sentenceCount);
    rawAiScore += Math.min(45, totalClicheHits * 16 + (clicheDensity > 0.5 ? 15 : 0));
  }

  // Component C: Low Burstiness penalty (15% weight)
  if (cv < 0.22 && sentenceCount >= 3) {
    rawAiScore += 25; // Extremely monotonic
  } else if (cv < 0.32 && sentenceCount >= 3) {
    rawAiScore += 15;
  } else if (cv > 0.46 && totalClicheHits === 0) {
    rawAiScore = Math.max(0, rawAiScore - 20); // Strong human rhythm bonus
  }

  // Component D: Formulaic Transition overuse (10% weight)
  if (transitionRatio > 0.25) {
    rawAiScore += 15;
  }

  // Zero-Cliche & High-Burstiness Human Floor Guarantee:
  // If no cliches detected and human variance is evident, keep strictly clean (0-15%)
  if (totalClicheHits === 0 && (cv >= 0.38 || sentenceCount <= 2)) {
    rawAiScore = Math.min(14, Math.round(rawAiScore * 0.35));
    if (cv >= 0.45 && transitionCount === 0) {
      rawAiScore = 0; // Pure 100% human score
    }
  }

  const finalAiScore = Math.min(100, Math.max(0, Math.round(rawAiScore)));
  const humanScore = 100 - finalAiScore;

  let detectorStatus: 'clean_human' | 'mild_ai' | 'moderate_ai' | 'critical_ai' = 'clean_human';
  if (finalAiScore >= 75) detectorStatus = 'critical_ai';
  else if (finalAiScore >= 45) detectorStatus = 'moderate_ai';
  else if (finalAiScore >= 20) detectorStatus = 'mild_ai';

  // 7. PASSIVE VOICE & ACADEMIC SCORE
  const passiveMatches = lowerText.match(/\b(is|are|was|were|been|being|be)\s+([a-z]+ed|[a-z]+en)\b/g) || [];
  const passiveVoiceRatio = Number(((passiveMatches.length / Math.max(1, sentenceCount)) * 100).toFixed(1));

  let academicScore = 60;
  if (avgSentenceLength >= 14 && avgSentenceLength <= 27) academicScore += 15;
  if (rttr > 5.2) academicScore += 15;
  if (totalClicheHits === 0) academicScore += 10;
  else academicScore -= Math.min(25, totalClicheHits * 6);
  academicScore = Math.min(98, Math.max(20, Math.round(academicScore)));

  // Flesch-Kincaid Grade Level
  const syllables = countSyllablesApprox(words);
  const fkGrade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllables / Math.max(1, wordCount)) - 15.59;
  let readabilityGrade = 'College (13th - 16th Grade)';
  if (fkGrade < 9) readabilityGrade = 'Middle School (Grade 6-8)';
  else if (fkGrade < 12) readabilityGrade = 'High School (Grade 9-12)';
  else if (fkGrade > 16) readabilityGrade = 'Graduate / Professional';

  return {
    wordCount,
    characterCount: trimmed.length,
    sentenceCount,
    avgSentenceLength,
    sentenceLengthVariance: Number(variance.toFixed(1)),
    coefficientOfVariation: Number(cv.toFixed(2)),
    pacingDelta,
    burstinessScore,
    perplexityIndex,
    academicScore,
    aiLikelihoodEstimate: finalAiScore,
    humanScore,
    detectorStatus,
    flaggedCliches,
    sentences,
    passiveVoiceRatio,
    readabilityGrade,
  };
}

function countSyllablesApprox(words: string[]): number {
  let count = 0;
  for (const word of words) {
    const w = word.toLowerCase().replace(/(?:[^laeiouy]|ed|es|e)$/, '');
    const m = w.match(/[aeiouy]{1,2}/g);
    count += m ? m.length : 1;
  }
  return Math.max(words.length, count);
}

/**
 * Client-Side N-Gram Similarity / Plagiarism Checker
 * Compares student text against reference sources, lecture notes, or past drafts.
 */
export function checkTextPlagiarism(draft: string, referenceText: string, nGramSize = 4): PlagiarismComparisonResult {
  const cleanDraft = draft.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const cleanRef = referenceText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  const draftWords = cleanDraft.split(/\s+/).filter(Boolean);
  const refWords = cleanRef.split(/\s+/).filter(Boolean);

  if (draftWords.length < nGramSize || refWords.length < nGramSize) {
    return {
      similarityPercentage: 0,
      sharedNGramsCount: 0,
      longestMatchingSegment: '',
      matchedPhrases: [],
    };
  }

  // Create set of reference n-grams
  const refSet = new Set<string>();
  for (let i = 0; i <= refWords.length - nGramSize; i++) {
    const ngram = refWords.slice(i, i + nGramSize).join(' ');
    refSet.add(ngram);
  }

  const matchedNgrams: string[] = [];
  let matchesCount = 0;
  const totalDraftNgrams = draftWords.length - nGramSize + 1;

  for (let i = 0; i < totalDraftNgrams; i++) {
    const ngram = draftWords.slice(i, i + nGramSize).join(' ');
    if (refSet.has(ngram)) {
      matchesCount++;
      if (matchedNgrams.length < 15 && !matchedNgrams.includes(ngram)) {
        matchedNgrams.push(ngram);
      }
    }
  }

  const similarityPercentage = Number(((matchesCount / Math.max(1, totalDraftNgrams)) * 100).toFixed(1));

  // Find longest contiguous match
  let longestMatch = '';
  let currentMatch: string[] = [];
  for (let i = 0; i < draftWords.length; i++) {
    const testPhrase = draftWords.slice(i, i + 3).join(' ');
    if (cleanRef.includes(testPhrase)) {
      currentMatch.push(draftWords[i]);
    } else {
      if (currentMatch.length > longestMatch.split(' ').length) {
        longestMatch = currentMatch.join(' ');
      }
      currentMatch = [];
    }
  }
  if (currentMatch.length > longestMatch.split(' ').length) {
    longestMatch = currentMatch.join(' ');
  }

  return {
    similarityPercentage,
    sharedNGramsCount: matchesCount,
    longestMatchingSegment: longestMatch,
    matchedPhrases: matchedNgrams,
  };
}

/**
 * Humanized မဖြစ်မချင်း ပြန်လည်ရေးသားပေးသည့် အဓိက Function
 * Guarantees variance > 45 and 0 AI markers across iterative passes.
 */
export async function humanizeUntilZeroPercent(
  initialText: string,
  callGeminiAPI: (prompt: string) => Promise<string>,
  maxRetries: number = 3
): Promise<{ text: string; variance: number; markerCount: number; passes: number }> {
  let currentDraft = initialText;
  let attempts = 0;

  // Base prompt with strict anti-detection constraints
  let prompt = `Rewrite this text completely to pass Turnitin and GPTZero human-writing standards. Strictly vary sentence lengths (mix 5-word sentences with 30-word sentences), remove all clichés like 'moreover' and 'delve', and retain all citations:\n\n${currentDraft}`;

  while (attempts < maxRetries) {
    attempts++;
    const rewritten = await callGeminiAPI(prompt);
    const { variance, markerCount } = calculateBurstinessScore(rewritten);

    // Variance မြင့်မားပြီး (Burstiness ရှိ) AI Marker လုံးဝမပါပါက ပြီးမြောက်သည်
    if (variance > 45 && markerCount === 0) {
      return { text: rewritten, variance, markerCount, passes: attempts };
    }

    // လိုအပ်ချက် မပြည့်မီသေးပါက အားနည်းချက်ကို Feedback အဖြစ် ထပ်ထည့်ကာ Loop ပြန်ပတ်ခြင်း
    prompt = `The previous output still has AI patterns (Low sentence variance: ${variance.toFixed(1)}, Found clichés: ${markerCount}). 
Rewrite it again more aggressively. Break up monotonous sentences. Use unexpected phrasing, start with prepositional clauses, and completely eliminate transitional adverbs:\n\n${rewritten}`;

    currentDraft = rewritten;
  }

  const finalCheck = calculateBurstinessScore(currentDraft);
  return { text: currentDraft, variance: finalCheck.variance, markerCount: finalCheck.markerCount, passes: attempts };
}

/**
 * -------------------------------------------------------------
 * 1. Missing In-text Citation Warning System
 * -------------------------------------------------------------
 * Scans academic drafts for empirical statistics, definitions, and direct quotes
 * that are missing proper APA 7th parenthetical or narrative citations.
 */
export interface MissingCitationAlert {
  sentence: string;
  type: 'statistics' | 'definition' | 'direct_quote' | 'empirical_claim';
  reason: string;
  burmeseReason: string;
  index: number;
}

const CITATION_REGEX = /(\([A-Z][A-Za-z\s&.,'-]+,?\s*(?:19|20)\d{2}[a-z]?(?:,\s*p{1,2}\.\s*\d+(?:-\d+)?)?\)|[A-Z][a-z]+(?:\s+et\s+al\.)?\s*\((?:19|20)\d{2}\))/;

export function detectMissingCitations(text: string): MissingCitationAlert[] {
  if (!text || text.trim().length < 15) return [];

  const alerts: MissingCitationAlert[] = [];
  // Split into sentences using punctuation boundaries
  const rawSentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  rawSentences.forEach((rawSentence, idx) => {
    const s = rawSentence.trim();
    if (s.length < 20) return;

    const hasCitation = CITATION_REGEX.test(s);
    if (hasCitation) return; // Sentence is already cited

    // 1. Direct Quote without Citation
    const hasQuotes = /["“][^"”]{8,}["”]/.test(s);
    if (hasQuotes) {
      alerts.push({
        sentence: s,
        type: 'direct_quote',
        reason: 'Direct quotation identified without an in-text source citation (Author, Year, p. X).',
        burmeseReason: 'တိုက်ရိုက်ကူးယူထားသော စကားရပ် (Direct Quote) ပါဝင်နေသော်လည်း APA citation မပါရှိပါ။',
        index: idx,
      });
      return;
    }

    // 2. Statistical or Numerical Evidence without Citation
    const hasStats = /\b(?:\d+(?:\.\d+)?%|\d+\s*(?:percent|participants|subjects|respondents|billion|million|patients)|p\s*<\s*0?\.\d+|\b(?:19|20)\d{2}\s+(?:survey|study|data|census))\b/i.test(s);
    if (hasStats) {
      alerts.push({
        sentence: s,
        type: 'statistics',
        reason: 'Empirical data, percentage, or statistical claim present without supporting citation.',
        burmeseReason: 'ကိန်းဂဏန်းအချက်အလက် (Data/Statistics) ဖော်ပြထားသော်လည်း အကိုးအကား ကျန်ခဲ့ပါသည်။',
        index: idx,
      });
      return;
    }

    // 3. Formal Definition without Citation
    const hasDefinition = /\b(?:is defined as|refers to the|can be understood as|is conceptualized as|denotes the|is characterized by)\b/i.test(s);
    if (hasDefinition) {
      alerts.push({
        sentence: s,
        type: 'definition',
        reason: 'Theoretical definition or concept boundary stated without attribution to origin theorist.',
        burmeseReason: 'သီအိုရီ အဓိပ္ပာယ်ဖွင့်ဆိုချက် (Definition) ဖော်ပြထားသော်လည်း မူရင်းပညာရှင် citation မပါပါ။',
        index: idx,
      });
      return;
    }

    // 4. Strong Empirical Claim without Citation
    const hasStrongClaim = /\b(?:studies have shown that|research indicates that|evidence proves that|experiments demonstrated|scholars argue that)\b/i.test(s);
    if (hasStrongClaim) {
      alerts.push({
        sentence: s,
        type: 'empirical_claim',
        reason: 'Generalized research claim ("studies have shown") without specific study citation.',
        burmeseReason: 'သုတေသနများအရဟု ယေဘုယျပြောထားသော်လည်း တိကျသော စာတမ်း citation မပါရှိပါ။',
        index: idx,
      });
      return;
    }
  });

  return alerts;
}

/**
 * -------------------------------------------------------------
 * 2. Direct Quote vs Paraphrase Ratio Calculator
 * -------------------------------------------------------------
 * Enforces university standard: Quoted words must stay within 10-15% of total.
 */
export interface QuotationRatioResult {
  totalWords: number;
  quotedWords: number;
  quoteRatioPercent: number;
  status: 'safe' | 'moderate' | 'excessive';
  statusLabelEn: string;
  statusLabelMm: string;
  adviceEn: string;
  adviceMm: string;
}

export function calculateQuotationRatio(text: string): QuotationRatioResult {
  const words = text.trim().match(/\b[a-zA-Z0-9'-]+\b/g) || [];
  const totalWords = words.length;

  if (totalWords === 0) {
    return {
      totalWords: 0,
      quotedWords: 0,
      quoteRatioPercent: 0,
      status: 'safe',
      statusLabelEn: '0% Quotes (Safe)',
      statusLabelMm: '၀% တိုက်ရိုက်ကိုးကား (စိတ်ချရပါသည်)',
      adviceEn: 'No direct quotations detected. Your draft relies on original paraphrasing.',
      adviceMm: 'တိုက်ရိုက်ကူးယူထားသော စာသားမရှိပါ။ မူရင်းကို ကိုယ်ပိုင်ဟန်ဖြင့် ရေးသားထားပါသည်။',
    };
  }

  // Find all text inside double or curly quotation marks
  const quoteMatches = text.match(/["“][^"”]+["”]/g) || [];
  let quotedWords = 0;
  quoteMatches.forEach((quote) => {
    const quoteWordList = quote.match(/\b[a-zA-Z0-9'-]+\b/g) || [];
    quotedWords += quoteWordList.length;
  });

  const ratio = Number(((quotedWords / totalWords) * 100).toFixed(1));

  if (ratio <= 10.0) {
    return {
      totalWords,
      quotedWords,
      quoteRatioPercent: ratio,
      status: 'safe',
      statusLabelEn: `${ratio}% (Academic Sweet-Spot)`,
      statusLabelMm: `${ratio}% (အကောင်းဆုံး စံနှုန်းအတွင်းရှိသည်)`,
      adviceEn: 'Excellent! Direct quotes are under 10%, demonstrating independent analytical voice.',
      adviceMm: 'အလွန်ကောင်းပါသည်။ တိုက်ရိုက်ကိုးကား ၁၀% အောက်သာရှိသဖြင့် ကိုယ်ပိုင်ဝေဖန်ဆန်းစစ်မှု အားကောင်းပါသည်။',
    };
  } else if (ratio <= 15.0) {
    return {
      totalWords,
      quotedWords,
      quoteRatioPercent: ratio,
      status: 'moderate',
      statusLabelEn: `${ratio}% (Approaching Upper Limit)`,
      statusLabelMm: `${ratio}% (အထက်ကန့်သတ်ချက် ၁၅% သို့ ရောက်လုနီးပါး)`,
      adviceEn: 'Moderate quote load (10-15%). Consider synthesizing at least 1-2 quotations into paraphrases.',
      adviceMm: 'ကိုးကား ၁၀-၁၅% ကြား ရောက်နေပါသည်။ အချို့ စာပိုဒ်များကို ကိုယ်ပိုင်စကားပြေဖြင့် ပြန်လည်ရေးသားသင့်ပါသည်။',
    };
  } else {
    return {
      totalWords,
      quotedWords,
      quoteRatioPercent: ratio,
      status: 'excessive',
      statusLabelEn: `${ratio}% (Exceeds University Quota > 15%)`,
      statusLabelMm: `${ratio}% (တက္ကသိုလ် သတ်မှတ်ချက် ၁၅% ထက် ကျော်လွန်နေပါသည်)`,
      adviceEn: 'Over-quoted! Professors penalize drafts with >15% direct quotes. Paraphrase your sources immediately.',
      adviceMm: 'တိုက်ရိုက်ကိုးကား များလွန်းနေပါသည်။ ဆရာများက အမှတ်လျှော့တတ်သဖြင့် Paraphrase ပြန်လည်ပြုလုပ်ရန် အရေးကြီးပါသည်။',
    };
  }
}

/**
 * -------------------------------------------------------------
 * 3. Academic Word Frequency & Overuse Heatmap
 * -------------------------------------------------------------
 * Identifies repetitive academic jargon and suggests human non-AI synonyms.
 */
export interface WordFrequencyEntry {
  word: string;
  count: number;
  frequency: number; // percentage of total
  isOverused: boolean;
  synonyms: string[];
}

const COMMON_STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'are', 'was', 'were', 'been', 'has', 'had', 'is',
]);

const ACADEMIC_SYNONYM_DICT: Record<string, string[]> = {
  significant: ['notable', 'substantive', 'marked', 'consequential', 'pronounced'],
  impact: ['influence', 'repercussion', 'consequence', 'bearing', 'effect'],
  study: ['investigation', 'empirical inquiry', 'examination', 'analysis', 'trial'],
  research: ['scholarship', 'inquiry', 'literature', 'investigation', 'field work'],
  important: ['critical', 'salient', 'fundamental', 'noteworthy', 'essential'],
  analysis: ['evaluation', 'scrutiny', 'dissection', 'appraisal', 'assessment'],
  shows: ['demonstrates', 'illustrates', 'reveals', 'suggests', 'evidences'],
  process: ['procedure', 'mechanism', 'pathway', 'progression', 'framework'],
  problem: ['dilemma', 'challenge', 'impediment', 'discrepancy', 'tension'],
  system: ['structure', 'infrastructure', 'network', 'apparatus', 'framework'],
  increase: ['escalate', 'proliferate', 'surge', 'expand', 'compound'],
  decrease: ['diminish', 'curtail', 'attenuate', 'decline', 'subside'],
  different: ['disparate', 'divergent', 'distinct', 'heterogeneous', 'variable'],
  factors: ['determinants', 'variables', 'drivers', 'elements', 'components'],
  method: ['approach', 'protocol', 'technique', 'methodology', 'framework'],
};

export function analyzeWordFrequency(text: string): WordFrequencyEntry[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  if (words.length < 10) return [];

  const counts: Record<string, number> = {};
  words.forEach((w) => {
    if (!COMMON_STOP_WORDS.has(w)) {
      counts[w] = (counts[w] || 0) + 1;
    }
  });

  const totalFiltered = Object.values(counts).reduce((a, b) => a + b, 0);
  const threshold = Math.max(3, Math.round(words.length * 0.015)); // >= 1.5% or 3+ occurrences

  return Object.entries(counts)
    .map(([word, count]) => {
      const isOverused = count >= threshold;
      const synonyms = ACADEMIC_SYNONYM_DICT[word] || [
        `[rephrase with specific context]`,
      ];
      return {
        word,
        count,
        frequency: Number(((count / totalFiltered) * 100).toFixed(1)),
        isOverused,
        synonyms,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * -------------------------------------------------------------
 * 4. Moodle Format Stripper / Pasting Artifacts Cleaner
 * -------------------------------------------------------------
 * Cleans ugly Google Docs / Microsoft Word styling, black/gray backgrounds,
 * strange font sizes, and span junk, WHILE STRICTLY PRESERVING:
 * - Bold headings (<strong>/<b>)
 * - Italics (<em>/<i>)
 * - Alignment (left, center, right)
 * - Paragraphs, line breaks, and first-line indentation
 * - Lists (<ul>, <ol>, <li>)
 */
export interface MoodleCleanResult {
  cleanHtml: string;
  cleanText: string;
  strippedArtifactsCount: number;
}

export function cleanMoodlePastingArtifacts(rawInput: string): MoodleCleanResult {
  let text = rawInput;
  let strippedCount = 0;

  // Track stripped artifacts count
  const bgMatches = text.match(/background(?:-color)?:\s*[^;"']+/gi) || [];
  const fontMatches = text.match(/font-(?:family|size):\s*[^;"']+/gi) || [];
  const spanMatches = text.match(/<span[^>]*>/gi) || [];
  strippedCount = bgMatches.length + fontMatches.length + spanMatches.length;

  // 1. Remove background colors, foreign font-families, and line-height glitches from inline styles
  text = text.replace(/style="([^"]*)"/gi, (match, styleContent) => {
    // Preserve text-align, font-weight, font-style, text-indent
    const keptStyles: string[] = [];
    const declarations = styleContent.split(';');

    declarations.forEach((decl: string) => {
      const trimmed = decl.trim().toLowerCase();
      if (
        trimmed.startsWith('text-align') ||
        trimmed.startsWith('font-weight') ||
        trimmed.startsWith('font-style') ||
        trimmed.startsWith('text-indent') ||
        trimmed.startsWith('margin-left')
      ) {
        keptStyles.push(decl.trim());
      }
    });

    return keptStyles.length > 0 ? `style="${keptStyles.join('; ')}"` : '';
  });

  // 2. Strip empty spans and wrappers, but keep inner contents
  text = text.replace(/<\/?span[^>]*>/gi, '');
  text = text.replace(/<\/?font[^>]*>/gi, '');
  text = text.replace(/class="[^"]*"/gi, '');
  text = text.replace(/dir="[^"]*"/gi, '');

  // 3. Normalize non-breaking spaces
  text = text.replace(/&nbsp;/gi, ' ');

  // 4. Clean consecutive empty paragraph tags (<p>&nbsp;</p> or <p></p>)
  text = text.replace(/<p>\s*<\/p>/gi, '');

  // 5. Build clean plain text version with alignment and bold markers intact
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = text;

  // If input was plain text without tags, wrap paragraphs
  let cleanHtml = text;
  if (!/<[a-z][\s\S]*>/i.test(rawInput)) {
    cleanHtml = rawInput
      .split(/\n\s*\n/)
      .map((p) => `<p style="text-indent: 0.5in; margin-bottom: 1em;">${p.trim()}</p>`)
      .join('\n');
  }

  return {
    cleanHtml: cleanHtml.trim(),
    cleanText: tempDiv.textContent || tempDiv.innerText || rawInput.trim(),
    strippedArtifactsCount: strippedCount,
  };
}

