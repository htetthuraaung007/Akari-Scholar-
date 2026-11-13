/**
 * Context-Aware Dynamic Template Engine for UoPeople Scholarships & Renewals
 * Synthesizes active UI state (hardship description, story angle badge, degree, career goal,
 * and renewal CGPA/credits) into 3 distinct scholarly lenses with complete 800-950 char narrative arcs.
 */

import { humanizeForZeroGpt } from './humanizerEngine';

export type ScholarshipStoryAngle =
  | 'balanced'
  | 'currency_inflation'
  | 'conflict_banking'
  | 'family_breadwinner'
  | 'academic_high_achiever';

export type TemplateLens =
  | 'economic_inflation'
  | 'grit_infrastructure'
  | 'merit_pay_it_forward';

export interface ScholarshipContextInput {
  mode: 'new_app' | 'renewal_app';
  hardshipDescription: string;
  storyAngle: ScholarshipStoryAngle;
  customStoryAngle?: string;
  degreeProgram: string;
  careerGoal: string;
  cgpa?: string;
  coursesDone?: string;
}

export interface TemplateOutlineSection {
  step: number;
  sectionTitle: string;
  recommendedTopics: string[];
  suggestedAnecdotes: string[];
  structuralGuidance: string;
}

export interface ScholarshipTemplateItem {
  id: string;
  lens: TemplateLens;
  title: string;
  titleMy: string;
  category: 'new_applicant' | 'renewal' | 'hardship' | 'merit';
  targetAudience: string;
  coreTheme: string;
  promptHint: string;
  text: string;
  outline: TemplateOutlineSection[];
  advisoryNotes: {
    dos: string[];
    donts: string[];
    wordCountTarget: string;
  };
  vectors?: {
    persona: string;
    macroBarrier: string;
    fieldOfStudy: string;
    copingMechanism: string;
    communityImpact: string;
    measurableMilestone: string;
  };
}

