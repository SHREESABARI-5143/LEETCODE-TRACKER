const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { authenticateToken } = require('../middleware/authMiddleware');
const scopeMiddleware = require('../middleware/scopeMiddleware');

router.use(authenticateToken);
router.use(scopeMiddleware);

router.get('/', leaderboardController.getLeaderboard);

module.exports = router;
