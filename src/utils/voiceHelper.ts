/**
 * Voice Recognition & Search Helper Utilities
 * Enhanced for Indian English / Hinglish speech, phonetic aliases,
 * Devanagari numerals/terms, and robust fuzzy scoring.
 */

export interface VoiceMatchResult<T> {
  match: T | null;
  matches: T[];
  normalizedQuery: string;
  matchType: 'EXACT_CODE' | 'SINGLE_MATCH' | 'MULTIPLE' | 'NONE';
  confidence: number;
}

// Devanagari numerals mapping
const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

// Hindi / English spoken number words
const WORD_TO_DIGIT: Record<string, string> = {
  // English words
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',

  // Hindi spoken words
  shunya: '0',
  ek: '1',
  do: '2',
  teen: '3',
  tin: '3',
  char: '4',
  chaar: '4',
  panch: '5',
  paanch: '5',
  chhe: '6',
  chhah: '6',
  che: '6',
  sat: '7',
  saat: '7',
  aath: '8',
  ath: '8',
  nau: '9',
  das: '10',
  dus: '10',
  gyarah: '11',
  barah: '12',
  baarah: '12',
  terah: '13',
  chaudah: '14',
  pandrah: '15',
  solah: '16',
  satrah: '17',
  atharah: '18',
  unnis: '19',
  bees: '20',
  beas: '20',
  beess: '20',
  ikkees: '21',
  bais: '22',
  teis: '23',
  chaubees: '24',
  pachees: '25',
  chhabees: '26',
  sattaees: '27',
  attaees: '28',
  untees: '29',
  tees: '30',
  chautees: '34',
  chhattees: '36',
  chalis: '40',
  pachas: '50',
};

// Common compound numbers in English speech
const COMPOUND_NUMBERS: [RegExp, string][] = [
  [/\btwenty\s+one\b/gi, '21'],
  [/\btwenty\s+two\b/gi, '22'],
  [/\btwenty\s+three\b/gi, '23'],
  [/\btwenty\s+four\b/gi, '24'],
  [/\btwenty\s+five\b/gi, '25'],
  [/\btwenty\s+six\b/gi, '26'],
  [/\btwenty\s+seven\b/gi, '27'],
  [/\btwenty\s+eight\b/gi, '28'],
  [/\btwenty\s+nine\b/gi, '29'],
  [/\bthirty\s+one\b/gi, '31'],
  [/\bthirty\s+two\b/gi, '32'],
  [/\bthirty\s+three\b/gi, '33'],
  [/\bthirty\s+four\b/gi, '34'],
  [/\bthirty\s+five\b/gi, '35'],
  [/\bthirty\s+six\b/gi, '36'],
];

/**
 * Normalizes speech-to-text transcripts for inventory and search.
 * Handles Indian English, Hinglish, Devanagari, number words, PRD codes, and phonetic aliases.
 */
