const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leetcode_tracker',
});

async function run() {
  try {
    const mainName = 'rajasekaran';
    const fullName = 'Dr. T. Rajasekaran';
    const email = 'rajasekaran@nandhaengg.org';
    const hash = await bcrypt.hash(mainName, 10);
    
    // Check if HOD exists
    const [hods] = await pool.query('SELECT id FROM users WHERE role = "HOD"');
    
    if (hods.length > 0) {
      await pool.query('UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?', [fullName, email, hash, hods[0].id]);
      console.log('Updated existing HOD to ' + fullName);
    } else {
      await pool.query('INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, "HOD", TRUE)', [fullName, email, hash]);
      console.log('Inserted new HOD ' + fullName);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
