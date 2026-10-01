const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const scopeMiddleware = require('../middleware/scopeMiddleware');

router.use(authenticateToken);
router.use(scopeMiddleware);

router.get('/', studentController.getStudents);
router.get('/sync-status/:taskId', studentController.getSyncStatus);
router.get('/refresh-status/:taskId', studentController.getSyncStatus);
router.post('/sync-all', studentController.syncAllStudents);
router.post('/refresh-all', studentController.refreshAllStudents);
router.post('/refresh-by-year/:year', studentController.refreshStudentsByYear);
router.get('/:id', studentController.getStudentById);
router.put('/:id', studentController.updateStudent);
router.put('/:id/assign-proctor', requireRole('ADMIN', 'HOD'), studentController.assignProctor);
router.post('/:id/sync', studentController.syncStudent);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
