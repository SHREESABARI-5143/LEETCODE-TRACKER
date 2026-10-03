const pool = require('../config/db');
const problemResolverService = require('../services/problemResolverService');
const leetcodeContestService = require('../services/leetcodeContestService');

async function getQuestionLists(req, res, next) {
  try {
    let query = `
      SELECT ql.id, ql.name, ql.contest_number, ql.contest_type, ql.department_id, ql.created_at,
             COUNT(qi.id) AS total_questions,
             d.name AS department_name, d.code AS department_code
      FROM question_lists ql
      LEFT JOIN question_list_items qi ON ql.id = qi.question_list_id
      LEFT JOIN departments d ON ql.department_id = d.id
    `;
    const params = [];

    if (!req.scope.isGlobal && req.scope.userDepartmentId) {
      query += ' WHERE (ql.department_id = ? OR ql.department_id IS NULL)';
      params.push(req.scope.userDepartmentId);
    }

    query += ' GROUP BY ql.id ORDER BY ql.created_at DESC';

    const [lists] = await pool.query(query, params);
    res.json(lists);
  } catch (err) {
    next(err);
  }
}

async function createQuestionList(req, res, next) {
  try {
    const { name, contest_number, contest_type, questions = [], questions_text } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Question list name is required.' });
    }

    let questionTitles = [];
    if (Array.isArray(questions) && questions.length > 0) {
      questionTitles = questions.map(q => typeof q === 'string' ? q : q.title || q.name);
    } else if (questions_text && typeof questions_text === 'string') {
      questionTitles = questions_text.split(/[\r\n,]+/).map(t => t.trim()).filter(Boolean);
    }

    const targetDeptId = req.scope.isGlobal
      ? (req.body.department_id ? parseInt(req.body.department_id, 10) : null)
      : req.scope.userDepartmentId;

    const [insertList] = await pool.query(
      'INSERT INTO question_lists (name, contest_number, contest_type, department_id, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name.trim(), contest_number ? parseInt(contest_number, 10) : null, contest_type || null, targetDeptId]
    );

    const listId = insertList.insertId;

    // Resolve questions
    const resolvedQuestions = await problemResolverService.resolveBatchProblemNames(questionTitles);

    for (const q of resolvedQuestions) {
      await pool.query(
        `INSERT INTO question_list_items 
          (question_list_id, input_title, resolved_slug, resolved_title, difficulty, resolution_status, resolution_candidates, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [listId, q.input_title, q.resolved_slug, q.resolved_title, q.difficulty, q.resolution_status, JSON.stringify(q.resolution_candidates || [])]
      );
    }

    res.status(201).json({
      id: listId,
      name: name.trim(),
      totalQuestions: resolvedQuestions.length,
      questions: resolvedQuestions
    });
  } catch (err) {
    next(err);
  }
}

async function getQuestionListDetails(req, res, next) {
  try {
    const listId = parseInt(req.params.id, 10);

    const [lists] = await pool.query('SELECT * FROM question_lists WHERE id = ?', [listId]);
    if (lists.length === 0) return res.status(404).json({ error: 'Question list not found.' });
    const list = lists[0];

    const [items] = await pool.query(
      'SELECT id, input_title, resolved_slug, resolved_title, difficulty, resolution_status, resolution_candidates FROM question_list_items WHERE question_list_id = ?',
      [listId]
    );

    res.json({
      ...list,
      items: items.map(it => ({
        ...it,
        resolution_candidates: typeof it.resolution_candidates === 'string'
          ? JSON.parse(it.resolution_candidates)
          : it.resolution_candidates
      }))
    });
  } catch (err) {
    next(err);
  }
}

/**
 * High-speed question list evaluation using the async concurrency pool (concurrency 45)
 * and batched multi-row DB upserts — replacing the old sequential for-loop.
 */
async function evaluateQuestionList(req, res, next) {
  try {
    const listId = parseInt(req.params.id, 10);
    const { whereSql, params } = req.scope.buildStudentWhere('s');

    const [items] = await pool.query(
      'SELECT id, resolved_slug, resolved_title FROM question_list_items WHERE question_list_id = ? AND resolved_slug IS NOT NULL',
      [listId]
    );

    if (items.length === 0) {
      return res.status(400).json({ error: 'No resolved questions in this list to evaluate.' });
    }

    const [students] = await pool.query(
      `SELECT s.id, s.leetcode_username FROM students s ${whereSql} AND s.leetcode_username NOT LIKE 'NIL_%'`,
      params
    );

    if (students.length === 0) {
      return res.json({ success: true, evaluatedStudents: 0, totalQuestions: items.length });
    }

    const syncEngine = require('../services/syncEngine');
    const result = await syncEngine.evaluateQuestionListFast(students, items);

    res.json({
      success: true,
      evaluatedStudents: result.evaluatedStudents,
      totalQuestions: result.totalQuestions,
      elapsedTimeMs: result.elapsedTimeMs
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQuestionLists,
  createQuestionList,
  getQuestionListDetails,
  evaluateQuestionList
};
