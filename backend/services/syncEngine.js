const crypto = require('crypto');
const pool = require('../config/db');
const leetcodeService = require('./leetcodeService');
const baselineService = require('./baselineService');
const rankingSnapshotService = require('./rankingSnapshotService');

// In-memory background task registry
const tasksMap = new Map();

// Periodic cleanup of stale tasks (retain for 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [taskId, task] of tasksMap.entries()) {
    if (task.completedAt && (now - task.completedAt > 3600000)) {
      tasksMap.delete(taskId);
    }
  }
}, 300000);

// Global adaptive concurrency state
let currentConcurrency = 50; // Main concurrency level tuned for sub-8s
const MIN_CONCURRENCY = 20;
const MAX_CONCURRENCY = 60;
let consecutiveSuccessRuns = 0;

/**
 * Flush buffered leetcode_stats rows in a single high-performance multi-row query.
 */
async function flushStatsBuffer(statsRows) {
  if (!statsRows || statsRows.length === 0) return;

  const placeholders = [];
  const values = [];

  for (const row of statsRows) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())');
    values.push(
      row.studentId,
      row.easySolved,
      row.mediumSolved,
      row.hardSolved,
      row.totalSolved,
      row.dailyStartTotal,
      row.baselineCycle,
      row.dailySolved,
      row.weeklySolved,
      row.monthlySolved,
      row.ranking,
      row.contestRating,
      row.contestGlobalRank,
      row.lastFetchStatus,
      row.lastFetchError,
      row.checksumValid
    );
  }

  const sql = `
    INSERT INTO leetcode_stats 
      (student_id, easy_solved, medium_solved, hard_solved, total_solved,
       daily_start_total, baseline_cycle, baseline_updated_at,
       daily_solved, weekly_solved, monthly_solved,
       ranking, contest_rating, contest_global_rank,
       last_fetch_status, last_fetch_error, checksum_valid, updated_at)
    VALUES ${placeholders.join(', ')}
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
      last_fetch_status = VALUES(last_fetch_status),
      last_fetch_error = VALUES(last_fetch_error),
      checksum_valid = VALUES(checksum_valid),
      updated_at = NOW()
  `;

  await pool.query(sql, values);
}

/**
 * Flush student sync status in bulk.
 */
async function flushStudentStatusBuffer(statusRows) {
  if (!statusRows || statusRows.length === 0) return;

  const successIds = [];
  const failedIds = [];

  for (const item of statusRows) {
    if (item.success) {
      successIds.push(item.id);
    } else {
      failedIds.push(item.id);
    }
  }

  const queries = [];
  if (successIds.length > 0) {
    queries.push(pool.query(
      "UPDATE students SET sync_status = 'Success', last_synced_at = NOW() WHERE id IN (?)",
      [successIds]
    ));
  }
  if (failedIds.length > 0) {
    queries.push(pool.query(
      "UPDATE students SET sync_status = 'Failed', last_synced_at = NOW() WHERE id IN (?)",
      [failedIds]
    ));
  }

  await Promise.all(queries);
}

/**
 * Flush ranking snapshots in a single multi-row insert.
 */
async function flushSnapshotBuffer(snapshotRows) {
  if (!snapshotRows || snapshotRows.length === 0) return;

  const placeholders = [];
  const values = [];

  for (const s of snapshotRows) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, NOW())');
    values.push(
      s.studentId,
      s.snapshotDate,
      s.ranking,
      s.totalSolved,
      s.easySolved,
      s.mediumSolved,
      s.hardSolved
    );
  }

  const sql = `
    INSERT INTO ranking_snapshots 
      (student_id, snapshot_date, ranking, total_solved, easy_solved, medium_solved, hard_solved, created_at)
    VALUES ${placeholders.join(', ')}
    ON DUPLICATE KEY UPDATE
      ranking = VALUES(ranking),
      total_solved = VALUES(total_solved),
      easy_solved = VALUES(easy_solved),
      medium_solved = VALUES(medium_solved),
      hard_solved = VALUES(hard_solved)
  `;

  await pool.query(sql, values);
}

/**
 * Execute batch LeetCode sync using concurrency pool, persistent HTTP keepAlive,
 * rate-limit awareness, and multi-row buffered DB writes.
 */
