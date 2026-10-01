import { prisma } from '../config/prisma';

async function main() {
  const students = await prisma.student.findMany({
    where: { year: 4 },
    include: { profile: true, proctor: true },
    orderBy: { registerNumber: 'asc' },
  });

  const studentIds = students.map(s => s.id);

  const now = new Date();
  const todayResetUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

  const weekStart = new Date(todayResetUtc);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const recentProblems = await prisma.studentProblem.findMany({
    where: {
      studentId: { in: studentIds },
      solvedAt: { gte: weekStart },
    },
    select: {
      studentId: true,
      slug: true,
      solvedAt: true,
    },
  });

  const prevSnapshots = await prisma.analysisSnapshot.findMany({
    where: {
      studentId: { in: studentIds },
      date: { lt: todayResetUtc },
    },
    orderBy: { date: 'desc' },
    distinct: ['studentId'],
    select: {
      studentId: true,
      totalSolved: true,
    },
  });
  const prevSnapshotMap = new Map<string, number>();
  prevSnapshots.forEach(ps => prevSnapshotMap.set(ps.studentId, ps.totalSolved));

  const problemsTodayMap = new Map<string, Set<string>>();
  recentProblems.forEach(p => {
    if (new Date(p.solvedAt).getTime() >= todayResetUtc.getTime()) {
      if (!problemsTodayMap.has(p.studentId)) problemsTodayMap.set(p.studentId, new Set());
      problemsTodayMap.get(p.studentId)!.add(p.slug);
    }
  });

  console.log(`LeetCode Daily Reset Time: ${todayResetUtc.toISOString()} (5:30 AM IST)`);
  console.log('--- Top Students Today Solved ---');

  students
    .map(s => {
      const totalSolved = s.profile?.totalSolved || 0;
      const pDaily = problemsTodayMap.get(s.id)?.size || 0;
      const prevTotal = prevSnapshotMap.get(s.id);
      const snapshotDiffDaily = prevTotal !== undefined ? Math.max(0, totalSolved - prevTotal) : 0;
      const dailySolved = Math.max(pDaily, snapshotDiffDaily);
      return {
        name: s.name,
        regNo: s.registerNumber,
        username: s.leetcodeUsername,
        totalSolved,
        dailySolved,
      };
    })
    .sort((a, b) => b.dailySolved - a.dailySolved)
    .slice(0, 10)
    .forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.name} (@${s.username}) - Total: ${s.totalSolved} | Solved Today: +${s.dailySolved}`);
    });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
