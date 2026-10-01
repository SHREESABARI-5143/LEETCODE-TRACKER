import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const real4thYearStudents = [
  { regNo: '23CS001', name: 'AAYISHA MAHIRA K', username: 'Mahira_006', section: 'A' },
  { regNo: '23CS003', name: 'ANITHA AR', username: 'anithaar111205', section: 'A' },
  { regNo: '23CS004', name: 'ATHULYA G', username: 'Athulya21', section: 'A' },
  { regNo: '23CS005', name: 'BALAHARIHARAN S', username: 'balahariharan003', section: 'A' },
  { regNo: '23CS006', name: 'BHARATH V', username: 'Bharath_v', section: 'A' },
  { regNo: '23CS007', name: 'DEEPAK R', username: 'deepak_r', section: 'A' },
  { regNo: '23CS008', name: 'DINESH KUMAR M', username: 'dineshkumar_m', section: 'B' },
  { regNo: '23CS009', name: 'DIVYADHARSHINI S', username: 'divyadharshini_s', section: 'B' },
  { regNo: '23CS010', name: 'GOWTHAM K', username: 'gowtham_k', section: 'B' },
];

async function seed4thYear() {
  console.log('Updating 4th Year Students list in database...');

  // Get proctors for assignment
  const proctors = await prisma.proctor.findMany();
  const defaultProctor = proctors[0] || null;

  for (const s of real4thYearStudents) {
    const email = `${s.regNo.toLowerCase()}@svec.edu.in`;

    await prisma.student.upsert({
      where: { registerNumber: s.regNo },
      create: {
        registerNumber: s.regNo,
        name: s.name,
        collegeEmail: email,
        year: 4,
        section: s.section,
        batch: '2023-2027',
        leetcodeUsername: s.username,
        leetcodeProfileUrl: `https://leetcode.com/${s.username}`,
        status: 'active',
        proctorId: defaultProctor?.id || null,
        profile: {
          create: {
            ranking: Math.floor(Math.random() * 200000) + 50000,
            reputation: Math.floor(Math.random() * 500) + 50,
            totalSolved: Math.floor(Math.random() * 250) + 100,
            easySolved: Math.floor(Math.random() * 120) + 60,
            mediumSolved: Math.floor(Math.random() * 100) + 30,
            hardSolved: Math.floor(Math.random() * 30) + 5,
            acceptanceRate: 65.5,
            contestRating: Math.floor(Math.random() * 500) + 1400,
            highestContestRating: Math.floor(Math.random() * 500) + 1500,
            contestsAttended: Math.floor(Math.random() * 10) + 5,
          },
        },
      },
      update: {
        name: s.name,
        year: 4,
        section: s.section,
        batch: '2023-2027',
        leetcodeUsername: s.username,
        leetcodeProfileUrl: `https://leetcode.com/${s.username}`,
      },
    });
  }

  console.log('4th Year Students list successfully updated in database!');
}

seed4thYear()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
