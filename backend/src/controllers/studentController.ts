const pool = require('../config/db');
const leetcodeService = require('../services/leetcodeService');
const syncEngine = require('../services/syncEngine');
const baselineService = require('../services/baselineService');
const rankingSnapshotService = require('../services/rankingSnapshotService');
const validators = require('../utils/validators');

async function getStudents(req, res, next) {
  try {
    const { search, year, placement, sync_status, limit = 50, page = 1 } = req.query;
    const additionalConditions = [];
    const queryParams = [];

    if (search) {
      additionalConditions.push('(s.name LIKE ? OR s.roll_number LIKE ? OR s.leetcode_username LIKE ?)');
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term);
    }

    if (year) {
      additionalConditions.push('s.year_of_study = ?');
      queryParams.push(parseInt(year, 10));
    }

    if (placement) {
      additionalConditions.push('s.placement_status = ?');
      queryParams.push(placement);
    }

    if (sync_status) {
      additionalConditions.push('s.sync_status = ?');
      queryParams.push(sync_status);
    }

    const { whereSql, params } = req.scope.buildStudentWhere('s', additionalConditions, queryParams);

    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const offset = Math.max((parseInt(page, 10) || 1) - 1, 0) * pageSize;

    const countQuery = `
      SELECT COUNT(s.id) AS total
      FROM students s
      ${whereSql}
    `;
    const [countRows] = await pool.query(countQuery, params);
    const totalRecords = countRows[0]?.total || 0;

    const selectQuery = `
      SELECT s.id, s.roll_number, s.name, s.year_of_study, s.placement_status,
             s.leetcode_username, s.profile_link, s.sync_status, s.last_synced_at,
             s.department_id, s.proctor_id, s.created_at,
             d.name AS department_name, d.code AS department_code,
             p.full_name AS proctor_name, u.email AS proctor_email,
             ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved,
             ls.daily_start_total, ls.daily_solved, ls.weekly_solved, ls.monthly_solved,
             ls.ranking, ls.contest_rating, ls.contest_global_rank, ls.last_fetch_status, ls.last_fetch_error
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN proctors p ON s.proctor_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
      ${whereSql}
      ORDER BY ls.total_solved DESC, ls.ranking ASC, s.roll_number ASC
      LIMIT ? OFFSET ?
    `;

    const [students] = await pool.query(selectQuery, [...params, pageSize, offset]);

    res.json({
      students: students.map(s => ({
        id: s.id,
        registerNumber: s.roll_number,
        rollNumber: s.roll_number,
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
        dailySolved: s.daily_solved != null ? Number(s.daily_solved) : null,
        weeklySolved: Number(s.weekly_solved) || 0,
        monthlySolved: Number(s.monthly_solved) || 0,
        ranking: s.ranking ? Math.round(Number(s.ranking)) : null,
        contestRating: Math.round(Number(s.contest_rating) || 0),
        contestGlobalRank: s.contest_global_rank ? Math.round(Number(s.contest_global_rank)) : null,
        lastFetchStatus: s.last_fetch_status,
        lastFetchError: s.last_fetch_error
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

async function getStudentById(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const accessCheck = await req.scope.verifyStudentAccess(studentId, false);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.status).json({ error: accessCheck.reason });
    }

    const [rows] = await pool.query(
      `SELECT s.id, s.roll_number, s.name, s.year_of_study, s.placement_status,
              s.leetcode_username, s.profile_link, s.sync_status, s.last_synced_at,
              s.department_id, s.proctor_id, s.created_at,
              d.name AS department_name, d.code AS department_code,
              p.full_name AS proctor_name, u.email AS proctor_email,
              ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved,
              ls.daily_start_total, ls.daily_solved, ls.weekly_solved, ls.monthly_solved,
              ls.ranking, ls.contest_rating, ls.contest_global_rank, ls.last_fetch_status, ls.last_fetch_error
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN proctors p ON s.proctor_id = p.id
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
       WHERE s.id = ? LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
    const s = rows[0];

    res.json({
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
      totalSolved: s.total_solved || 0,
      easySolved: s.easy_solved || 0,
      mediumSolved: s.medium_solved || 0,
      hardSolved: s.hard_solved || 0,
      dailyStartTotal: Number(s.daily_start_total) || 0,
      dailySolved: s.daily_solved != null ? Number(s.daily_solved) : null,
      weeklySolved: Number(s.weekly_solved) || 0,
      monthlySolved: Number(s.monthly_solved) || 0,
      ranking: s.ranking,
      contestRating: s.contest_rating,
      contestGlobalRank: s.contest_global_rank,
      lastFetchStatus: s.last_fetch_status,
      lastFetchError: s.last_fetch_error
    });
  } catch (err) {
    next(err);
  }
}

async function updateStudent(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const accessCheck = await req.scope.verifyStudentAccess(studentId, true);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.status).json({ error: accessCheck.reason });
    }

    const { name, roll_number, year_of_study, placement_status, leetcode_username, profile_link, department_id, proctor_id } = req.body;
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (roll_number) { updates.push('roll_number = ?'); params.push(roll_number.trim()); }
    if (year_of_study) { updates.push('year_of_study = ?'); params.push(parseInt(year_of_study, 10)); }
    if (placement_status) { updates.push('placement_status = ?'); params.push(placement_status.trim()); }
    
    if (leetcode_username) {
      const cleanHandle = leetcode_username.trim();
      updates.push('leetcode_username = ?');
      params.push(cleanHandle);
      updates.push("sync_status = 'Pending'");
    }

    if (profile_link) {
      updates.push('profile_link = ?');
      params.push(profile_link.trim());
    }

    if (req.scope.isGlobal && department_id !== undefined) {
      updates.push('department_id = ?');
      params.push(department_id ? parseInt(department_id) : null);
    }

    if ((req.scope.isGlobal || req.scope.isHOD) && proctor_id !== undefined) {
      updates.push('proctor_id = ?');
      params.push(proctor_id ? parseInt(proctor_id) : null);
    }

    if (updates.length > 0) {
      params.push(studentId);
      await pool.query(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    next(err);
  }
}

async function assignProctor(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const { proctor_id } = req.body;

    const accessCheck = await req.scope.verifyStudentAccess(studentId, true);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.status).json({ error: accessCheck.reason });
    }

    let validProctorId = null;
    if (proctor_id) {
      const targetProctorId = parseInt(proctor_id, 10);
      const [proctors] = await pool.query(
        'SELECT id, department_id, role FROM users WHERE id = ? AND is_active = TRUE',
        [targetProctorId]
      );
      if (proctors.length === 0) {
        return res.status(400).json({ error: 'Proctor user not found or inactive.' });
      }

      // If HOD is assigning, verify proctor belongs to same department
      if (req.scope.isHOD && proctors[0].department_id !== req.scope.userDepartmentId) {
        return res.status(403).json({ error: 'Proctor must belong to your department.' });
      }

      validProctorId = targetProctorId;
    }

    await pool.query('UPDATE students SET proctor_id = ? WHERE id = ?', [validProctorId, studentId]);

    res.json({ success: true, message: 'Proctor assigned successfully.', proctorId: validProctorId });
  } catch (err) {
    next(err);
  }
}

async function syncStudent(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const accessCheck = await req.scope.verifyStudentAccess(studentId, true);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.status).json({ error: accessCheck.reason });
    }

    const student = accessCheck.student;
    const [fullStudent] = await pool.query('SELECT leetcode_username FROM students WHERE id = ?', [studentId]);
    const username = fullStudent[0]?.leetcode_username;

    if (!username || username.startsWith('NIL_')) {
      await pool.query("UPDATE students SET sync_status = 'Failed', last_synced_at = NOW() WHERE id = ?", [studentId]);
      return res.status(400).json({ error: 'Student does not have a valid LeetCode handle.' });
    }

    const statsResult = await leetcodeService.fetchUserLeetcodeStats(username);

    if (statsResult.status === 'OK' && statsResult.data) {
      const d = statsResult.data;

      const [existingStatsRows] = await pool.query(
        'SELECT total_solved, daily_start_total, baseline_cycle FROM leetcode_stats WHERE student_id = ?',
        [studentId]
      );
      const existing = existingStatsRows[0] || null;
      const { dailyStartTotal, baselineCycle, dailySolved } = baselineService.resolveDailyBaseline(d.total_solved, existing, d.daily_solved);

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
          last_fetch_error = NULL,
          checksum_valid = VALUES(checksum_valid),
          updated_at = NOW()`,
        [studentId, d.easy_solved, d.medium_solved, d.hard_solved, d.total_solved,
         dailyStartTotal, baselineCycle,
         dailySolved, d.weekly_solved || 0, d.monthly_solved || 0,
         d.ranking, d.contest_rating, d.contest_global_rank, d.checksum_valid]
      );

      await pool.query("UPDATE students SET sync_status = 'Success', last_synced_at = NOW() WHERE id = ?", [studentId]);

      // Capture snapshot
      const todayStr = new Date().toISOString().split('T')[0];
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
        [studentId, todayStr, d.ranking, d.total_solved, d.easy_solved, d.medium_solved, d.hard_solved]
      );

      res.json({ success: true, stats: { ...d, daily_start_total: dailyStartTotal, daily_solved: dailySolved } });
    } else {
      await pool.query(
        `INSERT INTO leetcode_stats (student_id, last_fetch_status, last_fetch_error, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
          last_fetch_status = VALUES(last_fetch_status),
          last_fetch_error = VALUES(last_fetch_error),
          updated_at = NOW()`,
        [studentId, statsResult.status, statsResult.error]
      );

      await pool.query("UPDATE students SET sync_status = 'Failed', last_synced_at = NOW() WHERE id = ?", [studentId]);
      res.status(400).json({ error: statsResult.error || 'Failed to sync LeetCode stats.' });
    }
  } catch (err) {
    next(err);
  }
}

async function syncAllStudents(req, res, next) {
  try {
    const year = req.query.year || req.body?.year || req.params?.year;
    const additionalConditions = ["s.leetcode_username NOT LIKE 'NIL_%'"];
    const additionalParams = [];
    if (year && year !== 'all' && !isNaN(parseInt(year, 10))) {
      additionalConditions.push("s.year_of_study = ?");
      additionalParams.push(parseInt(year, 10));
    }
    const { whereSql, params } = req.scope.buildStudentWhere('s', additionalConditions, additionalParams);

    const [students] = await pool.query(
      `SELECT s.id, s.leetcode_username FROM students s ${whereSql}`,
      params
    );

    if (students.length === 0) {
      return res.json({
        success: true,
        message: 'No students found to synchronize.',
        total: 0,
        processed: 0,
        isFinished: true
      });
    }

    // Check if synchronous execution was explicitly requested (e.g. ?wait=true)
    const shouldWait = req.query.wait === 'true' || req.body?.wait === true;
    if (shouldWait) {
      const result = await syncEngine.executeBatchSync(students, req.scope.departmentId);
      return res.json({
        success: true,
        total: result.total,
        successCount: result.successful,
        failedCount: result.failed,
        elapsedTimeMs: result.elapsedTimeMs,
        message: `Synchronized ${result.successful} of ${result.total} students in ${(result.elapsedTimeMs / 1000).toFixed(2)}s.`
      });
    }

    // Fast non-blocking response (<0.2s): return task info immediately and run pool in background
    const taskInfo = syncEngine.startSyncTask({
      students,
      departmentId: req.scope.departmentId
    });

    res.status(202).json({
      success: true,
      taskId: taskInfo.taskId,
      total: taskInfo.total,
      status: 'processing',
      message: `Sync started in background for ${taskInfo.total} students.`
    });
  } catch (err) {
    next(err);
  }
}

async function getSyncStatus(req, res, next) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required.' });
    }

    const status = syncEngine.getTaskStatus(taskId);
    if (!status) {
      return res.status(404).json({ error: 'Sync task not found or has expired.' });
    }

    res.json({
      success: true,
      ...status
    });
  } catch (err) {
    next(err);
  }
}

async function refreshAllStudents(req, res, next) {
  return syncAllStudents(req, res, next);
}

async function refreshStudentsByYear(req, res, next) {
  return syncAllStudents(req, res, next);
}

async function deleteStudent(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    const accessCheck = await req.scope.verifyStudentAccess(studentId, true);
    if (!accessCheck.allowed) {
      return res.status(accessCheck.status).json({ error: accessCheck.reason });
    }

    await pool.query('DELETE FROM leetcode_stats WHERE student_id = ?', [studentId]);
    await pool.query('DELETE FROM ranking_snapshots WHERE student_id = ?', [studentId]);
    await pool.query('DELETE FROM student_question_status WHERE student_id = ?', [studentId]);
    const [result] = await pool.query('DELETE FROM students WHERE id = ?', [studentId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStudents,
  getStudentById,
  updateStudent,
  assignProctor,
  syncStudent,
  syncAllStudents,
  refreshAllStudents,
  refreshStudentsByYear,
  getSyncStatus,
  deleteStudent
};
