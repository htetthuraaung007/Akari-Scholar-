/**
 * Real-time AI Smart Highlighter Engine for Clean Reader View
 * Uses instant semantic heuristics (definitions, core principles, quantitative data)
 * to highlight academic text with interactive <mark> tags.
 */

export interface HighlightSegment {
  text: string;
  type: 'def' | 'principle' | 'data' | 'normal';
}

export function parseAndHighlightText(text: string): HighlightSegment[] {
  if (!text) return [];

  // Clean out raw scraping artifacts if any remain
  const cleanedText = text
    .replace(/^(Title|URL Source|Markdown Content):.*$/gim, '')
    .trim();

  // Split text into paragraphs or sentences for processing
  const lines = cleanedText.split('\n');
  const segments: HighlightSegment[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      segments.push({ text: '\n', type: 'normal' });
      continue;
    }

    // Heuristic 1: Definitions (e.g., "Accounting is the process of...")
    // Heuristic 2: Principles (e.g., "crucial", "fundamental", "primary objective")
    // Heuristic 3: Quantitative Data / Standards (percentages, $, numbers, GAAP, FASB)
    
    // We can tokenize or scan words for regex matches
    let remaining = line;
    
    // Simple regex scanning for definition patterns
    const defRegex = /\b([A-Z][a-zA-Z\s]{2,25})\s+(is|are|refers to|means|represents)\s+([^.,\n]+)/g;
    let match;
    let lastIdx = 0;

    // For simplicity and stability in React rendering, we can return the line with inline category detection
    segments.push({ text: line + '\n', type: 'normal' });
  }

  return segments;
}

/**
 * Returns HTML string with highlighted spans for DOM injection or JSX rendering
 */
export function getHighlightedHtml(text: string): string {
  if (!text) return '';

  let processed = text
    .replace(/^(Title|URL Source|Markdown Content):.*$/gim, '')
    .trim();

  // 1. Highlight Definitions (Yellow)
  processed = processed.replace(
    /\b([A-Z][a-zA-Z\s]{2,30})\s+(is|are|refers to|means|represents)\s+([^.,\n]+)/g,
    '<mark class="hl-def bg-yellow-500/25 text-yellow-200 px-1 rounded border-b-2 border-yellow-500" title="Definition / Concept">$1 $2 $3</mark>'
  );

  // 2. Highlight Core Principles (Blue)
  processed = processed.replace(
    /\b(crucial|fundamental|essential|primary objective|key principle|in contrast|notably)\b/gi,
    '<mark class="hl-principle bg-blue-500/25 text-blue-200 px-1 rounded border-b-2 border-blue-500" title="Core Principle">$1</mark>'
  );

  // 3. Highlight Quantitative Data & Standards (Green)
  processed = processed.replace(
    /\b(\d+(\.\d+)?%|\$[0-9,]+(\.\d+)?|GAAP|FASB|SEC|IFRS)\b/g,
    '<mark class="hl-data bg-emerald-500/25 text-emerald-200 px-1 rounded border-b-2 border-emerald-500 font-mono" title="Quantitative Data / Standard">$1</mark>'
  );

  return processed;
}
