const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'leetcode-tracker-super-jwt-secret-key-2026-prod-grade';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'leetcode-tracker-refresh-jwt-secret-key-2026-prod-grade';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.cookies?.token;

  console.log(`[Auth] Using token from: ${authHeader ? 'Header' : (req.cookies?.token ? 'Cookie' : 'None')}`);
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
        return next();
      }
    } catch (err) {
      // Token expired or invalid signature
      console.error('JWT Verification failed:', err.message, err);
      return res.status(401).json({ error: 'Token expired or invalid. Please log in again.' });
    }
  } else {
    console.error('No token provided in headers or cookies.');
  }

  return res.status(401).json({ error: 'Authentication required.' });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const normalizedRole = req.user.role.toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

    if (!normalizedAllowed.includes(normalizedRole)) {
      return res.status(403).json({ 
        error: `Access forbidden for role '${req.user.role}'. Required: ${allowedRoles.join(' or ')}.` 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};

// Trigger nodemon restart
