import { prisma } from '../config/prisma';
import { LeetCodeService } from '../services/leetcode/leetcode.service';

async function main() {
  console.log('Fetching sample students...');
  const students = await prisma.student.findMany({ take: 5 });
  console.log('Students found:', students.length);
  for (const s of students) {
    console.log(`Checking ${s.name} (${s.leetcodeUsername})...`);
    try {
      const data = await LeetCodeService.fetchProfile(s.leetcodeUsername);
      console.log(`-> Solved: ${data?.totalSolved}, Rating: ${data?.contestRating}, History: ${data?.contestHistory?.length}`);
      await LeetCodeService.syncStudent(prisma, s.id, s.leetcodeUsername);
      console.log(`-> Synced to DB successfully!`);
    } catch (err: any) {
      console.error(`-> Error:`, err.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
