/**
 * Automatic Front-Matter & Textbook Boilerplate Cleaner
 * Strips publisher prefaces, contributing author lists, OpenStax Rice University addresses,
 * copyright blocks, and ISBN metadata before text is sent to the AI exam generator.
 */

export function stripTextbookNoise(rawText: string): string {
  if (!rawText) return '';

  // Remove author listings, OpenStax Rice University addresses, copyright, ISBN
  return rawText
    .replace(/SENIOR CONTRIBUTING AUTHORS[\s\S]*?(?=(Chapter|1\.1|Introduction))/i, '')
    .replace(/OpenStax Rice University[\s\S]*?Creative Commons[^\n]*/gi, '')
    .replace(/ Rice University\s+6100 Main Street[\s\S]*?(?=(Chapter|1\.1|Introduction|\n\n))/gi, '')
    .replace(/ISBN-1[03]:?\s*[\d-]+/gi, '')
    .replace(/Attribution\s+4\.0\s+International\s+\(CC\s+BY\s+4\.0\)/gi, '')
    .trim();
}

/**
 * Sanitizes a generated question stem to strip accidental meta-language prefixes
 * such as "According to the chapter, " or "In section 1.1, " while preserving
 * the core academic question.
 */
export function sanitizeAcademicQuestionStem(question: string): string {
  if (!question) return '';
  let cleaned = question
    .replace(/^(According to (the )?(text|chapter|section|passage|author|reading)(\s+[\d.]+)?,\s*)/i, '')
    .replace(/^(In (chapter|section|unit)\s+[\d.]+(\s*\([^)]*\))?,\s*)/i, '')
    .replace(/^(Based on (the )?(provided )?(text|chapter|section|excerpt)(\s+[\d.]+)?,\s*)/i, '')
    .trim();

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Detects forbidden metadata-only questions (e.g., "Which chapter covers X?", "Who authored this book?")
 */
export function isForbiddenMetaQuestion(question: string): boolean {
  if (!question) return true;
  const q = question.trim();
  const forbiddenPatterns = [
    /^which\s+(chapter|section|unit|page)\s+(covers|discusses|introduces|mentions|is\s+titled)/i,
    /^what\s+is\s+the\s+title\s+of\s+(chapter|section|unit)/i,
    /^who\s+(authored|wrote|published|contributed\s+to)\s+(this|the)\s+(book|textbook|chapter)/i,
    /^in\s+which\s+(chapter|section|unit)\s+(would\s+you\s+find|is\s+.*?\s+discussed)/i,
    /^what\s+organization\s+published\s+this\s+textbook/i,
  ];
  return forbiddenPatterns.some((pattern) => pattern.test(q));
}
