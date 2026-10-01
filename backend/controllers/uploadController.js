const fs = require('fs');
const pool = require('../config/db');
const excelService = require('../services/excelService');

async function uploadStudents(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No Excel file uploaded.' });
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;
  const defaultYear = parseInt(req.body.year || req.body.year_of_study, 10) || 1;
  const defaultPlacementStatus = req.body.placement_status || 'Placement';

  // Determine target department
  let targetDeptId = null;
  if (req.scope.isGlobal) {
    targetDeptId = req.body.department_id ? parseInt(req.body.department_id, 10) : 1;
  } else {
    targetDeptId = req.scope.userDepartmentId || 1;
  }

  try {
    const parseResult = excelService.parseExcelFile(filePath, defaultYear, defaultPlacementStatus);

    let successfulCount = 0;
    let failedCount = parseResult.invalid.length + parseResult.duplicates.length;
    const errors = [...parseResult.errorReport];

    if (parseResult.valid.length > 0) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        for (const student of parseResult.valid) {
          try {
            const [insertResult] = await conn.query(
              `INSERT INTO students 
                (roll_number, name, year_of_study, placement_status, leetcode_username, profile_link, department_id, sync_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
               ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                year_of_study = VALUES(year_of_study),
                placement_status = VALUES(placement_status),
                leetcode_username = VALUES(leetcode_username),
                profile_link = VALUES(profile_link),
                department_id = COALESCE(VALUES(department_id), department_id)`,
              [student.roll_number, student.name, student.year_of_study, student.placement_status, student.leetcode_username, student.profile_link, targetDeptId, student.sync_status]
            );

            const studentId = insertResult.insertId || (await conn.query('SELECT id FROM students WHERE roll_number = ?', [student.roll_number]))[0][0]?.id;

            if (studentId) {
              await conn.query(
                `INSERT IGNORE INTO leetcode_stats (student_id, total_solved, easy_solved, medium_solved, hard_solved, updated_at)
                 VALUES (?, 0, 0, 0, 0, NOW())`,
                [studentId]
              );
            }

            successfulCount++;
          } catch (stErr) {
            failedCount++;
            errors.push({ rollNumber: student.roll_number, message: stErr.message });
          }
        }

        await conn.commit();
      } catch (txErr) {
        await conn.rollback();
        throw txErr;
      } finally {
        conn.release();
      }
    }

    // Record upload history
    await pool.query(
      `INSERT INTO upload_history 
        (file_name, department_id, year_of_study, total_records, successful_records, failed_records, error_report, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [fileName, targetDeptId, defaultYear, parseResult.totalRecords, successfulCount, failedCount, JSON.stringify(errors)]
    );

    // Clean up temporary uploaded file
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}

    res.json({
      success: true,
      totalRecords: parseResult.totalRecords,
      successfulRecords: successfulCount,
      failedRecords: failedCount,
      invalidRecords: parseResult.invalid,
      duplicateRecords: parseResult.duplicates,
      errorReport: errors
    });
  } catch (err) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}
    next(err);
  }
}

async function getUploadHistory(req, res, next) {
  try {
    let query = `
      SELECT uh.id, uh.file_name, uh.year_of_study, uh.total_records, uh.successful_records,
             uh.failed_records, uh.error_report, uh.created_at,
             d.name AS department_name, d.code AS department_code
      FROM upload_history uh
      LEFT JOIN departments d ON uh.department_id = d.id
    `;
    const params = [];

    if (!req.scope.isGlobal && req.scope.userDepartmentId) {
      query += ' WHERE uh.department_id = ?';
      params.push(req.scope.userDepartmentId);
    }

    query += ' ORDER BY uh.created_at DESC LIMIT 50';

    const [history] = await pool.query(query, params);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

async function downloadTemplate(req, res, next) {
  try {
    const buffer = excelService.generateSampleTemplateExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Student_Roster_Template.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadStudents,
  getUploadHistory,
  downloadTemplate
};
