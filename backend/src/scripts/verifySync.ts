import { prisma } from '../config/prisma';

async function main() {
  const topProfiles = await prisma.leetCodeProfile.findMany({
    take: 10,
    orderBy: { totalSolved: 'desc' },
    include: { student: true }
  });
  
  console.log('--- TOP 10 4TH YEAR STUDENTS ON LEETCODE ---');
  topProfiles.forEach((p, i) => {
    console.log(`${i+1}. ${p.student.name} [${p.student.registerNumber}] (@${p.student.leetcodeUsername})`);
    console.log(`   Solved: ${p.totalSolved} (E: ${p.easySolved}, M: ${p.mediumSolved}, H: ${p.hardSolved}) | Rating: ${p.contestRating} | Global Rank: #${p.ranking}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
