import { prisma } from '../config/prisma';
import axios from 'axios';

async function main() {
  const cr = await prisma.contestResult.findFirst({
    where: { contestName: { contains: '517' } },
    include: { student: { include: { profile: true } } },
  });
  console.log('Found contest 517 result:');
  console.log(cr);

  if (cr) {
    const username = cr.student.leetcodeUsername;
    console.log(`\nTesting LeetCode GraphQL for username: ${username}`);
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
    console.log('Recent 5 contests in GraphQL history:');
    console.log(history.slice(-5));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
