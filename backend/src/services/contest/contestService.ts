import axios from 'axios';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { cacheGet, cacheSet } from '../cache/cacheService';
import { generateCandidateSlug, normalizeProblemTitle } from '../../utils/slugUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UpcomingContestInfo {
  contestName: string;
  contestNumber: number | null;
  contestSlug: string;
  contestType: 'weekly' | 'biweekly';
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  status: 'upcoming' | 'active' | 'completed';
}

export interface QuestionVerificationResult {
  originalInput: string;
  normalizedTitle: string;
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  verified: boolean;
  questionFrontendId?: string;
  source: 'leetcode' | 'database' | 'manual';
}

export interface ContestProblemSummary {
  orderNum: number;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  verified: boolean;
  solvedCount: number;
}

export interface StudentContestItem {
  id: string;
  studentId: string;
  name: string;
  registerNumber: string;
  leetcodeUsername: string;
  year: number;
  section: string;
  proctorName: string;
  status: 'Attended' | 'Not Attended';
  rank: number | null;
  solvedCount: number;
  totalProblems: number;
  solvePercentage: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  solvedSlugs: string[];
  exactProblems: Array<{
    orderNum: number;
    title: string;
    slug: string;
    difficulty: string;
    solved: boolean;
  }>;
}

export interface ContestAnalyticsSummary {
  totalStudents: number;
  attendedCount: number;
  notAttendedCount: number;
  attendancePercentage: number;
  totalProblems: number;
  totalSolved: number;
  avgSolved: number;
  avgEasySolved: number;
  avgMediumSolved: number;
  avgHardSolved: number;
  easyProblemsCount: number;
  mediumProblemsCount: number;
  hardProblemsCount: number;
}

export interface FullContestAnalytics {
  contest: {
    id?: string;
    contestName: string;
    contestNumber: number | null;
    contestSlug: string;
    contestType: string;
    startTime: string;
    endTime: string | null;
    status: 'upcoming' | 'active' | 'completed';
    isManaged: boolean;
  };
  summary: ContestAnalyticsSummary;
  problems: ContestProblemSummary[];
  students: StudentContestItem[];
}

export interface StudentContestHistoryEntry {
  contestName: string;
  contestSlug: string;
  contestType: string;
  contestDate: string;
  status: 'Attended' | 'Not Attended';
  rank: number | null;
  problemsSolved: number;
  totalProblems: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  rating: number;
  ratingChange: number;
  previousRank: number | null;
  rankImprovementPct: number | null; // ((prev - curr) / prev) * 100
  solvedDelta: number | null;
}

export interface StudentContestPerformanceReport {
  student: {
    id: string;
    name: string;
    registerNumber: string;
    leetcodeUsername: string;
    year: number;
    section: string;
    proctorName: string;
    collegeEmail: string;
  };
  currentContest: {
    contestName: string;
    contestSlug: string;
    contestType: string;
    contestDate: string;
    status: 'Attended' | 'Not Attended';
    rank: number | null;
    problemsSolved: number;
    totalProblems: number;
    solvePercentage: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    rankImprovementPct: number | null;
    solvedDelta: number | null;
    exactProblems: Array<{
      orderNum: number;
      title: string;
      slug: string;
      difficulty: string;
      solved: boolean;
    }>;
  } | null;
  history: StudentContestHistoryEntry[];
}

// ─── LeetCode GraphQL Client ────────────────────────────────────────────────

const LEETCODE_GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql';

async function queryLeetCodeGraphQL(query: string, variables: any = {}): Promise<any> {
  const res = await axios.post(
    LEETCODE_GRAPHQL_ENDPOINT,
    { query, variables },
    {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://leetcode.com/contest/',
      },
    }
  );
  return res.data?.data;
}

// ─── Contest Service ─────────────────────────────────────────────────────────

export class ContestService {

