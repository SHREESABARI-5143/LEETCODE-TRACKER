const axios = require('axios');

// In-memory catalog cache for full LeetCode problem list
let problemCatalogCache = {
  data: [],
  slugMap: new Map(),
  lastUpdated: 0
};

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours cache TTL

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  
  const dist = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  return (maxLen - dist) / maxLen;
}

function normalizeProblemInput(rawInput) {
  if (!rawInput) return '';
  return rawInput
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

async function getProblemCatalog() {
  if (problemCatalogCache.data.length > 0 && (Date.now() - problemCatalogCache.lastUpdated < CATALOG_TTL_MS)) {
    return problemCatalogCache;
  }

  try {
    const response = await axios.get('https://leetcode.com/api/problems/all/', {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const statStatusPairs = response.data?.stat_status_pairs || [];
    const catalog = statStatusPairs.map(item => {
      const difficultyNum = item.difficulty?.level;
      const diffStr = difficultyNum === 1 ? 'Easy' : difficultyNum === 2 ? 'Medium' : 'Hard';
      return {
        id: item.stat.question_id,
        title: item.stat.question__title,
        slug: item.stat.question__title_slug,
        difficulty: diffStr
      };
    });

    const slugMap = new Map();
    catalog.forEach(item => slugMap.set(item.slug, item));

    problemCatalogCache = {
      data: catalog,
      slugMap,
      lastUpdated: Date.now()
    };
    return problemCatalogCache;
  } catch (error) {
    console.warn('[ProblemResolver] Could not fetch live problem catalog from LeetCode. Using fallback matching.', error.message);
    return problemCatalogCache;
  }
}

async function resolveProblemName(inputRaw) {
  const trimmed = inputRaw ? inputRaw.toString().trim() : '';
  const normalizedSlug = normalizeProblemInput(trimmed);

  if (!trimmed) {
    return {
      input_title: inputRaw || '',
      resolved_slug: null,
      resolved_title: null,
      difficulty: null,
      resolution_status: 'Unresolved',
      resolution_candidates: []
    };
  }

  const { data: catalog, slugMap } = await getProblemCatalog();

  // 1. Direct Slug Match
  if (slugMap.has(normalizedSlug)) {
    const match = slugMap.get(normalizedSlug);
    return {
      input_title: trimmed,
      resolved_slug: match.slug,
      resolved_title: match.title,
      difficulty: match.difficulty,
      resolution_status: 'Resolved',
      resolution_candidates: []
    };
  }

  // 2. Exact Title Match (Case-Insensitive)
  const titleMatch = catalog.find(p => p.title.toLowerCase() === trimmed.toLowerCase());
  if (titleMatch) {
    return {
      input_title: trimmed,
      resolved_slug: titleMatch.slug,
      resolved_title: titleMatch.title,
      difficulty: titleMatch.difficulty,
      resolution_status: 'Resolved',
      resolution_candidates: []
    };
  }

  // 3. Fuzzy Candidate Search
  const matches = [];
  for (const item of catalog) {
    const slugSim = calculateSimilarity(normalizedSlug, item.slug);
    const titleSim = calculateSimilarity(trimmed, item.title);
    const maxSim = Math.max(slugSim, titleSim);

    if (maxSim >= 0.55) {
      matches.push({ ...item, score: maxSim });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    const topMatch = matches[0];
    if (topMatch.score >= 0.85) {
      return {
        input_title: trimmed,
        resolved_slug: topMatch.slug,
        resolved_title: topMatch.title,
        difficulty: topMatch.difficulty,
        resolution_status: 'Resolved',
        resolution_candidates: matches.slice(0, 3).map(m => ({ slug: m.slug, title: m.title, difficulty: m.difficulty }))
      };
    } else {
      return {
        input_title: trimmed,
        resolved_slug: null,
        resolved_title: null,
        difficulty: null,
        resolution_status: 'Ambiguous',
        resolution_candidates: matches.slice(0, 5).map(m => ({ slug: m.slug, title: m.title, difficulty: m.difficulty }))
      };
    }
  }

  // 4. Fallback: Unresolved
  return {
    input_title: trimmed,
    resolved_slug: null,
    resolved_title: null,
    difficulty: null,
    resolution_status: 'Unresolved',
    resolution_candidates: []
  };
}

async function resolveBatchProblemNames(titleList) {
  const results = [];
  for (const raw of titleList) {
    const resolved = await resolveProblemName(raw);
    results.push(resolved);
  }
  return results;
}

module.exports = {
  resolveProblemName,
  resolveBatchProblemNames,
  normalizeProblemInput,
  getProblemCatalog
};
