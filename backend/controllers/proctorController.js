const pool = require('../config/db');

const YEARS = [1, 2, 3, 4];
const YEAR_LABELS = {
  1: '1st Year Proctors',
  2: '2nd Year Proctors',
  3: '3rd Year Proctors',
  4: '4th Year Proctors'
};

/**
 * Helper to derive section from register/roll number
 */
function deriveSection(rollNumber) {
  if (!rollNumber) return 'A';
  const match = rollNumber.match(/[A-Z0-9]{8}([A-Z0-9])/i);
  if (match) {
    const char = match[1].toUpperCase();
    if (['A', 'B', 'C', 'D', 'E', 'F'].includes(char)) return char;
  }
  return 'A';
}

/**
 * GET /api/v1/analytics/proctors
 * Returns real database-driven proctor performance metrics across all academic years
 */
async function getProctorPerformance(req, res, next) {
  try {
    const targetDeptId = req.scope?.isGlobal ? null : req.scope?.userDepartmentId || 1;

    // Fetch proctors from database
    const [dbProctors] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.role IN ('PROCTOR', 'HOD')
       ORDER BY u.role DESC, u.name ASC`
    );

    // Default faculty proctor pool if only 1 proctor account exists
    const proctorsPool = dbProctors.length > 0 ? dbProctors : [
      { id: 5, name: 'Dr. Anitha Kumar', email: 'proctor@svec.edu.in' }
    ];

    const yearGroups = [];

    for (const year of YEARS) {
      // Fetch all students for this year
      const [students] = await pool.query(
        `SELECT s.id, s.roll_number, s.name, s.leetcode_username, s.year_of_study, s.sync_status,
                s.proctor_id, u.name AS proctor_name, u.email AS proctor_email,
                ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved, ls.ranking,
                ls.contest_rating, ls.daily_solved, ls.weekly_solved, ls.monthly_solved
         FROM students s
         LEFT JOIN users u ON s.proctor_id = u.id
         LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
         WHERE s.year_of_study = ?
         ORDER BY ls.total_solved DESC, s.name ASC`,
        [year]
      );

      if (students.length === 0) {
        yearGroups.push({
          year,
          label: YEAR_LABELS[year],
          proctors: []
        });
        continue;
      }

      // Group students by proctor
      const proctorMap = new Map();

      // Ensure every proctor in pool is initialized
      proctorsPool.forEach(p => {
        proctorMap.set(p.id, {
          id: String(p.id),
          name: p.name,
          email: p.email,
          year,
          students: []
        });
      });

      // Distribute students
      students.forEach((s, idx) => {
        const assignedProctorId = s.proctor_id || proctorsPool[idx % proctorsPool.length].id;
        if (!proctorMap.has(assignedProctorId)) {
          proctorMap.set(assignedProctorId, {
            id: String(assignedProctorId),
            name: s.proctor_name || `Faculty Proctor (${assignedProctorId})`,
            email: s.proctor_email || 'proctor@svec.edu.in',
            year,
            students: []
          });
        }
        proctorMap.get(assignedProctorId).students.push(s);
      });

      const proctorMetricsList = [];

      for (const [, pData] of proctorMap.entries()) {
        if (pData.students.length === 0) continue;

        const pStudents = pData.students;
        const totalCount = pStudents.length;

        const mappedStudents = pStudents.map(s => {
          const section = deriveSection(s.roll_number);
          const totalSolved = s.total_solved || 0;
          const isActive = s.sync_status === 'Success' && totalSolved > 0;

          return {
            id: String(s.id),
            name: s.name,
            registerNo: s.roll_number,
            rollNumber: s.roll_number,
            leetcodeUsername: s.leetcode_username,
            year: s.year_of_study,
            section,
            proctorId: pData.id,
            proctorName: pData.name,
            totalSolved,
            easySolved: s.easy_solved || 0,
            mediumSolved: s.medium_solved || 0,
            hardSolved: s.hard_solved || 0,
            ranking: s.ranking,
            contestRating: Math.round(s.contest_rating || 0),
            dailySolved: s.daily_solved || 0,
            weeklySolved: s.weekly_solved || 0,
            monthlySolved: s.monthly_solved || 0,
            status: isActive ? 'active' : totalSolved > 0 ? 'attention' : 'inactive',
            profile: {
              totalSolved,
              easySolved: s.easy_solved || 0,
              mediumSolved: s.medium_solved || 0,
              hardSolved: s.hard_solved || 0,
              ranking: s.ranking,
              contestRating: Math.round(s.contest_rating || 0),
              streak: 0
            }
          };
        });

        const attendedStudents = mappedStudents.filter(s => s.status === 'active' || s.totalSolved > 0);
        const notAttendedStudents = mappedStudents.filter(s => s.status === 'inactive' || s.totalSolved === 0);

        const activePercentage = totalCount > 0 ? Math.round((attendedStudents.length / totalCount) * 100) : 0;
        const attentionCount = notAttendedStudents.length;

        const uniqueSections = Array.from(new Set(mappedStudents.map(s => s.section))).sort();
        const assignedSections = uniqueSections.map(sec => `Y${year}-${sec}`);

        proctorMetricsList.push({
          id: pData.id,
          name: pData.name,
          email: pData.email,
          year,
          assignedSections: assignedSections.length > 0 ? assignedSections : [`Y${year}-A`],
          studentCount: totalCount,
          activePercentage,
          attentionCount,
          attendedStudents,
          notAttendedStudents
        });
      }

      yearGroups.push({
        year,
        label: YEAR_LABELS[year],
        proctors: proctorMetricsList
      });
    }

    res.json({
      success: true,
      data: {
        yearGroups
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/analytics/proctors/me
 * Returns metrics and students for the currently logged in Proctor
 */
async function getMyProctorDashboard(req, res, next) {
  try {
    const proctorId = req.user.id;
    const proctorName = req.user.name;
    const proctorEmail = req.user.email;

    // Fetch assigned students
    const [students] = await pool.query(
      `SELECT s.id, s.roll_number, s.name, s.leetcode_username, s.year_of_study, s.sync_status,
              ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved, ls.ranking,
              ls.contest_rating, ls.daily_solved, ls.weekly_solved, ls.monthly_solved
       FROM students s
       LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
       WHERE s.proctor_id = ? OR s.proctor_id IS NULL
       ORDER BY ls.total_solved DESC, s.name ASC`,
      [proctorId]
    );

    const mappedStudents = students.map(s => {
      const section = deriveSection(s.roll_number);
      const totalSolved = s.total_solved || 0;
      const isActive = s.sync_status === 'Success' && totalSolved > 0;

      return {
        id: String(s.id),
        name: s.name,
        registerNo: s.roll_number,
        rollNumber: s.roll_number,
        leetcodeUsername: s.leetcode_username,
        year: s.year_of_study,
        section,
        proctorId: String(proctorId),
        proctorName,
        totalSolved,
        easySolved: s.easy_solved || 0,
        mediumSolved: s.medium_solved || 0,
        hardSolved: s.hard_solved || 0,
        ranking: s.ranking,
        contestRating: Math.round(s.contest_rating || 0),
        dailySolved: s.daily_solved || 0,
        weeklySolved: s.weekly_solved || 0,
        monthlySolved: s.monthly_solved || 0,
        status: isActive ? 'active' : totalSolved > 0 ? 'attention' : 'inactive',
        profile: {
          totalSolved,
          easySolved: s.easy_solved || 0,
          mediumSolved: s.medium_solved || 0,
          hardSolved: s.hard_solved || 0,
          ranking: s.ranking,
          contestRating: Math.round(s.contest_rating || 0),
          streak: 0
        }
      };
    });

    const active = mappedStudents.filter(s => s.status === 'active');
    const attention = mappedStudents.filter(s => s.status === 'attention');
    const inactive = mappedStudents.filter(s => s.status === 'inactive');

    const totalEasy = mappedStudents.reduce((a, s) => a + s.easySolved, 0);
    const totalMedium = mappedStudents.reduce((a, s) => a + s.mediumSolved, 0);
    const totalHard = mappedStudents.reduce((a, s) => a + s.hardSolved, 0);
    const totalSolvedSum = mappedStudents.reduce((a, s) => a + s.totalSolved, 0);
    const avgSolved = mappedStudents.length > 0 ? Math.round(totalSolvedSum / mappedStudents.length) : 0;

    const ratings = mappedStudents.map(s => s.contestRating).filter(r => r > 0);
    const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;

    res.json({
      success: true,
      data: {
        proctor: {
          id: String(proctorId),
          name: proctorName,
          email: proctorEmail,
          designation: 'Faculty Proctor'
        },
        stats: {
          totalStudents: mappedStudents.length,
          activeCount: active.length,
          attentionCount: attention.length,
          inactiveCount: inactive.length,
          avgSolved,
          avgContestRating: avgRating,
          totalEasy,
          totalMedium,
          totalHard
        },
        students: mappedStudents
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProctorPerformance,
  getMyProctorDashboard
};
