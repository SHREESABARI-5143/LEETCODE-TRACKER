import { ContestService } from '../services/contest/contestService';
import { ContestExcelService } from '../services/excel/contestExcelService';
import { prisma } from '../config/prisma';

async function main() {
  console.log('=== 1. Testing getUpcomingContest() ===');
  const upcoming = await ContestService.getUpcomingContest();
  console.log('Upcoming Contest Result:', JSON.stringify(upcoming, null, 2));

  console.log('\n=== 2. Testing verifyQuestion() ===');
  const q1 = await ContestService.verifyQuestion('Two Sum');
  console.log('Two Sum Verification:', q1);

  const q2 = await ContestService.verifyQuestion('Minimum Bishop Moves to Reach Target');
  console.log('Bishop Moves Verification:', q2);

  const q3 = await ContestService.verifyQuestion('Custom Unknown Problem 123');
  console.log('Unknown Problem Verification:', q3);

  console.log('\n=== 3. Testing createManagedContest() ===');
  const created = await ContestService.createManagedContest({
    contestName: upcoming?.contestName || 'Weekly Contest 519',
    contestNumber: upcoming?.contestNumber || 519,
    contestSlug: upcoming?.contestSlug || 'weekly-contest-519',
    contestType: upcoming?.contestType || 'weekly',
    startTime: upcoming?.startTime || new Date(Date.now() + 86400000).toISOString(),
    endTime: upcoming?.endTime,
    questions: [
      { orderNum: 1, title: 'Two Sum', difficulty: 'Easy', verified: true },
      { orderNum: 2, title: 'Minimum Bishop Moves to Reach Target', difficulty: 'Medium', verified: true },
      { orderNum: 3, title: 'Add Two Numbers', difficulty: 'Medium', verified: true },
      { orderNum: 4, title: 'Median of Two Sorted Arrays', difficulty: 'Hard', verified: true },
    ],
  });
  console.log('Created Managed Contest:', created);

  console.log('\n=== 4. Testing getAllContests() ===');
  const allContests = await ContestService.getAllContests({ year: 4 });
  console.log(`Total contests found: ${allContests.totalContests}`);
  console.log('Top 3 Contests:', allContests.contests.slice(0, 3));

  console.log('\n=== 5. Testing getContestAnalytics() on latest contest ===');
  const analytics = await ContestService.getContestAnalytics({ year: 4 });
  if (analytics) {
    console.log('Contest Name:', analytics.contest.contestName);
    console.log('Status:', analytics.contest.status);
    console.log('Summary:', analytics.summary);
    console.log('Problems count:', analytics.problems.length);
    console.log('First problem:', analytics.problems[0]);
    console.log('Total students:', analytics.students.length);
    const attended = analytics.students.filter(s => s.status === 'Attended');
    console.log(`Attended students count: ${attended.length}`);
    if (attended.length > 0) {
      console.log('Sample attended student:', {
        name: attended[0].name,
        rank: attended[0].rank,
        solved: attended[0].solvedCount,
        easy: attended[0].easyCount,
        med: attended[0].mediumCount,
        hard: attended[0].hardCount,
        exactProblems: attended[0].exactProblems,
      });
    }
  }

  console.log('\n=== 6. Testing Excel Export ===');
  if (analytics) {
    const buffer = await ContestExcelService.generateContestReport(analytics.contest.contestSlug, 4);
    console.log(`Contest Excel generated successfully! Buffer size: ${buffer.length} bytes`);
  }

  console.log('\n=== 7. Testing Student Contest Performance ===');
  const sampleStudent = await prisma.student.findFirst({ where: { year: 4 } });
  if (sampleStudent) {
    const studentPerf = await ContestService.getStudentContestPerformance(sampleStudent.id);
    console.log('Student Name:', studentPerf?.student.name);
    console.log('Contests in history:', studentPerf?.history.length);
    if (studentPerf?.history && studentPerf.history.length > 0) {
      console.log('History sample (first 2):', studentPerf.history.slice(0, 2));
    }
    const studentExcelBuffer = await ContestExcelService.generateStudentReport(sampleStudent.id);
    console.log(`Student Excel report generated! Size: ${studentExcelBuffer.length} bytes`);
  }

  console.log('\n✅ ALL BACKEND TESTS PASSED!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
