const pool = require('../config/db');

async function getOverallReport(scope) {
  const { whereSql, params } = scope.buildStudentWhere('s');

  // Overall KPIs and Difficulty totals
  const [kpiRows] = await pool.query(
    `SELECT 
       COUNT(s.id) AS total_students,
       SUM(CASE WHEN s.sync_status = 'Success' AND COALESCE(ls.total_solved, 0) > 0 THEN 1 ELSE 0 END) AS active_students,
       SUM(CASE WHEN s.sync_status = 'Success' THEN 1 ELSE 0 END) AS analyzed_students,
       COALESCE(SUM(ls.total_solved), 0) AS total_solved,
       COALESCE(SUM(ls.easy_solved), 0) AS easy_solved,
       COALESCE(SUM(ls.medium_solved), 0) AS medium_solved,
       COALESCE(SUM(ls.hard_solved), 0) AS hard_solved,
       COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.total_solved ELSE NULL END), 0) AS avg_solved,
       COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.contest_rating ELSE NULL END), 0) AS avg_contest_rating
     FROM students s
     LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
     ${whereSql}`,
    params
  );

  // Sync health split
  const [syncRows] = await pool.query(
    `SELECT s.sync_status, COUNT(s.id) AS count
     FROM students s
     ${whereSql}
     GROUP BY s.sync_status`,
    params
  );

  const syncHealth = { Pending: 0, Success: 0, Failed: 0 };
  syncRows.forEach(r => {
    if (r.sync_status) syncHealth[r.sync_status] = parseInt(r.count);
  });

  const row = kpiRows[0] || {};
  const total = parseInt(row.total_students) || 0;
  const active = parseInt(row.active_students) || 0;
  const analyzed = parseInt(row.analyzed_students) || 0;
  const totalSolved = parseInt(row.total_solved) || 0;
  const avgSolved = Math.round(parseFloat(row.avg_solved) || 0);

  // Trend data over last 30 days
  const [trendRows] = await pool.query(
    `SELECT DATE_FORMAT(rs.snapshot_date, '%Y-%m-%d') as date, SUM(rs.total_solved) as total_solved
     FROM ranking_snapshots rs
     JOIN students s ON rs.student_id = s.id
     ${whereSql} AND rs.snapshot_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY rs.snapshot_date
     ORDER BY rs.snapshot_date ASC`,
    params
  );

  const trendData = trendRows.map(r => ({
    date: r.date,
    totalSolved: parseInt(r.total_solved) || 0
  }));

  // Contest Attendance over last 5 contests
  const [contestRows] = await pool.query(
    `SELECT cr.contest_slug, MAX(cr.contest_name) as contest_name, COUNT(DISTINCT cr.student_id) as attended_count
     FROM contest_results cr
     JOIN students s ON cr.student_id = s.id
     ${whereSql}
     GROUP BY cr.contest_slug
     ORDER BY MAX(cr.contest_date) DESC
     LIMIT 5`,
    params
  );

  const contestTrend = contestRows.reverse().map(r => ({
    contestSlug: r.contest_slug,
    contestName: r.contest_name,
    attendance: parseInt(r.attended_count) || 0,
    attendancePercentage: total > 0 ? Math.round((parseInt(r.attended_count) / total) * 100) : 0
  }));

  return {
    totalStudents: total,
    activeStudents: active,
    analyzedStudents: analyzed,
    activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
    analyzedPercentage: total > 0 ? Math.round((analyzed / total) * 100) : 0,
    totalSolved: totalSolved,
    avgSolved: avgSolved,
    avgContestRating: Math.round(parseFloat(row.avg_contest_rating) || 0),
    difficultyBreakdown: {
      easy: parseInt(row.easy_solved) || 0,
      medium: parseInt(row.medium_solved) || 0,
      hard: parseInt(row.hard_solved) || 0
    },
    syncHealth,
    trendData,
    contestTrend
  };
}

async function getYearWiseReport(scope) {
  const years = [1, 2, 3, 4];
  const yearLabels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
  const reports = [];

  for (const y of years) {
    const { whereSql, params } = scope.buildStudentWhere('s', ['s.year_of_study = ?'], [y]);

    const [statRows] = await pool.query(
      `SELECT 
         COUNT(s.id) AS total_students,
         SUM(CASE WHEN s.sync_status = 'Success' AND COALESCE(ls.total_solved, 0) > 0 THEN 1 ELSE 0 END) AS active_students,
         COALESCE(SUM(ls.total_solved), 0) AS total_solved,
         COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.total_solved ELSE NULL END), 0) AS avg_solved,
         COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.easy_solved ELSE NULL END), 0) AS avg_easy,
         COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.medium_solved ELSE NULL END), 0) AS avg_medium,
         COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.hard_solved ELSE NULL END), 0) AS avg_hard,
         COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.contest_rating ELSE NULL END), 0) AS avg_contest_rating
       FROM students s
       LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
       ${whereSql}`,
      params
    );

    // Get top student for this year
    const [topStudentRows] = await pool.query(
      `SELECT s.id, s.name, s.roll_number, s.leetcode_username, ls.total_solved, ls.ranking
       FROM students s
       JOIN leetcode_stats ls ON s.id = ls.student_id
       ${whereSql}
       ORDER BY ls.total_solved DESC, ls.ranking ASC
       LIMIT 1`,
      params
    );

    const st = statRows[0] || {};
    const topSt = topStudentRows[0] || null;

    // Get contest attendance for the year
    const [attendanceRows] = await pool.query(
      `SELECT COUNT(DISTINCT cr.student_id) as attended_count
       FROM contest_results cr
       JOIN students s ON cr.student_id = s.id
       ${whereSql}`,
      params
    );
    const attendedCount = parseInt(attendanceRows[0]?.attended_count) || 0;
    const yearTotal = parseInt(st.total_students) || 0;
    const attendancePercentage = yearTotal > 0 ? Math.round((attendedCount / yearTotal) * 100) : 0;
    const activePercentage = yearTotal > 0 ? Math.round((parseInt(st.active_students) / yearTotal) * 100) : 0;

    reports.push({
      year: y,
      label: yearLabels[y],
      totalStudents: yearTotal,
      activeStudents: parseInt(st.active_students) || 0,
      activePercentage,
      attendancePercentage,
      totalSolved: parseInt(st.total_solved) || 0,
      avgSolved: Math.round(parseFloat(st.avg_solved) || 0),
      avgEasy: Math.round(parseFloat(st.avg_easy) || 0),
      avgMedium: Math.round(parseFloat(st.avg_medium) || 0),
      avgHard: Math.round(parseFloat(st.avg_hard) || 0),
      avgContestRating: Math.round(parseFloat(st.avg_contest_rating) || 0),
      topStudent: topSt ? {
        id: topSt.id,
        name: topSt.name,
        rollNumber: topSt.roll_number,
        registerNo: topSt.roll_number,
        leetcodeUsername: topSt.leetcode_username,
        totalSolved: topSt.total_solved
      } : null
    });
  }

  return reports;
}

