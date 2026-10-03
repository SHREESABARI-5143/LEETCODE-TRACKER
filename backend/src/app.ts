import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error';
import { swaggerHtml } from './utils/docs';

// Import routers
import authRouter from './routes/auth';
import studentsRouter from './routes/students';
import proctorsRouter from './routes/proctors';
import analyticsRouter from './routes/analytics';
import rankingsRouter from './routes/rankings';
import reportsRouter from './routes/reports';
import exportRouter from './routes/export';
import analysisRouter from './routes/analysis';
import dashboardRouter from './routes/dashboard';
import usersRouter from './routes/users';
import departmentsRouter from './routes/departments';

const app = express();

// Security and utility middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allow CDN hosted Swagger packages
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve API docs static page
app.get('/docs', (req, res) => {
  res.send(swaggerHtml);
});

// Map routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/students', studentsRouter);
app.use('/api/v1/proctors', proctorsRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/rankings', rankingsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/export', exportRouter);
app.use('/api/v1/analysis', analysisRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/departments', departmentsRouter);

// Basic check route
app.get('/', (req, res) => {
  res.json({ status: 'CodeTrack analytics server online' });
});

// Global Error Handler
app.use(errorHandler);

export default app;
