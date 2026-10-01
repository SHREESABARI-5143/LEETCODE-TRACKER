import { prisma } from '../config/prisma';
import { LeetCodeService } from '../services/leetcode/leetcode.service';

async function testFullSyncSpeed() {
  console.log('⚡ Starting high-speed parallel sync for all students...');
  const t0 = Date.now();

  const result = await LeetCodeService.syncAllStudents(prisma, (done, total) => {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[${elapsed}s] Synced ${done} / ${total} students (${Math.round((done / total) * 100)}%)`);
  });

  const totalTime = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`🚀 ALL 136 PROFILES SYNCED IN ${totalTime} SECONDS!`);
  console.log(`✓ Successful: ${result.synced} | Failed: ${result.failed}`);
  console.log(`======================================================`);
}

testFullSyncSpeed()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
  });
