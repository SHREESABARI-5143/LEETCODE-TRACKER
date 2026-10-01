/**
 * Problem slug utilities for the Contest Analytics pipeline.
 *
 * Pipeline:
 *   FULL QUESTION TITLE
 *     → normalizeProblemTitle()
 *     → generateCandidateSlug()
 *     → matchSlugAgainstKnown()
 *     → verified slug (or unresolved)
 */

export interface SlugMatchResult {
  originalTitle: string;
  normalizedTitle: string;
  generatedSlug: string;
  matchedSlug: string;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'unresolved';
  confidence: number; // 0.0 – 1.0
}

/**
 * Normalize a problem title for comparison.
 * Handles: casing, leading/trailing spaces, multiple spaces, apostrophes.
 */
export function normalizeProblemTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    // Collapse multiple spaces into one
    .replace(/\s+/g, ' ')
    // Remove apostrophes (e.g. "Don't" → "dont")
    .replace(/'/g, '')
    .trim();
}

/**
 * Generate a candidate LeetCode slug from a problem title.
 *
 * Handles:
 *   - uppercase/lowercase → lowercase
 *   - spaces → hyphens
 *   - punctuation removal (except hyphens)
 *   - Roman numerals preserved (II, III, IV, etc.)
 *   - repeated hyphens collapsed
 *   - leading/trailing hyphens removed
 */
export function generateCandidateSlug(title: string): string {
  if (!title || !title.trim()) return '';

  return title
    .trim()
    .toLowerCase()
    // Remove apostrophes
    .replace(/'/g, '')
    // Replace any character that is not alphanumeric, space, or hyphen
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Collapse repeated hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Calculate token overlap score between two slugs.
 * Returns a ratio from 0.0 to 1.0.
 */
function tokenOverlapScore(slugA: string, slugB: string): number {
  const tokensA = slugA.split('-').filter(Boolean);
  const tokensB = slugB.split('-').filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const overlap = tokensA.filter(t => setB.has(t)).length;
  return overlap / Math.max(tokensA.length, tokensB.length);
}

/**
 * Match a candidate slug against a list of known (verified) contest problem slugs.
 *
 * Matching tiers:
 *   1. Exact match → confidence 1.0
 *   2. Normalized match (e.g. Roman numeral edge cases) → confidence 0.95
 *   3. Fuzzy token overlap (≥ 60%) → confidence = overlap ratio
 *   4. Unresolved → confidence 0
 *
 * IMPORTANT: This function is ONLY used to map a problem TITLE to a verified SLUG.
 * Student submissions are ALWAYS matched by exact slug comparison.
 */
export function matchSlugAgainstKnown(
  title: string,
  knownSlugs: string[]
): SlugMatchResult {
  const originalTitle = title;
  const normalizedTitle = normalizeProblemTitle(title);
  const generatedSlug = generateCandidateSlug(title);

  if (!generatedSlug) {
    return {
      originalTitle,
      normalizedTitle,
      generatedSlug: '',
      matchedSlug: '',
      matchType: 'unresolved',
      confidence: 0,
    };
  }

  // If no known slugs provided, return the generated slug as best-effort
  if (knownSlugs.length === 0) {
    return {
      originalTitle,
      normalizedTitle,
      generatedSlug,
      matchedSlug: generatedSlug,
      matchType: 'exact',
      confidence: 1.0,
    };
  }

  // ── Tier 1: Exact match ──
  if (knownSlugs.includes(generatedSlug)) {
    return {
      originalTitle,
      normalizedTitle,
      generatedSlug,
      matchedSlug: generatedSlug,
      matchType: 'exact',
      confidence: 1.0,
    };
  }

  // ── Tier 2: Normalized match ──
  // Try common variations:
  //   - trailing Roman numerals: "ii" vs "2", etc.
  //   - with/without trailing number
  const normalizedVariants = [
    generatedSlug,
    // Convert trailing Roman numerals to digits and vice-versa
    generatedSlug.replace(/-iv$/, '-4'),
    generatedSlug.replace(/-iii$/, '-3'),
    generatedSlug.replace(/-ii$/, '-2'),
    generatedSlug.replace(/-i$/, '-1'),
    generatedSlug.replace(/-4$/, '-iv'),
    generatedSlug.replace(/-3$/, '-iii'),
    generatedSlug.replace(/-2$/, '-ii'),
    generatedSlug.replace(/-1$/, '-i'),
  ];

  for (const variant of normalizedVariants) {
    const found = knownSlugs.find(s => s === variant);
    if (found) {
      return {
        originalTitle,
        normalizedTitle,
        generatedSlug,
        matchedSlug: found,
        matchType: 'normalized',
        confidence: 0.95,
      };
    }
  }

  // ── Tier 3: Fuzzy token overlap ──
  let bestSlug = '';
  let bestScore = 0;

  for (const slug of knownSlugs) {
    const score = tokenOverlapScore(generatedSlug, slug);
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      bestSlug = slug;
    }
  }

  if (bestSlug) {
    return {
      originalTitle,
      normalizedTitle,
      generatedSlug,
      matchedSlug: bestSlug,
      matchType: 'fuzzy',
      confidence: parseFloat(bestScore.toFixed(2)),
    };
  }

  // ── Tier 4: Unresolved ──
  return {
    originalTitle,
    normalizedTitle,
    generatedSlug,
    matchedSlug: '',
    matchType: 'unresolved',
    confidence: 0,
  };
}
