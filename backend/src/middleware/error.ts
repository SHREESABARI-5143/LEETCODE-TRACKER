import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';
import { logger } from '../config/logger';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn({ err }, 'Operational AppError caught');
    return errorResponse(res, err.code, err.message, err.statusCode);
  }

  logger.error({ err, url: req.originalUrl, method: req.method }, 'Unhandled Exception caught');
  return errorResponse(
    res,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
    500
  );
}
