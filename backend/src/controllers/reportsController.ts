const analyticsService = require('../services/analyticsService');
const excelService = require('../services/excelService');
const pool = require('../config/db');

async function getOverallReport(req, res, next) {
  try {
    const report = await analyticsService.getOverallReport(req.scope);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function getYearWiseReport(req, res, next) {
  try {
    const report = await analyticsService.getYearWiseReport(req.scope);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function getDepartmentComparison(req, res, next) {
  try {
    if (!req.scope.isGlobal) {
      return res.status(403).json({ error: 'Department comparison is restricted to administrators and placement officers.' });
    }
    const report = await analyticsService.getDepartmentComparisonReport();
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function getDailyPerformers(req, res, next) {
  try {
    const period = req.query.period || 'today';
    const report = await analyticsService.getDailyTopPerformers(req.scope, period);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function exportReportExcel(req, res, next) {
  try {
    const overall = await analyticsService.getOverallReport(req.scope);
    const yearWise = await analyticsService.getYearWiseReport(req.scope);
    let departmentComparison = null;
    if (req.scope.isGlobal) {
      departmentComparison = await analyticsService.getDepartmentComparisonReport();
    }

    const { whereSql, params } = req.scope.buildStudentWhere('s');
    const [students] = await pool.query(
      `SELECT s.roll_number, s.name, s.year_of_study, s.placement_status,
              s.leetcode_username, s.sync_status,
              d.name AS department_name, d.code AS department_code,
              ls.total_solved, ls.easy_solved, ls.medium_solved, ls.hard_solved, ls.ranking
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN leetcode_stats ls ON s.id = ls.student_id
       ${whereSql}
       ORDER BY ls.total_solved DESC, ls.ranking ASC`,
      params
    );

    const institutionName = process.env.INSTITUTION_NAME || 'Institution';
    const buffer = excelService.generateMultiSheetReportExcel({
      overall,
      yearWise,
      departmentComparison,
      students,
      institutionName
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CodeTrack_Report_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverallReport,
  getYearWiseReport,
  getDepartmentComparison,
  getDailyPerformers,
  exportReportExcel
};
