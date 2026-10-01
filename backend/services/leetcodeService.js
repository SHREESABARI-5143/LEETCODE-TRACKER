const https = require('https');
const axios = require('axios');

const LEETCODE_GQL_URL = 'https://leetcode.com/graphql';

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 120,
  maxFreeSockets: 60,
  timeout: 4000,
  keepAliveMsecs: 30000
});

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': 'https://leetcode.com/',
  'Accept-Encoding': 'gzip, deflate, br'
};

const leetcodeAxios = axios.create({
  httpsAgent,
  headers: HEADERS,
  timeout: 3500
});

// In-memory cache for recent fetches
const LEETCODE_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Returns the cycle-key 'YYYY-MM-DD' for the current 5:30 AM IST → next 5:30 AM IST window.
 * 5:30 AM IST = 00:00 UTC.
 *
 * IMPORTANT: we must use the IST date, NOT the UTC date.
 * Between 00:00–05:29 UTC (i.e. 5:30–10:59 AM IST) the UTC calendar date is
 * already the *next* day, which would produce the wrong cycle key and cause
 * resolveDailyBaseline to treat every valid baseline as stale (old cycle).
 */
function getCurrent530AmCycleKey(date = new Date()) {
  // IST = UTC + 5:30 = UTC + 330 minutes
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(date.getTime() + istOffsetMs);

  // If IST time is before 5:30 AM IST (i.e. before 00:00 UTC of the same UTC date),
  // the cycle belongs to the *previous* IST calendar day.
  const istHour = istNow.getUTCHours();
  const istMin  = istNow.getUTCMinutes();
  const beforeReset = istHour < 5 || (istHour === 5 && istMin < 30);

  if (beforeReset) {
    // Back up by one IST day
    const prev = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
    const y = prev.getUTCFullYear();
    const m = String(prev.getUTCMonth() + 1).padStart(2, '0');
    const d = String(prev.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const y = istNow.getUTCFullYear();
  const m = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates current 5:30 AM IST to next 5:30 AM IST rolling window.
 * 5:30 AM IST = 00:00:00 UTC.
 */
function getIst530AmWindow() {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  let startIstDate = istNow.getUTCDate();
  if (istNow.getUTCHours() < 5 || (istNow.getUTCHours() === 5 && istNow.getUTCMinutes() < 30)) {
    startIstDate -= 1;
  }
  const startUtc = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), startIstDate, 0, 0, 0);
  const startSeconds = Math.floor(startUtc / 1000);
  const endSeconds = startSeconds + 86400;
  const weekStartSeconds = startSeconds - (7 * 86400);
  const monthStartSeconds = startSeconds - (30 * 86400);

  return {
    startSeconds,
    endSeconds,
    weekStartSeconds,
    monthStartSeconds
  };
}

/**
 * Execute GraphQL query against LeetCode with persistent connection & rate limit retry backoff.
 */
async function postGraphQL(query, variables, retries = 2) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await leetcodeAxios.post(
        LEETCODE_GQL_URL,
        { query, variables }
      );
      return response;
    } catch (error) {
      attempt++;
      const status = error.response?.status ? Number(error.response.status) : null;
      // 404 or non-429 4xx errors should not be retried
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      if (attempt > retries) {
        throw error;
      }
      // Exponential backoff: attempt 1 -> 300ms, attempt 2 -> 700ms
      const backoffMs = attempt === 1 ? 300 : 700;
      await new Promise(res => setTimeout(res, backoffMs));
    }
  }
}

/**
 * Fetch student LeetCode statistics from public GraphQL endpoint.
 */
async function fetchUserLeetcodeStats(username) {
  const cleanUsername = username ? username.trim() : '';
  if (!cleanUsername || cleanUsername.startsWith('NIL_')) {
    return {
      status: 'ProfileNotFound',
      error: 'Empty or invalid username provided',
      data: null
    };
  }

  // Check cache first (5-minute TTL)
  const cached = LEETCODE_CACHE.get(cleanUsername.toLowerCase());
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.result;
  }

  const query = `
    query fullLeetcodeProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          ranking
          userAvatar
          realName
          reputation
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
          totalSubmissionNum {
            difficulty
            count
            submissions
          }
        }
        userCalendar {
          streak
          totalActiveDays
          submissionCalendar
        }
        badges {
          id
          displayName
          icon
        }
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
        totalParticipants
        attendedContestsCount
        topPercentage
        badge {
          name
        }
      }
      userContestRankingHistory(username: $username) {
        attended
        rating
        ranking
        problemsSolved
        totalProblems
        finishTimeInSeconds
        contest {
          title
          startTime
        }
      }
      recentAcSubmissionList(username: $username, limit: 50) {
        titleSlug
        timestamp
      }
    }
  `;

  try {
    const response = await postGraphQL(query, { username: cleanUsername });
    const matchedUser = response.data?.data?.matchedUser;
    const contestInfo = response.data?.data?.userContestRanking;
    const contestHistoryRaw = response.data?.data?.userContestRankingHistory || [];
    const recentAcList = response.data?.data?.recentAcSubmissionList || [];

    if (!matchedUser) {
      const result = {
        status: 'ProfileNotFound',
        error: `LeetCode profile '${cleanUsername}' not found`,
        data: null
      };
      return result;
    }

    const acStats = matchedUser.submitStats?.acSubmissionNum || [];
    const totalStats = matchedUser.submitStats?.totalSubmissionNum || [];

    let easy = 0;
    let medium = 0;
    let hard = 0;
    let total = 0;
    let totalAcSubmissions = 0;
    let totalAllSubmissions = 0;

    for (const stat of acStats) {
      if (stat.difficulty === 'Easy') easy = Number(stat.count || 0);
      else if (stat.difficulty === 'Medium') medium = Number(stat.count || 0);
      else if (stat.difficulty === 'Hard') hard = Number(stat.count || 0);
      else if (stat.difficulty === 'All') {
        total = Number(stat.count || 0);
        totalAcSubmissions = Number(stat.submissions || 0);
      }
    }

    for (const stat of totalStats) {
      if (stat.difficulty === 'All') {
        totalAllSubmissions = Number(stat.submissions || 0);
      }
    }

    let acceptanceRate = 0;
    if (totalAllSubmissions > 0) {
      acceptanceRate = Math.round((totalAcSubmissions / totalAllSubmissions) * 1000) / 10;
    }

    const ranking = matchedUser.profile?.ranking ? Math.round(Number(matchedUser.profile.ranking)) : null;
    const contestRating = contestInfo?.rating ? Math.round(Number(contestInfo.rating)) : 0;
    const contestGlobalRank = contestInfo?.globalRanking ? Math.round(Number(contestInfo.globalRanking)) : null;
    const calculatedTotal = easy + medium + hard;
    let checksumValid = true;

    if (total !== calculatedTotal) {
      if (total === 0 && calculatedTotal > 0) {
        total = calculatedTotal;
      } else if (total > 0 && calculatedTotal !== total) {
        checksumValid = false;
      }
    }

    // Process attended contests in chronological order to compute rating changes
    const attendedRaw = contestHistoryRaw
      .filter(h => h.attended)
      .sort((a, b) => (a.contest?.startTime || 0) - (b.contest?.startTime || 0));

    let prevRating = 1500;
    let maxRating = contestRating;

    const attendedContests = attendedRaw.map(h => {
      const curRating = Math.round(Number(h.rating));
      const ratingChange = curRating - prevRating;
      prevRating = curRating;
      if (curRating > maxRating) maxRating = curRating;

      return {
        contestName: h.contest?.title || 'LeetCode Contest',
        contestDate: h.contest?.startTime ? new Date(h.contest.startTime * 1000).toISOString() : null,
        rating: curRating,
        ratingChange: ratingChange,
        rank: h.ranking || 0,
        problemsSolved: h.problemsSolved !== undefined ? Number(h.problemsSolved) : 0,
        totalProblems: h.totalProblems !== undefined ? Number(h.totalProblems) : 4
      };
    });

    // Parse submission calendar into activity day list and compute daily/weekly/monthly solved counts strictly based on 5:30 AM IST window
    const { startSeconds, endSeconds, weekStartSeconds, monthStartSeconds } = getIst530AmWindow();
    let activityDays = [];
    let calToday = 0;
    let calWeek = 0;
    let calMonth = 0;

    try {
      const subCalStr = matchedUser.userCalendar?.submissionCalendar;
      if (subCalStr) {
        const parsedCal = JSON.parse(subCalStr);
        activityDays = Object.entries(parsedCal).map(([ts, count]) => {
          const sec = Number(ts);
          const ms = sec * 1000;
          const numCount = Number(count) || 0;
          if (sec === startSeconds) calToday += numCount;
          if (sec >= weekStartSeconds && sec < endSeconds) calWeek += numCount;
          if (sec >= monthStartSeconds && sec < endSeconds) calMonth += numCount;
          return {
            date: new Date(ms).toISOString().split('T')[0],
            count: numCount
          };
        });
      }
    } catch (calErr) {}

    // Unique recent submissions within the 5:30 AM IST window
    const recentToday = recentAcList.filter(r => {
      const ts = Number(r.timestamp);
      return ts >= startSeconds && ts < endSeconds;
    });
    const uniqueTodayAc = new Set(recentToday.map(r => r.titleSlug)).size;

    const recentWeek = recentAcList.filter(r => {
      const ts = Number(r.timestamp);
      return ts >= weekStartSeconds && ts < endSeconds;
    });
    const uniqueWeekAc = new Set(recentWeek.map(r => r.titleSlug)).size;

    const recentMonth = recentAcList.filter(r => {
      const ts = Number(r.timestamp);
      return ts >= monthStartSeconds && ts < endSeconds;
    });
    const uniqueMonthAc = new Set(recentMonth.map(r => r.titleSlug)).size;

    const dailySolved = Math.max(uniqueTodayAc, calToday);
    const weeklySolved = Math.max(uniqueWeekAc, calWeek);
    const monthlySolved = Math.max(uniqueMonthAc, calMonth);

    const result = {
      status: 'OK',
      error: null,
      data: {
        easy_solved: easy,
        medium_solved: medium,
        hard_solved: hard,
        total_solved: total,
        daily_solved: dailySolved,
        weekly_solved: weeklySolved,
        monthly_solved: monthlySolved,
        ranking: ranking,
        contest_rating: contestRating,
        highest_contest_rating: maxRating || contestRating,
        contest_global_rank: contestGlobalRank,
        attended_contests_count: contestInfo?.attendedContestsCount || attendedContests.length || 0,
        top_percentage: contestInfo?.topPercentage || null,
        real_name: matchedUser.profile?.realName || cleanUsername,
        avatar_url: matchedUser.profile?.userAvatar || null,
        reputation: matchedUser.profile?.reputation || 0,
        acceptance_rate: acceptanceRate,
        streak: matchedUser.userCalendar?.streak || 0,
        total_active_days: matchedUser.userCalendar?.totalActiveDays || activityDays.length,
        badges: matchedUser.badges || [],
        contest_history: attendedContests.reverse(), // reverse for newest first table display
        activity_days: activityDays,
        checksum_valid: checksumValid
      }
    };

    LEETCODE_CACHE.set(cleanUsername.toLowerCase(), { result, timestamp: Date.now() });
    return result;

  } catch (error) {
    const statusNum = error.response?.status;
    if (statusNum === 429) {
      return {
        status: 'RateLimited',
        error: 'LeetCode API rate limit reached (HTTP 429)',
        data: null
      };
    } else if (statusNum === 404) {
      return {
        status: 'ProfileNotFound',
        error: `LeetCode username '${cleanUsername}' does not exist (HTTP 404)`,
        data: null
      };
    }

    return {
      status: 'ParseError',
      error: error.message || 'Failed to fetch LeetCode user statistics',
      data: null
    };
  }
}

