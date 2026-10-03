const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const scopeMiddleware = require('../middleware/scopeMiddleware');

router.use(authenticateToken);
router.use(scopeMiddleware);

router.get('/overall', reportsController.getOverallReport);
router.get('/year-wise', reportsController.getYearWiseReport);
router.get('/department-comparison', requireRole('ADMIN', 'PLACEMENT'), reportsController.getDepartmentComparison);
router.get('/daily-performers', reportsController.getDailyPerformers);
router.get('/export', reportsController.exportReportExcel);

module.exports = router;
