import { prisma } from '../config/prisma';

async function check() {
  const latest = await prisma.contestResult.findFirst({
    orderBy: { contestDate: 'desc' },
  });
  console.log('Latest Contest:', latest);

  const totalResults = await prisma.contestResult.count();
  console.log('Total Contest Results:', totalResults);
}

check().then(() => prisma.$disconnect());
