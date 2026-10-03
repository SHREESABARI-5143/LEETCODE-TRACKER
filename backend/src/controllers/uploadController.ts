const fs = require('fs');
const pool = require('../config/db');
const excelService = require('../services/excelService');

const { normalizeProctorName, fuzzyMatchProctor } = require('../utils/nameNormalizer');

async function uploadStudents(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No Excel file uploaded.' });
  }

  const filePath = req.file.path;
  const defaultYear = parseInt(req.body.year || req.body.year_of_study, 10) || 1;
  const defaultPlacementStatus = req.body.placement_status || 'Placement';

  try {
    const parseResult = excelService.parseExcelFile(filePath, defaultYear, defaultPlacementStatus);

    const mapped = [];
    const unmatched = [];
    let dbProctors = [];
    
    if (parseResult.valid.length > 0) {
      const conn = await pool.getConnection();
      try {
        // Fetch proctors and their aliases
        const [proctors] = await conn.query(`SELECT id, full_name, normalized_name, department FROM proctors WHERE is_active = 1`);
        dbProctors = proctors;
        const [dbAliases] = await conn.query(`SELECT proctor_id, alias_normalized FROM proctor_aliases`);
        
        // Build map
        const proctorsList = dbProctors.map(p => {
          const aliases = dbAliases.filter(a => a.proctor_id === p.id).map(a => a.alias_normalized);
          return { ...p, aliases: [p.normalized_name, ...aliases] };
        });

        for (const student of parseResult.valid) {
          if (student.raw_proctor_name) {
             const norm = normalizeProctorName(student.raw_proctor_name);
             const matched = proctorsList.find(p => fuzzyMatchProctor(norm, p.aliases));
             if (matched) {
               mapped.push({ ...student, proctor_id: matched.id, proctor_name: matched.full_name });
             } else {
               unmatched.push({ ...student, proctor_id: null, proctor_name: student.raw_proctor_name });
             }
          } else {
             mapped.push({ ...student, proctor_id: null, proctor_name: null }); // no proctor provided
          }
        }
      } finally {
        conn.release();
      }
    }

    // Don't delete the file, rename it so we can read it again? Wait, preview doesn't need to save the file. We just send the parsed data to frontend and they post it back!
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}

    res.json({
      success: true,
      preview: true,
      totalRecords: parseResult.totalRecords,
      mapped,
      unmatched,
      proctors: dbProctors,
      invalidRecords: parseResult.invalid,
      duplicateRecords: parseResult.duplicates,
      errorReport: parseResult.errorReport
    });
  } catch (err) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {}
    next(err);
  }
}

async function commitUpload(req, res, next) {
  const { fileName, defaultYear, targetDeptId, mapped, unmatched, errors } = req.body;
  // mapped contains students with resolved proctor_id
  // unmatched contains students with manually resolved proctor_id from UI

  let successfulCount = 0;
  let failedCount = (errors || []).length;
  
  const allStudents = [...(mapped || []), ...(unmatched || [])];
  
  if (allStudents.length === 0) {
    return res.status(400).json({ error: 'No valid students to commit.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const uploadedBy = req.user?.id || null;

    for (const student of allStudents) {
      try {
        const [insertResult] = await conn.query(
          `INSERT INTO students 
            (roll_number, name, year_of_study, placement_status, leetcode_username, profile_link, department_id, sync_status, proctor_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            year_of_study = VALUES(year_of_study),
            placement_status = VALUES(placement_status),
            leetcode_username = VALUES(leetcode_username),
            profile_link = VALUES(profile_link),
            proctor_id = COALESCE(VALUES(proctor_id), proctor_id),
            department_id = COALESCE(VALUES(department_id), department_id)`,
          [student.roll_number, student.name, student.year_of_study, student.placement_status, student.leetcode_username, student.profile_link, targetDeptId, student.sync_status, student.proctor_id || null]
        );

        const studentId = insertResult.insertId || (await conn.query('SELECT id FROM students WHERE roll_number = ?', [student.roll_number]))[0][0]?.id;

        if (studentId) {
          await conn.query(
            `INSERT IGNORE INTO leetcode_stats (student_id, total_solved, easy_solved, medium_solved, hard_solved, updated_at)
             VALUES (?, 0, 0, 0, 0, NOW())`,
            [studentId]
          );
        }

        // If this came from unmatched and they assigned a proctor, save the alias
        if (student.raw_proctor_name && student.proctor_id) {
            const norm = normalizeProctorName(student.raw_proctor_name);
            await conn.query(`INSERT IGNORE INTO proctor_aliases (proctor_id, alias_normalized) VALUES (?, ?)`, [student.proctor_id, norm]);
        }

        successfulCount++;
      } catch (stErr) {
        failedCount++;
      }
    }
    
    // Record upload history / logs
    await conn.query(
      `INSERT INTO import_logs (uploaded_by, file_name, total, mapped, unmatched, errors, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [uploadedBy, fileName || 'Manual Commit', allStudents.length, mapped?.length || 0, unmatched?.length || 0, failedCount]
    );

    await conn.commit();
    res.json({ success: true, successfulCount, failedCount });
  } catch (txErr) {
    await conn.rollback();
    next(txErr);
  } finally {
    conn.release();
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
  commitUpload,
  getUploadHistory,
  downloadTemplate
};
