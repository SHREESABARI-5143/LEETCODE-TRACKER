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
    const [admins] = await pool.query("SELECT name, email FROM users WHERE role = 'ADMIN'");
    console.table(admins);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
