import { executeGeminiRequest } from '../services/geminiService';
import {
  CourseRecord,
  TermRecord,
  enrichTermWithCalendarMetadata,
  normalizeUoPeopleGrade,
  parseStandardTermDescriptor,
  sortTermsChronologically,
} from './cgpaAnalytics';

export interface ParsedAcademicProgressCourse {
  courseCode: string;
  courseName?: string;
  credits: number;
  grade: string;
  gradePoint?: number | null;
}

export interface ParsedAcademicProgressTerm {
  term: string;
  calendarSpan?: string;
  courses: ParsedAcademicProgressCourse[];
}

export type ProgressParseErrorCode =
  | 'INVALID_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNREADABLE'
  | 'API_ERROR';

export class AcademicProgressParseError extends Error {
  public readonly code: ProgressParseErrorCode;

  constructor(code: ProgressParseErrorCode, message: string) {
    super(message);
    this.name = 'AcademicProgressParseError';
    this.code = code;
  }
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

// Keep safely under Express 10MB JSON payload limit (base64 expands ~33%)
const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read file payload.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read uploaded file.'));
    reader.readAsDataURL(file);
  });
}

function stripJsonCodeFences(raw: string): string {
  const trimmed = (raw || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonPayload(rawText: string): ParsedAcademicProgressTerm[] | null {
  const cleaned = stripJsonCodeFences(rawText);
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      if (parsed.unreadable === true) {
        return null;
      }
      if (Array.isArray(parsed.terms)) {
        return parsed.terms;
      }
      if (Array.isArray(parsed.data)) {
        return parsed.data;
      }
    }
  } catch {
    // Attempt extracting JSON array block if wrapped with explanatory prose
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        const arr = JSON.parse(arrMatch[0]);
        if (Array.isArray(arr)) return arr;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export interface ProgressIngestionResult {
  terms: TermRecord[];
  extractedCourseCount: number;
  extractedTermCount: number;
}

/**
 * Parses an uploaded UoPeople "My Academic Progress" PDF or screenshot image
 * via `executeGeminiRequest` using the active verified dynamic model catalog (Tier 1 / Lite Vision).
 */
export async function parseAcademicProgressFile(
  file: File
): Promise<ProgressIngestionResult> {
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = !file.type || ACCEPTED_MIME_TYPES.has(file.type.toLowerCase());

  if (!hasValidExt && !hasValidMime) {
    throw new AcademicProgressParseError(
      'INVALID_FILE',
      'Supported formats: PDF (.pdf) or Screenshot (.png, .jpg, .webp).'
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AcademicProgressParseError(
      'FILE_TOO_LARGE',
      'File exceeds 7MB limit. Please upload a cropped screenshot or smaller PDF export.'
    );
  }

  const dataUrl = await readFileAsDataUrl(file);

  const systemInstruction = `
You are an expert Academic Transcript & UoPeople "My Academic Progress" Parser.
Analyze the attached PDF or screenshot image from the University of the People (UoPeople) Student Portal ("My Academic Progress", Degree Audit, or Unofficial Transcript).

EXTRACTION RULES:
1. Extract ALL completed / graded courses and Transfer Credits (TC) grouped chronologically by Academic Term.
2. Skip courses with status "In Progress", "Registered", "Not Started", or "W" (Withdrawn) unless an earned letter grade or Transfer Credit (TC) is shown.
3. Map all UoPeople letter grades strictly to one of:
   "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F", "TC"
   (Note: Transfer Credits / CR / TR / Exempt Transfer courses map to "TC" with gradePoint null).
4. Format term names consistently using the UoPeople Academic Calendar cycle whenever visible (e.g., "2025-2026 Term 1", "2025-2026 Term 2", or "Transfer Credits" for ungrouped transfer rows), and include calendarSpan if visible or inferable (e.g., "Sep 2025 - Nov 2025").
5. Return ONLY a valid JSON array matching this schema (no markdown commentary):
[
  {
    "term": "2025-2026 Term 1",
    "calendarSpan": "Sep 2025 - Nov 2025",
    "courses": [
      {
        "courseCode": "UNIV 1001",
        "courseName": "Online Education Strategies",
        "credits": 3,
        "grade": "A",
        "gradePoint": 4.00
      }
    ]
  }
]
6. If the document or image is blurry, cropped beyond legibility, or contains NO recognizable courses or grades, return an empty JSON array [].
`.trim();

  const prompt = `Parse all completed terms, course codes, course titles, credit hours, and UoPeople letter grades chronologically from this uploaded file (${file.name}). Return strict JSON only.`;

  let rawResponse = '';
  try {
    rawResponse = await executeGeminiRequest(
      prompt,
      'light',
      systemInstruction,
      [{ name: file.name, dataUrl }],
      3200,
      undefined,
      true,
      'application/json'
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err || '');
    throw new AcademicProgressParseError(
      'API_ERROR',
      msg || 'Failed to parse document with Gemini cascade.'
    );
  }

  const parsedGroups = extractJsonPayload(rawResponse);
  if (!parsedGroups || parsedGroups.length === 0) {
    throw new AcademicProgressParseError(
      'UNREADABLE',
      'No readable courses or grades found in uploaded document.'
    );
  }

  const timestampBase = Date.now();
  const normalizedTerms: TermRecord[] = [];
  let totalCourses = 0;

  parsedGroups.forEach((group, groupIdx) => {
    if (!group || !Array.isArray(group.courses)) return;

    const validCourses: CourseRecord[] = [];
    group.courses.forEach((c, cIdx) => {
      const normalizedGrade = normalizeUoPeopleGrade(String(c?.grade || ''));
      const rawCode = String(c?.courseCode || '').trim().toUpperCase();
      const rawName = String(c?.courseName || '').trim();

      if (!normalizedGrade || (!rawCode && !rawName)) return;

      const parsedCreds = Number(c?.credits);
      const credits =
        Number.isFinite(parsedCreds) && parsedCreds >= 1 && parsedCreds <= 12
          ? Math.round(parsedCreds)
          : 3;

      validCourses.push({
        id: `ingested-${timestampBase}-${groupIdx}-${cIdx}-${Math.random().toString(36).slice(2, 6)}`,
        code: rawCode || rawName.slice(0, 14).toUpperCase(),
        courseName: rawName || undefined,
        credits,
        grade: normalizedGrade,
      });
    });

    if (validCourses.length === 0) return;

    totalCourses += validCourses.length;
    const rawTermLabel = String(group.term || '').trim() || `Term ${groupIdx + 1}`;
    const parsedStd = parseStandardTermDescriptor(rawTermLabel);
    const isTransferOrCustom = !parsedStd;

    const termRecord = enrichTermWithCalendarMetadata({
      id: `term-ingested-${timestampBase}-${groupIdx}`,
      termName: rawTermLabel,
      calendarSpan: group.calendarSpan ? String(group.calendarSpan).trim() : undefined,
      isCustom: isTransferOrCustom,
      courses: validCourses,
    });

    normalizedTerms.push(termRecord);
  });

  if (normalizedTerms.length === 0 || totalCourses === 0) {
    throw new AcademicProgressParseError(
      'UNREADABLE',
      'Could not extract any valid completed courses from the uploaded document.'
    );
  }

  return {
    terms: sortTermsChronologically(normalizedTerms),
    extractedCourseCount: totalCourses,
    extractedTermCount: normalizedTerms.length,
  };
}

/**
 * Merges newly ingested terms into existing CGPA history chronologically,
 * matching existing terms by standard calendar (academicStartYear + termNumber) or normalized name,
 * and updating/appending courses without creating duplicate course codes within the same term.
 */
export function mergeIngestedTerms(
  existing: TermRecord[],
  ingested: TermRecord[]
): TermRecord[] {
  const merged = existing.map((t) => ({
    ...t,
    courses: [...t.courses],
  }));

  const findMatchingTermIndex = (incoming: TermRecord): number => {
    const incStd = !incoming.isCustom ? parseStandardTermDescriptor(incoming.termName) : null;
    const incKey = incoming.termName.trim().toLowerCase();

    return merged.findIndex((curr) => {
      if (curr.termName.trim().toLowerCase() === incKey) return true;
      if (incStd && !curr.isCustom) {
        const currStd = parseStandardTermDescriptor(curr.termName);
        if (
          currStd &&
          currStd.academicStartYear === incStd.academicStartYear &&
          currStd.termNumber === incStd.termNumber
        ) {
          return true;
        }
      }
      return false;
    });
  };

  ingested.forEach((incTerm) => {
    const matchIdx = findMatchingTermIndex(incTerm);
    if (matchIdx === -1) {
      merged.push(incTerm);
      return;
    }

    const target = merged[matchIdx];
    const updatedCourses = [...target.courses];

    incTerm.courses.forEach((incCourse) => {
      const normalizedCode = incCourse.code.replace(/\s+/g, '').toUpperCase();
      const existingCourseIdx = updatedCourses.findIndex(
        (c) => c.code.replace(/\s+/g, '').toUpperCase() === normalizedCode && normalizedCode !== ''
      );
      if (existingCourseIdx !== -1) {
        updatedCourses[existingCourseIdx] = {
          ...updatedCourses[existingCourseIdx],
          code: incCourse.code,
          courseName: incCourse.courseName || updatedCourses[existingCourseIdx].courseName,
          credits: incCourse.credits,
          grade: incCourse.grade,
        };
      } else {
        updatedCourses.push(incCourse);
      }
    });

    merged[matchIdx] = enrichTermWithCalendarMetadata({
      ...target,
      termName: incTerm.termName || target.termName,
      calendarSpan: incTerm.calendarSpan || target.calendarSpan,
      academicYear: incTerm.academicYear || target.academicYear,
      courses: updatedCourses,
    });
  });

  return sortTermsChronologically(merged);
}