async function executeBatchSync(students, departmentId = null, onProgress = null) {
  const total = students.length;
  if (total === 0) {
    return { total: 0, successful: 0, failed: 0, elapsedTimeMs: 0 };
  }

  const startTime = Date.now();
  let completed = 0;
  let successful = 0;
  let failed = 0;
  let rateLimitHit = false;

  // 1. Pre-fetch existing stats baselines in bulk (single DB round-trip)
  const studentIds = students.map(s => s.id);
  const existingMap = new Map();

  // Batch query existing rows in chunks of 500
  for (let i = 0; i < studentIds.length; i += 500) {
    const chunkIds = studentIds.slice(i, i + 500);
    const [existingRows] = await pool.query(
      `SELECT student_id, total_solved, daily_start_total, baseline_cycle 
       FROM leetcode_stats WHERE student_id IN (?)`,
      [chunkIds]
    );
    existingRows.forEach(r => existingMap.set(r.student_id, r));
  }

  // 2. Setup DB write buffer & auto-flush
  const FLUSH_CHUNK_SIZE = 50;
  let statsBuffer = [];
  let statusBuffer = [];
  let snapshotBuffer = [];
  const todayStr = new Date().toISOString().split('T')[0];

  async function flushAllBuffers() {
    if (statsBuffer.length === 0 && statusBuffer.length === 0 && snapshotBuffer.length === 0) return;
    const statsToFlush = statsBuffer;
    const statusToFlush = statusBuffer;
    const snapToFlush = snapshotBuffer;
    statsBuffer = [];
    statusBuffer = [];
    snapshotBuffer = [];

    await Promise.all([
      flushStatsBuffer(statsToFlush),
      flushStudentStatusBuffer(statusToFlush),
      flushSnapshotBuffer(snapToFlush)
    ]);
  }

  // 3. Concurrency worker queue
  const concurrency = currentConcurrency;
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < total) {
      const idx = nextIdx++;
      const student = students[idx];
      const username = student.leetcode_username;

      try {
        const statsResult = await leetcodeService.fetchUserLeetcodeStats(username);

        if (statsResult.status === 'OK' && statsResult.data) {
          const d = statsResult.data;
          const existing = existingMap.get(student.id) || null;
          const { dailyStartTotal, baselineCycle, dailySolved } = baselineService.resolveDailyBaseline(d.total_solved, existing);

          statsBuffer.push({
            studentId: student.id,
            easySolved: d.easy_solved,
            mediumSolved: d.medium_solved,
            hardSolved: d.hard_solved,
            totalSolved: d.total_solved,
            dailyStartTotal,
            baselineCycle,
            dailySolved,
            weeklySolved: d.weekly_solved || 0,
            monthlySolved: d.monthly_solved || 0,
            ranking: d.ranking,
            contestRating: d.contest_rating,
            contestGlobalRank: d.contest_global_rank,
            lastFetchStatus: 'OK',
            lastFetchError: null,
            checksumValid: d.checksum_valid
          });

          snapshotBuffer.push({
            studentId: student.id,
            snapshotDate: todayStr,
            ranking: d.ranking,
            totalSolved: d.total_solved,
            easySolved: d.easy_solved,
            mediumSolved: d.medium_solved,
            hardSolved: d.hard_solved
          });

          statusBuffer.push({ id: student.id, success: true });
          successful++;
        } else {
          if (statsResult.status === 'RateLimited') {
            rateLimitHit = true;
          }

          statsBuffer.push({
            studentId: student.id,
            easySolved: 0,
            mediumSolved: 0,
            hardSolved: 0,
            totalSolved: 0,
            dailyStartTotal: 0,
            baselineCycle: null,
            dailySolved: 0,
            weeklySolved: 0,
            monthlySolved: 0,
            ranking: null,
            contestRating: null,
            contestGlobalRank: null,
            lastFetchStatus: statsResult.status || 'ParseError',
            lastFetchError: statsResult.error || 'Failed to fetch LeetCode stats',
            checksumValid: true
          });

          statusBuffer.push({ id: student.id, success: false });
          failed++;
        }
      } catch (err) {
        statusBuffer.push({ id: student.id, success: false });
        failed++;
      } finally {
        completed++;
        onProgress?.(completed, total, successful, failed);

        // Periodic buffer flush
        if (statsBuffer.length >= FLUSH_CHUNK_SIZE) {
          await flushAllBuffers();
        }
      }
    }
  }

  // Launch parallel concurrency workers
  const workerCount = Math.min(concurrency, total);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.allSettled(workers);

  // Final flush for remaining buffered items
  await flushAllBuffers();

  // 4. Capture daily ranking snapshots aggregated for department / global
  try {
    await rankingSnapshotService.captureDailySnapshot(departmentId);
  } catch (snapErr) {
    console.warn('[SyncEngine] Daily snapshot capture notice:', snapErr.message);
  }

  // 5. Adaptive Concurrency Tuning
  if (rateLimitHit) {
    currentConcurrency = Math.max(MIN_CONCURRENCY, Math.floor(currentConcurrency * 0.7));
    consecutiveSuccessRuns = 0;
    console.warn(`[SyncEngine] Rate limit encountered. Adaptive concurrency reduced to ${currentConcurrency}`);
  } else {
    consecutiveSuccessRuns++;
    if (consecutiveSuccessRuns >= 3 && currentConcurrency < MAX_CONCURRENCY) {
      currentConcurrency = Math.min(MAX_CONCURRENCY, currentConcurrency + 5);
      console.log(`[SyncEngine] Clean runs detected. Adaptive concurrency increased to ${currentConcurrency}`);
    }
  }

  const elapsedTimeMs = Date.now() - startTime;
  console.log(`[SyncEngine] Completed batch sync of ${total} students in ${(elapsedTimeMs / 1000).toFixed(2)}s (${successful} success, ${failed} failed)`);

  return {
    total,
    successful,
    failed,
    elapsedTimeMs
  };
}