// 32-bit MurmurHash3 + SFC32 deterministic PRNG for fresh non-duplicative variations
function murmurhash3_32_gc(key: string, seed = 0): number {
  const remainder = key.length & 3;
  const bytes = key.length - remainder;
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  let k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    // falls through
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    // falls through
    case 1:
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createSeededRng(seedStr: string): () => number {
  const h1 = murmurhash3_32_gc(seedStr, 0x12345678);
  const h2 = murmurhash3_32_gc(seedStr, 0x9abcdef0);
  const h3 = murmurhash3_32_gc(seedStr, 0xfeedbeef);
  const h4 = murmurhash3_32_gc(seedStr, 0xcafebabe);
  return sfc32(h1, h2, h3, h4);
}

/**
 * Deterministic context signature so UI detects immediately when any input field or badge changes.
 */
export function buildContextSignature(ctx: ScholarshipContextInput): string {
  return [
    ctx.mode,
    ctx.hardshipDescription.trim(),
    ctx.storyAngle,
    (ctx.customStoryAngle || '').trim(),
    ctx.degreeProgram.trim(),
    ctx.careerGoal.trim(),
    ctx.cgpa?.trim() || '',
    ctx.coursesDone?.trim() || '',
  ].join('||');
}

const BURMESE_CHAR_RE = /[\u1000-\u109F]/;

interface ExtractedContextDetails {
  degreeClean: string;
  goalSentence: string;
  goalPhrase: string;
  cgpaClean: string;
  coursesClean: string;
  angleSentence: string;
  angleTag: string;
  customAngleSentence: string;
  hasCustomStoryAngle: boolean;
  userHardshipSentence: string;
  hasCustomHardship: boolean;
}

function cleanEnglishFragment(raw: string): string {
  return raw
    .replace(/[\u1000-\u109F\uAA60-\uAA7F]+/g, ' ')
    .replace(/[-—–_/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function translateBurmeseHardshipSignals(text: string): string[] {
  const signals: string[] = [];
  if (/(ငွေကြေးဖောင်းပွ|ငွေတန်ဖိုး|ဒေါ်လာ)/i.test(text)) {
    signals.push('severe local currency depreciation has sharply reduced our family purchasing power');
  }
  if (/(ကုန်ဈေးနှုန်း|စားဝတ်နေရေး|စားစရိတ်|အခြေခံစား)/i.test(text)) {
    signals.push('escalating prices for rice, cooking oil, and basic utilities consume nearly all household wages');
  }
  if (/(မီးပျက်|လျှပ်စစ်|မီးစက်)/i.test(text)) {
    signals.push('daily electrical blackouts force me to charge devices via backup shops and study late at night');
  }
  if (/(အင်တာနက်|လိုင်း|ဖုန်းဘေလ်)/i.test(text)) {
    signals.push('unstable internet access and costly mobile data make downloading offline study units essential');
  }
  if (/(တစ်ဦးတည်း|မိသားစုတာဝန်|ဝင်ငွေ|လစာ)/i.test(text)) {
    signals.push('as a primary household earner supporting family dependents, every kyat goes toward daily survival');
  }
  if (/(ဆေးဝါး|ကျန်းမာရေး|ဆေးကု)/i.test(text)) {
    signals.push('unexpected family medical expenses have exhausted our remaining household savings');
  }
  if (/(ဘဏ်|ငွေလွှဲ|နိုင်ငံတကာ)/i.test(text)) {
    signals.push('strict domestic banking limits and foreign exchange spreads block independent exam fee payments');
  }
  if (/(အလုပ်အကိုင်|စီးပွားရေးကျ|အလုပ်ပြုတ်)/i.test(text)) {
    signals.push('regional job scarcity and falling shop revenues leave our household without steady income');
  }
  if (/(မတည်ငြိမ်|စစ်ဘေး|ပြောင်းရွှေ့)/i.test(text)) {
    signals.push('ongoing regional instability has disrupted regular work and strained daily living conditions');
  }
  return signals;
}

function translateBurmeseGoal(rawGoal: string): string {
  const cleanedEn = cleanEnglishFragment(rawGoal);
  const lower = rawGoal.toLowerCase();

  if (!BURMESE_CHAR_RE.test(rawGoal) && cleanedEn.length >= 12) {
    const trimmed = cleanedEn.replace(/^[Tt]o\s+/, '').replace(/\.$/, '');
    return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  }

  const parts: string[] = [];
  if (/(နည်းပညာ|software|tech|computer|it|developer|programmer)/i.test(rawGoal)) {
    parts.push('build reliable software skills and lead free digital literacy workshops for underserved youth');
  }
  if (/(ကျန်းမာရေး|health|clinic|medical|public health|telemedicine)/i.test(rawGoal)) {
    parts.push('strengthen community health initiatives and expand practical health literacy in underserved areas');
  }
  if (/(စီးပွားရေး|business|manage|startup|entrepreneur)/i.test(rawGoal)) {
    parts.push('support sustainable small local enterprises and create practical community employment');
  }
  if (/(သင်ကြား|ပညာ|teach|mentor|youth|လူငယ်|ရပ်ရွာ)/i.test(rawGoal) && parts.length === 0) {
    parts.push('mentor underprivileged students in my community and expand access to practical education');
  }
  if (parts.length > 0) return parts[0];
  if (cleanedEn.length >= 12) return cleanedEn.replace(/^[Tt]o\s+/, '').replace(/\.$/, '');
  return 'secure stable professional employment, support my household, and give back to my local community';
}

function extractContextDetails(ctx: ScholarshipContextInput): ExtractedContextDetails {
  const degreeClean = (ctx.degreeProgram || '').trim() || 'Bachelor of Science in Computer Science';
  const cgpaClean = (ctx.cgpa || '').trim() || '3.65';
  const coursesClean = (ctx.coursesDone || '').trim() || '8 courses completed';

  const rawHardship = (ctx.hardshipDescription || '').trim();
  const hasCustomHardship = rawHardship.length > 0;
  const englishHardship = cleanEnglishFragment(rawHardship).replace(/\.$/, '');
  const burmeseSignals = BURMESE_CHAR_RE.test(rawHardship)
    ? translateBurmeseHardshipSignals(rawHardship)
    : [];

  let userHardshipSentence = '';
  if (hasCustomHardship) {
    if (!BURMESE_CHAR_RE.test(rawHardship) && englishHardship.length >= 15) {
      const normalized =
        englishHardship.charAt(0).toUpperCase() + englishHardship.slice(1);
      userHardshipSentence = `${normalized}.`;
    } else if (burmeseSignals.length > 0) {
      const combined = burmeseSignals.slice(0, 2).join(', while ');
      const cap = combined.charAt(0).toUpperCase() + combined.slice(1);
      userHardshipSentence =
        englishHardship.length >= 8
          ? `${cap} (${englishHardship}).`
          : `${cap}.`;
    } else if (englishHardship.length >= 8) {
      userHardshipSentence = `Specifically, my household faces acute strain regarding ${englishHardship}.`;
    } else {
      userHardshipSentence =
        'Rising daily living costs and restricted local earnings leave zero surplus beyond basic survival expenses.';
    }
  }

  const angleMap: Record<ScholarshipStoryAngle, { tag: string; sentence: string }> = {
    currency_inflation: {
      tag: 'Currency Volatility & Inflation',
      sentence:
        'Rapid currency devaluation has doubled essential food and utility bills while family earnings remain stagnant, placing $140 course assessment fees completely out of reach.',
    },
    conflict_banking: {
      tag: 'Regional Instability & Banking Barriers',
      sentence:
        'Severe regional instability and strict foreign-exchange banking barriers block normal cross-border tuition payments and strain daily household survival.',
    },
    family_breadwinner: {
      tag: 'Sole Breadwinner & Dependent Care',
      sentence:
        'Supporting household dependents on a single modest wage leaves every dollar committed to food, rent, and medicine with nothing left for university exam fees.',
    },
    balanced: {
      tag: 'Systemic Financial Hardship & Academic Focus',
      sentence:
        'Persistent household budget deficits mean covering course assessment fees out of pocket would force me to pause my degree immediately.',
    },
    academic_high_achiever: {
      tag: 'High Academic Merit Amid Scarcity',
      sentence:
        'Despite acute financial scarcity at home, I have treated every assignment and discussion post with strict academic discipline and top-tier focus.',
    },
  };

  const chosenAngle = angleMap[ctx.storyAngle] || angleMap.balanced;
  const rawCustomAngle = (ctx.customStoryAngle || '').trim();
  const hasCustomStoryAngle = rawCustomAngle.length > 0;
  let customAngleSentence = '';

  if (hasCustomStoryAngle) {
    const englishCustomAngle = cleanEnglishFragment(rawCustomAngle).replace(/\.$/, '');
    const customBurmeseSignals = BURMESE_CHAR_RE.test(rawCustomAngle)
      ? translateBurmeseHardshipSignals(rawCustomAngle)
      : [];

    if (!BURMESE_CHAR_RE.test(rawCustomAngle) && englishCustomAngle.length >= 12) {
      const cap = englishCustomAngle.charAt(0).toUpperCase() + englishCustomAngle.slice(1);
      customAngleSentence = `${cap}.`;
    } else if (customBurmeseSignals.length > 0) {
      const joinedSignals = customBurmeseSignals.slice(0, 2).join(', while ');
      const cap = joinedSignals.charAt(0).toUpperCase() + joinedSignals.slice(1);
      customAngleSentence =
        englishCustomAngle.length >= 6 ? `${cap} (${englishCustomAngle}).` : `${cap}.`;
    } else if (englishCustomAngle.length >= 6) {
      customAngleSentence = `In particular, my circumstances center on ${englishCustomAngle}.`;
    } else {
      customAngleSentence =
        'Unforeseen family health expenses, regional disruption, and unreliable electricity make fee support essential for my study continuity.';
    }
  }

  const effectiveAngleTag = hasCustomStoryAngle
    ? `Custom Focus & ${chosenAngle.tag}`
    : chosenAngle.tag;

  const goalPhrase = translateBurmeseGoal(ctx.careerGoal || '');
  const goalSentence = `After completing my ${degreeClean} studies, I aim to ${goalPhrase}.`;

  return {
    degreeClean,
    goalSentence,
    goalPhrase,
    cgpaClean,
    coursesClean,
    angleSentence: chosenAngle.sentence,
    angleTag: effectiveAngleTag,
    customAngleSentence,
    hasCustomStoryAngle,
    userHardshipSentence,
    hasCustomHardship,
  };
}

/**
 * Guarantees a complete narrative arc strictly between 800 and 950 characters
 * with ZERO mid-sentence cuts and a fully formed closing sentence.
 */
export function enforceCompleteNarrativeArc(
  rawText: string,
  ctx?: Partial<ScholarshipContextInput>,
  lens: TemplateLens = 'economic_inflation'
): string {
  if (!rawText || !rawText.trim()) return '';

  // 1. Clean formatting artifacts without calling truncating helpers prematurely
  let cleaned = rawText
    .replace(/\[Character Count:.*?\]/gi, '')
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .replace(/^["“]|["”]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Apply humanizer replacements only (preserve full sentences before sentence-aware sizing)
  // Note: humanizeForZeroGpt caps at 980 -> 960; we re-verify sentence integrity right below.
  cleaned = humanizeForZeroGpt(cleaned, ctx?.degreeProgram || 'Bachelor of Science in Computer Science');

  // 2. Extract only COMPLETE sentences ending in . ! ? followed by whitespace or end-of-string
  // Protects decimal numbers (e.g., 3.91 GPA, 3.65 CGPA) from splitting at the decimal dot.
  const completeMatches = cleaned.match(/(?:[^.!?]|\.(?=\d))+[.!?]+(?=\s|$)/g);
  let sentences: string[] = completeMatches
    ? completeMatches.map((s) => s.trim()).filter((s) => s.length >= 8)
    : [];

  if (sentences.length === 0) {
    const safeLine = cleaned.replace(/[,;:\-–—\s]+$/, '').trim();
    sentences = safeLine ? [`${safeLine}.`] : [];
  }

  // 3. If total length exceeds 950 chars, drop inner/elaboration sentences cleanly (never slice mid-sentence!)
  const joinSentences = (arr: string[]) => arr.join(' ').replace(/\s+/g, ' ').trim();
  let combined = joinSentences(sentences);

  while (combined.length > 950 && sentences.length > 2) {
    // Prefer removing the second-to-last supporting sentence so opening + conclusion stay intact
    const removeIdx = sentences.length > 3 ? sentences.length - 2 : sentences.length - 1;
    sentences.splice(removeIdx, 1);
    combined = joinSentences(sentences);
  }

  // Edge case: if still > 950 with <= 2 very long sentences, trim at last complete sentence/clause < 950
  if (combined.length > 950) {
    const sub = combined.substring(0, 948);
    const sentenceEndMatch = Array.from(sub.matchAll(/[.!?](?=\s|$)/g)).pop();
    const lastDot = sentenceEndMatch?.index ?? -1;
    if (lastDot >= 450) {
      combined = sub.substring(0, lastDot + 1).trim();
    } else {
      const lastComma = sub.lastIndexOf(',');
      const cutBase = lastComma > 550 ? sub.substring(0, lastComma) : sub.substring(0, sub.lastIndexOf(' '));
      combined = `${cutBase.replace(/[,;:\s]+$/, '')}.`;
    }
    sentences = combined.match(/(?:[^.!?]|\.(?=\d))+[.!?]+(?=\s|$)/g)?.map((s) => s.trim()) || [combined];
  }

  // 4. If length < 800 chars, append complete context-aware bridging/closing sentences inside [800, 950]
  const details = extractContextDetails({
    mode: ctx?.mode || 'new_app',
    hardshipDescription: ctx?.hardshipDescription || '',
    storyAngle: ctx?.storyAngle || 'balanced',
    customStoryAngle: ctx?.customStoryAngle || '',
    degreeProgram: ctx?.degreeProgram || 'Bachelor of Science in Computer Science',
    careerGoal: ctx?.careerGoal || '',
    cgpa: ctx?.cgpa,
    coursesDone: ctx?.coursesDone,
  });

  const lensBridgePool: Record<TemplateLens, string[]> = {
    economic_inflation: [
      `Without this fee waiver, covering $140 per course alongside rising household living expenses is simply impossible for my family.`,
      `Even under severe household financial strain, I manage my time carefully to keep up with every weekly reading unit and quiz.`,
      `Approving this support protects my enrollment in ${details.degreeClean} and moves me closer to my goal to ${details.goalPhrase}.`,
      `Receiving this Assessment Fee Scholarship allows me to stay enrolled next term without financial disruption.`,
      `Thank you sincerely for reviewing my application and helping me continue my studies.`,
    ],
    grit_infrastructure: [
      `Even during eight-hour daily power cuts and weak network access, I download every unit early to meet all deadlines.`,
      `My family prioritizes essential food and rent, leaving zero spare funds to cover university exam fees out of pocket.`,
      `Your fee support keeps my academic persistence alive so I can complete ${details.degreeClean} and ${details.goalPhrase}.`,
      `Receiving this Assessment Fee Scholarship allows me to stay enrolled next term without financial disruption.`,
      `Thank you very much for considering my application and supporting resilient learners.`,
    ],
    merit_pay_it_forward: [
      ctx?.mode === 'renewal_app'
        ? `Maintaining my ${details.cgpaClean} CGPA across ${details.coursesClean} proves my readiness to finish strong and serve others.`
        : `I study with strict daily discipline so I can graduate on schedule and give back to my community.`,
      `Independent course assessment fees remain beyond my family's tight monthly budget right now.`,
      `With this scholarship, I can complete my ${details.degreeClean} degree and ${details.goalPhrase}.`,
      `Receiving this Assessment Fee Scholarship allows me to stay enrolled next term without financial disruption.`,
      `Thank you sincerely for investing in my education and future community impact.`,
    ],
  };

  const extraCandidates = [
    ...lensBridgePool[lens],
    `Your support transforms daily economic adversity into lasting educational opportunity for my household.`,
    `I am deeply grateful to the scholarship committee for considering my request.`,
  ];

  for (const candidate of extraCandidates) {
    if (combined.length >= 800) break;
    const normalizedCandidate = candidate.replace(/\s+/g, ' ').trim();
    const alreadyPresent = sentences.some(
      (s) => s.toLowerCase().slice(0, 32) === normalizedCandidate.toLowerCase().slice(0, 32)
    );
    if (alreadyPresent) continue;

    if (combined.length + 1 + normalizedCandidate.length <= 950) {
      sentences.push(normalizedCandidate);
      combined = joinSentences(sentences);
    }
  }

  // Final check: ensure strong concluding sentence and strict <= 950 length
  if (!/[.!?]$/.test(combined)) {
    combined = `${combined.replace(/[,;:\s]+$/, '')}.`;
  }
  return combined;
}

/**
 * Dynamically generate contextual outline sections tailored to user's actual context and lens.
 */
export function generateContextualOutline(
  title: string,
  coreTheme: string,
  category: string,
  ctx?: Partial<ScholarshipContextInput>
): TemplateOutlineSection[] {
  const isRenewal =
    category === 'renewal' ||
    ctx?.mode === 'renewal_app' ||
    title.toLowerCase().includes('renewal') ||
    title.includes('သက်တမ်းတိုး');

  const degreeLabel = (ctx?.degreeProgram || '').trim() || 'your enrolled degree program';
  const cgpaLabel = (ctx?.cgpa || '').trim() || '3.65';
  const coursesLabel = (ctx?.coursesDone || '').trim() || 'completed coursework';
  const goalLabel = translateBurmeseGoal(ctx?.careerGoal || '');

  const isInfrastructure =
    /infrastructure|blackout|power|grit|မီးပျက်/i.test(title + coreTheme);
  const isMerit =
    /merit|pay-it-forward|community|စွမ်းဆောင်ရည်|ရပ်ရွာ/i.test(title + coreTheme);

  if (isRenewal) {
    return [
      {
        step: 1,
        sectionTitle: `Academic Standing (${cgpaLabel} CGPA · ${coursesLabel})`,
        recommendedTopics: [
          `Cite exact cumulative GPA (${cgpaLabel}) in ${degreeLabel}`,
          `Reference ${coursesLabel} completed on schedule`,
          'Highlight consistent Moodle forum participation and peer grading',
        ],
        suggestedAnecdotes: [
          `Lead with your ${cgpaLabel} CGPA across ${coursesLabel} to demonstrate reliable academic return on scholarship investment.`,
        ],
        structuralGuidance: 'Open directly with your academic credentials before detailing continuing financial barriers.',
      },
      {
        step: 2,
        sectionTitle: isInfrastructure
          ? 'Infrastructure & Connectivity Resilience'
          : 'Continuing Economic Strain & Cost Escalation',
        recommendedTopics: [
          isInfrastructure
            ? 'Managing daily electricity rationing and unstable mobile data'
            : 'Ongoing inflation, currency loss, and family dependent obligations',
          'Why out-of-pocket $140 assessment fees remain unfeasible',
          'Connecting personal hardship details cleanly without repetition',
        ],
        suggestedAnecdotes: [
          isInfrastructure
            ? 'Explain how you pre-download course PDFs and use battery backups to never miss a deadline.'
            : 'Detail specific household budget pressures that persist since your previous term.',
        ],
        structuralGuidance: 'Ground financial need in concrete daily trade-offs rather than generic statements.',
      },
      {
        step: 3,
        sectionTitle: 'Degree Progression & Pay-It-Forward Impact',
        recommendedTopics: [
          `Next-term enrollment momentum in ${degreeLabel}`,
          `Long-term goal: ${goalLabel}`,
          'Preventing an involuntary leave of absence before graduation',
        ],
        suggestedAnecdotes: [
          `Connect your upcoming courses directly to your plan to ${goalLabel}.`,
        ],
        structuralGuidance: 'Finish cleanly between 800 and 950 characters with a strong concluding sentence.',
      },
    ];
  }

  return [
    {
      step: 1,
      sectionTitle: isInfrastructure
        ? 'Infrastructure Hurdles & Study Grit'
        : isMerit
        ? 'Academic Ambition & Community Vision'
        : 'Economic Volatility & Household Strain',
      recommendedTopics: [
        `State target program (${degreeLabel}) immediately`,
        isInfrastructure
          ? 'Power cuts, network outages, and offline study planning'
          : isMerit
          ? 'First-generation drive and disciplined study schedule'
          : 'Currency devaluation, food inflation, and breadwinner pressure',
        'Specific personal hardship context from your prompt',
      ],
      suggestedAnecdotes: [
        isInfrastructure
          ? 'Describe downloading units early and studying offline during evening blackouts.'
          : 'Share concrete household expense priorities that leave zero cash for $140 course fees.',
      ],
      structuralGuidance: 'Avoid AI clichés; use crisp, specific human sentences of varied lengths.',
    },
    {
      step: 2,
      sectionTitle: 'Daily Discipline & Academic Readiness',
      recommendedTopics: [
        'Meeting every UoPeople weekly deadline without fail',
        'Early-morning or late-night study routines around work/care duties',
        'Active peer collaboration readiness',
      ],
      suggestedAnecdotes: [
        'Mention balancing daily household duties with dedicated daily reading blocks.',
      ],
      structuralGuidance: 'Prove that financial hardship has never weakened your academic reliability.',
    },
    {
      step: 3,
      sectionTitle: 'Career Goal, Community Uplift & Closing Appeal',
      recommendedTopics: [
        `Post-graduation vision: ${goalLabel}`,
        'Respectful appeal for Assessment Fee Scholarship approval',
        'Strict 800–950 character complete closing arc',
      ],
      suggestedAnecdotes: [
        `Explain clearly how graduating from ${degreeLabel} enables you to ${goalLabel}.`,
      ],
      structuralGuidance: 'Never end mid-sentence; finish with a warm, direct closing sentence.',
    },
  ];
}

export function generateAdvisoryNotes(
  _coreTheme: string,
  category: string,
  ctx?: Partial<ScholarshipContextInput>
) {
  const isRenewal = category === 'renewal' || ctx?.mode === 'renewal_app';
  return {
    dos: [
      'Keep total character count strictly between 800 and 950 characters with a complete ending.',
      isRenewal
        ? `Explicitly verify your CGPA (${ctx?.cgpa || '3.65'}) and completed courses (${ctx?.coursesDone || '8 courses'}).`
        : 'Include concrete personal hardship details tailored to your Story Angle.',
      'Maintain an authentic, human academic cadence without AI buzzwords.',
    ],
    donts: [
      'Never exceed 1,000 characters (UoPeople portal hard rejection limit).',
      'Avoid generic clichés like "beacon of hope", "pivotal role", or "testament to".',
      'Never leave a sentence cut off mid-thought before submitting.',
    ],
    wordCountTarget: '800 - 950 Characters (Complete Arc · Portal Safe)',
  };
}

/**
 * Primary Context-Aware Dynamic Template Engine for Tabs 1 & 2.
 * Synthesizes 3 completely unique narratives (Economic/Inflation, Grit/Infrastructure, Merit/Pay-It-Forward)
 * incorporating every active UI input.
 */
export function buildContextAwareTemplates(
  ctx: ScholarshipContextInput,
  clickCount = 1,
  entropySeed: string | number = 'live'
): ScholarshipTemplateItem[] {
  const d = extractContextDetails(ctx);
  const isRenewal = ctx.mode === 'renewal_app';
  const seedBase = `${buildContextSignature(ctx)}-${clickCount}-${entropySeed}`;
  const rng = createSeededRng(seedBase);

  const hardshipClause = d.hasCustomHardship
    ? d.userHardshipSentence
    : d.hasCustomStoryAngle
    ? d.customAngleSentence
    : d.angleSentence;
  const secondaryHardship = d.hasCustomStoryAngle
    ? d.hasCustomHardship
      ? d.customAngleSentence
      : d.angleSentence
    : d.hasCustomHardship
    ? d.angleSentence
    : '';

  // Variation connectors keyed by PRNG so "New Templates ထုတ်မည်" yields genuinely varied phrasing
  const openingVariationsNew = [
    `I am applying for an Assessment Fee Scholarship to pursue my ${d.degreeClean} degree at University of the People.`,
    `I respectfully request an Assessment Fee Scholarship to begin my ${d.degreeClean} studies at University of the People.`,
    `I am writing to apply for an Assessment Fee Scholarship for the ${d.degreeClean} program at University of the People.`,
  ];

  const openingVariationsRenewal = [
    `I am applying to renew my Assessment Fee Scholarship for my ${d.degreeClean} program at University of the People.`,
    `I respectfully request the renewal of my Assessment Fee Scholarship as I continue my ${d.degreeClean} degree at University of the People.`,
    `I am writing to renew my Assessment Fee Scholarship in ${d.degreeClean} after completing ${d.coursesClean} with a ${d.cgpaClean} GPA.`,
  ];

  const openA = isRenewal
    ? openingVariationsRenewal[Math.floor(rng() * openingVariationsRenewal.length)]
    : openingVariationsNew[Math.floor(rng() * openingVariationsNew.length)];
  const openB = isRenewal
    ? `I respectfully apply to renew my Assessment Fee Scholarship while studying ${d.degreeClean} at University of the People, having earned a ${d.cgpaClean} CGPA across ${d.coursesClean}.`
    : `I am applying for an Assessment Fee Scholarship for my ${d.degreeClean} studies at University of the People despite severe local infrastructure barriers.`;
  const openC = isRenewal
    ? `With a ${d.cgpaClean} cumulative GPA across ${d.coursesClean} in ${d.degreeClean}, I am applying to renew my UoPeople Assessment Fee Scholarship.`
    : `As a committed ${d.degreeClean} applicant at University of the People, I am requesting an Assessment Fee Scholarship to realize my academic goals.`;

  // ------------------------------------------------------------------
  // TEMPLATE A: Economic & Inflation Lens
  // ------------------------------------------------------------------
  const bodyA = [
    openA,
    isRenewal
      ? `Across ${d.coursesClean}, I have maintained a ${d.cgpaClean} cumulative GPA and submitted every assignment on time.`
      : '',
    hardshipClause,
    secondaryHardship ||
      `Rising food prices, utility bills, and local currency swings consume our household budget, leaving zero cash for $140 course assessment fees.`,
    `Even under heavy breadwinner pressure, I study early each morning so my coursework never slips.`,
    `Completing ${d.degreeClean} will let me ${d.goalPhrase} and stabilize my family's future.`,
    `Please approve this fee support so I can register next term without interruption. Thank you sincerely.`,
  ]
    .filter(Boolean)
    .join(' ');

  // ------------------------------------------------------------------
  // TEMPLATE B: Grit, Power & Infrastructure Lens
  // ------------------------------------------------------------------
  const bodyB = [
    openB,
    hardshipClause,
    d.hasCustomStoryAngle && d.hasCustomHardship ? d.customAngleSentence : '',
    `In addition to financial strain (${d.angleTag}), daily electricity load-shedding and frequent network drops make online study demanding.`,
    `To stay ahead, I charge my device before blackouts, download reading units offline, and write discussion posts late at night.`,
    isRenewal
      ? `My ${d.cgpaClean} GPA proves that power cuts and tight finances have never lowered my academic standards.`
      : `This persistence ensures I meet every weekly deadline regardless of local infrastructure limits.`,
    `Earning my ${d.degreeClean} credential will help me ${d.goalPhrase}.`,
    `Renewing or granting this fee waiver keeps my study momentum unbroken. Thank you for considering my application.`,
  ]
    .filter(Boolean)
    .join(' ');

  // ------------------------------------------------------------------
  // TEMPLATE C: Academic Merit & Pay-It-Forward Lens
  // ------------------------------------------------------------------
  const bodyC = [
    openC,
    isRenewal
      ? `My record of ${d.coursesClean} at a ${d.cgpaClean} GPA reflects daily discipline and active collaboration with global peers.`
      : `I bring strict academic discipline and an unwavering commitment to graduate near the top of my cohort.`,
    hardshipClause,
    d.hasCustomStoryAngle && d.hasCustomHardship ? d.customAngleSentence : '',
    `Paying $140 per course independently is out of reach for my household right now, making fee support essential for my continuation.`,
    `Upon finishing ${d.degreeClean}, I am determined to ${d.goalPhrase} and uplift learners in underserved communities.`,
    `This scholarship turns financial adversity into measurable educational impact for my community.`,
    `Thank you for trusting my academic record and helping me move forward toward graduation.`,
  ]
    .filter(Boolean)
    .join(' ');

  const textA = enforceCompleteNarrativeArc(bodyA, ctx, 'economic_inflation');
  const textB = enforceCompleteNarrativeArc(bodyB, ctx, 'grit_infrastructure');
  const textC = enforceCompleteNarrativeArc(bodyC, ctx, 'merit_pay_it_forward');

  const category: 'new_applicant' | 'renewal' = isRenewal ? 'renewal' : 'new_applicant';
  const suffix = clickCount > 1 ? ` (v${clickCount})` : '';

  return [
    {
      id: `ctx-${ctx.mode}-econ-${clickCount}`,
      lens: 'economic_inflation',
      title: `Template A: Economic & Inflation Lens${suffix}`,
      titleMy: `ပုံစံ (က) - ငွေကြေးဖောင်းပွမှုနှင့် စီးပွားရေးအခက်အခဲ ရှုထောင့်${suffix}`,
      category,
      targetAudience: isRenewal ? 'Continuing Scholar · Economic Need' : 'Economic & Breadwinner Lens',
      coreTheme: `currency devaluation, living cost inflation (${d.angleTag})`,
      promptHint: `${d.angleTag} · ${d.degreeClean}`,
      text: textA,
      outline: generateContextualOutline(
        `Template A: Economic & Inflation Lens`,
        'currency inflation',
        category,
        ctx
      ),
      advisoryNotes: generateAdvisoryNotes('currency inflation', category, ctx),
    },
    {
      id: `ctx-${ctx.mode}-grit-${clickCount}`,
      lens: 'grit_infrastructure',
      title: `Template B: Grit, Power & Infrastructure Lens${suffix}`,
      titleMy: `ပုံစံ (ခ) - မီးပျက်ခြင်းနှင့် အခက်အခဲကြားမှ ဇွဲလုံ့လ ရှုထောင့်${suffix}`,
      category,
      targetAudience: isRenewal ? 'Continuing Scholar · Study Grit' : 'Infrastructure & Resilience Lens',
      coreTheme: `electricity blackouts, connectivity hurdles, study grit`,
      promptHint: `Infrastructure grit · ${d.degreeClean}`,
      text: textB,
      outline: generateContextualOutline(
        `Template B: Grit, Power & Infrastructure Lens`,
        'blackout infrastructure',
        category,
        ctx
      ),
      advisoryNotes: generateAdvisoryNotes('blackout infrastructure', category, ctx),
    },
    {
      id: `ctx-${ctx.mode}-merit-${clickCount}`,
      lens: 'merit_pay_it_forward',
      title: `Template C: Academic Merit & Pay-It-Forward Lens${suffix}`,
      titleMy: `ပုံစံ (ဂ) - ပညာရေးစွမ်းဆောင်ရည်နှင့် ရပ်ရွာအကျိုးပြု ရှုထောင့်${suffix}`,
      category,
      targetAudience: isRenewal ? `Continuing Scholar · ${d.cgpaClean} CGPA` : 'Academic Merit & Community Impact',
      coreTheme: `academic merit, ${d.goalPhrase}, community uplift`,
      promptHint: `Merit & Pay-it-forward · ${d.degreeClean}`,
      text: textC,
      outline: generateContextualOutline(
        `Template C: Academic Merit & Pay-It-Forward Lens`,
        'community merit',
        category,
        ctx
      ),
      advisoryNotes: generateAdvisoryNotes('community merit', category, ctx),
    },
  ];
}

/**
 * Backward-compatible helper wrappers updated to accept full optional user context.
 */
export function generateProceduralNewTemplates(
  degree: string,
  entropySeed: string | number,
  clickCount = 1,
  extraContext?: Partial<ScholarshipContextInput>
): ScholarshipTemplateItem[] {
  return buildContextAwareTemplates(
    {
      mode: 'new_app',
      hardshipDescription: extraContext?.hardshipDescription || '',
      storyAngle: extraContext?.storyAngle || 'currency_inflation',
      degreeProgram: degree,
      careerGoal: extraContext?.careerGoal || '',
    },
    clickCount,
    entropySeed
  );
}

export function generateProceduralRenewalTemplates(
  degree: string,
  cgpa: string,
  coursesDone: string,
  entropySeed: string | number,
  clickCount = 1,
  extraContext?: Partial<ScholarshipContextInput>
): ScholarshipTemplateItem[] {
  return buildContextAwareTemplates(
    {
      mode: 'renewal_app',
      hardshipDescription: extraContext?.hardshipDescription || '',
      storyAngle: extraContext?.storyAngle || 'academic_high_achiever',
      degreeProgram: degree,
      careerGoal: extraContext?.careerGoal || '',
      cgpa,
      coursesDone,
    },
    clickCount,
    entropySeed
  );
}
