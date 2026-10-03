const mysql = require('mysql2/promise');
require('dotenv').config();
const bcrypt = require('bcrypt');
const { normalizeProctorName } = require('../utils/nameNormalizer');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leetcode_tracker',
});

const PROCTORS = [
  { name: 'Mr. K.U. Ranjith', designation: 'AP', department: 'CSE' },
  { name: 'Ms. E. Padma', designation: 'AP', department: 'CSE' },
  { name: 'Ms. P. Devika', designation: 'AP', department: 'CSE' },
  { name: 'Dr. R. Praveenkumar', designation: 'AsP', department: 'ECE' },
  { name: 'Mr. R. Manikandan', designation: 'AP', department: 'CSE' },
  { name: 'Mrs. P. Uma', designation: 'AP', department: 'CSE' },
  { name: 'Ms. P. Savitha', designation: 'AP', department: 'CSE' },
  { name: 'Ms. K. Shanmugapriya', designation: 'AP', department: 'CSE' }
];

async function seedProctors() {
  console.log('Seeding proctors...');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const defaultPassword = await bcrypt.hash('Proctor@123', 10);

    for (const p of PROCTORS) {
      const normalized = normalizeProctorName(p.name);
      
      let mainName = p.name.toLowerCase();
      mainName = mainName.replace(/\b(mr|mrs|ms|dr|prof)\.?\s*/g, ''); 
      mainName = mainName.replace(/\b[a-z]\.\s*/g, ''); 
      mainName = mainName.replace(/\b[a-z]\b/g, ''); 
      mainName = mainName.replace(/[^a-z]/g, '');
      
      const email = `${mainName}@nandhaengg.org`;
      const pass = await bcrypt.hash(mainName, 10);
      let userId;
      
      const [existingUsers] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      } else {
        const [insertUser] = await conn.query(
          `INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'PROCTOR', TRUE)`,
          [p.name, email, pass]
        );
        userId = insertUser.insertId;
      }

      // 2. Upsert into proctors table
      const [existingProctors] = await conn.query('SELECT id FROM proctors WHERE normalized_name = ? AND department = ?', [normalized, p.department]);
      
      let proctorId;
      if (existingProctors.length > 0) {
        proctorId = existingProctors[0].id;
        await conn.query(
          `UPDATE proctors SET full_name = ?, designation = ?, user_id = ? WHERE id = ?`,
          [p.name, p.designation, userId, proctorId]
        );
      } else {
        const [insertProctor] = await conn.query(
          `INSERT INTO proctors (user_id, full_name, normalized_name, designation, department, is_active)
           VALUES (?, ?, ?, ?, ?, TRUE)`,
          [userId, p.name, normalized, p.designation, p.department]
        );
        proctorId = insertProctor.insertId;
      }

      // 3. Add default alias
      await conn.query(
        `INSERT IGNORE INTO proctor_aliases (proctor_id, alias_normalized) VALUES (?, ?)`,
        [proctorId, normalized]
      );
      
      console.log(`Seeded proctor: ${p.name} (${normalized})`);
    }

    await conn.commit();
    console.log('Seeding completed successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('Failed to seed proctors:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seedProctors();
