import https from 'https';
import axios from 'axios';
import { logger } from '../../config/logger';

export interface LeetCodeProfileData {
  username: string;
  ranking: number;
  reputation: number;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  acceptanceRate: number;
  contestRating: number;
  highestContestRating: number;
  contestGlobalRanking: number | null;
  contestsAttended: number;
  badgeCount: number;
  badges: { name: string; icon: string }[];
  contestHistory: {
    contestName: string;
    contestDate: Date;
    rating: number;
    ratingChange: number;
    rank: number;
    problemsSolved: number;
  }[];
  recentProblems: {
    title: string;
    slug: string;
    difficulty: string;
    solvedAt: Date;
  }[];
  activityDays: {
    date: string;
    count: number;
  }[];
}

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 120,
  maxFreeSockets: 60,
  timeout: 6000,
});

const leetcodeAxios = axios.create({
  httpsAgent,
  timeout: 6000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
});

const COMBINED_LEETCODE_QUERY = `
  query getStudentFullLeetCodeData($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        realName
        userAvatar
        reputation
        ranking
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
      submissionCalendar
    }
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
      totalParticipants
      topPercentage
    }
    userContestRankingHistory(username: $username) {
      attended
      trendDirection
      problemsSolved
      totalProblems
      finishTimeInSeconds
      rating
      ranking
      contest {
        title
        startTime
      }
    }
    recentAcSubmissionList(username: $username, limit: 15) {
      title
      titleSlug
      timestamp
    }
  }
`;

export class LeetCodeService {
  /**
   * Fetch full student data (profile, contests, submissions, heatmap) in a SINGLE GraphQL query.
   */
  public static async fetchProfile(username: string): Promise<LeetCodeProfileData | null> {
    if (!username || !username.trim()) return null;
    const cleanUsername = username.trim();

    try {
      const response = await leetcodeAxios.post(
        LEETCODE_GRAPHQL_URL,
        {
          query: COMBINED_LEETCODE_QUERY,
          variables: { username: cleanUsername },
        }
      );

      const matchedUser = response.data?.data?.matchedUser;
      if (!matchedUser) {
        return null;
      }

      // Solved counts
      let total = 0, easy = 0, medium = 0, hard = 0;
      const submissions = matchedUser.submitStatsGlobal?.acSubmissionNum || [];
      submissions.forEach((item: any) => {
        if (item.difficulty === 'All') total = item.count;
        if (item.difficulty === 'Easy') easy = item.count;
        if (item.difficulty === 'Medium') medium = item.count;
        if (item.difficulty === 'Hard') hard = item.count;
      });

      // Parse calendar
      const activityDays: { date: string; count: number }[] = [];
      try {
        const cal = JSON.parse(matchedUser.submissionCalendar || '{}');
        Object.entries(cal).forEach(([timestamp, count]) => {
          const dateStr = new Date(parseInt(timestamp) * 1000).toISOString().split('T')[0];
          activityDays.push({ date: dateStr, count: count as number });
        });
      } catch {
        // ignore
      }

      // Contest ranking info
      const ranking = response.data?.data?.userContestRanking;
      const history = response.data?.data?.userContestRankingHistory || [];

      const contestRating = ranking ? Math.round(ranking.rating) : 0;
      const contestGlobalRanking = ranking ? ranking.globalRanking : null;
      const contestsAttended = ranking ? ranking.attendedContestsCount : 0;

      const contestHistoryList: LeetCodeProfileData['contestHistory'] = [];
      let highestRating = contestRating;
      let prevRating = 0;

      history.forEach((h: any) => {
        if (!h.attended) return;
        const currentRating = Math.round(h.rating);
        highestRating = Math.max(highestRating, currentRating);
        const change = prevRating === 0 ? 0 : currentRating - prevRating;
        prevRating = currentRating;

        contestHistoryList.push({
          contestName: h.contest?.title || 'Contest',
          contestDate: new Date(h.contest?.startTime * 1000),
          rating: currentRating,
          ratingChange: change,
          rank: h.ranking,
          problemsSolved: h.problemsSolved || 0,
        });
      });

      // Recent submissions
      const recentAc = response.data?.data?.recentAcSubmissionList || [];
      const recentProblems = recentAc.map((ac: any) => ({
        title: ac.title,
        slug: ac.titleSlug,
        difficulty: 'Medium',
        solvedAt: new Date(parseInt(ac.timestamp) * 1000),
      }));

      return {
        username: cleanUsername,
        ranking: matchedUser.profile?.ranking || 0,
        reputation: matchedUser.profile?.reputation || 0,
        totalSolved: total,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        acceptanceRate: 50.0,
        contestRating,
        highestContestRating: highestRating,
        contestGlobalRanking,
        contestsAttended,
        badgeCount: 0,
        badges: [],
        contestHistory: contestHistoryList,
        recentProblems,
        activityDays,
      };
    } catch (err: any) {
      logger.warn({ username: cleanUsername, err: err?.message }, 'Failed to fetch student data from LeetCode');
      return null;
    }
  }