  /**
   * Auto-detect the next upcoming LeetCode contest via LeetCode GraphQL topTwoContests.
   */
  static async getUpcomingContest(): Promise<UpcomingContestInfo | null> {
    const cacheKey = 'leetcode:upcoming_contest';
    const cached = await cacheGet<UpcomingContestInfo>(cacheKey);
    if (cached) return cached;

    try {
      const query = `
        query {
          topTwoContests {
            title
            titleSlug
            startTime
            duration
            originStartTime
            isVirtual
          }
        }
      `;

      const data = await queryLeetCodeGraphQL(query);
      const contests = data?.topTwoContests || [];

      if (!contests || contests.length === 0) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      let selected = contests.find((c: any) => c.startTime + c.duration > now);
      if (!selected) {
        selected = contests[0];
      }

      const isBiweekly = selected.titleSlug.includes('biweekly');
      const numberMatch = selected.title.match(/\d+/);
      const contestNumber = numberMatch ? parseInt(numberMatch[0], 10) : null;

      const startDate = new Date(selected.startTime * 1000);
      const endDate = new Date((selected.startTime + selected.duration) * 1000);

      let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
      const currentTimeMs = Date.now();
      if (currentTimeMs < startDate.getTime()) {
        status = 'upcoming';
      } else if (currentTimeMs <= endDate.getTime()) {
        status = 'active';
      } else {
        status = 'completed';
      }

      const info: UpcomingContestInfo = {
        contestName: selected.title,
        contestNumber,
        contestSlug: selected.titleSlug,
        contestType: isBiweekly ? 'biweekly' : 'weekly',
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        durationSeconds: selected.duration,
        status,
      };

      await cacheSet(cacheKey, info, 300); // 5 minutes cache
      return info;
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch upcoming contest from LeetCode GraphQL');
      return null;
    }
  }

  /**
   * Verify problem title/slug against LeetCode GraphQL question query or local DB.
   * Resolves exact title, verified slug, and difficulty ("Easy", "Medium", "Hard").
   */
  static async verifyQuestion(input: string): Promise<QuestionVerificationResult> {
    const rawInput = (input || '').trim();
    if (!rawInput) {
      return {
        originalInput: '',
        normalizedTitle: '',
        slug: '',
        title: '',
        difficulty: 'Medium',
        verified: false,
        source: 'manual',
      };
    }

    const normalized = normalizeProblemTitle(rawInput);
    const candidateSlug = generateCandidateSlug(rawInput);

    // 1. Try LeetCode GraphQL question(titleSlug: $titleSlug)
    try {
      const query = `
        query getQuestionDetail($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionId
            questionFrontendId
            title
            titleSlug
            difficulty
            isPaidOnly
          }
        }
      `;

      const data = await queryLeetCodeGraphQL(query, { titleSlug: candidateSlug });
      const q = data?.question;

      if (q && q.titleSlug) {
        let diff: 'Easy' | 'Medium' | 'Hard' = 'Medium';
        if (q.difficulty === 'Easy' || q.difficulty === 'Medium' || q.difficulty === 'Hard') {
          diff = q.difficulty;
        }

        return {
          originalInput: rawInput,
          normalizedTitle: normalized,
          slug: q.titleSlug,
          title: q.title || rawInput,
          difficulty: diff,
          verified: true,
          questionFrontendId: q.questionFrontendId,
          source: 'leetcode',
        };
      }
    } catch (err) {
      logger.debug({ candidateSlug, err }, 'LeetCode GraphQL problem lookup failed or question not yet public');
    }

    // 2. Check local database StudentProblem table
    try {
      const dbProblem = await prisma.studentProblem.findFirst({
        where: {
          OR: [
            { slug: candidateSlug },
            { title: { equals: rawInput, mode: 'insensitive' } },
          ],
        },
      });

      if (dbProblem) {
        let diff: 'Easy' | 'Medium' | 'Hard' = 'Medium';
        if (dbProblem.difficulty === 'Easy' || dbProblem.difficulty === 'Medium' || dbProblem.difficulty === 'Hard') {
          diff = dbProblem.difficulty as any;
        }

        return {
          originalInput: rawInput,
          normalizedTitle: normalized,
          slug: dbProblem.slug,
          title: dbProblem.title,
          difficulty: diff,
          verified: true,
          source: 'database',
        };
      }
    } catch (dbErr) {
      logger.debug({ candidateSlug, dbErr }, 'DB lookup for problem failed');
    }

    // 3. Fallback: candidate slug generated, unverified
    return {
      originalInput: rawInput,
      normalizedTitle: normalized,
      slug: candidateSlug,
      title: rawInput,
      difficulty: 'Medium',
      verified: false,
      source: 'manual',
    };
  }

