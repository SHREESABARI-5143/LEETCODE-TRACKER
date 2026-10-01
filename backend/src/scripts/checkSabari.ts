import axios from 'axios';

async function main() {
  const username = 'Sabari_5143';
  console.log(`Checking GraphQL userContestRankingHistory for ${username}...`);
  const query = {
    query: `
      query userContestRankingInfo($username: String!) {
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
      }
    `,
    variables: { username },
  };
  const res = await axios.post('https://leetcode.com/graphql', query, {
    headers: { 'Content-Type': 'application/json' },
  });
  const history = res.data?.data?.userContestRankingHistory?.filter((h: any) => h.attended) || [];
  console.log('Recent 5 contests in GraphQL history for Sabari_5143:');
  console.log(history.slice(-5));
}

main().catch(console.error);
