export interface ShuffledQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  realWorldApplication: string;
  questionType: 'mcq' | 'except' | 'true_false';
}

function inferQuestionType(q: any, options: string[]): 'mcq' | 'except' | 'true_false' {
  const rawType = String(q?.questionType || '').toLowerCase().trim();
  if (
    options.length === 2 &&
    (options[0].toLowerCase() === 'true' || options[0].toLowerCase() === 'false')
  ) {
    return 'true_false';
  }
  if (rawType === 'true_false') return 'true_false';
  if (rawType === 'except') return 'except';
  const stem = String(q?.question || q?.q || '');
  if (/\b(EXCEPT|NOT|FALSE|LEAST)\b/.test(stem)) {
    return 'except';
  }
  return 'mcq';
}

export function shuffleQuizOptions(rawQuestions: any[]): ShuffledQuizQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions.map((q, idx) => {
    const rawOptions: string[] = Array.isArray(q?.options)
      ? q.options.map((opt: any) => String(opt ?? ''))
      : Array.isArray(q?.o)
      ? q.o.map((opt: any) => String(opt ?? ''))
      : [];

    const rawCorrectIndex =
      typeof q?.correctIndex === 'number'
        ? q.correctIndex
        : typeof q?.a === 'number'
        ? q.a
        : 0;

    const safeCorrectIndex =
      rawCorrectIndex >= 0 && rawCorrectIndex < rawOptions.length ? rawCorrectIndex : 0;

    const questionType = inferQuestionType(q, rawOptions);

    const baseQuestion: ShuffledQuizQuestion = {
      id: q?.id || `uop-quiz-${Date.now()}-${idx}`,
      question: String(q?.question || q?.q || ''),
      options: rawOptions,
      correctIndex: safeCorrectIndex,
      explanation: String(q?.explanation || q?.e || ''),
      realWorldApplication: String(q?.realWorldApplication || q?.realWorld || ''),
      questionType,
    };

    // If True/False, preserve conventional [True, False] order
    if (
      baseQuestion.options.length === 2 &&
      (baseQuestion.options[0].toLowerCase() === 'true' ||
        baseQuestion.options[0].toLowerCase() === 'false')
    ) {
      const chosenTruth = baseQuestion.options[baseQuestion.correctIndex]?.toLowerCase().trim();
      const canonicalOptions = ['True', 'False'];
      const canonicalCorrectIndex = chosenTruth === 'false' ? 1 : 0;
      return {
        ...baseQuestion,
        options: canonicalOptions,
        correctIndex: canonicalCorrectIndex,
        questionType: 'true_false',
      };
    }

    if (baseQuestion.options.length <= 1) {
      return baseQuestion;
    }

    const originalCorrectOption = baseQuestion.options[baseQuestion.correctIndex];
    const indexedOptions = baseQuestion.options.map((opt: string) => opt);

    // Modern Fisher-Yates algorithm
    for (let i = indexedOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexedOptions[i], indexedOptions[j]] = [indexedOptions[j], indexedOptions[i]];
    }

    const newCorrectIndex = indexedOptions.indexOf(originalCorrectOption);

    return {
      ...baseQuestion,
      options: indexedOptions,
      correctIndex: newCorrectIndex !== -1 ? newCorrectIndex : 0,
    };
  });
}
