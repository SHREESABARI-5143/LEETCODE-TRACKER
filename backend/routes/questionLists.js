const express = require('express');
const router = express.Router();
const questionListController = require('../controllers/questionListController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const scopeMiddleware = require('../middleware/scopeMiddleware');

router.use(authenticateToken);
router.use(scopeMiddleware);

router.get('/', questionListController.getQuestionLists);
router.post('/', requireRole('ADMIN', 'HOD'), questionListController.createQuestionList);
router.get('/:id', questionListController.getQuestionListDetails);
router.post('/:id/evaluate', requireRole('ADMIN', 'HOD', 'PLACEMENT'), questionListController.evaluateQuestionList);

module.exports = router;
