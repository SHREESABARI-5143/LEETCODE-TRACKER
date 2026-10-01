import axios from 'axios';

async function main() {
  console.log('Testing contest ranking API for weekly-contest-517 and biweekly-contest-190...');
  
  // Test weekly-contest-517 search for Sabari_5143
  try {
    const res = await axios.get('https://leetcode.com/contest/api/ranking/weekly-contest-517/?pagination=1&region=global', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    console.log('WC 517 total participants in contest API:', res.data?.user_num);
  } catch (e: any) {
    console.log('Contest API err:', e.message);
  }

  // Let's check user ranking in contest API vs GraphQL
}

main().catch(console.error);