  /** Fast Sync a single student's LeetCode profile + contest history into the DB using bulk operations */
  public static async syncStudent(prisma: any, studentId: string, username: string): Promise<void> {
    const profileData = await LeetCodeService.fetchProfile(username);
    if (!profileData) return;

    // 1. Contest Results bulk data (deduplicated by contestName)
    const contestMap = new Map<string, any>();
    for (const c of profileData.contestHistory) {
      if (!c.contestName || contestMap.has(c.contestName)) continue;
      const title = c.contestName;
      const slug = title.toLowerCase().replace(/\s+/g, '-');
      const isBiweekly = title.toLowerCase().includes('biweekly');
      const contestType = isBiweekly ? 'biweekly' : 'weekly';
      contestMap.set(title, {
        studentId,
        contestName: title,
        contestSlug: slug,
        contestType,
        contestDate: c.contestDate,
        rating: c.rating,
        ratingChange: c.ratingChange,
        rank: c.rank,
        problemsSolved: c.problemsSolved,
        easyCount: 0,
        mediumCount: 0,
        hardCount: 0,
      });
    }
    const contestData = Array.from(contestMap.values());

    // 2. Recent Problems bulk data (deduplicated by slug)
    const problemMap = new Map<string, any>();
    for (const p of profileData.recentProblems) {
      if (!p.slug || problemMap.has(p.slug)) continue;
      problemMap.set(p.slug, {
        studentId,
        title: p.title,
        slug: p.slug,
        difficulty: p.difficulty,
        solvedAt: p.solvedAt,
      });
    }
    const problemsData = Array.from(problemMap.values());

    // 3. Activity Days bulk data (deduplicated by ISO date string)
    // Count actual unique problems solved on each date from accepted submissions
    const problemsByDate = new Map<string, number>();
    for (const p of problemsData) {
      const dateKey = new Date(p.solvedAt).toISOString().split('T')[0];
      problemsByDate.set(dateKey, (problemsByDate.get(dateKey) || 0) + 1);
    }

    const activityMap = new Map<string, any>();
    for (const act of profileData.activityDays) {
      const d = new Date(act.date);
      d.setUTCHours(0, 0, 0, 0);
      const key = d.toISOString().split('T')[0];
      if (activityMap.has(key)) continue;

      const solvedCountOnDate = problemsByDate.get(key) || 0;

      activityMap.set(key, {
        studentId,
        date: d,
        submissionCount: act.count,
        problemsSolved: solvedCountOnDate,
      });
    }
    const activityData = Array.from(activityMap.values());

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const activeDaysCount = profileData.activityDays.filter((d) => d.count > 0).length;

    // Run in a single atomic high-performance transaction (1 DB roundtrip instead of 400+ queries)
    await prisma.$transaction([
      prisma.leetCodeProfile.upsert({
        where: { studentId },
        create: {
          studentId,
          ranking: profileData.ranking,
          reputation: profileData.reputation,
          totalSolved: profileData.totalSolved,
          easySolved: profileData.easySolved,
          mediumSolved: profileData.mediumSolved,
          hardSolved: profileData.hardSolved,
          acceptanceRate: profileData.acceptanceRate,
          contestRating: profileData.contestRating,
          highestContestRating: profileData.highestContestRating,
          contestGlobalRanking: profileData.contestGlobalRanking,
          contestsAttended: profileData.contestsAttended,
          badgeCount: profileData.badgeCount,
          lastSyncedAt: new Date(),
        },
        update: {
          ranking: profileData.ranking,
          reputation: profileData.reputation,
          totalSolved: profileData.totalSolved,
          easySolved: profileData.easySolved,
          mediumSolved: profileData.mediumSolved,
          hardSolved: profileData.hardSolved,
          acceptanceRate: profileData.acceptanceRate,
          contestRating: profileData.contestRating,
          highestContestRating: profileData.highestContestRating,
          contestGlobalRanking: profileData.contestGlobalRanking,
          contestsAttended: profileData.contestsAttended,
          badgeCount: profileData.badgeCount,
          lastSyncedAt: new Date(),
        },
      }),
      prisma.contestResult.deleteMany({ where: { studentId } }),
      ...(contestData.length > 0 ? [prisma.contestResult.createMany({ data: contestData })] : []),
      prisma.studentProblem.deleteMany({ where: { studentId } }),
      ...(problemsData.length > 0 ? [prisma.studentProblem.createMany({ data: problemsData })] : []),
      prisma.activityDay.deleteMany({ where: { studentId } }),
      ...(activityData.length > 0 ? [prisma.activityDay.createMany({ data: activityData })] : []),
      prisma.analysisSnapshot.upsert({
        where: { studentId_date: { studentId, date: today } },
        create: {
          studentId,
          date: today,
          totalSolved: profileData.totalSolved,
          easy: profileData.easySolved,
          medium: profileData.mediumSolved,
          hard: profileData.hardSolved,
          contestRating: profileData.contestRating,
          globalRank: profileData.ranking || 0,
          activeDays: activeDaysCount,
        },
        update: {
          totalSolved: profileData.totalSolved,
          easy: profileData.easySolved,
          medium: profileData.mediumSolved,
          hard: profileData.hardSolved,
          contestRating: profileData.contestRating,
          globalRank: profileData.ranking || 0,
          activeDays: activeDaysCount,
        },
      }),
    ]);
  }

