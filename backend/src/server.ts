import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './config/logger';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  logger.info(`CodeTrack analytics backend running on Port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/docs`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down server gracefully.');
  server.close(() => {
    logger.info('Process terminated.');
  });
});
