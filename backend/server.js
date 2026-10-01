const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const pool = require('./config/db');
const { initCronScheduler } = require('./jobs/cronSync');

const app = express();
const PORT = process.env.PORT || 4000;

// Security and CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow any localhost origin during development or matching configured origin
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === process.env.CORS_ORIGIN) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition']
};
app.use(cors(corsOptions));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing mounts
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/students', require('./routes/students'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/v1/analytics', require('./routes/analytics'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/questions', require('./routes/questionLists'));
app.use('/api/question-lists', require('./routes/questionLists'));
app.use('/api/config', require('./routes/config'));

// Admin debug routes (admin-only)
const { authenticateToken, requireRole } = require('./middleware/authMiddleware');
const { getBaselineDebug } = require('./controllers/adminDebugController');
app.get('/api/admin/baseline-debug', authenticateToken, requireRole('ADMIN', 'admin'), getBaselineDebug);


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date(),
    institution: process.env.INSTITUTION_NAME || 'Institution'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

async function startServer() {
  try {
    console.log('[Server] Connecting to MySQL database...');
    const conn = await pool.getConnection();
    console.log('[Server] Database pool connected successfully.');
    conn.release();

    // Run auto-migrations
    await pool.runMigrations();

    // Immediately fix any students with invalid baselines (daily_start_total=0 but total_solved>50)
    // so the TODAY column never shows a student's full career total as their daily count.
    const { backfillMissingBaselines } = require('./services/baselineService');
    await backfillMissingBaselines();

    // Start background sync scheduler
    initCronScheduler();

    app.listen(PORT, () => {
      console.log(`[Server] LeetCode Student Tracker Backend running on port ${PORT}`);
      console.log(`[Server] Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[Server Startup Failure]:', err.message);
    process.exit(1);
  }
}

startServer();
