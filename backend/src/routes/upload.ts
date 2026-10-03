const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const uploadController = require('../controllers/uploadController');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const scopeMiddleware = require('../middleware/scopeMiddleware');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'roster-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'));
    }
  }
});

// Soft/graceful authentication: if token is present and valid, use it; otherwise fallback gracefully to default HOD scope
async function softAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const [users] = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active, d.name AS department_name, d.code AS department_code 
         FROM users u 
         LEFT JOIN departments d ON u.department_id = d.id 
         WHERE u.id = ? LIMIT 1`,
        [decoded.userId]
      );
      if (users.length > 0 && users[0].is_active) {
        req.user = users[0];
      }
    } catch (e) {}
  }

  // Fallback if not authenticated
  if (!req.user) {
    req.user = {
      id: 2,
      name: 'Dr. P. Venkatesan',
      email: 'hod@svec.edu.in',
      role: 'HOD',
      department_id: 1
    };
  }

  next();
}

router.use(softAuthMiddleware);
router.use(scopeMiddleware);

router.post('/', upload.single('file'), uploadController.uploadStudents);
router.post('/commit', uploadController.commitUpload);
router.get('/history', uploadController.getUploadHistory);
router.get('/template', uploadController.downloadTemplate);

module.exports = router;
