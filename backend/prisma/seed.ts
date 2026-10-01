import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Student data from "2027 Leetcode UserName with Profile.xlsx"
 * Pre-extracted into students_4th_year.json.
 */
interface ExcelStudent {
  sno: number;
  regNo: string;
  name: string;
  username: string;
  url: string;
}

function loadStudentsFromJSON(): ExcelStudent[] {
  // Try root-level copy first, then frontend copy
  const candidates = [
    path.join(__dirname, '..', '..', 'students_4th_year.json'),
    path.join(__dirname, '..', '..', 'frontend', 'students_4th_year.json'),
  ];
  
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      console.log(`   Loading from: ${filePath}`);
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as ExcelStudent[];
    }
  }
  
  console.error('ERROR: students_4th_year.json not found.');
  process.exit(1);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CodeTrack Seed — Real 4th Year Students Only');
  console.log('═══════════════════════════════════════════════════════');

  // ── Step 1: Clear all tables ──
  console.log('\n🗑️  Clearing all database tables...');
  await prisma.badge.deleteMany();
  await prisma.studentProblem.deleteMany();
  await prisma.contestResult.deleteMany();
  await prisma.activityDay.deleteMany();
  await prisma.analysisSnapshot.deleteMany();
  await prisma.leetCodeProfile.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.analysisJob.deleteMany();
  await prisma.student.deleteMany();
  await prisma.proctor.deleteMany();
  await prisma.user.deleteMany();
  console.log('   ✓ All tables cleared');

  // ── Step 2: Create Admin & HOD ──
  const hashedAdminPassword = await bcrypt.hash('Admin@123', 10);
  const hashedHODPassword = await bcrypt.hash('HOD@1234', 10);
  const hashedProctorPassword = await bcrypt.hash('Proctor@123', 10);

  console.log('\n👤 Creating Admin account...');
  await prisma.user.create({
    data: {
      name: 'System Admin',
      collegeEmail: 'admin@svec.edu.in',
      password: hashedAdminPassword,
      role: Role.ADMIN,
    },
  });
  console.log('   ✓ admin@svec.edu.in / Admin@123');

  console.log('👤 Creating HOD account...');
  await prisma.user.create({
    data: {
      name: 'Dr. P. Venkatesan',
      collegeEmail: 'hod@svec.edu.in',
      password: hashedHODPassword,
      role: Role.HOD,
    },
  });
  console.log('   ✓ hod@svec.edu.in / HOD@1234');

  // ── Step 3: Create Proctors ──
  console.log('\n👨‍🏫 Creating Proctor accounts...');
  const proctorNames = [
    'Dr. Anitha Kumar',
    'Dr. Ramesh Rajan',
    'Prof. Meenakshi Devi',
    'Dr. Suresh Pillai',
    'Prof. Lakshmi Krishnan',
    'Dr. Karthikeyan Natarajan',
  ];

  const proctorsList = [];
  for (let i = 0; i < proctorNames.length; i++) {
    const name = proctorNames[i];
    const email = `proctor${i + 1}@svec.edu.in`;

    const user = await prisma.user.create({
      data: {
        name,
        collegeEmail: email,
        password: hashedProctorPassword,
        role: Role.PROCTOR,
      },
    });

    const proctor = await prisma.proctor.create({
      data: {
        userId: user.id,
        name,
        email,
        designation: i < 2 ? 'Assistant Professor' : i < 4 ? 'Associate Professor' : 'Professor',
        sections: [],
      },
    });
    proctorsList.push(proctor);
    console.log(`   ✓ ${email} — ${name}`);
  }

  // ── Step 4: Load real students from JSON ──
  console.log('\n📋 Loading students from 2027 batch data...');
  const excelStudents = loadStudentsFromJSON();
  console.log(`   Found ${excelStudents.length} students`);

  // ── Step 5: Determine sections and assign proctors ──
  // Split students into sections of ~25-30 each
  const studentsPerSection = 30;
  const sectionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const year = 4;
  const batch = '2023-2027';

  // Assign sections
  const studentsWithSections = excelStudents.map((s, idx) => {
    const sectionIdx = Math.floor(idx / studentsPerSection);
    const section = sectionLetters[Math.min(sectionIdx, sectionLetters.length - 1)];
    return { ...s, section };
  });

  // Get unique sections used
  const usedSections = [...new Set(studentsWithSections.map(s => s.section))];

  // Assign proctors to sections
  const sectionProctorMap = new Map<string, typeof proctorsList[0]>();
  for (let i = 0; i < usedSections.length; i++) {
    const proctor = proctorsList[i % proctorsList.length];
    sectionProctorMap.set(usedSections[i], proctor);

    // Update proctor's sections array
    await prisma.proctor.update({
      where: { id: proctor.id },
      data: {
        sections: {
          push: `Y${year}-${usedSections[i]}`,
        },
      },
    });
  }

  // ── Step 6: Create students ──
  console.log(`\n🎓 Seeding ${excelStudents.length} 4th-year students...`);
  let created = 0;
  let skipped = 0;

  for (const s of studentsWithSections) {
    if (!s.regNo || !s.username || !s.name) {
      skipped++;
      continue;
    }

    const proctor = sectionProctorMap.get(s.section)!;
    const collegeEmail = `${s.regNo.toLowerCase()}@svec.edu.in`;
    const profileUrl = s.url || `https://leetcode.com/u/${s.username}/`;

    try {
      await prisma.student.create({
        data: {
          registerNumber: s.regNo,
          name: s.name,
          collegeEmail,
          year,
          section: s.section,
          batch,
          proctorId: proctor.id,
          leetcodeUsername: s.username,
          leetcodeProfileUrl: profileUrl,
          status: 'active',
        },
      });
      created++;
    } catch (err: any) {
      // Likely duplicate registerNumber or email
      console.warn(`   ⚠ Skipped ${s.regNo} (${s.name}): ${err.message?.slice(0, 80)}`);
      skipped++;
    }
  }

  console.log(`   ✓ Created: ${created} students`);
  if (skipped > 0) console.log(`   ⚠ Skipped: ${skipped} students (duplicates or missing data)`);

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ Seed complete!');
  console.log(`  • Admin:    admin@svec.edu.in / Admin@123`);
  console.log(`  • HOD:      hod@svec.edu.in / HOD@1234`);
  console.log(`  • Proctors: ${proctorsList.length} accounts (Proctor@123)`);
  console.log(`  • Students: ${created} (4th year, batch 2023-2027)`);
  console.log(`  • Sections: ${usedSections.join(', ')}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n📌 Next step: Run LeetCode sync to fetch profiles:');
  console.log('   POST /api/v1/analytics/sync { "year": 4 }');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
