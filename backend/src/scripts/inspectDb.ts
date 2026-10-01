import { prisma } from '../config/prisma';

async function main() {
  const studentsByYear = await prisma.student.groupBy({
    by: ['year'],
    _count: { id: true },
  });
  console.log('Students by year:', studentsByYear);

  const totalStudents = await prisma.student.count();
  console.log('Total students in DB:', totalStudents);

  const proctors = await prisma.proctor.findMany({
    include: {
      _count: { select: { students: true } }
    }
  });
  console.log('Proctors in DB:', proctors.map(p => ({
    name: p.name,
    email: p.email,
    designation: p.designation,
    sections: p.sections,
    studentsCount: p._count.students,
  })));

  const contestResultsCount = await prisma.contestResult.count();
  console.log('Total Contest Results:', contestResultsCount);

  const distinctContests = await prisma.contestResult.groupBy({
    by: ['contestName', 'contestSlug'],
    _count: { id: true }
  });
  console.log('Distinct Contests in DB:', distinctContests.length);
  console.log('Sample Contests:', distinctContests.slice(0, 10));

  const sampleYear4 = await prisma.student.findMany({
    where: { year: 4 },
    take: 5,
    select: { id: true, name: true, registerNumber: true, leetcodeUsername: true, section: true }
  });
  console.log('Sample 4th year students (REAL):', sampleYear4);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
