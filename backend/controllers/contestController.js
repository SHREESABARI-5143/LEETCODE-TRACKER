const pool = require('../config/db');
const problemResolverService = require('../services/problemResolverService');
const leetcodeService = require('../services/leetcodeService');
const baselineService = require('../services/baselineService');
const rankingSnapshotService = require('../services/rankingSnapshotService');
const xlsx = require('xlsx');

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 1. GET /api/v1/analytics/contests/upcoming
 * Calculates the next upcoming LeetCode contest
 */
async function getUpcomingContest(req, res, next) {
  try {
    const now = new Date();

    // Next Sunday 8:00 AM IST (02:30 UTC) for Weekly Contest
    const nextSunday = new Date(now);
    const day = nextSunday.getDay();
    const diff = (7 - day) % 7;
    nextSunday.setDate(nextSunday.getDate() + (diff === 0 && (now.getUTCHours() > 4 || (now.getUTCHours() === 4 && now.getUTCMinutes() > 0)) ? 7 : diff));
    nextSunday.setUTCHours(2, 30, 0, 0); // 08:00 AM IST

    // Find the latest weekly contest number in DB or fallback
    const [latestRows] = await pool.query(
      `SELECT contest_number FROM question_lists WHERE contest_type = 'weekly' AND contest_number IS NOT NULL ORDER BY contest_number DESC LIMIT 1`
    );
    const lastNum = latestRows[0]?.contest_number || 519;
    const nextContestNumber = lastNum + 1;

    res.json({
      success: true,
      data: {
        contestName: `Weekly Contest ${nextContestNumber}`,
        contestNumber: nextContestNumber,
        contestType: 'weekly',
        startTime: nextSunday.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. POST /api/v1/analytics/contests/verify-question
 * Verifies a question title against LeetCode problem catalog or generates clean slug
 */
async function verifyQuestion(req, res, next) {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Problem title is required.' } });
    }

    const trimmed = title.trim();
    const resolved = await problemResolverService.resolveProblemName(trimmed);

    const generatedSlug = slugify(trimmed);
    const finalSlug = resolved.resolved_slug || generatedSlug;
    const difficulty = resolved.difficulty || 'Medium';

    res.json({
      success: true,
      data: {
        title: resolved.resolved_title || trimmed,
        slug: finalSlug,
        difficulty,
        verified: resolved.resolution_status === 'Resolved'
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. POST /api/v1/analytics/contests/match-slug
 */
async function matchSlug(req, res, next) {
  try {
    const { title, contestSlug } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: { message: 'Title is required.' } });
    }

    const trimmed = title.trim();
    const resolved = await problemResolverService.resolveProblemName(trimmed);
    const genSlug = slugify(trimmed);

    let matchType = 'unresolved';
    let confidence = 0;

    if (resolved.resolution_status === 'Resolved') {
      matchType = resolved.resolved_slug === genSlug ? 'exact' : 'normalized';
      confidence = 95;
    } else if (resolved.resolution_candidates && resolved.resolution_candidates.length > 0) {
      matchType = 'fuzzy';
      confidence = 70;
    } else {
      confidence = 50;
    }

    res.json({
      success: true,
      data: {
        originalTitle: trimmed,
        normalizedTitle: resolved.resolved_title || trimmed,
        generatedSlug: genSlug,
        matchedSlug: resolved.resolved_slug || genSlug,
        matchType,
        confidence
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. POST /api/v1/analytics/contests
 * Creates a contest and its problems
 */
async function createContest(req, res, next) {
  try {
    const {
      contestName,
      contestNumber,
      contestType = 'weekly',
      startTime,
      questions = []
    } = req.body;

    if (!contestName || !contestName.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Contest name is required.' } });
    }

    const trimmedName = contestName.trim();
    const contestSlug = slugify(trimmedName);
    const num = contestNumber ? parseInt(contestNumber, 10) : null;
    const targetDeptId = req.scope?.isGlobal ? null : req.scope?.userDepartmentId || 1;

    // Check if contest already exists
    const [existing] = await pool.query(
      'SELECT id FROM question_lists WHERE name = ? OR (contest_number = ? AND contest_type = ?)',
      [trimmedName, num, contestType]
    );

    let contestId;
    if (existing.length > 0) {
      contestId = existing[0].id;
      await pool.query(
        'UPDATE question_lists SET name = ?, contest_number = ?, contest_type = ?, department_id = ? WHERE id = ?',
        [trimmedName, num, contestType, targetDeptId, contestId]
      );
      // Clean up previous child relations safely
      await pool.query(
        `DELETE sqs FROM student_question_status sqs 
         JOIN question_list_items qi ON sqs.question_list_item_id = qi.id 
         WHERE qi.question_list_id = ?`,
        [contestId]
      );
      await pool.query('DELETE FROM question_list_items WHERE question_list_id = ?', [contestId]);
    } else {
      const [inserted] = await pool.query(
        'INSERT INTO question_lists (name, contest_number, contest_type, department_id, created_at) VALUES (?, ?, ?, ?, NOW())',
        [trimmedName, num, contestType, targetDeptId]
      );
      contestId = inserted.insertId;
    }

    // Insert question items
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const qTitle = (q.title || `Question ${idx + 1}`).trim();
      const qSlug = q.slug ? slugify(q.slug) : slugify(qTitle);
      const qDiff = q.difficulty || (idx === 0 ? 'Easy' : idx === 3 ? 'Hard' : 'Medium');

      await pool.query(
        `INSERT INTO question_list_items 
          (question_list_id, input_title, resolved_slug, resolved_title, difficulty, resolution_status, created_at)
         VALUES (?, ?, ?, ?, ?, 'Resolved', NOW())`,
        [contestId, qTitle, qSlug, qTitle, qDiff]
      );
    }

    // Automatically check student submissions for this contest in background
    setTimeout(async () => {
      try {
        const [items] = await pool.query(
          'SELECT id, resolved_slug, resolved_title FROM question_list_items WHERE question_list_id = ? AND resolved_slug IS NOT NULL',
          [contestId]
        );
        const [students] = await pool.query(
          `SELECT s.id, s.leetcode_username FROM students s WHERE s.leetcode_username NOT LIKE 'NIL_%' AND s.sync_status = 'Success'`
        );
        for (const st of students) {
          const evalResults = await leetcodeService.checkStudentSolvedProblems(st.leetcode_username, items);
          for (const er of evalResults) {
            if (!er.question_list_item_id) continue;
            await pool.query(
              `INSERT INTO student_question_status 
                (student_id, question_list_item_id, solved, solved_at, checked_at, verified_via)
               VALUES (?, ?, ?, ?, NOW(), ?)
               ON DUPLICATE KEY UPDATE solved = VALUES(solved), solved_at = VALUES(solved_at), checked_at = NOW()`,
              [st.id, er.question_list_item_id, er.solved, er.solved_at, er.verified_via]
            );
          }
        }
      } catch (bgErr) {
        console.warn('[Contest Background Eval Notice]:', bgErr.message);
      }
    }, 100);

    res.status(201).json({
      success: true,
      data: {
        id: contestId,
        contestName: trimmedName,
        contestSlug,
        contestNumber: num,
        contestType,
        questionsCount: questions.length
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. GET /api/v1/analytics/contests
 * Lists all contests with historical summary and student attendance
 */
async function getContests(req, res, next) {
  try {
    const yearParam = req.query.year;
    const isAllYears = !yearParam || yearParam === 'all' || yearParam === '0';
    const yearNum = !isAllYears ? parseInt(yearParam, 10) : null;

    const { whereSql, params } = req.scope?.buildStudentWhere
      ? (yearNum
          ? req.scope.buildStudentWhere('s', ['s.year_of_study = ?'], [yearNum])
          : req.scope.buildStudentWhere('s'))
      : (yearNum
          ? { whereSql: 'WHERE s.year_of_study = ?', params: [yearNum] }
          : { whereSql: '', params: [] });

    // Get total student count
    const [stCountRows] = await pool.query(
      `SELECT COUNT(s.id) AS total_students FROM students s ${whereSql}`,
      params
    );
    const totalStudents = stCountRows[0]?.total_students || 0;

    const [contests] = await pool.query(
      `SELECT ql.id, ql.name, ql.contest_number, ql.contest_type, ql.created_at,
              COUNT(DISTINCT qi.id) AS questions_count
       FROM question_lists ql
       LEFT JOIN question_list_items qi ON ql.id = qi.question_list_id
       GROUP BY ql.id
       ORDER BY ql.created_at DESC`
    );

    const contestList = [];

    for (const c of contests) {
      const contestSlug = slugify(c.name);

      // Count students who solved at least 1 problem in this contest
      const [attendRows] = await pool.query(
        `SELECT COUNT(DISTINCT sqs.student_id) AS attended_count,
                COUNT(CASE WHEN sqs.solved = 1 THEN 1 END) AS total_solved
         FROM student_question_status sqs
         JOIN question_list_items qi ON sqs.question_list_item_id = qi.id
         JOIN students s ON sqs.student_id = s.id
         WHERE qi.question_list_id = ? AND sqs.solved = 1 ${whereSql ? 'AND ' + whereSql.replace('WHERE ', '') : ''}`,
        [c.id, ...params]
      );

      const attended = attendRows[0]?.attended_count || 0;
      const totalSolved = attendRows[0]?.total_solved || 0;
      const notAttended = Math.max(0, totalStudents - attended);
      const attendancePercentage = totalStudents > 0 ? Math.round((attended / totalStudents) * 100) : 0;
      const averageSolved = attended > 0 ? parseFloat((totalSolved / attended).toFixed(1)) : 0;

      contestList.push({
        id: String(c.id),
        contestName: c.name,
        contestNumber: c.contest_number,
        contestSlug,
        contestType: c.contest_type || 'weekly',
        contestDate: c.created_at,
        status: 'completed',
        questionsCount: parseInt(c.questions_count, 10) || 0,
        totalStudents,
        attended,
        notAttended,
        attendancePercentage,
        averageSolved,
        isManaged: true
      });
    }

    res.json({
      success: true,
      data: {
        contests: contestList
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. GET /api/v1/analytics/contests/current
 */
async function getCurrentContest(req, res, next) {
  try {
    const [contests] = await pool.query(
      `SELECT ql.id, ql.name, ql.contest_number, ql.contest_type, ql.created_at
       FROM question_lists ql
       ORDER BY ql.created_at DESC LIMIT 1`
    );

    if (contests.length === 0) {
      return res.json({ success: true, data: null });
    }

    const c = contests[0];
    const contestSlug = slugify(c.name);

    // Fetch details for this contest
    req.params.contestSlug = contestSlug;
    return getContestDetail(req, res, next);
  } catch (err) {
    next(err);
  }
}

/**
 * 7. GET /api/v1/analytics/contests/:contestSlug
 */
async function getContestDetail(req, res, next) {
  try {
    const { contestSlug } = req.params;
    const yearParam = req.query.year;
    const isAllYears = !yearParam || yearParam === 'all' || yearParam === '0';
    const yearNum = !isAllYears ? parseInt(yearParam, 10) : null;

    // Find contest by slug or ID
    const [allLists] = await pool.query('SELECT * FROM question_lists');
    const contest = allLists.find(l => slugify(l.name) === contestSlug || String(l.id) === contestSlug);

    if (!contest) {
      return res.status(404).json({ success: false, error: { message: 'Contest not found' } });
    }

    // Get question items
    const [items] = await pool.query(
      `SELECT id, input_title, resolved_slug, resolved_title, difficulty 
       FROM question_list_items 
       WHERE question_list_id = ? 
       ORDER BY id ASC`,
      [contest.id]
    );

    // Get students in this year cohort
    const { whereSql, params } = req.scope?.buildStudentWhere
      ? (yearNum
          ? req.scope.buildStudentWhere('s', ['s.year_of_study = ?'], [yearNum])
          : req.scope.buildStudentWhere('s'))
      : (yearNum
          ? { whereSql: 'WHERE s.year_of_study = ?', params: [yearNum] }
          : { whereSql: '', params: [] });

    const [students] = await pool.query(
      `SELECT s.id, s.roll_number, s.name, s.leetcode_username, s.year_of_study, s.sync_status,
              u.name AS proctor_name,
              ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved, ls.ranking, ls.contest_rating,
              ls.daily_solved, ls.weekly_solved, ls.monthly_solved
       FROM students s
       LEFT JOIN users u ON s.proctor_id = u.id
       LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
       ${whereSql}
       ORDER BY ls.total_solved DESC, s.name ASC`,
      params
    );

    // Fetch all student question statuses for this contest
    const [statuses] = await pool.query(
      `SELECT sqs.student_id, sqs.question_list_item_id, sqs.solved, sqs.solved_at 
       FROM student_question_status sqs
       JOIN question_list_items qi ON sqs.question_list_item_id = qi.id
       WHERE qi.question_list_id = ?`,
      [contest.id]
    );

    const statusMap = new Map();
    statuses.forEach(st => {
      const key = `${st.student_id}_${st.question_list_item_id}`;
      statusMap.set(key, Boolean(st.solved));
    });

    // Build problem summaries with solve counts
    const problemSummaries = items.map((item, idx) => {
      let solvedCount = 0;
      students.forEach(st => {
        if (statusMap.get(`${st.id}_${item.id}`)) solvedCount++;
      });

      return {
        orderNum: idx + 1,
        title: item.resolved_title || item.input_title,
        slug: item.resolved_slug || slugify(item.input_title),
        difficulty: item.difficulty || 'Medium',
        verified: true,
        solvedCount
      };
    });

    // Build student breakdown
    let totalContestSolved = 0;
    let attendedCount = 0;

    const studentRows = students.map(st => {
      let solvedCount = 0;
      let easyCount = 0;
      let mediumCount = 0;
      let hardCount = 0;
      const solvedSlugs = [];

      const exactProblems = items.map((item, idx) => {
        const isSolved = Boolean(statusMap.get(`${st.id}_${item.id}`));
        if (isSolved) {
          solvedCount++;
          solvedSlugs.push(item.resolved_slug);
          if (item.difficulty === 'Easy') easyCount++;
          else if (item.difficulty === 'Hard') hardCount++;
          else mediumCount++;
        }
        return {
          orderNum: idx + 1,
          title: item.resolved_title || item.input_title,
          slug: item.resolved_slug || slugify(item.input_title),
          difficulty: item.difficulty || 'Medium',
          solved: isSolved
        };
      });

      const isAttended = solvedCount > 0;
      if (isAttended) attendedCount++;
      totalContestSolved += solvedCount;

      const totalProblems = items.length;
      const solvePercentage = totalProblems > 0 ? Math.round((solvedCount / totalProblems) * 100) : 0;

      // Extract section from roll_number if available (e.g. 21A91A05B3 -> Section B)
      let section = 'A';
      const match = st.roll_number?.match(/[A-Z0-9]{8}([A-Z0-9])/i);
      if (match) {
        const char = match[1].toUpperCase();
        if (['A', 'B', 'C', 'D', 'E', 'F'].includes(char)) section = char;
      }

      return {
        id: String(st.id),
        studentId: String(st.id),
        name: st.name,
        registerNumber: st.roll_number,
        leetcodeUsername: st.leetcode_username,
        year: st.year_of_study,
        section,
        proctorName: st.proctor_name || 'Dr. Anitha Kumar',
        status: isAttended ? 'Attended' : 'Not Attended',
        rank: st.ranking || null,
        solvedCount,
        totalProblems,
        solvePercentage,
        easyCount,
        mediumCount,
        hardCount,
        dailySolved: st.daily_solved || 0,
        weeklySolved: st.weekly_solved || 0,
        monthlySolved: st.monthly_solved || 0,
        totalSolved: st.total_solved || 0,
        solvedSlugs,
        exactProblems
      };
    });

    const totalStudents = students.length;
    const notAttendedCount = Math.max(0, totalStudents - attendedCount);
    const attendancePercentage = totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0;
    const avgSolved = attendedCount > 0 ? parseFloat((totalContestSolved / attendedCount).toFixed(1)) : 0;

    const easyProblemsCount = items.filter(i => i.difficulty === 'Easy').length;
    const mediumProblemsCount = items.filter(i => i.difficulty === 'Medium').length;
    const hardProblemsCount = items.filter(i => i.difficulty === 'Hard').length;

    const contestObj = {
      id: String(contest.id),
      contestName: contest.name,
      contestNumber: contest.contest_number,
      contestSlug: slugify(contest.name),
      contestType: contest.contest_type || 'weekly',
      startTime: contest.created_at,
      endTime: null,
      status: 'completed',
      isManaged: true
    };

    res.json({
      success: true,
      data: {
        contest: contestObj,
        currentContest: contestObj,
        selectedYear: isAllYears ? 'all' : yearNum,
        summary: {
          totalStudents,
          attendedCount,
          notAttendedCount,
          attendancePercentage,
          totalProblems: items.length,
          totalSolved: totalContestSolved,
          avgSolved,
          avgEasySolved: 0,
          avgMediumSolved: 0,
          avgHardSolved: 0,
          easyProblemsCount,
          mediumProblemsCount,
          hardProblemsCount
        },
        problems: problemSummaries,
        students: studentRows
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 8. POST /api/v1/analytics/contests/:contestSlug/sync
 * Syncs student LeetCode profiles for a specific year (or all) and re-evaluates the contest
 */
async function syncContestYear(req, res, next) {
  try {
    const { contestSlug } = req.params;
    const yearParam = req.body?.year || req.query?.year;
    const isAllYears = !yearParam || yearParam === 'all' || yearParam === '0';
    const yearNum = !isAllYears ? parseInt(yearParam, 10) : null;

    // 1. Find contest
    const [allLists] = await pool.query('SELECT * FROM question_lists');
    const contest = allLists.find(l => slugify(l.name) === contestSlug || String(l.id) === contestSlug);
    if (!contest) {
      return res.status(404).json({ success: false, error: { message: 'Contest not found' } });
    }

    const [items] = await pool.query(
      `SELECT id, resolved_slug, resolved_title FROM question_list_items WHERE question_list_id = ? AND resolved_slug IS NOT NULL`,
      [contest.id]
    );

    // 2. Fetch students for target year
    const additionalConditions = ["s.leetcode_username NOT LIKE 'NIL_%'"];
    const additionalParams = [];
    if (yearNum) {
      additionalConditions.push("s.year_of_study = ?");
      additionalParams.push(yearNum);
    }
    const { whereSql, params } = req.scope?.buildStudentWhere
      ? req.scope.buildStudentWhere('s', additionalConditions, additionalParams)
      : { whereSql: yearNum ? 'WHERE s.year_of_study = ?' : '', params: yearNum ? [yearNum] : [] };

    const [students] = await pool.query(
      `SELECT s.id, s.leetcode_username FROM students s ${whereSql}`,
      params
    );

    let syncedCount = 0;
    const CONCURRENCY = 15;

    for (let i = 0; i < students.length; i += CONCURRENCY) {
      const batch = students.slice(i, i + CONCURRENCY);
      const batchIds = batch.map(b => b.id);
      const [existingRows] = await pool.query(
        `SELECT student_id, total_solved, daily_start_total, baseline_cycle FROM leetcode_stats WHERE student_id IN (?)`,
        [batchIds.length > 0 ? batchIds : [0]]
      );
      const existingMap = new Map();
      existingRows.forEach(r => existingMap.set(r.student_id, r));

      await Promise.allSettled(batch.map(async (st) => {
        const statsResult = await leetcodeService.fetchUserLeetcodeStats(st.leetcode_username);
        if (statsResult.status === 'OK' && statsResult.data) {
          const d = statsResult.data;
          const existing = existingMap.get(st.id) || null;
          const { dailyStartTotal, baselineCycle, dailySolved } = baselineService.resolveDailyBaseline(d.total_solved, existing);

          await pool.query(
            `INSERT INTO leetcode_stats 
              (student_id, easy_solved, medium_solved, hard_solved, total_solved,
               daily_start_total, baseline_cycle, baseline_updated_at,
               daily_solved, weekly_solved, monthly_solved,
               ranking, contest_rating, contest_global_rank,
               last_fetch_status, last_fetch_error, checksum_valid, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, 'OK', NULL, ?, NOW())
             ON DUPLICATE KEY UPDATE
              easy_solved = VALUES(easy_solved),
              medium_solved = VALUES(medium_solved),
              hard_solved = VALUES(hard_solved),
              total_solved = VALUES(total_solved),
              daily_start_total = IF(baseline_cycle != VALUES(baseline_cycle) OR baseline_cycle IS NULL,
                                      VALUES(daily_start_total),
                                      daily_start_total),
              baseline_cycle = VALUES(baseline_cycle),
              daily_solved = VALUES(daily_solved),
              weekly_solved = VALUES(weekly_solved),
              monthly_solved = VALUES(monthly_solved),
              ranking = VALUES(ranking),
              contest_rating = VALUES(contest_rating),
              contest_global_rank = VALUES(contest_global_rank),
              last_fetch_status = 'OK',
              checksum_valid = VALUES(checksum_valid),
              updated_at = NOW()`,
            [st.id, d.easy_solved, d.medium_solved, d.hard_solved, d.total_solved,
             dailyStartTotal, baselineCycle,
             dailySolved, d.weekly_solved || 0, d.monthly_solved || 0,
             d.ranking, d.contest_rating, d.contest_global_rank, d.checksum_valid]
          );
          await pool.query("UPDATE students SET sync_status = 'Success', last_synced_at = NOW() WHERE id = ?", [st.id]);
          syncedCount++;

          // Check contest submissions
          if (items.length > 0) {
            const evalResults = await leetcodeService.checkStudentSolvedProblems(st.leetcode_username, items);
            for (const er of evalResults) {
              if (!er.question_list_item_id) continue;
              await pool.query(
                `INSERT INTO student_question_status 
                  (student_id, question_list_item_id, solved, solved_at, checked_at, verified_via)
                 VALUES (?, ?, ?, ?, NOW(), ?)
                 ON DUPLICATE KEY UPDATE solved = VALUES(solved), solved_at = VALUES(solved_at), checked_at = NOW()`,
                [st.id, er.question_list_item_id, er.solved, er.solved_at, er.verified_via]
              );
            }
          }
        }
      }));
    }

    res.json({
      success: true,
      message: `Successfully synced and evaluated ${syncedCount} students for ${isAllYears ? 'All Years' : `Year ${yearNum}`}`,
      syncedCount,
      totalStudents: students.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 9. GET /api/v1/analytics/contests/:contestSlug/export
 */
async function exportContestReport(req, res, next) {
  try {
    const { contestSlug } = req.params;
    const yearParam = req.query.year;
    const isAllYears = !yearParam || yearParam === 'all' || yearParam === '0';
    const yearNum = !isAllYears ? parseInt(yearParam, 10) : null;

    // Fetch contest data using existing logic
    const [allLists] = await pool.query('SELECT * FROM question_lists');
    const contest = allLists.find(l => slugify(l.name) === contestSlug || String(l.id) === contestSlug);

    if (!contest) {
      return res.status(404).send('Contest not found');
    }

    const [items] = await pool.query(
      `SELECT id, input_title, resolved_slug, resolved_title, difficulty FROM question_list_items WHERE question_list_id = ? ORDER BY id ASC`,
      [contest.id]
    );

    const { whereSql, params } = req.scope?.buildStudentWhere
      ? (yearNum
          ? req.scope.buildStudentWhere('s', ['s.year_of_study = ?'], [yearNum])
          : req.scope.buildStudentWhere('s'))
      : (yearNum
          ? { whereSql: 'WHERE s.year_of_study = ?', params: [yearNum] }
          : { whereSql: '', params: [] });

    const [students] = await pool.query(
      `SELECT s.id, s.roll_number, s.name, s.leetcode_username, s.year_of_study, u.name AS proctor_name
       FROM students s
       LEFT JOIN users u ON s.proctor_id = u.id
       ${whereSql}
       ORDER BY s.year_of_study ASC, s.roll_number ASC`,
      params
    );

    const [statuses] = await pool.query(
      `SELECT sqs.student_id, sqs.question_list_item_id, sqs.solved FROM student_question_status sqs
       JOIN question_list_items qi ON sqs.question_list_item_id = qi.id
       WHERE qi.question_list_id = ?`,
      [contest.id]
    );

    const statusMap = new Map();
    statuses.forEach(st => statusMap.set(`${st.student_id}_${st.question_list_item_id}`, Boolean(st.solved)));

    const rows = students.map((st, idx) => {
      let solvedCount = 0;
      const row = {
        'S.No': idx + 1,
        'Register Number': st.roll_number,
        'Student Name': st.name,
        'Academic Year': `Year ${st.year_of_study}`,
        'Proctor': st.proctor_name || 'Dr. Anitha Kumar',
        'LeetCode Username': st.leetcode_username
      };

      items.forEach((it, qIdx) => {
        const isSolved = Boolean(statusMap.get(`${st.id}_${it.id}`));
        if (isSolved) solvedCount++;
        row[`Q${qIdx + 1}: ${it.resolved_title || it.input_title}`] = isSolved ? 'SOLVED' : 'UNSOLVED';
      });

      row['Total Solved'] = solvedCount;
      row['Contest Status'] = solvedCount > 0 ? 'Attended' : 'Not Attended';
      return row;
    });

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Contest Results');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Contest_Report_${contestSlug}_${isAllYears ? 'All_Years' : `Year_${yearNum}`}.xlsx`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUpcomingContest,
  verifyQuestion,
  matchSlug,
  createContest,
  getContests,
  getCurrentContest,
  getContestDetail,
  syncContestYear,
  exportContestReport
};
