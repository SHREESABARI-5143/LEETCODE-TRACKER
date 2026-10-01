const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET, JWT_REFRESH_SECRET } = require('../middleware/authMiddleware');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '30d';

async function login(email, password) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const [users] = await pool.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department_id, u.is_active, 
            d.name AS department_name, d.code AS department_code
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.email = ? LIMIT 1`,
    [email.trim().toLowerCase()]
  );

  if (users.length === 0) {
    throw new Error('Invalid email or password.');
  }

  const user = users[0];

  if (!user.is_active) {
    throw new Error('This account has been deactivated. Please contact an administrator.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password.');
  }

  // Update last_login_at
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    departmentId: user.department_id
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
      departmentName: user.department_name,
      departmentCode: user.department_code
    },
    accessToken,
    refreshToken
  };
}

async function refreshToken(token) {
  if (!token) {
    throw new Error('Refresh token is required.');
  }

  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  const [users] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active,
            d.name AS department_name, d.code AS department_code
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE u.id = ? LIMIT 1`,
    [decoded.userId]
  );

  if (users.length === 0 || !users[0].is_active) {
    throw new Error('User inactive or invalid token.');
  }

  const user = users[0];
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    departmentId: user.department_id
  };

  const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const newRefreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
      departmentName: user.department_name,
      departmentCode: user.department_code
    }
  };
}

async function createUser(payload, creatorRole) {
  if (creatorRole !== 'ADMIN') {
    throw new Error('Only administrators can create user accounts.');
  }

  const { name, email, password, role, department_id } = payload;

  if (!name || !email || !password || !role) {
    throw new Error('Name, email, password, and role are required.');
  }

  const validRoles = ['ADMIN', 'PLACEMENT', 'HOD', 'PROCTOR'];
  const normalizedRole = role.toUpperCase();
  if (!validRoles.includes(normalizedRole)) {
    throw new Error(`Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`);
  }

  // Validate department requirements
  let finalDeptId = null;
  if (['HOD', 'PROCTOR'].includes(normalizedRole)) {
    if (!department_id) {
      throw new Error(`A department is required for ${normalizedRole} accounts.`);
    }
    const [depts] = await pool.query('SELECT id FROM departments WHERE id = ?', [department_id]);
    if (depts.length === 0) {
      throw new Error('Specified department does not exist.');
    }
    finalDeptId = parseInt(department_id);
  }

  // Check email uniqueness
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing.length > 0) {
    throw new Error(`A user with email '${email}' already exists.`);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department_id, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, TRUE, NOW())`,
    [name.trim(), email.trim().toLowerCase(), passwordHash, normalizedRole, finalDeptId]
  );

  return {
    id: result.insertId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: normalizedRole,
    departmentId: finalDeptId
  };
}

module.exports = {
  login,
  refreshToken,
  createUser
};
