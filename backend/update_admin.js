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
    const hash = await bcrypt.hash('admin', 10);
    const email = 'admin@nandhaengg.org';
    await pool.query("UPDATE users SET email = ?, password_hash = ? WHERE role = 'ADMIN'", [email, hash]);
    console.log('Admin updated');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
