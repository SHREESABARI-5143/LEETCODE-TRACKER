const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leetcode_tracker',
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

async function ensureColumnExists(conn, tableName, columnName, columnDef) {
  try {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`);
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`[DB Migration] Added column ${columnName} to ${tableName}`);
    }
  } catch (err) {
    console.warn(`[DB Migration Notice] Column check ${tableName}.${columnName}:`, err.message);
  }
}

async function ensureIndexExists(conn, tableName, indexName, indexDef) {
  try {
    const [indexes] = await conn.query(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`);
    if (indexes.length === 0) {
      await conn.query(`ALTER TABLE \`${tableName}\` ADD ${indexDef}`);
      console.log(`[DB Migration] Added index ${indexName} to ${tableName}`);
    }
  } catch (err) {
    // Index may already exist or have slight variation, ignore safely
  }
}

async function runMigrations() {
  console.log('[Database] Checking schema & executing idempotent migrations...');
  const conn = await pool.getConnection();

  try {
    // 1. departments
    await conn.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        code VARCHAR(20) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. users
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('ADMIN','PLACEMENT','HOD','PROCTOR') NOT NULL,
        department_id INT DEFAULT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_role (role),
        INDEX idx_user_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. students
    await conn.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        roll_number VARCHAR(30) NOT NULL,
        name VARCHAR(120) NOT NULL,
        year_of_study TINYINT NOT NULL DEFAULT 1,
        placement_status VARCHAR(50) NOT NULL DEFAULT 'Placement',
        leetcode_username VARCHAR(120) NOT NULL,
        profile_link VARCHAR(255) NOT NULL,
        department_id INT DEFAULT NULL,
        proctor_id INT DEFAULT NULL,
        sync_status ENUM('Pending', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
        last_synced_at DATETIME DEFAULT NULL,
        needs_department_assignment BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_year_of_study (year_of_study),
        INDEX idx_roll_number (roll_number),
        INDEX idx_leetcode_username (leetcode_username),
        INDEX idx_sync_status (sync_status),
        INDEX idx_student_dept (department_id),
        INDEX idx_student_proctor (proctor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await ensureColumnExists(conn, 'students', 'department_id', 'INT DEFAULT NULL');
    await ensureColumnExists(conn, 'students', 'proctor_id', 'INT DEFAULT NULL');
    await ensureColumnExists(conn, 'students', 'needs_department_assignment', 'BOOLEAN NOT NULL DEFAULT FALSE');
    await ensureColumnExists(conn, 'students', 'placement_status', "VARCHAR(50) NOT NULL DEFAULT 'Placement'");
    await ensureColumnExists(conn, 'students', 'roll_number', "VARCHAR(30) NOT NULL DEFAULT ''");
    await ensureColumnExists(conn, 'students', 'year_of_study', 'TINYINT NOT NULL DEFAULT 1');
    await ensureColumnExists(conn, 'students', 'profile_link', "VARCHAR(255) NOT NULL DEFAULT ''");
    await ensureColumnExists(conn, 'students', 'sync_status', "ENUM('Pending', 'Success', 'Failed') NOT NULL DEFAULT 'Pending'");
    await ensureColumnExists(conn, 'students', 'last_synced_at', 'DATETIME DEFAULT NULL');

    // 4. leetcode_stats
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leetcode_stats (
        student_id INT PRIMARY KEY,
        easy_solved INT NOT NULL DEFAULT 0,
        medium_solved INT NOT NULL DEFAULT 0,
        hard_solved INT NOT NULL DEFAULT 0,
        total_solved INT NOT NULL DEFAULT 0,
        ranking INT DEFAULT NULL,
        contest_rating DECIMAL(10,2) DEFAULT NULL,
        contest_global_rank INT DEFAULT NULL,
        last_fetch_status ENUM('OK', 'RateLimited', 'ProfileNotFound', 'ParseError') NOT NULL DEFAULT 'OK',
        last_fetch_error TEXT DEFAULT NULL,
        checksum_valid BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        INDEX idx_total_solved (total_solved),
        INDEX idx_ranking (ranking)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await ensureColumnExists(conn, 'leetcode_stats', 'ranking', 'INT DEFAULT NULL');
    await ensureColumnExists(conn, 'leetcode_stats', 'contest_rating', 'DECIMAL(10,2) DEFAULT NULL');
    await ensureColumnExists(conn, 'leetcode_stats', 'contest_global_rank', 'INT DEFAULT NULL');
    await ensureColumnExists(conn, 'leetcode_stats', 'daily_start_total', 'INT NOT NULL DEFAULT 0');
    await ensureColumnExists(conn, 'leetcode_stats', 'baseline_cycle', 'VARCHAR(20) DEFAULT NULL');
    await ensureColumnExists(conn, 'leetcode_stats', 'baseline_updated_at', 'DATETIME DEFAULT NULL');
    await ensureColumnExists(conn, 'leetcode_stats', 'daily_solved', 'INT NOT NULL DEFAULT 0');
    await ensureColumnExists(conn, 'leetcode_stats', 'weekly_solved', 'INT NOT NULL DEFAULT 0');
    await ensureColumnExists(conn, 'leetcode_stats', 'monthly_solved', 'INT NOT NULL DEFAULT 0');
    await ensureColumnExists(conn, 'leetcode_stats', 'last_fetch_status', "ENUM('OK', 'RateLimited', 'ProfileNotFound', 'ParseError') NOT NULL DEFAULT 'OK'");
    await ensureColumnExists(conn, 'leetcode_stats', 'checksum_valid', 'BOOLEAN NOT NULL DEFAULT TRUE');

    // Allow daily_solved to be NULL — NULL means "no valid 5:30 AM baseline captured yet".
    // This is different from 0 (which means "solved nothing new today").
    // We ALTER only if the column is currently NOT NULL, making the migration idempotent.
    try {
      const [cols] = await conn.query(`SHOW COLUMNS FROM leetcode_stats LIKE 'daily_solved'`);
      if (cols.length > 0 && cols[0].Null === 'NO') {
        await conn.query(`ALTER TABLE leetcode_stats MODIFY COLUMN daily_solved INT NULL DEFAULT NULL`);
        console.log('[DB Migration] Made daily_solved nullable to support "no baseline" sentinel.');
      }
    } catch (e) {
      console.warn('[DB Migration] Could not modify daily_solved nullability:', e.message);
    }

    // 5. ranking_snapshots
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ranking_snapshots (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        snapshot_date DATE NOT NULL,
        ranking INT DEFAULT NULL,
        total_solved INT NOT NULL DEFAULT 0,
        easy_solved INT NOT NULL DEFAULT 0,
        medium_solved INT NOT NULL DEFAULT 0,
        hard_solved INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        UNIQUE KEY uq_student_date (student_id, snapshot_date),
        INDEX idx_snapshot_date (snapshot_date),
        INDEX idx_snapshot_student (student_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. question_lists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS question_lists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        contest_number INT DEFAULT NULL,
        contest_type VARCHAR(20) DEFAULT NULL,
        department_id INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_qlist_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await ensureColumnExists(conn, 'question_lists', 'department_id', 'INT DEFAULT NULL');

    // 7. question_list_items
    await conn.query(`
      CREATE TABLE IF NOT EXISTS question_list_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        question_list_id INT NOT NULL,
        input_title VARCHAR(255) NOT NULL,
        resolved_slug VARCHAR(255) DEFAULT NULL,
        resolved_title VARCHAR(255) DEFAULT NULL,
        difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT NULL,
        resolution_status ENUM('Resolved', 'Ambiguous', 'Unresolved') NOT NULL DEFAULT 'Unresolved',
        resolution_candidates JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_list_id) REFERENCES question_lists(id) ON DELETE CASCADE,
        INDEX idx_qitem_list (question_list_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. student_question_status
    await conn.query(`
      CREATE TABLE IF NOT EXISTS student_question_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        question_list_item_id INT NOT NULL,
        solved BOOLEAN NOT NULL DEFAULT FALSE,
        solved_at DATETIME DEFAULT NULL,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        verified_via ENUM('recent_ac_submissions', 'graphql_progress_check') DEFAULT 'graphql_progress_check',
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (question_list_item_id) REFERENCES question_list_items(id) ON DELETE CASCADE,
        UNIQUE KEY uq_student_question (student_id, question_list_item_id),
        INDEX idx_sqs_student (student_id),
        INDEX idx_sqs_item (question_list_item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. upload_history
    await conn.query(`
      CREATE TABLE IF NOT EXISTS upload_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        department_id INT DEFAULT NULL,
        year_of_study TINYINT DEFAULT NULL,
        total_records INT NOT NULL DEFAULT 0,
        successful_records INT NOT NULL DEFAULT 0,
        failed_records INT NOT NULL DEFAULT 0,
        error_report JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_upload_dept (department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await ensureColumnExists(conn, 'upload_history', 'department_id', 'INT DEFAULT NULL');

    // Migration hook: if legacy student rows exist without department_id, flag them needs_department_assignment
    await conn.query(`
      UPDATE students 
      SET needs_department_assignment = TRUE 
      WHERE department_id IS NULL AND needs_department_assignment = FALSE;
    `);

    console.log('[Database] Migrations verified successfully.');
  } finally {
    conn.release();
  }
}

pool.runMigrations = runMigrations;

module.exports = pool;
