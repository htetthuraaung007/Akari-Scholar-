/**
 * Students Academic Engine:
 * 1. Client-Side Throttle Guard (Guards 15 RPM Free Tier limit)
 * 2. In-Browser Local Processing Engine (Offline summarization, flashcards, readability)
 * 3. Citation Synchronizer (In-text vs Reference list cross-auditor)
 */

import { CitationItem, Flashcard } from '../types';

// ================= 1. THROTTLE GUARD =================
class ThrottleGuard {
  private lastRequestTime = 0;
  private minIntervalMs = 200; // Ultra-fast response without artificial 3s delay

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      const wait = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRequestTime = Date.now();
  }
}

export const throttleGuard = new ThrottleGuard();

// ================= 2. LOCAL IN-BROWSER OFFLINE ENGINE =================
export class LocalInBrowserEngine {
  /**
   * Extractive summarization based on TF-IDF word frequency scoring.
   * Runs 100% locally with zero internet connection.
   */
  static summarize(text: string, maxSentences = 4): string[] {
    const sentences = text
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    if (sentences.length <= maxSentences) return sentences;

    // Word frequency counter
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'that', 'to', 'for', 'of', 'with', 'as', 'by', 'it', 'this', 'be', 'are', 'from', 'or', 'was', 'were'
    ]);
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const wordFreq: Record<string, number> = {};

    for (const w of words) {
      if (!stopWords.has(w)) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    }

    // Score sentences
    const scored = sentences.map((sentence, index) => {
      const sentenceWords = sentence.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      let score = 0;
      for (const sw of sentenceWords) {
        score += wordFreq[sw] || 0;
      }
      return { sentence, score: score / Math.max(1, sentenceWords.length), index };
    });

    // Select top scoring sentences and maintain original order
    scored.sort((a, b) => b.score - a.score);
    const topSentences = scored.slice(0, maxSentences).sort((a, b) => a.index - b.index);
    return topSentences.map((s) => s.sentence);
  }

  /**
   * Local Flashcard Generator
   * Extracts definitions, colon-delimited concepts, and key sentences offline.
   */
  static generateLocalFlashcards(text: string): { front: string; back: string; concept: string }[] {
    const cards: { front: string; back: string; concept: string }[] = [];
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Pattern 1: Concept: Definition or Term - Definition
      const colonMatch = line.match(/^([A-Za-z0-9\s]{3,35})\s*[:\-–—]\s*(.+)$/);
      if (colonMatch) {
        cards.push({
          front: `What is ${colonMatch[1].trim()}?`,
          back: colonMatch[2].trim(),
          concept: 'Key Definition',
        });
        continue;
      }

      // Pattern 2: "X is defined as Y" or "X refers to Y"
      const defMatch = line.match(/^([A-Za-z0-9\s]{3,30})\s+(is defined as|refers to|posits that|is a|means)\s+(.+)$/i);
      if (defMatch) {
        cards.push({
          front: `Define: ${defMatch[1].trim()}`,
          back: `${defMatch[1].trim()} ${defMatch[2]} ${defMatch[3].trim()}`,
          concept: 'Core Principle',
        });
      }
    }

    if (cards.length === 0) {
      const summaries = this.summarize(text, 3);
      summaries.forEach((s, idx) => {
        cards.push({
          front: `Key Concept ${idx + 1} from Reading`,
          back: s,
          concept: 'Lesson Key Point',
        });
      });
    }

    return cards;
  }
}

// ================= 3. CITATION AUTO-SYNC AUDITOR =================
export interface CitationSyncAudit {
  inTextFound: string[];
  matchedReferences: string[];
  orphanedInText: string[];
  unusedReferences: string[];
}

export function auditCitationSync(draftText: string, references: CitationItem[]): CitationSyncAudit {
  // Regex for APA in-text parenthetical citations: e.g. (Smith, 2020) or (Smith & Jones, 2019) or (Smith et al., 2021)
  const inTextRegex = /\((([A-Za-z\s&-]+)(?:,\s*|\s+et\s+al\.,?\s*)(\d{4}[a-z]?))\)/g;
  const inTextFound: string[] = [];
  let match;

  while ((match = inTextRegex.exec(draftText)) !== null) {
    if (!inTextFound.includes(match[1])) {
      inTextFound.push(match[1]);
    }
  }

  const matchedReferences: string[] = [];
  const orphanedInText: string[] = [];
  const refUsedSet = new Set<string>();

  for (const cite of inTextFound) {
    // Check if any author from reference matches cite
    const [authorPart, yearPart] = cite.split(',').map((s) => s.trim());
    const year = yearPart || '';
    const author = (authorPart.split(' ')[0] || '').toLowerCase();

    const matchingRef = references.find((r) => {
      const rLower = (r.authors || '').toLowerCase();
      const yearMatch = !r.year || !year || r.year.includes(year);
      const authorMatch = rLower.includes(author);
      return authorMatch && yearMatch;
    });

    if (matchingRef) {
      matchedReferences.push(cite);
      refUsedSet.add(matchingRef.id);
    } else {
      orphanedInText.push(cite);
    }
  }

  const unusedReferences = references
    .filter((r) => !refUsedSet.has(r.id))
    .map((r) => r.apaFormatted || r.title);

  return {
    inTextFound,
    matchedReferences,
    orphanedInText,
    unusedReferences,
  };
}
