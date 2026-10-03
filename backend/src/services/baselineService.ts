const pool = require('../config/db');
const leetcodeService = require('./leetcodeService');

/**
 * Sentinel that means "no baseline captured yet for this cycle."
 * daily_start_total = 0 with a non-zero total_solved is the DB default bleed-through,
 * NOT a real baseline of zero. We detect it and return null so the UI shows "—".
 *
 * Real "solved nothing at 5:30 AM" students will have:
 *   daily_start_total = 0  AND  total_solved = 0  (brand new account)
 *   OR baseline_cycle explicitly set with daily_start_total = 0 by resetDailyBaselinesAt530Am.
 *
 * Invalid baseline:
 *   daily_start_total = 0  AND  total_solved > some_large_number  (DB default bleed-through)
 */
function isBaselineMissing(existingStats) {
  if (!existingStats) return true;
  if (!existingStats.baseline_cycle) return true;

  const dst = Number(existingStats.daily_start_total);
  const ts  = Number(existingStats.total_solved);

  // DB default: daily_start_total is 0 but student clearly has problems solved.
  // The ONLY way dst=0 is valid is if total_solved is also 0 at capture time.
  // If ts > 0, it means they had problems solved before the baseline was properly captured.
  if (dst === 0 && ts > 0) return true;

  return false;
}

/**
 * Calculates the daily count using:
 *   today_solved_count = current_total_solved − 5:30 AM baseline
 *
 * Returns:
 *   { dailyStartTotal, baselineCycle, dailySolved }
 *   dailySolved is null when no valid baseline exists for today — callers must
 *   propagate null to the DB and API; the UI renders null as "—" (not 0).
 *
 * Rules:
 * - baseline_cycle 'YYYY-MM-DD' is the IST date of the 5:30 AM window.
 * - PRESERVES daily_start_total throughout the day (never overwrites within cycle).
 * - At 5:30 AM reset, baseline → current total and daily count → 0.
 * - If daily_start_total is the DB default 0 but total_solved > 0,
 *   treats the row as "no baseline captured" → dailySolved = null.
 */
function resolveDailyBaseline(currentTotal, existingStats, leetcodeDailySolved = 0) {
  const currentCycle = leetcodeService.getCurrent530AmCycleKey();
  const numCurrentTotal = Number(currentTotal) || 0;

  // ── Case 1: No row at all in the DB ─────────────────────────────────────────
  // We use numCurrentTotal as the new baseline (so from now on delta = 0).
  // But we return null for dailySolved because the baseline was just established
  // NOW, not at 5:30 AM — so we cannot reliably say how much was solved "today".
  if (!existingStats) {
    return {
      dailyStartTotal: numCurrentTotal,
      baselineCycle: currentCycle,
      dailySolved: null,          // unknown — no 5:30 AM baseline exists
      baselineMissing: true
    };
  }

  // ── Case 2: Row exists but baseline is invalid (DB default 0 bleed-through) ─
  if (isBaselineMissing(existingStats)) {
    // Capture current total as the baseline right now.
    // Daily delta from this point forward will be 0 (correct).
    return {
      dailyStartTotal: numCurrentTotal,
      baselineCycle: currentCycle,
      dailySolved: null,          // unknown — baseline was just established now
      baselineMissing: true
    };
  }

  // ── Case 3: Row exists with current cycle baseline ──────────────────────────
  if (existingStats.baseline_cycle === currentCycle) {
    const dailyStartTotal = Number(existingStats.daily_start_total);
    const dailySolved = Math.max(0, numCurrentTotal - dailyStartTotal);
    return {
      dailyStartTotal,
      baselineCycle: currentCycle,
      dailySolved,
      baselineMissing: false
    };
  }

  // ── Case 4: Row exists but for a previous cycle (day rollover) ──────────────
  // Use leetcodeDailySolved to establish today's start total. 
  // If the student hasn't synced in 10 days, previousTotal is 10 days old.
  // We should NOT attribute a 10-day gap entirely to "today".
  const dailySolved = Number(leetcodeDailySolved) || 0;
  const dailyStartTotal = Math.max(0, numCurrentTotal - dailySolved);
  
  return {
    dailyStartTotal,
    baselineCycle: currentCycle,
    dailySolved,
    baselineMissing: false
  };
}

/**
 * Executes 5:30 AM IST daily reset across the database.
 * IDEMPOTENT: WHERE baseline_cycle != ? prevents double-fire on server restart.
 */
async function resetDailyBaselinesAt530Am() {
  const currentCycle = leetcodeService.getCurrent530AmCycleKey();
  console.log(`[BaselineService] Executing 5:30 AM IST daily reset for cycle: ${currentCycle}...`);

  try {
    const [result] = await pool.query(
      `UPDATE leetcode_stats 
       SET daily_start_total = total_solved,
           daily_solved = 0,
           baseline_cycle = ?,
           baseline_updated_at = NOW()
       WHERE baseline_cycle != ? OR baseline_cycle IS NULL`,
      [currentCycle, currentCycle]
    );

    console.log(`[BaselineService] Reset daily baselines for ${result.affectedRows} student records (cycle: ${currentCycle}).`);
    if (result.affectedRows === 0) {
      console.log(`[BaselineService] Idempotency guard: reset already ran for cycle ${currentCycle}, skipping.`);
    }
    return { success: true, affected: result.affectedRows, cycle: currentCycle };
  } catch (err) {
    console.error('[BaselineService] Error during 5:30 AM daily baseline reset:', err);
    throw err;
  }
}

/**
 * Immediately backfill missing baselines for students whose daily_start_total is
 * the DB-default 0 but total_solved > 0 (invalid baseline).
 *
 * Sets their baseline = current total_solved right now so going forward their
 * today_solved_count will correctly be 0 (or small delta), never their full total.
 *
 * Called on server startup and after each import-students batch.
 */
async function backfillMissingBaselines() {
  const currentCycle = leetcodeService.getCurrent530AmCycleKey();
  console.log(`[BaselineService] Checking for invalid baselines (cycle: ${currentCycle})...`);

  try {
    const [result] = await pool.query(
      `UPDATE leetcode_stats
       SET daily_start_total = total_solved,
           daily_solved = 0,
           baseline_cycle = ?,
           baseline_updated_at = NOW()
       WHERE (
         (baseline_cycle = ? AND daily_start_total = 0 AND total_solved > 0)
         OR (baseline_cycle IS NULL AND total_solved > 0)
       )`,
      [currentCycle, currentCycle]
    );

    if (result.affectedRows > 0) {
      console.log(`[BaselineService] Backfilled ${result.affectedRows} students with invalid/missing baselines.`);
    } else {
      console.log('[BaselineService] No invalid baselines found — all good.');
    }
    return { success: true, fixed: result.affectedRows };
  } catch (err) {
    console.error('[BaselineService] Error during baseline backfill:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  resolveDailyBaseline,
  resetDailyBaselinesAt530Am,
  backfillMissingBaselines,
  isBaselineMissing
};
