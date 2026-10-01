import { prisma } from '../config/prisma';

async function main() {
  const cr = await prisma.contestResult.findFirst({
    where: {
      contestName: 'Weekly Contest 517',
      rank: 15443,
    },
    include: { student: true },
  });
  console.log('Student with rank 15443 in WC 517:');
  console.log(cr);

  if (!cr) {
    const all517 = await prisma.contestResult.findMany({
      where: { contestName: 'Weekly Contest 517' },
      take: 20,
      include: { student: true },
    });
    console.log('Found in WC 517:', all517.map(c => ({ name: c.student.name, user: c.student.leetcodeUsername, rank: c.rank, rating: c.rating })));
  }
}

main().finally(() => prisma.$disconnect());
