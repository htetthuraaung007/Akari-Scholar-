export interface ResolvedAcademicAction {
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
  images?: { base64?: string; dataUrl?: string; mimeType?: string }[];
}

export function resolveAcademicActionRequest(
  action: string,
  payload: Record<string, any> = {},
  targetLanguage: string = 'my'
): ResolvedAcademicAction {
  const defaultSystemInstruction = `You are "Akari Scholar", an elite University Academic & Research AI Mentor built for university students (especially University of the People - UoPeople, international scholarship applicants, and researchers).
- Maintain highest academic rigor, critical thinking, and APA 7th edition accuracy.
- Promote Academic Integrity: guide students with structured outlines, Socratic questioning, constructive critiques, and transparent scholarly synthesis rather than encouraging blind plagiarism.
- Language preference: Respond in clear academic English for templates/citations/essays, and provide helpful explanations in ${
    targetLanguage === 'my' ? 'Burmese (မြန်မာဘာသာ) alongside English terminology' : 'English'
  } when explaining concepts or giving feedback.`;

  let prompt = '';
  let responseMimeType: string | undefined = payload.responseMimeType;
  const systemInstruction = payload.systemInstruction || defaultSystemInstruction;
  const maxOutputTokens = payload.maxOutputTokens || 2048;
  const temperature = typeof payload.temperature === 'number' ? payload.temperature : undefined;
  const images: { base64?: string; dataUrl?: string; mimeType?: string }[] = Array.isArray(payload.images)
    ? [...payload.images]
    : [];

  if (payload.imageBase64 && typeof payload.imageBase64 === 'string') {
    images.push({
      base64: payload.imageBase64,
      mimeType: payload.imageMimeType || 'image/jpeg',
    });
  }

  switch (action) {
    case 'direct_assist': {
      prompt = payload.prompt || payload.text || 'Hello';
      responseMimeType = payload.responseMimeType;
      break;
    }

    case 'methodology_stats': {
      const textContent = (payload.content || payload.text || '').slice(0, 18000);
      prompt = `You are a Principal Research Methodologist and Biostatistician.
Analyze the following academic text or research paper and extract its methodological and statistical architecture in strictly valid JSON:
---
${textContent}
---
Return ONLY valid JSON matching this schema:
{
  "studyDesign": "Detailed description of research design (e.g., Randomized Controlled Trial, Cross-Sectional Survey, Qualitative Phenomenology, Mixed-Methods)",
  "samplingAndPopulation": "Sample size (N), target population, inclusion/exclusion criteria, and sampling technique",
  "variablesAndMeasures": {
    "independent": ["Independent variable / predictor 1"],
    "dependent": ["Dependent variable / outcome 1"],
    "controlsOrConfounders": ["Control or confounding variable 1"]
  },
  "statisticalTestsUsed": [
    {
      "testName": "e.g., Multiple Linear Regression / ANOVA / Chi-Square",
      "purpose": "Why this test was used in the study",
      "reportedMetrics": "Exact p-values, effect sizes, confidence intervals, or test statistics reported"
    }
  ],
  "plainLanguageInterpretation": "Clear English and Burmese explanation of what the statistical findings actually prove in practice",
  "methodologicalLimitations": [
    "Specific threat to internal/external validity, sample bias, or measurement limitation"
  ]
}`;
      responseMimeType = 'application/json';
      break;
    }

    case 'reader_quiz': {
      const textContent = (payload.content || payload.text || '').slice(0, 18000);
      prompt = `You are a University Professor creating a comprehension & critical-thinking quiz from this academic reading:
---
${textContent}
---
Return ONLY valid JSON matching this exact schema:
{
  "questions": [
    {
      "question": "Challenging conceptual or methodological question based strictly on the text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Detailed academic rationale explaining why the correct answer is right and why distractors are wrong (with Burmese summary)"
    }
  ]
}`;
      responseMimeType = 'application/json';
      break;
    }

    case 'dual_language_summary': {
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
    }

    case 'rubric_breakdown': {
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
    }

    case 'outline_analysis': {
      const textPayload = payload.textPayload || payload.rubricText || payload.text || payload.content || '';
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
${String(textPayload).substring(0, 4000)}`;
      responseMimeType = 'application/json';
      break;
    }

    case 'draft_critique':
    case 'instructor_evaluation': {
      prompt = `You are an expert Academic Evaluator, Assignment Reviewer, and University Course Instructor.
Analyze and evaluate the student assignment thoroughly against academic rubrics and grading standards.

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
    }

    case 'draft_rubric_audit': {
      const targetRubric =
        (payload.targetRubric || payload.rubricText || '').trim() ||
        'Standard UoPeople A-Grade Rubric: Depth of analysis, logical synthesis, empirical evidence, APA citations, cohesive structure.';
      const instructorPersona =
        (payload.instructorPersona || '').trim() ||
        'Standard academic evaluator focusing on logic, thesis, and evidence synthesis.';
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
      const inquirerType =
        payload.inquirerType === 'Classmate' || payload.interlocutorType === 'classmate'
          ? 'Classmate'
          : 'Instructor';
      const theirQuestion = (
        payload.theirQuestion ||
        payload.questionText ||
        payload.question ||
        ''
      )
        .trim()
        .slice(0, 1500);

      prompt = `You are a Confident University Scholar responding to a follow-up inquiry on your discussion post.
Respondent target: ${
        inquirerType === 'Instructor'
          ? 'Professor/Instructor (Strict academic rigor, respect, citing foundational course concepts)'
          : 'Peer Classmate (Collegial, collaborative, insightful)'
      }.
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
      const isAggressive = payload.intensity !== 'standard';
      const variation = payload.variation || 1;
      prompt = `You are an elite academic prose stylist, computational linguist, and adversarial humanizer.
Your mission is to completely transform the student's text so that it scores STRICTLY 0% AI DETECTION on detectors (GPTZero, Turnitin AI detector, CopyLeaks, ZeroGPT, Winston AI) and reads 100% as written by an astute human scholar.

MODE / INTENSITY: ${
        isAggressive
          ? 'Aggressive (0% AI Focus - Radical Sentence Restructuring & Extreme Burstiness)'
          : 'Standard (Polished Academic Tone & Active Voice)'
      }
VARIATION CYCLING: #Variation-${variation}

CRITICAL DIRECTIVES FOR 0% AI DETECTION (100% HUMAN SCORE):
1. RADICAL BURSTINESS (Sentence Length Variance):
   - In every paragraph, integrate ultra-short punchy sentences (3 to 7 words) right next to winding, multi-clause compound sentences (28 to 42 words).
2. TOTAL PURGE OF AI SIGNATURES & BUZZWORDS:
   - ZERO TOLERANCE for common LLM telltales: delve, pivotal, tapestry, testament, beacon, fosters, multifaceted, paramount, harness, realm, echoes, resonate, interplay, landscape, underscore, moreover, furthermore, in conclusion, undeniably, crucial, seamless, embark, vibrant, shed light, vital role, dynamic, cornerstone.
3. BAN ROBOTIC TRANSITIONAL FORMULAS:
   - Never start a sentence or paragraph with: "Furthermore,", "Moreover,", "Additionally,", "In conclusion,".
4. Retain every single in-text citation (e.g., Smith, 2021) and reference intact.

STUDENT DRAFT:
${payload.text}

OUTPUT FORMAT: Use clean Markdown with these exact sections:
### 🎓 Version A: Scholarly Precision (0% AI Detection / Formal Human-Academic)
### 🌿 Version B: Natural Human-Academic Flow (0% AI Detection / Expressive Human Voice)
### 💡 0% AI Detection Blueprint & Anti-Detection Diagnostics`;
      break;
    }

    case 'lesson_explainer': {
      const userContent = (payload.content || payload.text || '').slice(0, 20000);
      const hasImage = images.length > 0;
      prompt = `You are an elite bilingual academic professor and curriculum specialist at University of the People.
Analyze the following academic material (lecture slides, textbook excerpt, research study, problem sets, or diagrams) thoroughly:
"""
${userContent}
"""
${hasImage ? 'An accompanying academic diagram/slide/image has also been attached. Thoroughly synthesize both text and visual details.' : ''}

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
    "comprehensiveExplanation": "အသေးစိတ် မြန်မာလို ပြည့်စုံစွာ ရှင်းလင်းချက်...",
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
Do NOT add Markdown code fencing, preambles, or explanations.`;
      responseMimeType = 'application/json';
      break;
    }

    case 'generate_study_cards': {
      const rawCount = parseInt(payload.questionCount, 10);
      const count = Math.min(Math.max(isNaN(rawCount) ? 10 : rawCount, 1), 30);
      const chapterScope = payload.chapterScope || 'Full academic paper / textbook section';
      const isNewAttempt = !!payload.isNewAttempt;
      const excludeQuestions = Array.isArray(payload.excludeQuestions)
        ? payload.excludeQuestions.filter((q: string) => typeof q === 'string' && q.trim().length > 0).slice(0, 20)
        : [];
      const sanitizedTextPayload = String(payload.content || '').trim().slice(0, 22000);

      prompt = `You are a distinguished university professor designing an authentic, comprehensive examination for University of the People (UoPeople).
Construct EXACTLY ${count} rigorous questions based strictly on the provided FULL-TEXT research material:

SCOPE & TOPIC FOCUS:
${chapterScope}
${
  isNewAttempt && excludeQuestions.length > 0
    ? `NEW ATTEMPT DIRECTIVE — Do NOT duplicate any of these previous questions:\n${excludeQuestions
        .map((q: string, idx: number) => `${idx + 1}. ${q}`)
        .join('\n')}\n`
    : ''
}
OUTPUT FORMAT (Strict Raw JSON Array, No Markdown code fences):
[
  {
    "id": "q1",
    "questionType": "mcq",
    "question": "Rigorous question text testing methodology, statistics, or theory...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "In-depth theoretical explanation contrasting correct mechanism against distractors...",
    "realWorldApplication": "1 concise sentence demonstrating practical or clinical/managerial relevance."
  }
]
"""
${sanitizedTextPayload}
"""`;
      responseMimeType = 'application/json';
      break;
    }

    case 'scholarship_review': {
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
2. Evaluation on 4 Pillars: Personal Agency & Leadership, Adversity/Resilience, Alignment & Future Contribution, Storytelling & Voice.
3. Line-by-line red flags.
4. Polished revision sample for the opening or weakest section.
Include Burmese strategic advice.`;
      break;
    }

    case 'citation_formatter': {
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
3. If any required APA 7th element is missing, specify what should be verified.`;
      break;
    }

    case 'socratic_tutor':
    case 'socratic_dialogue': {
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
    }

    case 'counter_arguments': {
      prompt = `The student is writing an academic research paper with the following Thesis Statement:
---
THESIS:
${payload.thesisStatement}
---
TASK:
Generate a rigorous academic defense plan:
1. 3 Powerful Counter-Arguments.
2. For each counter-argument, provide a substantive Rebuttal Strategy with suggested types of empirical evidence needed to refute it.
3. How addressing these counter-arguments elevates the paper into sophisticated scholarship.`;
      break;
    }

    case 'concept_simplifier': {
      prompt = `Explain the following academic/technical/scientific concept:
---
CONCEPT:
${payload.conceptText}
---
MODE: ${payload.mode === 'feynman' ? 'Feynman Technique (Explain to a 12-Year-Old)' : 'Academic Rigor Mode'}
TASK:
${
  payload.mode === 'feynman'
    ? '1. Eliminate all confusing jargon. 2. Use a vivid, everyday real-world analogy. 3. Explain the mechanism in plain simple language. 4. Provide a crystal-clear Burmese explanation (မြန်မာလို အရိုးရှင်းဆုံး ဥပမာဖြင့် ရှင်းလင်းချက်).'
    : '1. Formal scientific/academic definition. 2. Underlying theoretical axioms & mechanics. 3. Methodological significance. 4. Scholarly terminology in English and Burmese.'
}`;
      break;
    }

    case 'paper_qa': {
      prompt = `You are an expert research analyst. Analyze the following academic paper text and answer the student query with strict textual grounding:
---
PAPER EXCERPT:
${payload.paperText}
---
STUDENT QUERY:
${payload.query || 'Extract: Study Design, Sample Size & Population, Key Findings, Limitations, and Research Gaps.'}
---
TASK:
Provide a clear, evidence-based breakdown answering the query strictly from the text.`;
      break;
    }

    case 'annotated_bib': {
      prompt = `Create a complete APA 7th Annotated Bibliography entry for the following source:
---
SOURCE INFO:
${payload.sourceInfo}
---
TASK:
1. APA 7th Reference Citation.
2. Annotation Paragraph (approx. 150-180 words) covering summary, critical evaluation, and application to literature review.`;
      break;
    }

    case 'synthesis_matrix': {
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
    }

    case 'star_story_arc': {
      const {
        programGoal = 'Fulbright / Chevening / International Leadership Scholarship',
        promptText = '',
        situation = '',
        task = '',
        action: userAction = '',
        result = '',
        seed = Date.now(),
        variation = 1,
      } = payload;

      const effectiveStory = promptText
        ? `STUDENT'S LEADERSHIP STORY PROMPT (EN / MM):\n${promptText}`
        : `STRUCTURED STAR BREAKDOWN:
- Situation: ${situation}
- Task: ${task}
- Action: ${userAction}
- Result: ${result}`;

      prompt = `You are an elite international scholarship admissions consultant.
TASK: Transform the student's leadership or community impact story into a high-scoring STAR narrative essay (Situation, Task, Action, Result) for ${programGoal}.
STUDENT INPUT:
---
${effectiveStory}
---
VARIATION SEED: #${seed} (#${variation})
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
      } = payload;
      prompt = `You are a certified professional resume writer (CPRW).
Convert the student's academic background and projects into an ATS-Friendly Single-Column Résumé for ${targetRole} (Seed #${seed}):
---
${promptText || rawBackground}
---
Use clean markdown headings and the Google XYZ high-impact bullet framework.`;
      break;
    }

    case 'stats_explainer': {
      prompt = `You are an expert biostatistician and empirical research methodologist.
Demystify the following quantitative findings and statistical data in plain English and natural Burmese:
---
${payload.statsText}
---
Use headings:
### 📊 Key Statistical Findings at a Glance (အဓိက ကိန်းဂဏန်း အနှစ်ချုပ်)
### 🔍 Plain-English Breakdown of Key Metrics (p-value, CI, Effect Sizes)
### 🇲🇲 သုတေသန ရလဒ်များအား သဘာဝကျသော မြန်မာစကားပြေဖြင့် ရှင်းလင်းချက်
### ⚠️ Critical Limitations & Questions to Ask`;
      break;
    }

    case 'paraphrase': {
      const depth = payload.depth || 'academic';
      prompt = `You are a professional Academic Tone Polisher and Humanizer.
TASK: Paraphrase the following academic passage using "${depth}" mode in 100% academic English with zero AI clichés and intact citations:
${payload.text || payload.content || ''}`;
      break;
    }

    case 'paraphrase_depth': {
      const depth = payload.depth || 'academic_elevation';
      const variation = payload.variation || 1;
      prompt = `You are an expert academic prose stylist specializing in university-level writing and 0% AI detection.
PARAPHRASING DEPTH MODE: ${depth.toUpperCase()} (Variation #${variation})
Retain all in-text citations and factual claims while varying sentence cadence and eliminating AI buzzwords.
STUDENT ORIGINAL TEXT:
---
${payload.text}
---
Output the rewritten academic text followed by a brief 3-bullet summary titled "### 🔍 Revision Strategy & Academic Adjustments".`;
      break;
    }

    case 'word_count_adjust': {
      const delta = parseInt(payload.targetDelta, 10) || 50;
      const mode = payload.mode || (delta > 0 ? 'expand' : 'trim');
      const absDelta = Math.abs(delta);
      prompt = `You are a precision academic text editor.
TARGET ADJUSTMENT: ${mode === 'expand' ? `EXPAND BY APPROXIMATELY +${absDelta} WORDS` : `TRIM / CONDENSE BY APPROXIMATELY -${absDelta} WORDS`}
Retain central thesis, evidence, and every citation intact.
ORIGINAL TEXT:
---
${payload.text}
---`;
      break;
    }

    case 'cross_unit_synthesizer': {
      const currentTitle = payload.currentUnitTitle || payload.currentUnit || 'Current Assignment Activity';
      const currentNotes = payload.currentUnitNotes || payload.currentText || '';
      const pastTitle = payload.pastUnitsTitle || payload.pastUnits || 'Previous Academic Units';
      const pastNotes = payload.pastUnitsNotes || payload.pastContext || '';

      prompt = `You are an Elite Academic Research Scholar.
Synthesize theories, methods, and empirical evidence from past learning units into the student's current assignment.
Return ONLY a valid JSON object matching this schema:
{
  "currentAssignmentSummary": "1 sentence summarizing the core focus of the current paper.",
  "integratedPillars": [
    { "label": "e.g. Constructivist Framework", "unit": "Unit 2", "category": "Theory" }
  ],
  "pillarCards": [
    {
      "pillarType": "Theory",
      "title": "Clear Concept / Method / Theory Name",
      "sourceUnit": "e.g. Unit 2",
      "coreConcept": "1-2 crisp sentences defining the concept.",
      "applicationToCurrentWork": "2 sentences showing practical integration into the current assignment.",
      "criticalNuance": "1 sentence on methodological constraint or ethical consideration."
    }
  ],
  "readyToSubmitParagraph": "A cohesive academic synthesis paragraph (150-180 words) in scholarly English.",
  "rubricAlignmentTip": "1 concise sentence explaining how this synthesis satisfies the rubric."
}
[CURRENT ASSIGNMENT]: ${currentTitle}\n${String(currentNotes).substring(0, 2000)}
[PAST UNITS]: ${pastTitle}\n${String(pastNotes).substring(0, 2000)}`;
      responseMimeType = 'application/json';
      break;
    }

    case 'anxiety_grounding': {
      const lang = payload.language || 'my';
      const randomSeed = payload.seed || Date.now();
      prompt = `You are a compassionate, deeply practical university academic counselor and senior peer advisor at University of the People (UoPeople).
STUDENT'S CONCERN:
"${payload.concern || 'I feel overwhelmed by my coursework and anxious about my grades.'}"
LANGUAGE: ${lang === 'my' ? 'Natural spoken Burmese (စကားပြောဟန် သဘာဝအရေးအသား)' : 'Warm empathetic English'}
Seed: #${randomSeed}
Provide:
- 🌿 Honest Reassurance & Perspective tailored to their concern.
- 🎯 3 Concrete, Actionable Micro-Steps for UoPeople coursework.
- 💬 Warm Encouraging Mindset Shift.`;
      break;
    }

    case 'uopeople_scholarship':
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
      } = payload;
      const isRenewal = Boolean(payload.isRenewal || applicationType === 'renewal');
      const effectivePrompt =
        userPrompt ||
        userSituation ||
        payload.studentInfo?.hardship ||
        'Severe currency devaluation, elevated inflation, and family economic hardship.';

      prompt = `You are a world-class university scholarship mentor.
Write an authentic, human-written Assessment Fee Scholarship application essay for the University of the People portal.
- Category: ${isRenewal ? 'SCHOLARSHIP RENEWAL' : 'NEW SCHOLARSHIP APPLICATION'}
- Degree Program: ${degreeProgram}
- CGPA: ${studentCgpa} (${coursesDone})
- Focus Angle: ${focusAngle}
- Career Goals: ${careerGoals}
- Circumstances: ${effectivePrompt}
- Seed: #${seed}
STRICT HARD CONSTRAINT: Output ONLY a single flowing essay paragraph strictly between 750 and 950 characters (including spaces), never exceeding 1,000 characters, with zero AI clichés.`;
      break;
    }

    case 'scholarship_dynamic_templates': {
      const {
        applicationType = 'new',
        degreeProgram = 'Bachelor of Science in Computer Science',
        seed = Date.now(),
      } = payload;
      prompt = `Generate 3 fresh, non-formulaic Assessment Fee Scholarship templates for UoPeople (${applicationType}, ${degreeProgram}, Seed #${seed}).
Each essay text MUST be strictly between 750 and 950 characters.
Output strict JSON:
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
      prompt = `Draft a courteous, persuasive email to UoPeople Program Advisor ${advisorName} from ${studentName} (ID: ${studentId}, ${degreeProgram}, CGPA: ${cgpa}, completed: ${coursesDone}, upcoming plan: ${termPlan}) requesting authorization to unlock and renew the Assessment Fee Scholarship form. Additional context: ${customNotesPrompt || 'Standard renewal'}. Seed: #${seed}. Output a clean SUBJECT line and email body.`;
      break;
    }

    case 'scholarship_intl_evaluator': {
      const { essayText = '', scholarshipName = 'University Scholarship' } = payload;
      prompt = `Evaluate this scholarship essay for ${scholarshipName} (${essayText.length} characters):
"""
${essayText}
"""
Provide Markdown sections:
### 🏆 Admissions Committee Verdict & Score
### 📊 Rubric Breakdown
### 🌟 Key Strengths (အားသာချက်များ)
### ⚠️ Areas for Improvement (ပိုမိုကောင်းမွန်အောင် ပြင်ဆင်ရန် အချက်များ)
### 💡 Polished Sentence-by-Sentence Suggestions`;
      break;
    }

    case 'scholarly_source_verifier': {
      const { queryMode, inputContent } = payload;
      prompt =
        queryMode === 'verify_existing'
          ? `Verify and audit the following academic citations/links for authenticity, temporal validity, and APA 7th formatting:\n---\n${inputContent}\n---`
          : `Find 3 to 5 genuine, verifiable peer-reviewed scholarly sources with exact APA 7th citations and DOIs/links to support this academic topic/excerpt:\n---\n${inputContent}\n---`;
      break;
    }

    case 'extension_petition': {
      const { reasonType, courseCode, instructorName, studentName, studentId, details, proposedDate } = payload;
      prompt = `Write an official, respectful email petition to ${instructorName || 'Instructor'} for course ${courseCode || 'Course'} from ${studentName || 'Student'} (${studentId || 'ID'}) requesting a deadline extension until ${proposedDate || 'within 48 hours'} due to ${reasonType}: ${details}. Include Subject Line and email body.`;
      break;
    }

    case 'claim_extractor': {
      const { excerpt, assignmentContext = '' } = payload;
      prompt = `Analyze this reading excerpt for ${assignmentContext || 'an academic paper'}:\n"${excerpt}"\n1. Classify as [CLAIM], [EMPIRICAL EVIDENCE], or [COUNTER-ARGUMENT].\n2. Rephrase into a synthesis-ready scholarly sentence with an in-text citation placeholder.`;
      break;
    }

    case 'emergency_rescuer': {
      const type = payload.assignmentType || 'discussion';
      const {
        courseCode = 'POLS 1503-01',
        unitNumber = 'Unit 7',
        instructorName = 'Instructor',
        studentName = 'Student',
        date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      } = payload.courseInfo || {};
      const randomEntropy = Math.floor(Math.random() * 1000000);
      prompt = `You are an elite academic prose stylist and university professor.
DEADLINE EMERGENCY RESCUE (${type === 'discussion' ? 'DISCUSSION FORUM ASSIGNMENT' : 'ASSIGNMENT ACTIVITY'})
Seed: #${randomEntropy}
Course: ${courseCode} (${unitNumber}) | Instructor: ${instructorName} | Student: ${studentName} | Date: ${date}
INSTRUCTOR PROMPT / REQUIREMENTS:
---
${payload.promptQuery}
---
Write a complete, submission-ready academic response with bold section subheadings (never numbered, no markdown # headers, no bullet points in body paragraphs), varied sentence cadence, natural in-text citations, and an APA 7th References section at the end.`;
      break;
    }

    case 'discussion_followup_reply': {
      const { originalPost, interlocutorType = 'classmate', questionText, seed = Date.now() } = payload;
      prompt = `You are an expert UoPeople academic peer and discussion mentor.
Write a polite, scholarly follow-up reply (100 to 160 words, Seed #${seed}) to a ${interlocutorType}'s question on the student's Discussion Forum post:
ORIGINAL POST:
---
${originalPost}
---
QUESTION FROM ${String(interlocutorType).toUpperCase()}:
---
${questionText}
---
Output only the polished, ready-to-post reply.`;
      break;
    }

    case 'instructor_rubric_profiler': {
      const { instructorNotes, draftText, profileType = 'custom' } = payload;
      prompt = `Analyze the instructor's grading bias (${instructorNotes || profileType}) and evaluate the student's assignment draft against it:
DRAFT:
---
${draftText || 'Provide general rubric optimization scorecard.'}
---
Provide:
1. 🎯 Instructor Archetype & Grading Bias Profile
2. 🔍 Draft Evaluation Against Instructor's Bias
3. ✍️ Three Actionable Adjustments for an 'A' Grade`;
      break;
    }

    case 'plagiarism_false_positive_shield': {
      const { fullText, courseCode = 'POLS 1503', promptExcerpt = '' } = payload;
      prompt = `Perform an Academic Plagiarism False-Positive Audit on this student paper for ${courseCode} (${promptExcerpt}):
---
${fullText}
---
Provide:
1. 🛡️ Institutional Boilerplate Identification
2. 📊 True Academic Core vs Boilerplate Breakdown
3. 🛠️ Anti-Similarity Paraphrasing Directives
4. 📄 Shielded Academic Core Text`;
      break;
    }

    case 'anti_ai_humanize_cot': {
      const { text, variation = 1 } = payload;
      prompt = `Rewrite and humanize the following academic draft (Variation #${variation}) to bypass AI detectors with high sentence length burstiness and zero AI clichés ("delve", "beacon", "testament", "tapestry", "furthermore", "moreover"):
---
${text}
---
Output ONLY the humanized essay text ready to copy-paste.`;
      break;
    }

    default: {
      prompt =
        payload.prompt ||
        payload.text ||
        payload.content ||
        JSON.stringify(payload);
      break;
    }
  }

  return {
    prompt,
    systemInstruction,
    responseMimeType,
    maxOutputTokens,
    temperature,
    images,
  };
}
