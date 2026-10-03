const pool = require('../config/db');

/**
 * Captures real snapshot of students' solved counts and ranking for today.
 * Triggered automatically after sync cycles.
 */
async function captureDailySnapshot(departmentId = null) {
  try {
    let query = `
      SELECT s.id AS student_id, ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved, ls.ranking
      FROM students s
      JOIN leetcode_stats ls ON s.id = ls.student_id
      WHERE ls.last_fetch_status = 'OK'
    `;
    const params = [];

    if (departmentId) {
      query += ' AND s.department_id = ?';
      params.push(departmentId);
    }

    const [students] = await pool.query(query, params);

    if (students.length === 0) {
      return { captured: 0, message: 'No active synchronized students to snapshot.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let insertedCount = 0;

    for (const st of students) {
      await pool.query(
        `INSERT INTO ranking_snapshots 
          (student_id, snapshot_date, ranking, total_solved, easy_solved, medium_solved, hard_solved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
          ranking = VALUES(ranking),
          total_solved = VALUES(total_solved),
          easy_solved = VALUES(easy_solved),
          medium_solved = VALUES(medium_solved),
          hard_solved = VALUES(hard_solved)`,
        [st.student_id, todayStr, st.ranking, st.total_solved || 0, st.easy_solved || 0, st.medium_solved || 0, st.hard_solved || 0]
      );
      insertedCount++;
    }

    return { captured: insertedCount, date: todayStr };
  } catch (err) {
    console.error('[RankingSnapshotService] Error capturing snapshot:', err.message);
    throw err;
  }
}

/**
 * Retrieves time-series ranking/solved data for student profile chart.
 */
async function getRankingTrend(studentId, rangeDays = 30) {
  const [snapshots] = await pool.query(
    `SELECT snapshot_date, ranking, total_solved, easy_solved, medium_solved, hard_solved
     FROM ranking_snapshots
     WHERE student_id = ? AND snapshot_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY snapshot_date ASC`,
    [studentId, parseInt(rangeDays) || 30]
  );

  return snapshots.map(s => ({
    date: s.snapshot_date.toISOString ? s.snapshot_date.toISOString().split('T')[0] : String(s.snapshot_date),
    ranking: s.ranking,
    totalSolved: s.total_solved,
    easy: s.easy_solved,
    medium: s.medium_solved,
    hard: s.hard_solved
  }));
}

/**
 * Calculates top performers and movers this week using real snapshot differences.
 */
async function getTopMovers(departmentId = null, limit = 5) {
  let deptCondition = '';
  const params = [];
  if (departmentId) {
    deptCondition = 'AND s.department_id = ?';
    params.push(departmentId);
  }

  // Find delta between latest snapshot and snapshot from ~7 days ago
  const [movers] = await pool.query(
    `SELECT s.id, s.name, s.roll_number, s.year_of_study, s.leetcode_username,
            curr.total_solved AS current_solved,
            curr.ranking AS current_ranking,
            COALESCE(curr.total_solved - prev.total_solved, 0) AS solved_gain,
            COALESCE(prev.ranking - curr.ranking, 0) AS rank_gain
     FROM students s
     JOIN ranking_snapshots curr ON s.id = curr.student_id AND curr.snapshot_date = (
       SELECT MAX(snapshot_date) FROM ranking_snapshots WHERE student_id = s.id
     )
     LEFT JOIN ranking_snapshots prev ON s.id = prev.student_id AND prev.snapshot_date = (
       SELECT MAX(snapshot_date) FROM ranking_snapshots 
       WHERE student_id = s.id AND snapshot_date <= DATE_SUB(curr.snapshot_date, INTERVAL 6 DAY)
     )
     WHERE 1=1 ${deptCondition}
     ORDER BY solved_gain DESC, current_solved DESC
     LIMIT ?`,
    [...params, parseInt(limit) || 5]
  );

  return movers;
}

module.exports = {
  captureDailySnapshot,
  getRankingTrend,
  getTopMovers
};
