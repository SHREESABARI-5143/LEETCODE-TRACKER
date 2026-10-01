/**
 * Fetches real LeetCode profile data for all 136 4th year students
 * Uses the public LeetCode GraphQL API
 * Run: node fetch_leetcode.js
 */

const https = require('https');
const fs = require('fs');

const STUDENTS = require('./students_4th_year.json');

const QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      realName
      ranking
      reputation
      starRating
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    userContestRanking {
      rating
      globalRanking
      totalParticipants
      topPercentage
      attendedContestsCount
    }
    badges {
      id
      name
    }
  }
  userContestRankingHistory(username: $username) {
    attended
    rating
    ranking
    problemsSolved
    finishTimeInSeconds
    contest {
      title
      startTime
    }
    ratingChange
  }
}
`;

function fetchLeetCode(username) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: QUERY, variables: { username } });
    const options = {
      hostname: 'leetcode.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://leetcode.com/${username}/`,
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ username, data: json.data, error: null });
        } catch (e) {
          resolve({ username, data: null, error: 'parse_error' });
        }
      });
    });

    req.on('error', (e) => resolve({ username, data: null, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ username, data: null, error: 'timeout' }); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`Fetching LeetCode data for ${STUDENTS.length} students...`);
  const results = [];
  let done = 0;
  let failed = 0;

  for (const student of STUDENTS) {
    process.stdout.write(`[${done+1}/${STUDENTS.length}] ${student.username}... `);
    const result = await fetchLeetCode(student.username);

    const mu = result.data?.matchedUser;
    const history = result.data?.userContestRankingHistory || [];

    if (!mu) {
      console.log(`FAILED (${result.error || 'not found'})`);
      failed++;
      results.push({ ...student, fetched: false });
    } else {
      const stats = mu.submitStats?.acSubmissionNum || [];
      const easy   = stats.find(s => s.difficulty === 'Easy')?.count || 0;
      const medium = stats.find(s => s.difficulty === 'Medium')?.count || 0;
      const hard   = stats.find(s => s.difficulty === 'Hard')?.count || 0;
      const total  = easy + medium + hard;
      const rating = Math.round(mu.userContestRanking?.rating || 0);
      const rank   = mu.userContestRanking?.globalRanking || 0;
      const contests = history.filter(h => h.attended).length;

      console.log(`OK — ${total} solved (E:${easy} M:${medium} H:${hard}) Rating:${rating}`);

      results.push({
        ...student,
        fetched: true,
        totalSolved: total,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        contestRating: rating,
        globalRank: rank,
        attendedContests: contests,
        badges: (mu.badges || []).map(b => ({ id: b.id, name: b.name, icon: '🏅' })),
        contestHistory: history.filter(h => h.attended).slice(-20).map(h => ({
          contestTitle: h.contest?.title || 'Contest',
          rating: Math.round(h.rating || 0),
          ranking: h.ranking || 0,
          problemsSolved: h.problemsSolved || 0,
          finishTime: Math.round((h.finishTimeInSeconds || 0) / 60),
          attended: true,
          ratingChange: Math.round(h.ratingChange || 0),
          date: h.contest?.startTime ? new Date(h.contest.startTime * 1000).toISOString().split('T')[0] : '',
        })),
        profileRanking: mu.profile?.ranking || 0,
        reputation: mu.profile?.reputation || 0,
      });
    }

    done++;
    // 1.5 second delay between requests to respect rate limits
    await sleep(1500);
  }

  fs.writeFileSync('leetcode_data_4th_year.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Done! ${done - failed}/${done} succeeded, ${failed} failed.`);
  console.log('Saved to leetcode_data_4th_year.json');
}

main().catch(console.error);
