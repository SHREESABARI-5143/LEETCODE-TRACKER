import axios from 'axios';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const COMBINED_QUERY = `
  query getStudentFullLeetCodeData($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        realName
        userAvatar
        reputation
        ranking
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
      submissionCalendar
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
      topPercentage
    }
    userContestRankingHistory(username: $username) {
      attended
      trendDirection
      problemsSolved
      totalProblems
      finishTimeInSeconds
      rating
      ranking
      contest {
        title
        startTime
      }
    }
    recentAcSubmissionList(username: $username, limit: 15) {
      title
      titleSlug
      timestamp
    }
  }
`;

async function test() {
  const t0 = Date.now();
  const res = await axios.post(
    LEETCODE_GRAPHQL_URL,
    { query: COMBINED_QUERY, variables: { username: 'balahariharan003' } },
    { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
  );
  const t1 = Date.now();
  console.log(`✓ Fetched in ${t1 - t0}ms!`);
  console.log('Username:', res.data?.data?.matchedUser?.username);
  console.log('Contests attended:', res.data?.data?.userContestRanking?.attendedContestsCount);
  console.log('Recent submissions:', res.data?.data?.recentAcSubmissionList?.length);
  console.log('Contest history items:', res.data?.data?.userContestRankingHistory?.length);
}

test().catch(console.error);
