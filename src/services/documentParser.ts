/**
 * Universal Multi-Format Client-Side Document Extraction Engine
 * Supports: PDF (.pdf), Word (.docx, .doc), PowerPoint (.pptx, .ppt),
 * Excel/CSV (.xlsx, .xls, .csv), Plain Text (.txt), and Images (.png, .jpg, .webp).
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

// Initialize PDF.js worker
try {
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfWorker || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker initialization notice:', e);
}

export type DocumentFileType = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'other';

export interface ParsedDocumentResult {
  fileType: DocumentFileType;
  fileName: string;
  sizeKb: number;
  extractedText: string;
  rawWordCount: number;
  isTruncated: boolean;
  truncatedWordCount: number;
  // Multimodal image payload if applicable
  imageBase64?: string;
  imageMimeType?: string;
  previewUrl?: string;
}

/**
 * Extract plain text from PDF using pdfjs-dist
 */
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const textChunks: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageStrings = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .filter((s: string) => s.trim().length > 0);
    if (pageStrings.length > 0) {
      textChunks.push(`[Page ${pageNum}]\n` + pageStrings.join(' '));
    }
  }

  return textChunks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract raw text from Word Document (.docx) using mammoth with JSZip XML fallback
 */
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = (result.value || '').trim();
    if (text.length > 20) return text;
  } catch (e) {
    console.warn('Mammoth extraction failed, falling back to JSZip XML parse:', e);
  }

  // Resilient fallback: Unzip word/document.xml and extract <w:t> text runs
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      const xml = await docXmlFile.async('text');
      const matches = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
      if (matches && matches.length > 0) {
        const sentences = matches
          .map((m) => m.replace(/<[^>]+>/g, '').trim())
          .filter(Boolean);
        const reconstructed = sentences.join(' ').replace(/\s{2,}/g, ' ').trim();
        if (reconstructed) return reconstructed;
      }
    }
  } catch (zipErr) {
    console.warn('JSZip DOCX fallback error:', zipErr);
  }

  return '';
}

/**
 * Extract text runs from PowerPoint Presentation (.pptx) using JSZip
 */
async function extractTextFromPptx(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files).filter((filePath) =>
    /^ppt\/slides\/slide\d+\.xml$/i.test(filePath)
  );

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.replace(/.*?slide(\d+)\.xml/i, '$1'), 10) || 0;
    const numB = parseInt(b.replace(/.*?slide(\d+)\.xml/i, '$1'), 10) || 0;
    return numA - numB;
  });

  const slidesText: string[] = [];

  for (let idx = 0; idx < slideFiles.length; idx++) {
    const filePath = slideFiles[idx];
    const xmlText = await zip.files[filePath].async('text');
    const matches = xmlText.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    if (matches && matches.length > 0) {
      const texts = matches
        .map((m) => m.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);
      if (texts.length > 0) {
        slidesText.push(`[Slide ${idx + 1}]\n${texts.join(' ')}`);
      }
    }
  }

  return slidesText.join('\n\n').trim();
}

/**
 * Extract spreadsheet tables from Excel (.xlsx, .xls) and CSV using SheetJS
 */
async function extractTextFromExcel(arrayBuffer: ArrayBuffer): Promise<string> {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetTexts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (csv) {
      sheetTexts.push(`### Sheet: ${sheetName}\n${csv}`);
    }
  }

  return sheetTexts.join('\n\n').trim();
}

/**
 * Determine DocumentFileType from file extension or MIME type
 */
export function getDocumentFileType(fileName: string, mimeType: string): DocumentFileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf' || mimeType.includes('pdf')) return 'pdf';
  if (ext === 'docx' || ext === 'doc' || mimeType.includes('word') || mimeType.includes('officedocument.wordprocessing')) return 'docx';
  if (ext === 'pptx' || ext === 'ppt' || mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'pptx';
  if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xlsx';
  if (ext === 'csv' || mimeType.includes('csv')) return 'csv';
  if (ext === 'txt' || mimeType.includes('text/plain')) return 'txt';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext) || mimeType.startsWith('image/')) return 'image';

  return 'other';
}

/**
 * Universal In-Browser Document Parsing Pipeline
 */
export async function parseUniversalDocument(file: File): Promise<ParsedDocumentResult> {
  const fileType = getDocumentFileType(file.name, file.type);
  const sizeKb = Math.round(file.size / 1024);

  // 1. Image Files: Maintain Base64 preview & multimodal delivery
  if (fileType === 'image') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve({
          fileType: 'image',
          fileName: file.name,
          sizeKb,
          extractedText: '',
          rawWordCount: 0,
          isTruncated: false,
          truncatedWordCount: 0,
          imageBase64: result,
          imageMimeType: file.type || 'image/png',
          previewUrl: result,
        });
      };
      reader.onerror = () => reject(new Error('Failed to load image file.'));
      reader.readAsDataURL(file);
    });
  }

  // 2. Document & Spreadsheet Extraction via ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  let extractedRaw = '';

  switch (fileType) {
    case 'pdf':
      extractedRaw = await extractTextFromPdf(arrayBuffer);
      break;
    case 'docx':
      extractedRaw = await extractTextFromDocx(arrayBuffer);
      break;
    case 'pptx':
      extractedRaw = await extractTextFromPptx(arrayBuffer);
      break;
    case 'xlsx':
    case 'csv':
      extractedRaw = await extractTextFromExcel(arrayBuffer);
      break;
    case 'txt':
    default: {
      const decoder = new TextDecoder('utf-8');
      extractedRaw = decoder.decode(arrayBuffer);
      break;
    }
  }

  const cleanText = extractedRaw.trim();
  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
  const rawWordCount = words.length;

  // Auto-enforce max 1,500 words limit
  let finalText = cleanText;
  let isTruncated = false;
  let truncatedWordCount = rawWordCount;

  if (rawWordCount > 1500) {
    finalText = words.slice(0, 1500).join(' ');
    isTruncated = true;
    truncatedWordCount = 1500;
  }

  return {
    fileType,
    fileName: file.name,
    sizeKb,
    extractedText: finalText,
    rawWordCount,
    isTruncated,
    truncatedWordCount,
  };
}
