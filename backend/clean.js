const mysql = require('mysql2/promise');
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
    // Delete Dr. Anitha Kumar completely
    await pool.query("DELETE FROM users WHERE name = 'Dr. Anitha Kumar'");
    console.log('Deleted Dr. Anitha Kumar from users.');

    // Remove any proctor_id on students that are not valid in the new proctors table
    // or point to old users table IDs that don't match.
    // The safest way is to just wipe proctor_id for students where it doesn't match an active proctor
    await pool.query(`UPDATE students s 
                      LEFT JOIN proctors p ON s.proctor_id = p.id 
                      SET s.proctor_id = NULL 
                      WHERE p.id IS NULL`);
    console.log('Cleaned up invalid proctor assignments on students.');

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
