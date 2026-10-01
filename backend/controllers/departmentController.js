const pool = require('../config/db');

async function listDepartments(req, res, next) {
  try {
    const role = req.user?.role?.toUpperCase();
    const userDeptId = req.user?.department_id;

    let query = `
      SELECT d.id, d.name, d.code, d.created_at,
             (SELECT COUNT(*) FROM students s WHERE s.department_id = d.id) AS studentCount,
             (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.is_active = 1 AND u.role IN ('HOD', 'PROCTOR')) AS activeStaffCount
      FROM departments d
    `;
    const params = [];

    // Scoped view for HOD / PROCTOR
    if (role === 'HOD' || role === 'PROCTOR') {
      if (userDeptId) {
        query += ' WHERE d.id = ?';
        params.push(userDeptId);
      }
    }

    query += ' ORDER BY d.name ASC';

    const [departments] = await pool.query(query, params);
    res.json(departments);
  } catch (err) {
    next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Department name and code are required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO departments (name, code, created_at) VALUES (?, ?, NOW())',
      [name.trim(), code.trim().toUpperCase()]
    );

    res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      code: code.trim().toUpperCase()
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Department name or code already exists.' });
    }
    next(err);
  }
}

async function updateDepartment(req, res, next) {
  try {
    const deptId = parseInt(req.params.id, 10);
    const { name, code } = req.body;

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (code) {
      updates.push('code = ?');
      params.push(code.trim().toUpperCase());
    }

    if (updates.length > 0) {
      params.push(deptId);
      await pool.query(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await pool.query('SELECT id, name, code, created_at FROM departments WHERE id = ?', [deptId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Department not found.' });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const deptId = parseInt(req.params.id, 10);
    
    // Check if any students or staff are assigned to this department
    const [students] = await pool.query('SELECT id FROM students WHERE department_id = ? LIMIT 1', [deptId]);
    const [staff] = await pool.query('SELECT id FROM users WHERE department_id = ? LIMIT 1', [deptId]);

    if (students.length > 0 || staff.length > 0) {
      return res.status(400).json({ error: 'Cannot delete department. It still has students or staff assigned to it.' });
    }

    await pool.query('DELETE FROM departments WHERE id = ?', [deptId]);
    res.json({ success: true, message: 'Department deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
