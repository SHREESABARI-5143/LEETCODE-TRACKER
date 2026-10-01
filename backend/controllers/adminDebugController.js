const pool = require('../config/db');
const leetcodeService = require('../services/leetcodeService');

/**
 * GET /api/admin/baseline-debug
 * Admin-only endpoint to inspect per-student baseline consistency.
 * Returns, per student: baseline_cycle, daily_start_total, total_solved, computed today_solved_count.
 * Use to verify Today's Solved counts are accurate after a fix or deployment.
 */
async function getBaselineDebug(req, res, next) {
  try {
    const currentCycle = leetcodeService.getCurrent530AmCycleKey();

    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.roll_number,
        s.leetcode_username,
        s.year_of_study,
        ls.baseline_cycle,
        ls.daily_start_total,
        ls.total_solved,
        ls.daily_solved         AS db_daily_solved,
        ls.last_fetch_status,
        ls.updated_at,
        GREATEST(0, COALESCE(ls.total_solved, 0) - COALESCE(ls.daily_start_total, 0))
                                AS computed_today_solved,
        (ls.baseline_cycle = ?)  AS cycle_is_current,
        (ls.baseline_cycle != ? OR ls.baseline_cycle IS NULL)
                                AS baseline_stale
      FROM students s
      LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
      WHERE s.leetcode_username NOT LIKE 'NIL_%'
      ORDER BY baseline_stale DESC, s.year_of_study, s.name
    `, [currentCycle, currentCycle]);

    const staleCount = rows.filter(r => r.baseline_stale).length;
    const negativeCount = rows.filter(r => (r.computed_today_solved || 0) < 0).length;
    const noBaselineCount = rows.filter(r => !r.baseline_cycle).length;

    res.json({
      success: true,
      currentCycle,
      summary: {
        total: rows.length,
        staleBaseline: staleCount,
        noBaseline: noBaselineCount,
        negativeComputed: negativeCount,
        healthy: rows.length - staleCount - noBaselineCount
      },
      students: rows.map(r => ({
        id: r.id,
        name: r.name,
        rollNumber: r.roll_number,
        leetcodeUsername: r.leetcode_username,
        year: r.year_of_study,
        baselineCycle: r.baseline_cycle,
        cycleIsCurrent: Boolean(r.cycle_is_current),
        baselineStale: Boolean(r.baseline_stale),
        dailyStartTotal: r.daily_start_total,
        totalSolved: r.total_solved,
        dbDailySolved: r.db_daily_solved,
        computedTodaySolved: r.computed_today_solved,
        lastFetchStatus: r.last_fetch_status,
        lastUpdated: r.updated_at
      }))
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBaselineDebug };
