import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../config/prisma';
import { LeetCodeService } from '../services/leetcode/leetcode.service';
import { logger } from '../config/logger';

export const ANALYSIS_QUEUE_NAME = 'analysis-queue';

let useRedis = true;
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Setup Redis connection with quick timeout to fallback to in-memory if not running
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  connectTimeout: 2000, // 2 seconds timeout to detect offline Redis
});

redisConnection.on('error', (err) => {
  if (useRedis) {
    useRedis = false;
    logger.warn({ err: err.message }, 'Redis is offline or failed to connect. Falling back to in-memory analysis job processing.');
  }
});

redisConnection.on('connect', () => {
  useRedis = true;
  logger.info('Connected to Redis for background jobs');
});

// Setup BullMQ elements conditionally
export let analysisQueue: Queue | null = null;
export let analysisWorker: Worker | null = null;

if (useRedis) {
  try {
    analysisQueue = new Queue(ANALYSIS_QUEUE_NAME, { connection: redisConnection });
    analysisWorker = new Worker(
      ANALYSIS_QUEUE_NAME,
      async (job: Job) => {
        const { studentIds, jobId } = job.data;
        await executeAnalysisTasks(studentIds, jobId);
      },
      { connection: redisConnection }
    );

    analysisWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Background worker job completed successfully');
    });

    analysisWorker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Background worker job failed');
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize BullMQ. Using in-memory fallback.');
    useRedis = false;
  }
}

// Reusable profile sync logic
export async function syncStudentProfile(studentId: string): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
  });
  if (!student) return;

  try {
    await LeetCodeService.syncStudent(prisma, student.id, student.leetcodeUsername);
    await prisma.student.update({
      where: { id: studentId },
      data: { status: 'active' },
    });
  } catch (err) {
    await prisma.student.update({
      where: { id: studentId },
      data: { status: 'attention' },
    });
    throw err;
  }
}

// Common executor with dynamic continuous worker pool for maximum speed
async function executeAnalysisTasks(studentIds: string[], jobId: string): Promise<void> {
  logger.info({ jobId, studentCount: studentIds.length }, 'Analysis task execution started');

  let completed = 0;
  let failed = 0;
  let nextIdx = 0;
  let doneCount = 0;
  const total = studentIds.length;

  if (total === 0) return;

  const CONCURRENCY = Math.min(35, total);

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (nextIdx < total) {
      const idx = nextIdx++;
      const studentId = studentIds[idx];
      try {
        await syncStudentProfile(studentId);
        completed++;
      } catch (err) {
        logger.error({ studentId, err }, 'Failed to sync student profile during analysis');
        failed++;
      } finally {
        doneCount++;
        const progress = Math.round((doneCount / total) * 100);
        await prisma.analysisJob.update({
          where: { id: jobId },
          data: {
            progress,
            completedCount: completed,
            failedCount: failed,
            status: doneCount >= total ? 'completed' : 'processing',
          },
        }).catch(() => null);
      }
    }
  });

  await Promise.all(workers);
}

// Exportable dispatcher
export async function triggerAnalysis(studentIds: string[], jobId: string): Promise<void> {
  // Check if redis connection is fully alive and useRedis is still true
  if (useRedis && analysisQueue) {
    try {
      await analysisQueue.add('bulk-analysis', { studentIds, jobId });
      logger.info({ jobId }, 'Analysis job successfully queued in Redis BullMQ');
      return;
    } catch (err) {
      logger.warn({ err }, 'Failed to queue job in Redis BullMQ. Falling back to in-memory execution.');
    }
  }

  // Fallback to in-process execution (run asynchronously to avoid blocking the HTTP response thread)
  setImmediate(() => {
    executeAnalysisTasks(studentIds, jobId)
      .then(() => logger.info({ jobId }, 'In-memory analysis job completed successfully'))
      .catch(err => logger.error({ jobId, err }, 'In-memory analysis job failed'));
  });
}
