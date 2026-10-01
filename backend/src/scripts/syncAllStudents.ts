import { prisma } from '../config/prisma';
import { LeetCodeService } from '../services/leetcode/leetcode.service';

async function main() {
  console.log('Starting full sync for 4th Year Students (2027 batch)...');
  const students = await prisma.student.findMany({
    where: { year: 4 },
    select: { id: true, name: true, registerNumber: true, leetcodeUsername: true },
    orderBy: { registerNumber: 'asc' },
  });

  console.log(`Total students to sync: ${students.length}`);

  let success = 0;
  let failed = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const chunk = students.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (s) => {
        try {
          await LeetCodeService.syncStudent(prisma, s.id, s.leetcodeUsername);
          success++;
          console.log(`[${success + failed}/${students.length}] ✓ ${s.registerNumber} - ${s.name} (@${s.leetcodeUsername})`);
        } catch (err: any) {
          failed++;
          console.error(`[${success + failed}/${students.length}] ✗ ${s.registerNumber} - ${s.name} (@${s.leetcodeUsername}): ${err.message}`);
        }
      })
    );
    // Short breather to avoid rate limits
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n========================================`);
  console.log(`Sync completed: ${success} succeeded, ${failed} failed`);
  console.log(`========================================`);
}

main()
  .catch((e) => {
    console.error('Fatal error during sync:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
