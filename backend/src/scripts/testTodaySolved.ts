import { prisma } from '../config/prisma';

async function main() {
  const student = await prisma.student.findUnique({
    where: { leetcodeUsername: 'balahariharan003' },
    include: {
      profile: true,
      problems: { orderBy: { solvedAt: 'desc' }, take: 10 },
      activityDays: { orderBy: { date: 'desc' }, take: 5 },
      snapshots: { orderBy: { date: 'desc' }, take: 5 }
    }
  });

  console.log('Student:', student?.name, 'Total Solved:', student?.profile?.totalSolved);

  const now = new Date();
  const todayResetUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  console.log('5:30 AM IST (Today 00:00 UTC):', todayResetUtc.toISOString());

  console.log('\n--- Recent Solved Problems ---');
  student?.problems.forEach(p => {
    const isToday = new Date(p.solvedAt).getTime() >= todayResetUtc.getTime();
    console.log(`- ${p.title} (${p.difficulty}) solved at: ${new Date(p.solvedAt).toISOString()} [Today: ${isToday}]`);
  });

  console.log('\n--- Activity Days ---');
  student?.activityDays.forEach(a => {
    console.log(`- Date: ${new Date(a.date).toISOString()} | Submissions: ${a.submissionCount} | problemsSolved: ${a.problemsSolved}`);
  });

  console.log('\n--- Snapshots ---');
  student?.snapshots.forEach(s => {
    console.log(`- Date: ${new Date(s.date).toISOString()} | Total Solved: ${s.totalSolved}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
