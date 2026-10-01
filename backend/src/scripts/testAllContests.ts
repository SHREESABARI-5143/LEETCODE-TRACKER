import axios from 'axios';

async function testAllContestEndpoints() {
  const authRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
    collegeEmail: 'hod@svec.edu.in',
    password: 'HOD@1234',
  });
  const token = authRes.data.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  console.log('\n1. Testing GET /api/v1/analytics/contests/current...');
  const resCurrent = await axios.get('http://localhost:4000/api/v1/analytics/contests/current', { headers });
  console.log('  Current Contest Status:', resCurrent.status, 'Name:', resCurrent.data.data?.currentContest?.contestName);

  console.log('\n2. Testing GET /api/v1/analytics/contests/history...');
  const resHistory = await axios.get('http://localhost:4000/api/v1/analytics/contests/history', { headers });
  console.log('  History Status:', resHistory.status, 'Past Contests Count:', resHistory.data.data?.pastContests?.length);

  console.log('\n3. Testing GET /api/v1/analytics/contests/weekly-contest-517...');
  const resDetail = await axios.get('http://localhost:4000/api/v1/analytics/contests/weekly-contest-517', { headers });
  console.log('  Detail Status:', resDetail.status, 'Attended Count:', resDetail.data.data?.attendedCount);

  console.log('\n4. Testing GET /api/v1/analytics/contest-summary...');
  const resSummary = await axios.get('http://localhost:4000/api/v1/analytics/contest-summary', { headers });
  console.log('  Summary Status:', resSummary.status, 'Total Contests:', resSummary.data.data?.totalContests, 'Total Participations:', resSummary.data.data?.totalParticipations);
}

testAllContestEndpoints().catch(console.error);