async function getDepartmentComparisonReport() {
  const [depts] = await pool.query(
    `SELECT 
       d.id, d.name, d.code,
       COUNT(s.id) AS total_students,
       SUM(CASE WHEN s.sync_status = 'Success' AND COALESCE(ls.total_solved, 0) > 0 THEN 1 ELSE 0 END) AS active_students,
       COALESCE(SUM(ls.total_solved), 0) AS total_solved,
       COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.total_solved ELSE NULL END), 0) AS avg_solved,
       COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.easy_solved ELSE NULL END), 0) AS avg_easy,
       COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.medium_solved ELSE NULL END), 0) AS avg_medium,
       COALESCE(AVG(CASE WHEN s.sync_status = 'Success' THEN ls.hard_solved ELSE NULL END), 0) AS avg_hard
     FROM departments d
     LEFT JOIN students s ON d.id = s.department_id
     LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
     GROUP BY d.id, d.name, d.code
     ORDER BY total_solved DESC`
  );

  // We need attendance percentage per department
  const [attendanceDepts] = await pool.query(
    `SELECT d.id, COUNT(DISTINCT cr.student_id) as attended_count
     FROM departments d
     LEFT JOIN students s ON d.id = s.department_id
     LEFT JOIN contest_results cr ON s.id = cr.student_id
     GROUP BY d.id`
  );
  
  const attendanceMap = {};
  attendanceDepts.forEach(r => attendanceMap[r.id] = parseInt(r.attended_count) || 0);

  return depts.map(d => {
    const totalDept = parseInt(d.total_students) || 0;
    const activeDept = parseInt(d.active_students) || 0;
    const attendedDept = attendanceMap[d.id] || 0;

    return {
      id: d.id,
      name: d.name,
      code: d.code,
      totalStudents: totalDept,
      activeStudents: activeDept,
      activePercentage: totalDept > 0 ? Math.round((activeDept / totalDept) * 100) : 0,
      attendancePercentage: totalDept > 0 ? Math.round((attendedDept / totalDept) * 100) : 0,
      totalSolved: parseInt(d.total_solved) || 0,
      avgSolved: Math.round(parseFloat(d.avg_solved) || 0),
      avgEasy: Math.round(parseFloat(d.avg_easy) || 0),
      avgMedium: Math.round(parseFloat(d.avg_medium) || 0),
      avgHard: Math.round(parseFloat(d.avg_hard) || 0)
    };
  });
}

async function getDailyTopPerformers(scope, period = 'today') {
  const years = [1, 2, 3, 4];
  const yearLabels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
  const results = [];

  const sortCol = period === '7d' ? 'ls.weekly_solved' : period === '30d' ? 'ls.monthly_solved' : 'ls.daily_solved';

  for (const y of years) {
    const { whereSql, params } = scope.buildStudentWhere('s', ['s.year_of_study = ?'], [y]);

    const [performers] = await pool.query(
      `SELECT s.id, s.name, s.roll_number, s.leetcode_username, ls.total_solved, ls.ranking,
              ls.daily_solved, ls.weekly_solved, ls.monthly_solved,
              ls.easy_solved, ls.medium_solved, ls.hard_solved
       FROM students s
       JOIN leetcode_stats ls ON s.id = ls.student_id
       ${whereSql}
       ORDER BY ${sortCol} DESC, ls.total_solved DESC, ls.ranking ASC
       LIMIT 5`,
      params
    );

    results.push({
      year: y,
      label: yearLabels[y],
      performers: performers.map(p => ({
        id: p.id,
        name: p.name,
        rollNumber: p.roll_number,
        registerNo: p.roll_number,
        leetcodeUsername: p.leetcode_username,
        totalSolved: p.total_solved,
        dailySolved: p.daily_solved,
        weeklySolved: p.weekly_solved,
        monthlySolved: p.monthly_solved,
        solvedInPeriod: period === '7d' ? p.weekly_solved : period === '30d' ? p.monthly_solved : p.daily_solved,
        ranking: p.ranking,
        easy: p.easy_solved,
        medium: p.medium_solved,
        hard: p.hard_solved
      }))
    });
  }

  return results;
}

module.exports = {
  getOverallReport,
  getYearWiseReport,
  getDepartmentComparisonReport,
  getDailyTopPerformers
};
