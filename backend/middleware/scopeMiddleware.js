const pool = require('../config/db');

function scopeMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required for scoping.' });
  }

  const role = req.user.role.toUpperCase();
  const userId = req.user.id;
  const userDeptId = req.user.department_id;
  const isMine = req.query.mine === 'true' || req.query.filter === 'mine';

  const isGlobal = role === 'ADMIN' || role === 'PLACEMENT';
  const isHOD = role === 'HOD';
  const isProctor = role === 'PROCTOR';

  const scope = {
    userId,
    role,
    isGlobal,
    isHOD,
    isProctor,
    departmentId: isGlobal ? (req.query.department_id ? parseInt(req.query.department_id) : null) : userDeptId,
    userDepartmentId: userDeptId,
    proctorId: isProctor && isMine ? userId : null,
    assignedProctorId: isProctor ? userId : null,

    /**
     * Builds SQL WHERE condition for student queries based on RBAC scope.
     * @param {string} prefix - e.g. 's' for students table alias, or ''
     * @param {Array} additionalConditions - array of extra SQL conditions
     * @param {Array} params - query parameters array
     * @returns {{ whereSql: string, params: Array }}
     */
    buildStudentWhere: (prefix = 's', additionalConditions = [], params = []) => {
      const colDept = prefix ? `${prefix}.department_id` : 'department_id';
      const colProctor = prefix ? `${prefix}.proctor_id` : 'proctor_id';
      const conditions = [...additionalConditions];
      const queryParams = [...params];

      if (!isGlobal) {
        if (userDeptId) {
          conditions.push(`${colDept} = ?`);
          queryParams.push(userDeptId);
        }
        if (isProctor && (isMine || req.query.proctor_only === 'true')) {
          conditions.push(`${colProctor} = ?`);
          queryParams.push(userId);
        }
      } else if (req.query.department_id) {
        conditions.push(`${colDept} = ?`);
        queryParams.push(parseInt(req.query.department_id));
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      return { whereSql, params: queryParams };
    },

    /**
     * Verifies if the current user has permission to read or write the given student.
     * @param {number|string} studentId 
     * @param {boolean} writeMode - If true, PROCTOR can only edit their own proctees
     */
    verifyStudentAccess: async (studentId, writeMode = false) => {
      const [rows] = await pool.query(
        'SELECT id, department_id, proctor_id FROM students WHERE id = ? LIMIT 1',
        [studentId]
      );
      if (rows.length === 0) return { allowed: false, reason: 'Student not found', status: 404 };

      const student = rows[0];

      if (isGlobal) {
        return { allowed: true, student };
      }

      if (student.department_id !== userDeptId) {
        return { allowed: false, reason: 'Access forbidden: student belongs to another department.', status: 403 };
      }

      if (isProctor && writeMode) {
        if (student.proctor_id !== userId) {
          return { allowed: false, reason: 'Access forbidden: proctors can only modify their assigned proctees.', status: 403 };
        }
      }

      return { allowed: true, student };
    },

    /**
     * Verifies if the current user can create/modify question lists or resources in a department.
     */
    verifyDepartmentAccess: (targetDeptId) => {
      if (isGlobal) return true;
      return userDeptId && parseInt(userDeptId) === parseInt(targetDeptId);
    }
  };

  req.scope = scope;
  next();
}

module.exports = scopeMiddleware;
