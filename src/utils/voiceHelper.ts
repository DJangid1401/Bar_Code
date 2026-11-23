/**
 * Voice Recognition & Search Helper Utilities
 * Enables voice-driven product selection and search across the application.
 */

export interface VoiceMatchResult<T> {
  match: T | null;
  matches: T[];
  normalizedQuery: string;
  matchType: 'EXACT_CODE' | 'SINGLE_MATCH' | 'MULTIPLE' | 'NONE';
}

/**
 * Normalizes speech-to-text transcripts for inventory product search.
 * Handles spoken Indian English / Hinglish nuances, PRD codes, number padding, and color codes.
 *
 * Examples:
 * - "prd 20" -> "PRD-0020"
 * - "prd dash 20" -> "PRD-0020"
 * - "p r d 0018" -> "PRD-0018"
 * - "tyre 3 mm t 1" -> "TYRE 3 MM T-1"
 * - "hole moti 6 mm" -> "HOLE MOTI 6 MM"
 */
export function normalizeVoiceQuery(raw: string): string {
  if (!raw) return '';

  let text = raw.trim();

  // Remove trailing sentence punctuation added by speech engines
  text = text.replace(/[.,!?;:]+$/, '').trim();

  // Normalize spoken "P R D" / "p.r.d." variations
  text = text.replace(/\bp\s*[.\-]?\s*r\s*[.\-]?\s*d\b/gi, 'PRD');

  // Normalize "PRD 20" or "PRD dash 20" or "PRD-20" -> "PRD-0020"
  text = text.replace(/\bPRD\s*(?:dash|-)?\s*([a-zA-Z0-9]+)\b/gi, (_, code: string) => {
    // If it's pure digits, pad to 4 digits (PRD-0001 to PRD-9999)
    if (/^\d+$/.test(code)) {
      return `PRD-${code.length < 4 ? code.padStart(4, '0') : code}`;
    }
    // If it's alphanumeric like T001 or HM014
    return `PRD-${code.toUpperCase()}`;
  });

  // Normalize single-letter prefix color/size codes like "T 1", "T-1", "T dash 1" -> "T-1"
  text = text.replace(/\b([a-zA-Z])\s*(?:dash|-)\s*(\d+)\b/gi, '$1-$2');
  text = text.replace(/\b([tT])\s+(\d+)\b/g, '$1-$2');

  // Normalize ML codes: "ML 27" -> "ML-27"
  text = text.replace(/\bML\s*(?:dash|-)?\s*(\d+)\b/gi, 'ML-$1');

  // Normalize millimeters: "3mm" -> "3 MM"
  text = text.replace(/(\d+(?:\.\d+)?)\s*mm\b/gi, '$1 MM');

  return text.trim();
}

/**
 * Searches items to find exact, single, or multiple matches for a spoken transcript.
 */
export function findBestVoiceMatch<
  T extends { barcode: string; name: string; size?: string; color?: string }
>(query: string, items: T[]): VoiceMatchResult<T> {
  const normalizedQuery = normalizeVoiceQuery(query);
  const cleanQ = normalizedQuery.toLowerCase().trim();

  if (!cleanQ) {
    return { match: null, matches: [], normalizedQuery: '', matchType: 'NONE' };
  }

  // 1. Exact barcode check
  const exactBarcode = items.find(
    i => i.barcode.toLowerCase() === cleanQ || i.barcode.toLowerCase() === query.trim().toLowerCase()
  );
  if (exactBarcode) {
    return {
      match: exactBarcode,
      matches: [exactBarcode],
      normalizedQuery,
      matchType: 'EXACT_CODE',
    };
  }

  // 2. Multi-word search: every spoken word must be present in the item's details
  const words = cleanQ.split(/\s+/).filter(w => w.length > 0);
  const allWordMatches = items.filter(i => {
    const haystack = [i.barcode, i.name, i.size || '', i.color || ''].join(' ').toLowerCase();
    return words.every(w => haystack.includes(w));
  });

  if (allWordMatches.length === 1) {
    return {
      match: allWordMatches[0],
      matches: allWordMatches,
      normalizedQuery,
      matchType: 'SINGLE_MATCH',
    };
  }

  if (allWordMatches.length > 1) {
    return {
      match: null,
      matches: allWordMatches,
      normalizedQuery,
      matchType: 'MULTIPLE',
    };
  }

  // 3. Fallback: partial match (at least one significant word matches)
  const significantWords = words.filter(w => w.length >= 2);
  const partialMatches = items.filter(i => {
    const haystack = [i.barcode, i.name, i.size || '', i.color || ''].join(' ').toLowerCase();
    return significantWords.some(w => haystack.includes(w));
  });

  if (partialMatches.length === 1) {
    return {
      match: partialMatches[0],
      matches: partialMatches,
      normalizedQuery,
      matchType: 'SINGLE_MATCH',
    };
  }

  return {
    match: null,
    matches: partialMatches,
    normalizedQuery,
    matchType: partialMatches.length > 0 ? 'MULTIPLE' : 'NONE',
  };
}

/**
 * Checks if the user's browser supports Web Speech API.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}
