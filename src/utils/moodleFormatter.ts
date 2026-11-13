export interface MoodleCleanedResult {
  html: string;
  wordCount: number;
}

export function formatDraftForMoodle(rawText: string): MoodleCleanedResult {
  if (!rawText.trim()) {
    return { html: '', wordCount: 0 };
  }

  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let htmlParts: string[] = [];
  let isReferencesSection = false;
  let wordsCounted = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect References section
    if (/^references$/i.test(line)) {
      isReferencesSection = true;
      htmlParts.push('<p style="text-align: center; margin-top: 1.5rem; margin-bottom: 0.75rem;"><strong>References</strong></p>');
      continue;
    }

    // Detect Metadata Header (e.g., University of the People, Course code, Instructor, Student, Date)
    if (i < 8 && (/university of the people/i.test(line) || /unit \d+/i.test(line) || /instructor/i.test(line) || /student:/i.test(line) || /date:/i.test(line) || /ay\d{4}/i.test(line))) {
      htmlParts.push(`<p style="text-align: center; margin: 0.15rem 0; font-weight: bold;">${line}</p>`);
      continue;
    }

    // Detect Main Essay Title
    if (i < 8 && !isReferencesSection && lines[i - 1]?.toLowerCase().includes('date:')) {
      htmlParts.push(`<p style="text-align: center; margin: 1rem 0; font-size: 1.15em; font-weight: bold;">${line}</p>`);
      continue;
    }

    // Detect Subheadings (e.g., Introduction, Conclusion, Positive and Negative Impacts of GMOs)
    const isSubheading = !isReferencesSection && line.length < 70 && !line.endsWith('.') && !line.includes('(') && (
      /^(introduction|conclusion)$/i.test(line) ||
      /impact|influence|technology|overview|analysis/i.test(line)
    );

    if (isSubheading) {
      htmlParts.push(`<p style="margin-top: 1.25rem; margin-bottom: 0.5rem; font-weight: bold; text-align: left;">${line}</p>`);
      continue;
    }

    // Detect Word Count line
    if (/^word count/i.test(line)) {
      htmlParts.push(`<p style="margin-top: 1rem; margin-bottom: 0.5rem; font-style: italic; text-align: left;">${line}</p>`);
      continue;
    }

    // In References section: Format with true APA Hanging Indent
    if (isReferencesSection) {
      htmlParts.push(
        `<p style="margin-left: 2rem; text-indent: -2rem; margin-top: 0.5rem; margin-bottom: 0.5rem; text-align: left; line-height: 1.5;">${line}</p>`
      );
      continue;
    }

    // Standard Body Paragraphs
    const words = line.split(/\s+/).filter(Boolean).length;
    wordsCounted += words;

    htmlParts.push(
      `<p style="text-align: left; margin-bottom: 0.85rem; line-height: 1.6; text-indent: 1.5rem;">${line}</p>`
    );
  }

  return {
    html: htmlParts.join('\n'),
    wordCount: wordsCounted
  };
}