export function normalizeVoiceQuery(raw: string): string {
  if (!raw) return '';

  let text = raw.trim();

  // 1. Remove trailing speech punctuation
  text = text.replace(/[.,!?;:]+$/, '').trim();

  // 2. Convert Devanagari digits to standard ASCII digits
  text = text.replace(/[०-९]/g, d => DEVANAGARI_DIGITS[d] || d);

  // 3. Devanagari inventory terms to English keywords
  text = text
    .replace(/\bटायर्स?\b/gi, 'TYRE')
    .replace(/\bमोती\b/gi, 'MOTI')
    .replace(/\bहोल\s*मोती\b/gi, 'HOLE MOTI')
    .replace(/\bहोल\b/gi, 'HOLE')
    .replace(/\bग्लोब\b/gi, 'Globe')
    .replace(/\bसुजानी\b/gi, 'Sujani')
    .replace(/\bओवल\b/gi, 'Oval')
    .replace(/\bपी\s*आर\s*डी\b/gi, 'PRD')
    .replace(/\bपीआरडी\b/gi, 'PRD')
    .replace(/\bपिआरडी\b/gi, 'PRD')
    .replace(/\bटी\b/gi, 'T')
    .replace(/\bएम\s*एल\b/gi, 'ML')
    .replace(/\bएमएल\b/gi, 'ML')
    .replace(/\bएम\s*एम\b/gi, 'MM')
    .replace(/\bएमएम\b/gi, 'MM')
    .replace(/\bमिमी\b/gi, 'MM')
    .replace(/\bपैकेट\b/gi, 'PAC')
    .replace(/\bपैक\b/gi, 'PAC')
    .replace(/\bकिलो\b/gi, 'KGS')
    .replace(/\bकेजी\b/gi, 'KGS')
    .replace(/\bपीसीएस?\b/gi, 'PCS')
    .replace(/\bपीस\b/gi, 'PCS');

  // 4. Decimal / point normalization ("2 point 5", "2 dot 5", "do point panch" -> "2.5")
  text = text.replace(/\b(\d+)\s*(?:point|dot|dashamlav|dushman)\s*(\d+)\b/gi, '$1.$2');

  // 5. English compound numbers ("twenty seven" -> "27")
  for (const [pattern, repl] of COMPOUND_NUMBERS) {
    text = text.replace(pattern, repl);
  }

  // 6. Phonetic replacements for product names & speech recognition typos
  text = text
    .replace(/\b(?:tire|tair|taiyar|tier|tyer|tyres|tires)\b/gi, 'TYRE')
    .replace(/\b(?:moty|mothy|mati|motee)\b/gi, 'MOTI')
    .replace(/\b(?:hall|whole|hol)\s+moti\b/gi, 'HOLE MOTI')
    .replace(/\b(?:soojni|soojani|sujni)\b/gi, 'Sujani')
    .replace(/\b(?:glow|glob|global)\b/gi, 'Globe');

  // 7. Spoken "PRD" / "P R D" / "Party" variations (when followed by numbers)
  text = text.replace(/\b(?:p\s*[.\-]?\s*r\s*[.\-]?\s*d|party|peer\s*d|brd|trd)\b/gi, 'PRD');

  // 8. Spoken "T-" color codes: "tea 1", "tee 1", "t 1", "tea one", "tee-one" -> "T-1"
  text = text.replace(/\b(?:tea|tee|ti)\s*(?:dash|-)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|thirty\s*six)\b/gi, (_, code) => {
    const digit = WORD_TO_DIGIT[code.toLowerCase().trim()] || code;
    return `T-${digit}`;
  });

  // 9. Spoken "ML-" color codes: "email 27", "em el 27", "m l 27", "ml 27" -> "ML-27"
  text = text.replace(/\b(?:email|em\s*el|m\s*l|ml)\s*(?:dash|-)?\s*(\d+|five|twenty\s*seven)\b/gi, (_, code) => {
    const digit = WORD_TO_DIGIT[code.toLowerCase().trim()] || code;
    return `ML-${digit}`;
  });

  // 10. Word-to-digit conversion for standalone words
  const tokens = text.split(/\s+/);
  const mappedTokens = tokens.map(token => {
    const lower = token.toLowerCase();
    return WORD_TO_DIGIT[lower] ?? token;
  });
  text = mappedTokens.join(' ');

  // 11. Normalize PRD codes: "PRD 20" or "PRD dash 20" or "PRD-20" -> "PRD-0020"
  text = text.replace(/\bPRD\s*(?:dash|-)?\s*([a-zA-Z0-9]+)\b/gi, (_, code: string) => {
    if (/^\d+$/.test(code)) {
      return `PRD-${code.length < 4 ? code.padStart(4, '0') : code}`;
    }
    return `PRD-${code.toUpperCase()}`;
  });

  // 12. Normalize remaining single-letter prefix codes: "T 1" -> "T-1", "N 25" -> "N-25"
  text = text.replace(/\b([a-zA-Z])\s*(?:dash|-)\s*(\d+)\b/gi, '$1-$2');
  text = text.replace(/\b([tT])\s+(\d+)\b/g, '$1-$2');
  text = text.replace(/\b([nN])\s+(\d+)\b/g, '$1-$2');

  // 13. Millimeters: "3mm" / "3 mm" / "2.5 mm"
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:mm|milli\s*meter|m\.m\.)\b/gi, '$1 MM');

  return text.trim();
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const costs: number[] = [];

  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  return costs[b.length];
}

/**
 * Computes similarity ratio between 0.0 (no match) and 1.0 (exact match).
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const a = s1.trim().toLowerCase();
  const b = s2.trim().toLowerCase();
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Searches items using an intelligent scoring system.
 * AUTO-SELECT occurs ONLY when confidence is high (exact barcode or unique multi-token match).
 * Generic or ambiguous spoken terms will NEVER falsely auto-select a product.
 */
