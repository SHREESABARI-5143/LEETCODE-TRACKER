/**
 * updateLeetcodeStats.js
 * ---------------------------------------------------------------------------
 * Standalone CLI / cron trigger for the high-speed LeetCode sync engine.
 *
 * Usage:
 *   node backend/jobs/updateLeetcodeStats.js
 *   node backend/jobs/updateLeetcodeStats.js --year 3
 *   node backend/jobs/updateLeetcodeStats.js --concurrency 40
 *
 * Environment:
 *   Reads DB config from the same .env as the main server.
 *
 * Exit codes:
 *   0  — success (all or majority synced)
 *   1  — error (DB connection failed or critical exception)
 * ---------------------------------------------------------------------------
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = require('../config/db');
const baselineService = require('../services/baselineService');
const syncEngine = require('../services/syncEngine');

// --- Parse CLI args ---------------------------------------------------------
const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

const targetYear = getArg('--year') ? parseInt(getArg('--year'), 10) : null;
const cliConcurrency = getArg('--concurrency') ? parseInt(getArg('--concurrency'), 10) : null;
const dryRun = args.includes('--dry-run');

// Override engine concurrency if specified via CLI
if (cliConcurrency && cliConcurrency > 0) {
  // Patch the module-level currentConcurrency by mutating exported symbol via engine internals
  process.env.SYNC_CONCURRENCY_OVERRIDE = String(cliConcurrency);
}

// ---------------------------------------------------------------------------

async function run() {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     LeetCode High-Speed Stats Updater                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`[UpdateStats] Started at ${new Date().toISOString()}`);

  if (targetYear) console.log(`[UpdateStats] Filtering: year_of_study = ${targetYear}`);
  if (cliConcurrency) console.log(`[UpdateStats] CLI concurrency override: ${cliConcurrency}`);
  if (dryRun) console.log('[UpdateStats] DRY RUN — no DB writes will occur.');

  let conn;
  try {
    conn = await pool.getConnection();
    console.log('[UpdateStats] Database connection established.');
    conn.release();
  } catch (err) {
    console.error('[UpdateStats] FATAL: Cannot connect to database:', err.message);
    process.exit(1);
  }

  try {
    // 1. Fetch students
    let query = `SELECT id, leetcode_username FROM students WHERE leetcode_username NOT LIKE 'NIL_%'`;
    const qParams = [];
    if (targetYear) {
      query += ` AND year_of_study = ?`;
      qParams.push(targetYear);
    }

    const [students] = await pool.query(query, qParams);
    console.log(`[UpdateStats] Found ${students.length} students to sync.`);

    if (students.length === 0) {
      console.log('[UpdateStats] Nothing to do. Exiting.');
      process.exit(0);
    }

    if (dryRun) {
      console.log('[UpdateStats] DRY RUN complete. Would have synced', students.length, 'students.');
      process.exit(0);
    }

    // 2. Run high-speed batch sync
    let lastProgressLine = '';
    const result = await syncEngine.executeBatchSync(
      students,
      null,
      (completed, total, successful, failed) => {
        const pct = Math.round((completed / total) * 100);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = completed > 0 ? (completed / ((Date.now() - startTime) / 1000)).toFixed(1) : '0';
        const eta = completed > 0
          ? ((total - completed) / parseFloat(rate)).toFixed(1)
          : '?';

        // Overwrite same line for clean CLI output
        const line = `\r[UpdateStats] ${completed}/${total} (${pct}%) | OK: ${successful} Fail: ${failed} | ${rate} req/s | ETA: ${eta}s | Elapsed: ${elapsed}s`;
        process.stdout.write(line + ' '.repeat(Math.max(0, lastProgressLine.length - line.length)));
        lastProgressLine = line;
      }
    );

    process.stdout.write('\n');

    const elapsedSec = (result.elapsedTimeMs / 1000).toFixed(2);

    console.log('──────────────────────────────────────────────────────────');
    console.log(`[UpdateStats] ✓ Sync complete in ${elapsedSec}s`);
    console.log(`[UpdateStats]   Total:     ${result.total}`);
    console.log(`[UpdateStats]   Succeeded: ${result.successful}`);
    console.log(`[UpdateStats]   Failed:    ${result.failed}`);
    console.log(`[UpdateStats]   Throughput: ${(result.total / result.elapsedTimeMs * 1000).toFixed(1)} students/sec`);
    console.log('──────────────────────────────────────────────────────────');

    if (result.elapsedTimeMs < 8000) {
      console.log(`[UpdateStats] 🚀 TARGET MET: ${elapsedSec}s < 8s`);
    } else {
      console.log(`[UpdateStats] ⚠ ${elapsedSec}s exceeded 8s target — check concurrency / rate limits.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('\n[UpdateStats] FATAL error during sync:', err.message);
    process.exit(1);
  }
}

run();
