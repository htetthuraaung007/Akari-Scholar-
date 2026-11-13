/**
 * Client-Side Academic Paper & Document Text Extractor
 * 100% in-browser parsing. Zero external uploads.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker safely: prefer local Vite-bundled worker, fallback to jsdelivr CDN
try {
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfWorker || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker setup fallback:', e);
}

export async function extractTextFromPdfFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      useSystemFonts: true,
    } as any);
    const pdfDoc = await loadingTask.promise;

    let fullText = '';
    const numPages = Math.min(pdfDoc.numPages, 40); // Cap at 40 pages for speed

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += `\n--- Page ${pageNum} ---\n` + pageStrings;
    }

    if (fullText.trim().length > 30) {
      return fullText.trim();
    }
  } catch (err) {
    console.warn('PDF.js standard parse failed, switching to binary stream text extractor:', err);
  }

  // Fallback: In-memory string extraction for text streams
  return extractReadableTextFromBuffer(arrayBuffer);
}

function extractReadableTextFromBuffer(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  let raw = '';
  // Convert printable ASCII characters
  for (let i = 0; i < uint8.length && raw.length < 50000; i++) {
    const code = uint8[i];
    if ((code >= 32 && code <= 126) || code === 10 || code === 13) {
      raw += String.fromCharCode(code);
    } else if (raw.length > 0 && raw[raw.length - 1] !== ' ') {
      raw += ' ';
    }
  }

  // Filter out PDF internal metadata tags and extract meaningful sentences
  const cleaned = raw
    .replace(/obj|endobj|stream|endstream|xref|trailer|startxref/gi, ' ')
    .replace(/<<[\s\S]*?>>/g, ' ')
    .replace(/[\\/][A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = cleaned.split(/(?<=[.?!])\s+/).filter((s) => s.length > 25);
  return sentences.slice(0, 50).join('\n\n') || cleaned.substring(0, 4000);
}
