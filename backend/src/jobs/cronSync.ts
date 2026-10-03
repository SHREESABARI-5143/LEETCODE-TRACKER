const cron = require('node-cron');
const pool = require('../config/db');
const baselineService = require('../services/baselineService');
const rankingSnapshotService = require('../services/rankingSnapshotService');
const syncEngine = require('../services/syncEngine');

let isSyncRunning = false;

async function runScheduledSync() {
  if (isSyncRunning) {
    console.log('[CronSync] Previous sync cycle still in progress, skipping.');
    return;
  }

  isSyncRunning = true;
  console.log(`[CronSync] Starting scheduled LeetCode sync cycle at ${new Date().toISOString()}...`);
  const startTime = Date.now();

  try {
    const [students] = await pool.query(
      `SELECT id, leetcode_username FROM students 
       WHERE leetcode_username NOT LIKE 'NIL_%'`
    );

    console.log(`[CronSync] Found ${students.length} students to sync.`);

    if (students.length === 0) {
      console.log('[CronSync] No students to sync. Exiting cycle.');
      return;
    }

    // High-speed batched sync via the concurrency pool engine
    const result = await syncEngine.executeBatchSync(
      students,
      null, // global (all departments)
      (completed, total, successful, failed) => {
        // Optional fine-grained progress logging every 50 completions
        if (completed % 50 === 0 || completed === total) {
          console.log(`[CronSync] Progress: ${completed}/${total} (${successful} OK, ${failed} failed)`);
        }
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[CronSync] Sync completed in ${elapsed}s: ${result.successful} success, ${result.failed} failed out of ${result.total} students.`
    );
  } catch (err) {
    console.error('[CronSync] Error during cron execution:', err.message);
  } finally {
    isSyncRunning = false;
  }
}

function initCronScheduler() {
  const hours = parseInt(process.env.CRON_INTERVAL_HOURS, 10) || 6;
  const cronExpression = `0 */${hours} * * *`;

  console.log(`[Scheduler] Initializing periodic sync cron with schedule: "${cronExpression}"`);
  cron.schedule(cronExpression, () => {
    runScheduledSync();
  });

  // Daily reset at exactly 5:30 AM IST (00:00:00 UTC)
  console.log('[Scheduler] Initializing daily 5:30 AM IST baseline reset cron ("0 0 * * *")');
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler 5:30 AM IST] Resetting baseline totals for new daily cycle...');
    try {
      await baselineService.resetDailyBaselinesAt530Am();
      await runScheduledSync();
    } catch (err) {
      console.error('[Scheduler 5:30 AM IST] Reset error:', err);
    }
  });
}

module.exports = {
  initCronScheduler,
  runScheduledSync
};