export function findBestVoiceMatch<
  T extends { barcode: string; name: string; size?: string; color?: string }
>(query: string, items: T[], alternatives: string[] = []): VoiceMatchResult<T> {
  const candidateQueries = [query, ...alternatives]
    .map(q => normalizeVoiceQuery(q))
    .filter(Boolean);

  if (candidateQueries.length === 0) {
    return { match: null, matches: [], normalizedQuery: '', matchType: 'NONE', confidence: 0 };
  }

  const primaryNormalized = candidateQueries[0];

  // 1. EXACT BARCODE CHECK across all candidate queries
  for (const q of candidateQueries) {
    const clean = q.toLowerCase().trim();
    const exact = items.find(
      i =>
        i.barcode.toLowerCase() === clean ||
        i.barcode.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, '')
    );
    if (exact) {
      return {
        match: exact,
        matches: [exact],
        normalizedQuery: exact.barcode,
        matchType: 'EXACT_CODE',
        confidence: 1.0,
      };
    }
  }

  // 2. TOKEN-BASED SCORING on primary query
  const queryWords = primaryNormalized
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0);

  type ScoredItem = { item: T; score: number; matchedTokens: number };

  const scored: ScoredItem[] = items.map(item => {
    let score = 0;
    let matchedTokens = 0;

    const barcodeNorm = item.barcode.toLowerCase();
    const nameNorm = item.name.toLowerCase();
    const sizeNorm = (item.size || '').toLowerCase();
    const colorNorm = (item.color || '').toLowerCase();

    for (const word of queryWords) {
      // Check barcode exact token or number match (e.g. "0020" or "prd-0020")
      if (barcodeNorm.includes(word)) {
        score += 35;
        matchedTokens++;
      }
      // Check color match (e.g. "t-1", "ml-27")
      else if (colorNorm && (colorNorm === word || colorNorm.includes(word))) {
        score += 25;
        matchedTokens++;
      }
      // Check size match (e.g. "3 mm", "2.5 mm")
      else if (sizeNorm && sizeNorm.includes(word)) {
        score += 20;
        matchedTokens++;
      }
      // Check product name match (e.g. "tyre", "moti")
      else if (nameNorm.includes(word)) {
        score += 20;
        matchedTokens++;
      }
      // Fuzzy similarity on name, size, or color
      else {
        const simName = stringSimilarity(word, nameNorm);
        const simColor = colorNorm ? stringSimilarity(word, colorNorm) : 0;
        const bestSim = Math.max(simName, simColor);
        if (bestSim >= 0.75) {
          score += 15 * bestSim;
          matchedTokens++;
        }
      }
    }

    return { item, score, matchedTokens };
  });

  // Filter items with at least some positive match
  const validScored = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (validScored.length === 0) {
    return {
      match: null,
      matches: [],
      normalizedQuery: primaryNormalized,
      matchType: 'NONE',
      confidence: 0,
    };
  }

  const top = validScored[0];
  const second = validScored[1];

  // Strong multi-token match: User spoke multiple details (e.g., "Tyre 3 MM T-1")
  // and the top candidate matched all/most tokens and is distinctly ahead of the 2nd candidate
  const isHighConfidenceSingle =
    queryWords.length >= 2 &&
    top.matchedTokens >= Math.min(2, queryWords.length) &&
    top.score >= 45 &&
    (!second || top.score - second.score >= 15);

  const matchedItems = validScored.slice(0, 15).map(s => s.item);

  if (isHighConfidenceSingle) {
    return {
      match: top.item,
      matches: [top.item],
      normalizedQuery: primaryNormalized,
      matchType: 'SINGLE_MATCH',
      confidence: Math.min(1.0, top.score / 100),
    };
  }

  // If user only spoke a single generic word (e.g. just "Tyre" or just "3 MM")
  // Or multiple products have similar scores:
  // DO NOT AUTO-SELECT! Return matching list for user to tap safely.
  return {
    match: null,
    matches: matchedItems,
    normalizedQuery: primaryNormalized,
    matchType: 'MULTIPLE',
    confidence: Math.min(0.7, top.score / 100),
  };
}

/**
 * Checks if Web Speech API is supported.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}
