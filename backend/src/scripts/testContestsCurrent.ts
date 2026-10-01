import axios from 'axios';

async function testContestsCurrent() {
  const authRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
    collegeEmail: 'hod@svec.edu.in',
    password: 'HOD@1234',
  });
  const token = authRes.data.data.accessToken;

  console.log('Testing GET /api/v1/analytics/contests/current...');
  const res = await axios.get('http://localhost:4000/api/v1/analytics/contests/current', {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('Status:', res.status);
  console.log('Success:', res.data.success);
  console.log('Current Contest:', res.data.data.currentContest);
  console.log('Summary:', res.data.data.summary);
  console.log('Problems count:', res.data.data.problems?.length);
  console.log('Students count:', res.data.data.students?.length);
  console.log('First 3 students:', res.data.data.students?.slice(0, 3));
}

testContestsCurrent().catch(console.error);