/**
 * Fast verification for checking if a student has solved specific problem slugs.
 */
async function checkStudentSolvedProblems(username, resolvedItems) {
  if (!resolvedItems || resolvedItems.length === 0) return [];

  const cleanUsername = username ? username.trim() : '';
  if (!cleanUsername || cleanUsername.startsWith('NIL_')) {
    return resolvedItems.map(item => ({
      question_list_item_id: item.id,
      solved: false,
      solved_at: null,
      verified_via: 'graphql_progress_check'
    }));
  }

  const targetSlugs = new Set(resolvedItems.map(item => item.resolved_slug).filter(Boolean));
  const solvedSlugMap = new Map();

  const recentAcQuery = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        titleSlug
        timestamp
      }
    }
  `;

  try {
    const resp = await leetcodeAxios.post(
      LEETCODE_GQL_URL,
      { query: recentAcQuery, variables: { username: cleanUsername, limit: 300 } }
    );
    const recentSubmissions = resp.data?.data?.recentAcSubmissionList || [];

    for (const sub of recentSubmissions) {
      if (sub.titleSlug && targetSlugs.has(sub.titleSlug)) {
        solvedSlugMap.set(sub.titleSlug, {
          solved: true,
          solved_at: sub.timestamp ? new Date(Number(sub.timestamp) * 1000) : new Date(),
          verified_via: 'recent_ac_submissions'
        });
      }
    }
  } catch (err) {}

  return resolvedItems.map(item => {
    const verified = solvedSlugMap.get(item.resolved_slug);
    return {
      question_list_item_id: item.id,
      solved: verified ? verified.solved : false,
      solved_at: verified ? verified.solved_at : null,
      verified_via: verified ? verified.verified_via : 'graphql_progress_check'
    };
  });
}

module.exports = {
  fetchUserLeetcodeStats,
  checkStudentSolvedProblems,
  getIst530AmWindow,
  getCurrent530AmCycleKey
};
