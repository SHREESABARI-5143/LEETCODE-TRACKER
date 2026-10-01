import axios from 'axios';

async function test() {
  const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

  // 1. Test topTwoContests / upcomingContests
  try {
    const res = await axios.post(
      LEETCODE_GRAPHQL_URL,
      {
        query: `
          query getUpcomingContests {
            topTwoContests {
              title
              titleSlug
              startTime
              duration
              cardImg
            }
          }
        `,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );
    console.log('Upcoming Contests:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('Failed topTwoContests:', err.message);
  }

  // 2. Test problem lookup by titleSlug
  try {
    const res2 = await axios.post(
      LEETCODE_GRAPHQL_URL,
      {
        query: `
          query questionData($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionId
              questionFrontendId
              title
              titleSlug
              difficulty
            }
          }
        `,
        variables: { titleSlug: 'two-sum' },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );
    console.log('Question detail (two-sum):', JSON.stringify(res2.data, null, 2));
  } catch (err: any) {
    console.error('Failed questionData:', err.message);
  }
}

test();