  /**
   * Create or update a managed contest with questions in PostgreSQL.
   */
  static async createManagedContest(payload: {
    contestName: string;
    contestNumber?: number | null;
    contestSlug?: string;
    contestType?: string;
    startTime: string;
    endTime?: string | null;
    questions: Array<{
      orderNum?: number;
      title: string;
      slug?: string;
      difficulty?: string;
      verified?: boolean;
    }>;
  }) {
    const { contestName, startTime, endTime } = payload;
    if (!contestName || !contestName.trim()) {
      throw new Error('Contest name is required');
    }
    if (!startTime) {
      throw new Error('Contest date/start time is required');
    }
    if (!payload.questions || payload.questions.length === 0) {
      throw new Error('At least one contest question is required');
    }

    const numberMatch = contestName.match(/\d+/);
    const contestNumber = payload.contestNumber ?? (numberMatch ? parseInt(numberMatch[0], 10) : null);
    const contestSlug = payload.contestSlug || generateCandidateSlug(contestName);
    const contestType = payload.contestType || (contestSlug.includes('biweekly') ? 'biweekly' : 'weekly');

    const startDateTime = new Date(startTime);
    const endDateTime = endTime ? new Date(endTime) : new Date(startDateTime.getTime() + 90 * 60 * 1000);

    const now = Date.now();
    let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
    if (now < startDateTime.getTime()) {
      status = 'upcoming';
    } else if (now <= endDateTime.getTime()) {
      status = 'active';
    } else {
      status = 'completed';
    }

    // Process & verify all questions
    const processedQuestions: Array<{
      orderNum: number;
      title: string;
      slug: string;
      difficulty: string;
      verified: boolean;
    }> = [];
    const seenSlugs = new Set<string>();

    for (let i = 0; i < payload.questions.length; i++) {
      const q = payload.questions[i];
      const orderNum = q.orderNum || (i + 1);
      const title = q.title.trim();
      let slug = q.slug ? generateCandidateSlug(q.slug) : generateCandidateSlug(title);
      let difficulty: 'Easy' | 'Medium' | 'Hard' = (q.difficulty as any) || 'Medium';
      let verified = q.verified ?? false;

      if (!slug) {
        slug = `problem-${orderNum}`;
      }

      if (seenSlugs.has(slug)) {
        slug = `${slug}-${orderNum}`;
      }
      seenSlugs.add(slug);

      if (!verified) {
        const verifiedResult = await this.verifyQuestion(title || slug);
        if (verifiedResult.verified) {
          slug = verifiedResult.slug;
          difficulty = verifiedResult.difficulty;
          verified = true;
        }
      }

      processedQuestions.push({
        orderNum,
        title: title || `Problem ${orderNum}`,
        slug,
        difficulty,
        verified,
      });
    }

    // Save in transaction: Upsert ManagedContest and replace ManagedQuestions
    const managedContest = await prisma.$transaction(async (tx) => {
      const contest = await tx.managedContest.upsert({
        where: { contestSlug },
        update: {
          contestName,
          contestNumber,
          contestType,
          startTime: startDateTime,
          endTime: endDateTime,
          status,
        },
        create: {
          contestName,
          contestNumber,
          contestSlug,
          contestType,
          startTime: startDateTime,
          endTime: endDateTime,
          status,
        },
      });

      await tx.managedQuestion.deleteMany({
        where: { contestId: contest.id },
      });

      await tx.managedQuestion.createMany({
        data: processedQuestions.map((q) => ({
          contestId: contest.id,
          orderNum: q.orderNum,
          title: q.title,
          slug: q.slug,
          difficulty: q.difficulty,
          verified: q.verified,
        })),
      });

      return contest;
    });

    logger.info({ contestId: managedContest.id, contestSlug }, 'Managed contest saved successfully');
    return managedContest;
  }

