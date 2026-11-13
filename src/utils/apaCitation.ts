/**
 * Rigorous APA 7th Edition Citation Generator for Textbooks & Web Chapters
 */

export interface CitationParams {
  authors?: string;
  year?: string | number;
  chapterTitle?: string;
  bookTitle?: string;
  publisher?: string;
  sourceUrl?: string;
}

export interface ApaCitationResult {
  referenceEntry: string;
  parentheticalInText: string;
  narrativeInText: string;
}

export function generateApa7Citation(params: CitationParams): ApaCitationResult {
  const authors = (params.authors || 'OpenStax').trim();
  const year = String(params.year || new Date().getFullYear()).trim();
  const chapterTitle = (params.chapterTitle || 'Chapter Reading Section').trim();
  const bookTitle = (params.bookTitle || 'Principles of Academic Study').trim();
  const publisher = (params.publisher || 'OpenStax & University of the People').trim();
  const sourceUrl = (params.sourceUrl || 'https://my.uopeople.edu').trim();

  // APA 7th format for chapter in open textbook:
  // Author, A. A. (Year). Chapter title. In *Book title*. Publisher. URL
  const referenceEntry = `${authors}. (${year}). ${chapterTitle}. In *${bookTitle}*. ${publisher}. ${sourceUrl}`;

  const primaryAuthor = authors.includes(',') ? authors.split(',')[0] : authors.split(' ')[0];
  const parentheticalInText = `(${primaryAuthor}, ${year})`;
  const narrativeInText = `${primaryAuthor} (${year})`;

  return {
    referenceEntry,
    parentheticalInText,
    narrativeInText,
  };
}
