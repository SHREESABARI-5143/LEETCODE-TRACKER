const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/authMiddleware');
const scopeMiddleware = require('../middleware/scopeMiddleware');

router.use(authenticateToken);
router.use(scopeMiddleware);

router.get('/:studentId', profileController.getStudentProfile);
router.get('/:studentId/ranking-trend', profileController.getStudentRankingTrend);

module.exports = router;