  /**
   * List all contests (both ManagedContests and past ContestResult records).
   */
  static async getAllContests(options: { year?: number; type?: string } = {}) {
    const { year = 4, type } = options;

    // 1. Fetch all managed contests
    const managedContests = await prisma.managedContest.findMany({
      include: {
        questions: {
          orderBy: { orderNum: 'asc' },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // 2. Fetch all unique contest results for year 4 students
    const students = await prisma.student.findMany({
      where: { year },
      select: { id: true },
    });
    const studentIds = students.map((s) => s.id);
    const totalStudents = studentIds.length;

    const contestResults = await prisma.contestResult.findMany({
      where: {
        studentId: { in: studentIds },
        ...(type ? { contestType: type } : {}),
      },
      select: {
        contestName: true,
        contestSlug: true,
        contestType: true,
        contestDate: true,
        studentId: true,
        problemsSolved: true,
        easyCount: true,
        mediumCount: true,
        hardCount: true,
      },
      orderBy: { contestDate: 'desc' },
    });

    // Aggregate ContestResult stats by slug/name
    const resultStatsMap = new Map<
      string,
      {
        contestName: string;
        contestSlug: string;
        contestType: string;
        contestDate: Date;
        attendedStudentIds: Set<string>;
        totalSolved: number;
        easySolved: number;
        medSolved: number;
        hardSolved: number;
      }
    >();

    for (const cr of contestResults) {
      const key = cr.contestSlug || cr.contestName;
      if (!resultStatsMap.has(key)) {
        resultStatsMap.set(key, {
          contestName: cr.contestName,
          contestSlug: cr.contestSlug,
          contestType: cr.contestType,
          contestDate: cr.contestDate,
          attendedStudentIds: new Set(),
          totalSolved: 0,
          easySolved: 0,
          medSolved: 0,
          hardSolved: 0,
        });
      }
      const item = resultStatsMap.get(key)!;
      item.attendedStudentIds.add(cr.studentId);
      item.totalSolved += cr.problemsSolved;
      item.easySolved += cr.easyCount;
      item.medSolved += cr.mediumCount;
      item.hardSolved += cr.hardCount;
    }

    // Merge ManagedContest records and pure ContestResult past contests
    const combinedList: Array<{
      id?: string;
      contestName: string;
      contestNumber: number | null;
      contestSlug: string;
      contestType: string;
      contestDate: string;
      status: 'upcoming' | 'active' | 'completed';
      questionsCount: number;
      totalStudents: number;
      attended: number;
      notAttended: number;
      attendancePercentage: number;
      averageSolved: number;
      isManaged: boolean;
    }> = [];

    const seenSlugs = new Set<string>();

    for (const mc of managedContests) {
      if (type && mc.contestType !== type) continue;

      const key = mc.contestSlug;
      seenSlugs.add(key);
      const stat = resultStatsMap.get(key);
      const attended = stat ? stat.attendedStudentIds.size : 0;
      const notAttended = totalStudents - attended;
      const avgSolved = attended > 0 ? parseFloat((stat!.totalSolved / attended).toFixed(2)) : 0;
      const attPct = totalStudents > 0 ? parseFloat(((attended / totalStudents) * 100).toFixed(1)) : 0;

      const now = Date.now();
      let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
      if (now < new Date(mc.startTime).getTime()) {
        status = 'upcoming';
      } else if (mc.endTime && now <= new Date(mc.endTime).getTime()) {
        status = 'active';
      } else {
        status = 'completed';
      }

      combinedList.push({
        id: mc.id,
        contestName: mc.contestName,
        contestNumber: mc.contestNumber,
        contestSlug: mc.contestSlug,
        contestType: mc.contestType,
        contestDate: mc.startTime.toISOString(),
        status,
        questionsCount: mc.questions.length,
        totalStudents,
        attended,
        notAttended,
        attendancePercentage: attPct,
        averageSolved: avgSolved,
        isManaged: true,
      });
    }

    // Add remaining past contests from resultStatsMap
    for (const [key, stat] of resultStatsMap.entries()) {
      if (seenSlugs.has(key) || (stat.contestSlug && seenSlugs.has(stat.contestSlug))) continue;

      const numMatch = stat.contestName.match(/\d+/);
      const contestNumber = numMatch ? parseInt(numMatch[0], 10) : null;
      const attended = stat.attendedStudentIds.size;
      const notAttended = totalStudents - attended;
      const avgSolved = attended > 0 ? parseFloat((stat.totalSolved / attended).toFixed(2)) : 0;
      const attPct = totalStudents > 0 ? parseFloat(((attended / totalStudents) * 100).toFixed(1)) : 0;

      combinedList.push({
        contestName: stat.contestName,
        contestNumber,
        contestSlug: stat.contestSlug || generateCandidateSlug(stat.contestName),
        contestType: stat.contestType,
        contestDate: stat.contestDate.toISOString(),
        status: 'completed',
        questionsCount: 4,
        totalStudents,
        attended,
        notAttended,
        attendancePercentage: attPct,
        averageSolved: avgSolved,
        isManaged: false,
      });
    }

    // Sort newest first
    combinedList.sort((a, b) => new Date(b.contestDate).getTime() - new Date(a.contestDate).getTime());

    return {
      totalContests: combinedList.length,
      totalStudents,
      contests: combinedList,
    };
  }

  /**
   * Build complete contest analytics for a specific contest slug (or latest contest).
   */
  static async getContestAnalytics(options: {
    contestSlug?: string;
    year?: number;
  } = {}): Promise<FullContestAnalytics | null> {
    const year = options.year || 4;

    // 1. Fetch real students (Year 4)
    const students = await prisma.student.findMany({
      where: { year },
      include: {
        proctor: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    const totalStudents = students.length;
    if (totalStudents === 0) return null;

    const studentIds = students.map((s) => s.id);

    // 2. Identify target contest
    let targetSlug = options.contestSlug;
    let managedContest = null;

    if (targetSlug) {
      managedContest = await prisma.managedContest.findUnique({
        where: { contestSlug: targetSlug },
        include: { questions: { orderBy: { orderNum: 'asc' } } },
      });
    } else {
      managedContest = await prisma.managedContest.findFirst({
        include: { questions: { orderBy: { orderNum: 'asc' } } },
        orderBy: { startTime: 'desc' },
      });

      if (managedContest) {
        targetSlug = managedContest.contestSlug;
      } else {
        const latestResult = await prisma.contestResult.findFirst({
          where: { studentId: { in: studentIds } },
          orderBy: { contestDate: 'desc' },
        });
        if (latestResult) {
          targetSlug = latestResult.contestSlug || latestResult.contestName;
        }
      }
    }

    if (!targetSlug && !managedContest) {
      return null;
    }

    // 3. Resolve contest metadata
    let contestName = managedContest?.contestName || '';
    let contestNumber = managedContest?.contestNumber ?? null;
    let contestType = managedContest?.contestType || 'weekly';
    let startTime = managedContest?.startTime || new Date();
    let endTime = managedContest?.endTime || null;
    let isManaged = !!managedContest;

    if (!managedContest) {
      const cr = await prisma.contestResult.findFirst({
        where: {
          OR: [{ contestSlug: targetSlug }, { contestName: targetSlug }],
          studentId: { in: studentIds },
        },
        orderBy: { contestDate: 'desc' },
      });
      if (cr) {
        contestName = cr.contestName;
        const numMatch = cr.contestName.match(/\d+/);
        contestNumber = numMatch ? parseInt(numMatch[0], 10) : null;
        contestType = cr.contestType;
        startTime = cr.contestDate;
        endTime = new Date(cr.contestDate.getTime() + 90 * 60 * 1000);
      } else {
        contestName = targetSlug!;
      }
    }

    const now = Date.now();
    let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
    if (now < new Date(startTime).getTime()) {
      status = 'upcoming';
    } else if (endTime && now <= new Date(endTime).getTime()) {
      status = 'active';
    } else {
      status = 'completed';
    }

    // 4. Resolve Problems List
    interface ResolvedProblem {
      orderNum: number;
      title: string;
      slug: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      verified: boolean;
    }

    let problemsList: ResolvedProblem[] = [];

    if (managedContest && managedContest.questions.length > 0) {
      problemsList = managedContest.questions.map((q) => ({
        orderNum: q.orderNum,
        title: q.title,
        slug: q.slug,
        difficulty: (q.difficulty as any) || 'Medium',
        verified: q.verified,
      }));
    } else {
      problemsList = [
        { orderNum: 1, title: `${contestName} Problem 1`, slug: `${targetSlug}-q1`, difficulty: 'Easy', verified: true },
        { orderNum: 2, title: `${contestName} Problem 2`, slug: `${targetSlug}-q2`, difficulty: 'Medium', verified: true },
        { orderNum: 3, title: `${contestName} Problem 3`, slug: `${targetSlug}-q3`, difficulty: 'Medium', verified: true },
        { orderNum: 4, title: `${contestName} Problem 4`, slug: `${targetSlug}-q4`, difficulty: 'Hard', verified: true },
      ];
    }

    const totalProblems = problemsList.length;
    const problemSlugs = problemsList.map((p) => p.slug);

    // 5. Fetch contest participations from ContestResult
    const contestResults = await prisma.contestResult.findMany({
      where: {
        OR: [{ contestSlug: targetSlug }, { contestName: contestName }],
        studentId: { in: studentIds },
      },
    });

    const resultMap = new Map<string, typeof contestResults[0]>();
    for (const r of contestResults) {
      resultMap.set(r.studentId, r);
    }

    // 6. Fetch exact student submissions
    const studentSolvedSlugsMap = new Map<string, Set<string>>();

    if (problemSlugs.length > 0 && startTime) {
      const dbSolved = await prisma.studentProblem.findMany({
        where: {
          studentId: { in: studentIds },
          slug: { in: problemSlugs },
        },
        select: { studentId: true, slug: true },
      });

      for (const sp of dbSolved) {
        if (!studentSolvedSlugsMap.has(sp.studentId)) {
          studentSolvedSlugsMap.set(sp.studentId, new Set());
        }
        studentSolvedSlugsMap.get(sp.studentId)!.add(sp.slug);
      }
    }

    // 7. Calculate problem-level solved counts
    const problemSolvedCounts = new Map<string, number>();
    for (const p of problemsList) {
      problemSolvedCounts.set(p.slug, 0);
    }

    // 8. Build student records
    let attendedCount = 0;
    let grandTotalSolved = 0;
    let grandTotalEasy = 0;
    let grandTotalMedium = 0;
    let grandTotalHard = 0;

    const studentItems: StudentContestItem[] = students.map((s) => {
      const cr = resultMap.get(s.id);
      const attended = !!cr;
      if (attended) attendedCount++;

      const solvedSlugSet = studentSolvedSlugsMap.get(s.id) || new Set<string>();

      const exactProblems = problemsList.map((p, pIdx) => {
        let isSolved = false;
        if (solvedSlugSet.has(p.slug)) {
          isSolved = true;
        } else if (cr && cr.problemsSolved >= pIdx + 1) {
          isSolved = true;
        }
        return {
          orderNum: p.orderNum,
          title: p.title,
          slug: p.slug,
          difficulty: p.difficulty,
          solved: isSolved,
        };
      });

      const solvedCount = attended
        ? Math.max(cr?.problemsSolved || 0, exactProblems.filter((ep) => ep.solved).length)
        : 0;

      let easyCount = 0;
      let mediumCount = 0;
      let hardCount = 0;

      if (attended) {
        exactProblems.forEach((ep) => {
          if (ep.solved) {
            if (ep.difficulty === 'Easy') easyCount++;
            else if (ep.difficulty === 'Hard') hardCount++;
            else mediumCount++;
          }
        });

        if (easyCount + mediumCount + hardCount === 0 && cr) {
          easyCount = cr.easyCount;
          mediumCount = cr.mediumCount;
          hardCount = cr.hardCount;
        }

        grandTotalSolved += solvedCount;
        grandTotalEasy += easyCount;
        grandTotalMedium += mediumCount;
        grandTotalHard += hardCount;
      }

      exactProblems.forEach((ep) => {
        if (ep.solved) {
          problemSolvedCounts.set(ep.slug, (problemSolvedCounts.get(ep.slug) || 0) + 1);
        }
      });

      const solvePercentage = totalProblems > 0 ? Math.round((solvedCount / totalProblems) * 100) : 0;

      return {
        id: s.id,
        studentId: s.id,
        name: s.name,
        registerNumber: s.registerNumber,
        leetcodeUsername: s.leetcodeUsername,
        year: s.year,
        section: s.section,
        proctorName: s.proctor?.name || 'Unassigned',
        status: attended ? 'Attended' : 'Not Attended',
        rank: cr ? cr.rank : null,
        solvedCount,
        totalProblems,
        solvePercentage,
        easyCount,
        mediumCount,
        hardCount,
        solvedSlugs: exactProblems.filter((ep) => ep.solved).map((ep) => ep.slug),
        exactProblems,
      };
    });

    studentItems.sort((a, b) => {
      if (a.status === 'Attended' && b.status !== 'Attended') return -1;
      if (a.status !== 'Attended' && b.status === 'Attended') return 1;
      if (a.status === 'Attended' && b.status === 'Attended') {
        if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
        if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
      }
      return a.name.localeCompare(b.name);
    });

    const notAttendedCount = totalStudents - attendedCount;
    const attPercentage = totalStudents > 0 ? parseFloat(((attendedCount / totalStudents) * 100).toFixed(2)) : 0;
    const avgSolved = attendedCount > 0 ? parseFloat((grandTotalSolved / attendedCount).toFixed(2)) : 0;
    const avgEasySolved = attendedCount > 0 ? parseFloat((grandTotalEasy / attendedCount).toFixed(2)) : 0;
    const avgMedSolved = attendedCount > 0 ? parseFloat((grandTotalMedium / attendedCount).toFixed(2)) : 0;
    const avgHardSolved = attendedCount > 0 ? parseFloat((grandTotalHard / attendedCount).toFixed(2)) : 0;

    const easyCount = problemsList.filter((p) => p.difficulty === 'Easy').length;
    const medCount = problemsList.filter((p) => p.difficulty === 'Medium').length;
    const hardCount = problemsList.filter((p) => p.difficulty === 'Hard').length;

    const problemsSummary: ContestProblemSummary[] = problemsList.map((p) => ({
      orderNum: p.orderNum,
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      verified: p.verified,
      solvedCount: problemSolvedCounts.get(p.slug) || 0,
    }));

    return {
      contest: {
        id: managedContest?.id,
        contestName,
        contestNumber,
        contestSlug: targetSlug!,
        contestType,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : null,
        status,
        isManaged,
      },
      summary: {
        totalStudents,
        attendedCount,
        notAttendedCount,
        attendancePercentage: attPercentage,
        totalProblems,
        totalSolved: grandTotalSolved,
        avgSolved,
        avgEasySolved,
        avgMediumSolved: avgMedSolved,
        avgHardSolved,
        easyProblemsCount: easyCount,
        mediumProblemsCount: medCount,
        hardProblemsCount: hardCount,
      },
      problems: problemsSummary,
      students: studentItems,
    };
  }

  /**
   * Get student's detailed contest history with rank improvement % and solved deltas.
   */
  static async getStudentContestPerformance(
    studentId: string,
    currentContestSlug?: string
  ): Promise<StudentContestPerformanceReport | null> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { proctor: true },
    });

    if (!student) return null;

    const contestResults = await prisma.contestResult.findMany({
      where: { studentId },
      orderBy: { contestDate: 'desc' },
    });

    const history: StudentContestHistoryEntry[] = [];

    for (let i = 0; i < contestResults.length; i++) {
      const curr = contestResults[i];
      const prev = i + 1 < contestResults.length ? contestResults[i + 1] : null;

      let rankImprovementPct: number | null = null;
      let solvedDelta: number | null = null;

      if (prev && prev.rank && curr.rank && prev.rank > 0) {
        rankImprovementPct = parseFloat((((prev.rank - curr.rank) / prev.rank) * 100).toFixed(1));
      }

      if (prev) {
        solvedDelta = curr.problemsSolved - prev.problemsSolved;
      }

      history.push({
        contestName: curr.contestName,
        contestSlug: curr.contestSlug || generateCandidateSlug(curr.contestName),
        contestType: curr.contestType,
        contestDate: curr.contestDate.toISOString(),
        status: 'Attended',
        rank: curr.rank,
        problemsSolved: curr.problemsSolved,
        totalProblems: 4,
        easyCount: curr.easyCount,
        mediumCount: curr.mediumCount,
        hardCount: curr.hardCount,
        rating: curr.rating,
        ratingChange: curr.ratingChange,
        previousRank: prev ? prev.rank : null,
        rankImprovementPct,
        solvedDelta,
      });
    }

    let currentContestResult: any = null;

    const targetContestSlug = currentContestSlug || (history.length > 0 ? history[0].contestSlug : undefined);

    if (targetContestSlug) {
      const fullAnalytics = await this.getContestAnalytics({ contestSlug: targetContestSlug, year: student.year });
      if (fullAnalytics) {
        const studentItem = fullAnalytics.students.find((s) => s.id === studentId);
        const historyItem = history.find((h) => h.contestSlug === targetContestSlug);

        currentContestResult = {
          contestName: fullAnalytics.contest.contestName,
          contestSlug: fullAnalytics.contest.contestSlug,
          contestType: fullAnalytics.contest.contestType,
          contestDate: fullAnalytics.contest.startTime,
          status: studentItem?.status || 'Not Attended',
          rank: studentItem?.rank || null,
          problemsSolved: studentItem?.solvedCount || 0,
          totalProblems: fullAnalytics.summary.totalProblems,
          solvePercentage: studentItem?.solvePercentage || 0,
          easyCount: studentItem?.easyCount || 0,
          mediumCount: studentItem?.mediumCount || 0,
          hardCount: studentItem?.hardCount || 0,
          rankImprovementPct: historyItem?.rankImprovementPct ?? null,
          solvedDelta: historyItem?.solvedDelta ?? null,
          exactProblems: studentItem?.exactProblems || [],
        };
      }
    }

    return {
      student: {
        id: student.id,
        name: student.name,
        registerNumber: student.registerNumber,
        leetcodeUsername: student.leetcodeUsername,
        year: student.year,
        section: student.section,
        proctorName: student.proctor?.name || 'Unassigned',
        collegeEmail: student.collegeEmail,
      },
      currentContest: currentContestResult,
      history,
    };
  }
}
