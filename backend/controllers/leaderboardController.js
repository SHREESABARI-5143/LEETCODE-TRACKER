const pool = require('../config/db');
const rankingSnapshotService = require('../services/rankingSnapshotService');

async function getLeaderboard(req, res, next) {
  try {
    const { year, department_id, placement, search, limit = 100, page = 1 } = req.query;
    const additionalConditions = [];
    const queryParams = [];

    if (year) {
      additionalConditions.push('s.year_of_study = ?');
      queryParams.push(parseInt(year, 10));
    }

    if (placement) {
      additionalConditions.push('s.placement_status = ?');
      queryParams.push(placement);
    }

    if (search) {
      additionalConditions.push('(s.name LIKE ? OR s.roll_number LIKE ? OR s.leetcode_username LIKE ?)');
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term);
    }

    const { whereSql, params } = req.scope.buildStudentWhere('s', additionalConditions, queryParams);

    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const offset = Math.max((parseInt(page, 10) || 1) - 1, 0) * pageSize;

    const countQuery = `
      SELECT COUNT(s.id) AS total
      FROM students s
      ${whereSql}
    `;
    const [countRows] = await pool.query(countQuery, params);
    const totalRecords = countRows[0]?.total || 0;

    const query = `
      SELECT s.id, s.roll_number, s.name, s.year_of_study, s.placement_status,
             s.leetcode_username, s.profile_link, s.sync_status,
             d.name AS department_name, d.code AS department_code,
             ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved,
             ls.ranking, ls.contest_rating, ls.contest_global_rank
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
      ${whereSql}
      ORDER BY ls.total_solved DESC, ls.ranking ASC, s.roll_number ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [...params, pageSize, offset]);

    // Calculate top movers
    const topMovers = await rankingSnapshotService.getTopMovers(
      req.scope.isGlobal ? (department_id ? parseInt(department_id) : null) : req.scope.userDepartmentId,
      5
    );

    res.json({
      leaderboard: rows.map((r, index) => ({
        rank: offset + index + 1,
        id: r.id,
        rollNumber: r.roll_number,
        registerNumber: r.roll_number,
        name: r.name,
        year: r.year_of_study,
        yearOfStudy: r.year_of_study,
        placementStatus: r.placement_status,
        leetcodeUsername: r.leetcode_username,
        profileUrl: r.profile_link,
        departmentName: r.department_name,
        departmentCode: r.department_code,
        totalSolved: r.total_solved || 0,
        easySolved: r.easy_solved || 0,
        mediumSolved: r.medium_solved || 0,
        hardSolved: r.hard_solved || 0,
        ranking: r.ranking,
        contestRating: r.contest_rating,
        contestGlobalRank: r.contest_global_rank,
        syncStatus: r.sync_status
      })),
      topMovers: topMovers.map(m => ({
        id: m.id,
        name: m.name,
        rollNumber: m.roll_number,
        registerNumber: m.roll_number,
        yearOfStudy: m.year_of_study,
        leetcodeUsername: m.leetcode_username,
        currentSolved: m.current_solved,
        currentRanking: m.current_ranking,
        solvedGain: m.solved_gain,
        rankGain: m.rank_gain
      })),
      pagination: {
        total: totalRecords,
        page: parseInt(page, 10) || 1,
        limit: pageSize,
        totalPages: Math.ceil(totalRecords / pageSize)
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLeaderboard
};