  /** High-speed parallel sync for a given year */
  public static async syncYear(
    prisma: any,
    year: number,
    onProgress?: (done: number, total: number) => void
  ): Promise<{ synced: number; failed: number }> {
    const students = await prisma.student.findMany({
      where: { year },
      select: { id: true, leetcodeUsername: true },
    });

    return LeetCodeService.runParallelSync(prisma, students, onProgress);
  }

  /** High-speed parallel bulk sync for all students */
  public static async syncAllStudents(
    prisma: any,
    onProgress?: (done: number, total: number) => void
  ): Promise<{ synced: number; failed: number }> {
    const students = await prisma.student.findMany({
      select: { id: true, leetcodeUsername: true },
    });

    return LeetCodeService.runParallelSync(prisma, students, onProgress);
  }

  /**
   * Execute sync with dynamic continuous worker pool (35 workers) for sub-10-second sync
   */
  private static async runParallelSync(
    prisma: any,
    students: { id: string; leetcodeUsername: string }[],
    onProgress?: (done: number, total: number) => void
  ): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    let nextIdx = 0;
    let doneCount = 0;
    const total = students.length;

    if (total === 0) return { synced: 0, failed: 0 };

    const CONCURRENCY = Math.min(35, total);

    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (nextIdx < total) {
        const currentIdx = nextIdx++;
        const s = students[currentIdx];
        try {
          await LeetCodeService.syncStudent(prisma, s.id, s.leetcodeUsername);
          synced++;
        } catch (err) {
          failed++;
        } finally {
          doneCount++;
          onProgress?.(doneCount, total);
        }
      }
    });

    await Promise.all(workers);
    return { synced, failed };
  }
}
