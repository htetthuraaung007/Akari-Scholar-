/**
 * Bulletproof JSON Array Extractor & Sanitizer
 * Reliably isolates and parses JSON arrays even when the model appends markdown fences,
 * conversational preambles/postambles, citation brackets (e.g. [1]), or trailing commas.
 */

/**
 * Finds the balanced closing bracket ']' for the first '[' in a string,
 * properly ignoring brackets inside quoted JSON strings.
 */
function extractBalancedArraySubstring(input: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < input.length; i++) {
    const ch = input[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '[') {
        depth++;
      } else if (ch === ']') {
        depth--;
        if (depth === 0) {
          return input.substring(startIdx, i + 1);
        }
      }
    }
  }

  return null;
}

export function safeExtractJsonArray<T = any>(rawResponse: unknown): T[] {
  if (!rawResponse) {
    throw new Error('Empty response received from AI engine.');
  }

  // Handle already-parsed arrays or wrapper objects directly
  if (Array.isArray(rawResponse)) {
    return rawResponse as T[];
  }
  if (typeof rawResponse === 'object' && rawResponse !== null) {
    const obj = rawResponse as Record<string, any>;
    if (Array.isArray(obj.quizzes)) return obj.quizzes as T[];
    if (Array.isArray(obj.questions)) return obj.questions as T[];
    if (Array.isArray(obj.flashcards)) return obj.flashcards as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }

  const rawString = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse);

  // Step 1: Strip markdown code blocks
  let cleaned = rawString
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```$/m, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  // Step 2: Use bracket matching to extract ONLY the array [ ... ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    const objMatch = cleaned.match(/\[[\s\S]*\]/);
    if (objMatch) {
      cleaned = objMatch[0];
    } else {
      throw new Error('AI did not return a valid JSON array format.');
    }
  } else {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  // Step 3: Remove trailing commas before closing braces/brackets
  const removeTrailingCommas = (str: string) => str.replace(/,\s*([\]}])/g, '$1');
  cleaned = removeTrailingCommas(cleaned);

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
    if (parsed && typeof parsed === 'object') {
      const candidate =
        parsed.quizzes || parsed.questions || parsed.flashcards || parsed.items || parsed.data;
      if (Array.isArray(candidate)) return candidate as T[];
    }
    throw new Error('Parsed JSON is not an array.');
  } catch (firstErr: any) {
    // Fallback: If greedy lastIndexOf(']') captured extra trailing text with brackets
    // (causing "Unexpected non-whitespace character after JSON"), extract the exact balanced array
    const balanced =
      firstBracket !== -1 ? extractBalancedArraySubstring(rawString, rawString.indexOf('[')) : null;

    if (balanced) {
      const sanitizedBalanced = removeTrailingCommas(balanced);
      try {
        const parsedBalanced = JSON.parse(sanitizedBalanced);
        if (Array.isArray(parsedBalanced)) {
          return parsedBalanced as T[];
        }
      } catch {
        // continue to object wrapper check
      }
    }

    // Also check if the response is a JSON object {"quizzes": [...]} or a comma-separated sequence of objects {...}, {...}
    const firstBrace = rawString.indexOf('{');
    const lastBrace = rawString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const braceSlice = removeTrailingCommas(rawString.substring(firstBrace, lastBrace + 1));
      try {
        const parsedObj = JSON.parse(braceSlice);
        const arr =
          parsedObj?.quizzes ||
          parsedObj?.questions ||
          parsedObj?.flashcards ||
          parsedObj?.items ||
          parsedObj?.data;
        if (Array.isArray(arr)) {
          return arr as T[];
        }
        return [parsedObj as T];
      } catch {
        // If outer [ ] were stripped leaving "{...}, {...}", wrap in [ ] and parse
        try {
          const wrappedArray = JSON.parse(`[${braceSlice}]`);
          if (Array.isArray(wrappedArray)) {
            return wrappedArray as T[];
          }
        } catch {
          // fall through
        }
      }
    }

    console.error('Failed JSON String:', cleaned);
    throw new Error(`JSON Structure Error: ${firstErr.message}. Retrying request...`);
  }
}

function extractBalancedObjectSubstring(input: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < input.length; i++) {
    const ch = input[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return input.substring(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

function repairTruncatedJsonObject(fragment: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < fragment.length; i++) {
    const ch = fragment[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{' || ch === '[') {
        stack.push(ch === '{' ? '}' : ']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  let repaired = fragment.trimEnd();
  if (inString) {
    repaired += '"';
  }
  repaired = repaired.replace(/,\s*$/, '');
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  return repaired.replace(/,\s*([\]}])/g, '$1');
}

export function safeExtractJsonObject<T = any>(rawResponse: unknown): T | null {
  if (!rawResponse) return null;
  if (typeof rawResponse === 'object' && !Array.isArray(rawResponse)) {
    return rawResponse as T;
  }
  const rawString = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse);
  const cleaned = rawString
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```$/m, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) {
    return null;
  }

  const balanced = extractBalancedObjectSubstring(cleaned, firstBrace);
  if (balanced) {
    const candidate = balanced.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Fall through to slice / repair attempts
    }
  }

  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace > firstBrace) {
    const candidate = cleaned.substring(firstBrace, lastBrace + 1).replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Fall through to truncation repair
    }
  }

  // Attempt truncation auto-repair if the model output stopped mid-JSON
  try {
    const repaired = repairTruncatedJsonObject(cleaned.substring(firstBrace));
    return JSON.parse(repaired) as T;
  } catch {
    return null;
  }
}

