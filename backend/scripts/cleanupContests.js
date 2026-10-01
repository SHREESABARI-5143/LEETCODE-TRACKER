const pool = require('../config/db');

async function cleanupAndSyncRealContests() {
  console.log('1. Removing testing contests (ids 12..17)...');
  await pool.query('DELETE sqs FROM student_question_status sqs JOIN question_list_items qi ON sqs.question_list_item_id = qi.id WHERE qi.question_list_id IN (12, 13, 14, 15, 16, 17)');
  await pool.query('DELETE FROM question_list_items WHERE question_list_id IN (12, 13, 14, 15, 16, 17)');
  await pool.query('DELETE FROM question_lists WHERE id IN (12, 13, 14, 15, 16, 17)');
  
  console.log('2. Standardizing real contest metadata...');
  await pool.query("UPDATE question_lists SET name = 'Weekly Contest 519', contest_number = 519, contest_type = 'weekly', department_id = 1 WHERE id = 11");
  await pool.query("UPDATE question_lists SET name = 'Weekly Contest 518', contest_number = 518, contest_type = 'weekly', department_id = 1 WHERE id = 10");
  await pool.query("UPDATE question_lists SET name = 'Weekly Contest 517', contest_number = 517, contest_type = 'weekly', department_id = 1 WHERE id = 9");
  await pool.query("UPDATE question_lists SET name = 'Biweekly Contest 190', contest_number = 190, contest_type = 'biweekly', department_id = 1 WHERE id = 7");
  await pool.query("UPDATE question_lists SET name = 'Weekly Contest 516', contest_number = 516, contest_type = 'weekly', department_id = 1 WHERE id = 2");

  const [remaining] = await pool.query('SELECT id, name, contest_number, contest_type, created_at FROM question_lists ORDER BY id DESC');
  console.log('Cleaned Real Contests in DB:', remaining);
  process.exit(0);
}

cleanupAndSyncRealContests().catch(err => {
  console.error(err);
  process.exit(1);
});
