const pool = require('../config/db');
const authService = require('../services/authService');
const bcrypt = require('bcrypt');

async function listUsers(req, res, next) {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active, u.last_login_at, u.created_at,
              d.name AS department_name, d.code AS department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.created_at DESC`
    );
    res.json(users);
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const newUser = await authService.createUser(req.body, req.user.role);
    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateUser(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    const { name, email, role, department_id, is_active, password } = req.body;

    const [existing] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (email) {
      updates.push('email = ?');
      params.push(email.trim().toLowerCase());
    }
    if (role) {
      updates.push('role = ?');
      params.push(role.toUpperCase());
    }
    if (department_id !== undefined) {
      updates.push('department_id = ?');
      params.push(department_id ? parseInt(department_id) : null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(Boolean(is_active));
    }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length > 0) {
      params.push(userId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updated] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active,
              d.name AS department_name, d.code AS department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [userId]
    );

    res.json({ success: true, user: updated[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own admin account.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser
};
