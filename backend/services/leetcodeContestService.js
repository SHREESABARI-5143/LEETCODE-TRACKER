const axios = require('axios');

const LEETCODE_GQL_URL = 'https://leetcode.com/graphql';

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://leetcode.com/'
};

// In-memory cache for contest status checks: key -> { result, timestamp }
const CONTEST_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

function buildContestName(contestNumber, contestType) {
  const num = parseInt(contestNumber, 10);
  const typeUpper = (contestType || 'WEEKLY').toString().toUpperCase().trim();
  const prefix = typeUpper === 'BIWEEKLY' ? 'Biweekly Contest' : 'Weekly Contest';
  return `${prefix} ${num}`;
}

async function fetchUserContestStatus(username, contestNumber, contestType) {
  const cleanUsername = username ? username.trim() : '';
  const num = parseInt(contestNumber, 10);
  const typeNorm = (contestType || 'WEEKLY').toString().toUpperCase().trim();
  const contestName = buildContestName(num, typeNorm);

  if (!cleanUsername || cleanUsername.startsWith('NIL_')) {
    return {
      username: cleanUsername || username,
      contestNumber: num,
      contestType: typeNorm,
      contestName,
      attended: null,
      status: 'USER_NOT_FOUND'
    };
  }

  const cacheKey = `${cleanUsername.toLowerCase()}_${typeNorm}_${num}`;
  const cached = CONTEST_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }

  const query = `
    query userContestRankingInfo($username: String!) {
      matchedUser(username: $username) {
        username
      }
      userContestRankingHistory(username: $username) {
        attended
        problemsSolved
        finishTimeInSeconds
        ranking
        contest {
          title
          startTime
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_GQL_URL,
      { query, variables: { username: cleanUsername } },
      { headers: HEADERS, timeout: 8000 }
    );

    const data = response.data?.data;
    const matchedUser = data?.matchedUser;

    if (!matchedUser) {
      const result = {
        username: cleanUsername,
        contestNumber: num,
        contestType: typeNorm,
        contestName,
        attended: null,
        status: 'USER_NOT_FOUND'
      };
      CONTEST_CACHE.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    const history = data?.userContestRankingHistory || [];
    const targetNameLower = contestName.toLowerCase();

    const contestRecord = history.find(item => item.contest && item.contest.title && item.contest.title.trim().toLowerCase() === targetNameLower);

    let attended = false;
    let problemsSolved = 0;
    let ranking = null;

    if (contestRecord) {
      attended = Boolean(contestRecord.attended);
      problemsSolved = contestRecord.problemsSolved || 0;
      ranking = contestRecord.ranking || null;
    }

    const result = {
      username: cleanUsername,
      contestNumber: num,
      contestType: typeNorm,
      contestName,
      attended,
      problemsSolved,
      ranking,
      status: 'OK'
    };

    CONTEST_CACHE.set(cacheKey, { result, timestamp: Date.now() });
    return result;

  } catch (error) {
    const statusNum = error.response?.status;
    let errorStatus = 'EXTERNAL_API_ERROR';
    if (statusNum === 404) {
      errorStatus = 'USER_NOT_FOUND';
    }

    return {
      username: cleanUsername,
      contestNumber: num,
      contestType: typeNorm,
      contestName,
      attended: null,
      status: errorStatus
    };
  }
}

async function fetchContestStatusBatch(usernames, contestNumber, contestType) {
  const num = parseInt(contestNumber, 10);
  const typeNorm = (contestType || 'WEEKLY').toString().toUpperCase().trim();
  const contestName = buildContestName(num, typeNorm);

  if (!Array.isArray(usernames) || usernames.length === 0) {
    return {
      contestNumber: num,
      contestType: typeNorm,
      contestName,
      results: []
    };
  }

  const results = [];
  const CONCURRENCY = 15;
  const chunks = [];

  for (let i = 0; i < usernames.length; i += CONCURRENCY) {
    chunks.push(usernames.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(uname => fetchUserContestStatus(uname, num, typeNorm))
    );
    results.push(...chunkResults);
  }

  return {
    contestNumber: num,
    contestType: typeNorm,
    contestName,
    results
  };
}

module.exports = {
  buildContestName,
  fetchUserContestStatus,
  fetchContestStatusBatch
};