/**
 * Start a background LeetCode sync task and return taskId immediately (<0.2s).
 */
function startSyncTask({ students, departmentId = null }) {
  const taskId = crypto.randomUUID();
  const startTime = Date.now();

  const task = {
    taskId,
    status: 'processing',
    total: students.length,
    completed: 0,
    successful: 0,
    failed: 0,
    progressPercentage: 0,
    isFinished: false,
    startTime,
    completedAt: null,
    elapsedTimeMs: 0,
    error: null
  };

  tasksMap.set(taskId, task);

  // Execute in background
  executeBatchSync(
    students,
    departmentId,
    (completed, total, successful, failed) => {
      task.completed = completed;
      task.successful = successful;
      task.failed = failed;
      task.progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 100;
      task.elapsedTimeMs = Date.now() - startTime;
    }
  ).then((res) => {
    task.status = 'completed';
    task.isFinished = true;
    task.completed = res.total;
    task.successful = res.successful;
    task.failed = res.failed;
    task.progressPercentage = 100;
    task.completedAt = Date.now();
    task.elapsedTimeMs = res.elapsedTimeMs;
  }).catch((err) => {
    task.status = 'failed';
    task.isFinished = true;
    task.error = err.message || 'Background sync failed';
    task.completedAt = Date.now();
    task.elapsedTimeMs = Date.now() - startTime;
  });

  return {
    taskId,
    total: students.length,
    status: 'processing'
  };
}

/**
 * Get current status of a background task.
 */
function getTaskStatus(taskId) {
  const task = tasksMap.get(taskId);
  if (!task) {
    return null;
  }
  return {
    taskId: task.taskId,
    status: task.status,
    total: task.total,
    completed: task.completed,
    successful: task.successful,
    failed: task.failed,
    progressPercentage: task.progressPercentage,
    isFinished: task.isFinished,
    elapsedTimeMs: task.isFinished ? task.elapsedTimeMs : (Date.now() - task.startTime),
    error: task.error
  };
}

/**
 * High-speed Question List Evaluation with Concurrency Pool and Batch DB Upserts.
 */
async function evaluateQuestionListFast(students, resolvedItems, onProgress = null) {
  const total = students.length;
  if (total === 0 || !resolvedItems || resolvedItems.length === 0) {
    return { evaluatedStudents: 0, totalQuestions: resolvedItems?.length || 0, elapsedTimeMs: 0 };
  }

  const startTime = Date.now();
  let completed = 0;
  let statusBuffer = [];
  const FLUSH_CHUNK = 100;

  async function flushQuestionStatusBuffer() {
    if (statusBuffer.length === 0) return;
    const toFlush = statusBuffer;
    statusBuffer = [];

    const placeholders = [];
    const values = [];

    for (const item of toFlush) {
      placeholders.push('(?, ?, ?, ?, NOW(), ?)');
      values.push(
        item.studentId,
        item.questionListItemId,
        item.solved ? 1 : 0,
        item.solvedAt,
        item.verifiedVia
      );
    }

    const sql = `
      INSERT INTO student_question_status 
        (student_id, question_list_item_id, solved, solved_at, checked_at, verified_via)
      VALUES ${placeholders.join(', ')}
      ON DUPLICATE KEY UPDATE
        solved = VALUES(solved),
        solved_at = VALUES(solved_at),
        checked_at = NOW(),
        verified_via = VALUES(verified_via)
    `;

    await pool.query(sql, values);
  }

  let nextIdx = 0;
  const CONCURRENCY = Math.min(45, total);

  async function worker() {
    while (nextIdx < total) {
      const idx = nextIdx++;
      const student = students[idx];
      try {
        const results = await leetcodeService.checkStudentSolvedProblems(student.leetcode_username, resolvedItems);
        for (const resItem of results) {
          statusBuffer.push({
            studentId: student.id,
            questionListItemId: resItem.question_list_item_id,
            solved: resItem.solved,
            solvedAt: resItem.solved_at,
            verifiedVia: resItem.verified_via
          });
        }
      } catch (err) {
        // Individual failure isolation
      } finally {
        completed++;
        onProgress?.(completed, total);

        if (statusBuffer.length >= FLUSH_CHUNK) {
          await flushQuestionStatusBuffer();
        }
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.allSettled(workers);
  await flushQuestionStatusBuffer();

  const elapsedTimeMs = Date.now() - startTime;
  return {
    evaluatedStudents: total,
    totalQuestions: resolvedItems.length,
    elapsedTimeMs
  };
}

module.exports = {
  startSyncTask,
  getTaskStatus,
  executeBatchSync,
  evaluateQuestionListFast
};
