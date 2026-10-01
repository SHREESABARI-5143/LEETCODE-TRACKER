const pool = require('../config/db');
const rankingSnapshotService = require('../services/rankingSnapshotService');
const leetcodeService = require('../services/leetcodeService');

async function getStudentProfile(req, res, next) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const accessCheck = await req.scope.verifyStudentAccess(studentId, false);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.status).json({ error: accessCheck.reason });
    }

    // 1. Core student details & leetcode stats
    let [students] = await pool.query(
      `SELECT s.id, s.roll_number, s.name, s.year_of_study, s.placement_status,
              s.leetcode_username, s.profile_link, s.sync_status, s.last_synced_at,
              s.department_id, s.proctor_id, s.created_at,
              d.name AS department_name, d.code AS department_code,
              u.name AS proctor_name, u.email AS proctor_email,
              ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved,
              ls.daily_start_total, ls.daily_solved, ls.weekly_solved, ls.monthly_solved,
              ls.ranking, ls.contest_rating, ls.contest_global_rank, ls.last_fetch_status, ls.last_fetch_error
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN users u ON s.proctor_id = u.id
       LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
       WHERE s.id = ? LIMIT 1`,
      [studentId]
    );

    if (students.length === 0) return res.status(404).json({ error: 'Student not found.' });
    let s = students[0];

    // If stats are empty or never synced and username exists, auto-sync on profile open
    let richStats = null;
    if (s.leetcode_username && !s.leetcode_username.startsWith('NIL_')) {
      const liveRes = await leetcodeService.fetchUserLeetcodeStats(s.leetcode_username);
      if (liveRes.status === 'OK' && liveRes.data) {
        richStats = liveRes.data;
        // If DB doesn't have it yet, update DB
        if (!s.total_solved || s.total_solved === 0) {
          const currentCycle = leetcodeService.getCurrent530AmCycleKey();
          await pool.query(
            `INSERT INTO leetcode_stats 
              (student_id, easy_solved, medium_solved, hard_solved, total_solved, daily_start_total, baseline_cycle, baseline_updated_at, daily_solved, weekly_solved, monthly_solved, ranking, contest_rating, contest_global_rank, last_fetch_status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0, ?, ?, ?, ?, ?, 'OK', NOW())
             ON DUPLICATE KEY UPDATE
              easy_solved = VALUES(easy_solved),
              medium_solved = VALUES(medium_solved),
              hard_solved = VALUES(hard_solved),
              total_solved = VALUES(total_solved),
              daily_start_total = VALUES(daily_start_total),
              baseline_cycle = VALUES(baseline_cycle),
              daily_solved = VALUES(daily_solved),
              weekly_solved = VALUES(weekly_solved),
              monthly_solved = VALUES(monthly_solved),
              ranking = VALUES(ranking),
              contest_rating = VALUES(contest_rating),
              contest_global_rank = VALUES(contest_global_rank),
              last_fetch_status = 'OK',
              updated_at = NOW()`,
            [s.id, richStats.easy_solved, richStats.medium_solved, richStats.hard_solved, richStats.total_solved, richStats.total_solved, currentCycle, richStats.weekly_solved || 0, richStats.monthly_solved || 0, richStats.ranking, richStats.contest_rating, richStats.contest_global_rank]
          );
          await pool.query("UPDATE students SET sync_status = 'Success', last_synced_at = NOW() WHERE id = ?", [s.id]);
          s.total_solved = richStats.total_solved;
          s.easy_solved = richStats.easy_solved;
          s.medium_solved = richStats.medium_solved;
          s.hard_solved = richStats.hard_solved;
          s.daily_start_total = richStats.total_solved;
          s.daily_solved = 0;
          s.weekly_solved = richStats.weekly_solved || 0;
          s.monthly_solved = richStats.monthly_solved || 0;
          s.ranking = richStats.ranking;
          s.contest_rating = richStats.contest_rating;
          s.contest_global_rank = richStats.contest_global_rank;
          s.sync_status = 'Success';
        }
      }
    }

    // 2. Question list solve history
    const [questionStatusRows] = await pool.query(
      `SELECT ql.id AS list_id, ql.name AS list_name, ql.contest_number, ql.contest_type,
              qi.id AS item_id, qi.input_title, qi.resolved_title, qi.difficulty,
              COALESCE(sqs.solved, FALSE) AS solved, sqs.solved_at, sqs.verified_via
       FROM question_lists ql
       JOIN question_list_items qi ON ql.id = qi.question_list_id
       LEFT JOIN student_question_status sqs ON sqs.question_list_item_id = qi.id AND sqs.student_id = ?
       ORDER BY ql.created_at DESC, qi.id ASC`,
      [studentId]
    );

    // Group questions by list
    const questionListsMap = new Map();
    questionStatusRows.forEach(row => {
      if (!questionListsMap.has(row.list_id)) {
        questionListsMap.set(row.list_id, {
          id: row.list_id,
          name: row.list_name,
          contestNumber: row.contest_number,
          contestType: row.contest_type,
          items: []
        });
      }
      questionListsMap.get(row.list_id).items.push({
        id: row.item_id,
        title: row.resolved_title || row.input_title,
        difficulty: row.difficulty,
        solved: Boolean(row.solved),
        solvedAt: row.solved_at,
        verifiedVia: row.verified_via
      });
    });

    res.json({
      student: {
        id: s.id,
        rollNumber: s.roll_number,
        registerNumber: s.roll_number,
        name: s.name,
        year: s.year_of_study,
        yearOfStudy: s.year_of_study,
        placementStatus: s.placement_status,
        leetcodeUsername: s.leetcode_username,
        profileUrl: s.profile_link,
        profileLink: s.profile_link,
        syncStatus: s.sync_status,
        lastSyncedAt: s.last_synced_at,
        departmentId: s.department_id,
        departmentName: s.department_name,
        departmentCode: s.department_code,
        proctorId: s.proctor_id,
        proctorName: s.proctor_name,
        proctorEmail: s.proctor_email,
        totalSolved: Number(s.total_solved) || 0,
        easySolved: Number(s.easy_solved) || 0,
        mediumSolved: Number(s.medium_solved) || 0,
        hardSolved: Number(s.hard_solved) || 0,
        dailyStartTotal: Number(s.daily_start_total) || 0,
        dailySolved: Number(s.daily_solved) || 0,
        weeklySolved: Number(s.weekly_solved) || 0,
        monthlySolved: Number(s.monthly_solved) || 0,
        ranking: s.ranking ? Math.round(Number(s.ranking)) : null,
        contestRating: Math.round(Number(richStats?.contest_rating !== undefined ? richStats.contest_rating : (s.contest_rating || 0))),
        highestContestRating: Math.round(Number(richStats?.highest_contest_rating || richStats?.contest_rating || s.contest_rating || 0)),
        contestGlobalRank: s.contest_global_rank ? Math.round(Number(s.contest_global_rank)) : null,
        lastFetchStatus: s.last_fetch_status,
        lastFetchError: s.last_fetch_error,
        avatarUrl: richStats?.avatar_url || null,
        reputation: richStats?.reputation || 0,
        acceptanceRate: richStats?.acceptance_rate || 0,
        streak: richStats?.streak || 0,
        totalActiveDays: richStats?.total_active_days || 0,
        badges: richStats?.badges || [],
        contestResults: richStats?.contest_history || [],
        attendedContestsCount: richStats?.attended_contests_count || 0,
        activityDays: richStats?.activity_days || []
      },
      questionLists: Array.from(questionListsMap.values())
    });
  } catch (err) {
    next(err);
  }
}

async function getStudentRankingTrend(req, res, next) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const days = parseInt(req.query.days, 10) || 30;

    const accessCheck = await req.scope.verifyStudentAccess(studentId, false);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.status).json({ error: accessCheck.reason });
    }

    const trend = await rankingSnapshotService.getRankingTrend(studentId, days);
    res.json({ snapshots: trend });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStudentProfile,
  getStudentRankingTrend
};
