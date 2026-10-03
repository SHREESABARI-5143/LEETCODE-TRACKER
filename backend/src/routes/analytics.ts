const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const scopeMiddleware = require('../middleware/scopeMiddleware');
const contestController = require('../controllers/contestController');
const proctorController = require('../controllers/proctorController');

router.use(authenticateToken);
router.use(scopeMiddleware);

router.get('/student-counts', async (req, res, next) => {
  try {
    const { whereSql, params } = req.scope.buildStudentWhere('s');
    const [rows] = await pool.query(
      `SELECT s.year_of_study, COUNT(s.id) AS count
       FROM students s
       ${whereSql}
       GROUP BY s.year_of_study`,
      params
    );

    const counts = { year1: 0, year2: 0, year3: 0, year4: 0, total: 0 };
    rows.forEach(r => {
      const y = parseInt(r.year_of_study, 10);
      const c = parseInt(r.count, 10);
      if (y === 1) counts.year1 = c;
      if (y === 2) counts.year2 = c;
      if (y === 3) counts.year3 = c;
      if (y === 4) counts.year4 = c;
      counts.total += c;
    });

    res.json({ success: true, data: counts });
  } catch (err) {
    next(err);
  }
});

router.get('/sync/status', (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: false,
      target: 'All Students',
      total: 0,
      synced: 0,
      failed: 0,
      startedAt: null,
      finishedAt: null
    }
  });
});

// Contest Endpoints
router.get('/contests/upcoming', contestController.getUpcomingContest);
router.post('/contests/verify-question', contestController.verifyQuestion);
router.post('/contests/match-slug', contestController.matchSlug);
router.post('/contests', contestController.createContest);
router.get('/contests', contestController.getContests);
router.get('/contests/current', contestController.getCurrentContest);
router.get('/contests/:contestSlug', contestController.getContestDetail);
router.post('/contests/:contestSlug/sync', contestController.syncContestYear);
router.get('/contests/:contestSlug/export', contestController.exportContestReport);

// Proctor Endpoints (Live DB Data)
router.get('/proctors', proctorController.getProctorPerformance);
router.get('/proctors/me', proctorController.getMyProctorDashboard);

module.exports = router;
