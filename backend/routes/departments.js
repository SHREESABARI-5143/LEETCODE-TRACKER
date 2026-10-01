const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', departmentController.listDepartments);
router.post('/', requireRole('ADMIN'), departmentController.createDepartment);
router.put('/:id', requireRole('ADMIN'), departmentController.updateDepartment);
router.delete('/:id', requireRole('ADMIN'), departmentController.deleteDepartment);

module.exports = router;
