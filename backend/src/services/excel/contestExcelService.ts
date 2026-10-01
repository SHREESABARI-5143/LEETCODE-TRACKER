import ExcelJS from 'exceljs';
import { ContestService, FullContestAnalytics, StudentContestPerformanceReport } from '../contest/contestService';

// Styling Constants
const PRIMARY_COLOR = 'FFE6A817'; // LeetCode Gold/Orange
const DARK_HEADER = 'FF1F2937';
const WHITE_TEXT = 'FFFFFFFF';
const LIGHT_BG = 'FFF3F4F6';
const BORDER_COLOR = 'FFE5E7EB';

export class ContestExcelService {
  /**
   * Generate full contest Excel report (.xlsx)
   */
  static async generateContestReport(contestSlug: string, year: number = 4): Promise<Buffer> {
    const analytics: FullContestAnalytics | null = await ContestService.getContestAnalytics({
      contestSlug,
      year,
    });

    if (!analytics) {
      throw new Error(`Contest ${contestSlug} not found or no student data available.`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CodeTrack Contest Analytics';
    workbook.created = new Date();

    // ──────────────────────────────────────────────────────────────────────────
    // Sheet 1: Summary & Overview
    // ──────────────────────────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Contest Summary', {
      views: [{ showGridLines: true }],
    });

    summarySheet.columns = [
      { width: 26 },
      { width: 34 },
      { width: 18 },
      { width: 24 },
    ];

    // Header Title
    summarySheet.mergeCells('A1:D1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `${analytics.contest.contestName} - Performance & Attendance Report`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE_TEXT } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_HEADER } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 36;

    // Contest Details Section
    summarySheet.addRow([]);
    summarySheet.addRow(['CONTEST DETAILS', '', 'METRICS SUMMARY', '']);
    const secRow = summarySheet.getRow(3);
    secRow.font = { bold: true, color: { argb: 'FF1E40AF' } };

    summarySheet.addRow(['Contest Name:', analytics.contest.contestName, 'Total 4th Year Students:', analytics.summary.totalStudents]);
    summarySheet.addRow(['Contest Number:', analytics.contest.contestNumber ?? 'N/A', 'Attended:', analytics.summary.attendedCount]);
    summarySheet.addRow(['Contest Type:', analytics.contest.contestType.toUpperCase(), 'Not Attended:', analytics.summary.notAttendedCount]);
    summarySheet.addRow(['Contest Date:', new Date(analytics.contest.startTime).toLocaleString(), 'Attendance Rate:', `${analytics.summary.attendancePercentage}%`]);
    summarySheet.addRow(['Status:', analytics.contest.status.toUpperCase(), 'Total Problems:', analytics.summary.totalProblems]);
    summarySheet.addRow(['Total Solved (All Students):', analytics.summary.totalSolved, 'Average Solved / Student:', analytics.summary.avgSolved]);
    summarySheet.addRow(['Easy Problems Count:', analytics.summary.easyProblemsCount, 'Avg Easy Solved:', analytics.summary.avgEasySolved]);
    summarySheet.addRow(['Medium Problems Count:', analytics.summary.mediumProblemsCount, 'Avg Medium Solved:', analytics.summary.avgMediumSolved]);
    summarySheet.addRow(['Hard Problems Count:', analytics.summary.hardProblemsCount, 'Avg Hard Solved:', analytics.summary.avgHardSolved]);

    for (let r = 4; r <= 12; r++) {
      summarySheet.getCell(`A${r}`).font = { bold: true };
      summarySheet.getCell(`C${r}`).font = { bold: true };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Sheet 2: Problem Analytics
    // ──────────────────────────────────────────────────────────────────────────
    const problemSheet = workbook.addWorksheet('Contest Problems', {
      views: [{ showGridLines: true }],
    });

    problemSheet.columns = [
      { header: '#', key: 'orderNum', width: 6 },
      { header: 'Problem Title', key: 'title', width: 42 },
      { header: 'Problem Slug', key: 'slug', width: 38 },
      { header: 'Difficulty', key: 'difficulty', width: 14 },
      { header: 'Verified Slug', key: 'verified', width: 14 },
      { header: 'Students Solved', key: 'solvedCount', width: 18 },
      { header: 'Solve Rate %', key: 'solveRate', width: 16 },
    ];

    const probHeader = problemSheet.getRow(1);
    probHeader.height = 26;
    probHeader.font = { bold: true, color: { argb: WHITE_TEXT } };
    probHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_HEADER } };
    probHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    analytics.problems.forEach((p) => {
      const solveRate = analytics.summary.attendedCount > 0
        ? `${((p.solvedCount / analytics.summary.attendedCount) * 100).toFixed(1)}%`
        : '0%';

      const row = problemSheet.addRow({
        orderNum: p.orderNum,
        title: p.title,
        slug: p.slug,
        difficulty: p.difficulty,
        verified: p.verified ? 'Verified ✓' : 'Manual',
        solvedCount: p.solvedCount,
        solveRate,
      });

      row.alignment = { vertical: 'middle' };
      row.getCell('orderNum').alignment = { horizontal: 'center' };
      row.getCell('difficulty').alignment = { horizontal: 'center' };
      row.getCell('verified').alignment = { horizontal: 'center' };
      row.getCell('solvedCount').alignment = { horizontal: 'center' };
      row.getCell('solveRate').alignment = { horizontal: 'center' };
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Sheet 3: Student Rankings & Solved Summary
    // ──────────────────────────────────────────────────────────────────────────
    const studentSheet = workbook.addWorksheet('Student Rankings', {
      views: [{ showGridLines: true }],
    });

    studentSheet.columns = [
      { header: 'Rank', key: 'rank', width: 10 },
      { header: 'Student Name', key: 'name', width: 28 },
      { header: 'Register No', key: 'regNo', width: 18 },
      { header: 'LeetCode Username', key: 'username', width: 22 },
      { header: 'Section', key: 'section', width: 12 },
      { header: 'Proctor', key: 'proctor', width: 24 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Solved', key: 'solved', width: 10 },
      { header: 'Total', key: 'total', width: 8 },
      { header: 'Solve %', key: 'solvePct', width: 12 },
      { header: 'Easy', key: 'easy', width: 8 },
      { header: 'Medium', key: 'medium', width: 10 },
      { header: 'Hard', key: 'hard', width: 8 },
    ];

    const studentHeader = studentSheet.getRow(1);
    studentHeader.height = 26;
    studentHeader.font = { bold: true, color: { argb: WHITE_TEXT } };
    studentHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_HEADER } };
    studentHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    analytics.students.forEach((s) => {
      const row = studentSheet.addRow({
        rank: s.rank ? `#${s.rank}` : 'N/A',
        name: s.name,
        regNo: s.registerNumber,
        username: s.leetcodeUsername,
        section: s.section,
        proctor: s.proctorName,
        status: s.status,
        solved: s.solvedCount,
        total: s.totalProblems,
        solvePct: `${s.solvePercentage}%`,
        easy: s.easyCount,
        medium: s.mediumCount,
        hard: s.hardCount,
      });

      row.alignment = { vertical: 'middle' };
      row.getCell('rank').alignment = { horizontal: 'center' };
      row.getCell('section').alignment = { horizontal: 'center' };
      row.getCell('status').alignment = { horizontal: 'center' };
      row.getCell('solved').alignment = { horizontal: 'center' };
      row.getCell('total').alignment = { horizontal: 'center' };
      row.getCell('solvePct').alignment = { horizontal: 'center' };
      row.getCell('easy').alignment = { horizontal: 'center' };
      row.getCell('medium').alignment = { horizontal: 'center' };
      row.getCell('hard').alignment = { horizontal: 'center' };

      if (s.status === 'Attended') {
        row.getCell('status').font = { color: { argb: 'FF15803D' }, bold: true };
      } else {
        row.getCell('status').font = { color: { argb: 'FF9CA3AF' } };
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Sheet 4: Question-Level Student Breakdown
    // ──────────────────────────────────────────────────────────────────────────
    const qLevelSheet = workbook.addWorksheet('Question Submissions', {
      views: [{ showGridLines: true }],
    });

    qLevelSheet.columns = [
      { header: 'Student Name', key: 'name', width: 28 },
      { header: 'Register No', key: 'regNo', width: 18 },
      { header: 'Section', key: 'section', width: 12 },
      { header: 'Q#', key: 'qNum', width: 6 },
      { header: 'Problem Title', key: 'probTitle', width: 38 },
      { header: 'Difficulty', key: 'difficulty', width: 12 },
      { header: 'Solved Status', key: 'solvedStatus', width: 16 },
    ];

    const qHeader = qLevelSheet.getRow(1);
    qHeader.height = 26;
    qHeader.font = { bold: true, color: { argb: WHITE_TEXT } };
    qHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_HEADER } };
    qHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    analytics.students.forEach((s) => {
      s.exactProblems.forEach((ep) => {
        const row = qLevelSheet.addRow({
          name: s.name,
          regNo: s.registerNumber,
          section: s.section,
          qNum: ep.orderNum,
          probTitle: ep.title,
          difficulty: ep.difficulty,
          solvedStatus: ep.solved ? 'Solved ✓' : 'Not Solved ✗',
        });

        row.alignment = { vertical: 'middle' };
        row.getCell('qNum').alignment = { horizontal: 'center' };
        row.getCell('difficulty').alignment = { horizontal: 'center' };
        row.getCell('solvedStatus').alignment = { horizontal: 'center' };

        if (ep.solved) {
          row.getCell('solvedStatus').font = { color: { argb: 'FF15803D' }, bold: true };
        } else {
          row.getCell('solvedStatus').font = { color: { argb: 'FFDC2626' } };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate individual student contest Excel report (.xlsx)
   */
  static async generateStudentReport(studentId: string, contestSlug?: string): Promise<Buffer> {
    const data: StudentContestPerformanceReport | null = await ContestService.getStudentContestPerformance(
      studentId,
      contestSlug
    );

    if (!data) {
      throw new Error(`Student ${studentId} not found.`);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CodeTrack Student Performance';
    workbook.created = new Date();

    // ──────────────────────────────────────────────────────────────────────────
    // Sheet 1: Student Overview & Current Contest
    // ──────────────────────────────────────────────────────────────────────────
    const overviewSheet = workbook.addWorksheet('Student Performance', {
      views: [{ showGridLines: true }],
    });

    overviewSheet.columns = [
      { width: 26 },
      { width: 34 },
      { width: 22 },
      { width: 24 },
    ];

    overviewSheet.mergeCells('A1:D1');
    const titleCell = overviewSheet.getCell('A1');
    titleCell.value = `${data.student.name} (${data.student.registerNumber}) - Contest Performance Report`;
    titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: WHITE_TEXT } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_HEADER } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    overviewSheet.getRow(1).height = 36;

    overviewSheet.addRow([]);
    overviewSheet.addRow(['STUDENT PROFILE', '', 'CURRENT CONTEST SUMMARY', '']);
    overviewSheet.getRow(3).font = { bold: true, color: { argb: 'FF1E40AF' } };

    const curr = data.currentContest;

    overviewSheet.addRow(['Student Name:', data.student.name, 'Contest Name:', curr ? curr.contestName : 'N/A']);
    overviewSheet.addRow(['Register Number:', data.student.registerNumber, 'Contest Status:', curr ? curr.status : 'N/A']);
    overviewSheet.addRow(['LeetCode Username:', data.student.leetcodeUsername, 'Contest Rank:', curr?.rank ? `#${curr.rank}` : 'N/A']);
    overviewSheet.addRow(['Year & Section:', `Year ${data.student.year} - ${data.student.section}`, 'Problems Solved:', curr ? `${curr.problemsSolved} / ${curr.totalProblems} (${curr.solvePercentage}%)` : 'N/A']);
    overviewSheet.addRow(['Assigned Proctor:', data.student.proctorName, 'Easy Solved:', curr ? curr.easyCount : 0]);
    overviewSheet.addRow(['College Email:', data.student.collegeEmail, 'Medium Solved:', curr ? curr.mediumCount : 0]);
    overviewSheet.addRow([
      '',
      '',
      'Hard Solved:',
      curr ? curr.hardCount : 0,
    ]);
    overviewSheet.addRow([
      '',
      '',
      'Rank Improvement %:',
      curr?.rankImprovementPct !== null && curr?.rankImprovementPct !== undefined
        ? `${curr.rankImprovementPct > 0 ? '↑' : '↓'} ${Math.abs(curr.rankImprovementPct)}% ${curr.rankImprovementPct >= 0 ? 'Improvement' : 'Decline'}`
        : 'N/A (First Contest)',
    ]);
    overviewSheet.addRow([
      '',
      '',
      'Solved Delta vs Prev:',
      curr?.solvedDelta !== null && curr?.solvedDelta !== undefined
        ? `${curr.solvedDelta >= 0 ? '+' : ''}${curr.solvedDelta} problems`
        : 'N/A',
    ]);

    for (let r = 4; r <= 12; r++) {
      overviewSheet.getCell(`A${r}`).font = { bold: true };
      overviewSheet.getCell(`C${r}`).font = { bold: true };
    }

    // Questions Solved in Current Contest
    if (curr && curr.exactProblems.length > 0) {
      overviewSheet.addRow([]);
      overviewSheet.addRow(['QUESTIONS BREAKDOWN (CURRENT CONTEST)', '', '', '']);
      const qTitleRow = overviewSheet.getRow(overviewSheet.rowCount);
      qTitleRow.font = { bold: true, color: { argb: 'FF1E40AF' } };

      overviewSheet.addRow(['#', 'Problem Title', 'Difficulty', 'Solved Status']);
      const subHeader = overviewSheet.getRow(overviewSheet.rowCount);
      subHeader.font = { bold: true, color: { argb: WHITE_TEXT } };
      subHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };

      curr.exactProblems.forEach((ep) => {
        const row = overviewSheet.addRow([
          ep.orderNum,
          ep.title,
          ep.difficulty,
          ep.solved ? 'Solved ✓' : 'Not Solved ✗',
        ]);
        if (ep.solved) {
          row.getCell(4).font = { color: { argb: 'FF15803D' }, bold: true };
        } else {
          row.getCell(4).font = { color: { argb: 'FFDC2626' } };
        }
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Sheet 2: Historical Contest Performance
    // ──────────────────────────────────────────────────────────────────────────
    const histSheet = workbook.addWorksheet('Past Contests History', {
      views: [{ showGridLines: true }],
    });

    histSheet.columns = [
      { header: 'Contest Name', key: 'contestName', width: 28 },
      { header: 'Contest Date', key: 'date', width: 18 },
      { header: 'Contest Rank', key: 'rank', width: 14 },
      { header: 'Solved / Total', key: 'solved', width: 16 },
      { header: 'Easy', key: 'easy', width: 8 },
      { header: 'Medium', key: 'medium', width: 10 },
      { header: 'Hard', key: 'hard', width: 8 },
      { header: 'LeetCode Rating', key: 'rating', width: 16 },
      { header: 'Previous Rank', key: 'prevRank', width: 16 },
      { header: 'Rank Improvement %', key: 'rankImp', width: 22 },
      { header: 'Solved Delta', key: 'solvedDelta', width: 14 },
    ];

    const histHeader = histSheet.getRow(1);
    histHeader.height = 26;
    histHeader.font = { bold: true, color: { argb: WHITE_TEXT } };
    histHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_HEADER } };
    histHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    data.history.forEach((h) => {
      let rankImpText = 'N/A';
      if (h.rankImprovementPct !== null) {
        rankImpText = `${h.rankImprovementPct > 0 ? '↑' : '↓'} ${Math.abs(h.rankImprovementPct)}% ${h.rankImprovementPct >= 0 ? 'Improved' : 'Declined'}`;
      }

      let solvedDeltaText = 'N/A';
      if (h.solvedDelta !== null) {
        solvedDeltaText = `${h.solvedDelta >= 0 ? '+' : ''}${h.solvedDelta}`;
      }

      const row = histSheet.addRow({
        contestName: h.contestName,
        date: new Date(h.contestDate).toLocaleDateString(),
        rank: h.rank ? `#${h.rank}` : 'N/A',
        solved: `${h.problemsSolved} / ${h.totalProblems}`,
        easy: h.easyCount,
        medium: h.mediumCount,
        hard: h.hardCount,
        rating: Math.round(h.rating),
        prevRank: h.previousRank ? `#${h.previousRank}` : 'N/A',
        rankImp: rankImpText,
        solvedDelta: solvedDeltaText,
      });

      row.alignment = { vertical: 'middle' };
      row.getCell('rank').alignment = { horizontal: 'center' };
      row.getCell('solved').alignment = { horizontal: 'center' };
      row.getCell('easy').alignment = { horizontal: 'center' };
      row.getCell('medium').alignment = { horizontal: 'center' };
      row.getCell('hard').alignment = { horizontal: 'center' };
      row.getCell('rating').alignment = { horizontal: 'center' };
      row.getCell('prevRank').alignment = { horizontal: 'center' };
      row.getCell('rankImp').alignment = { horizontal: 'center' };
      row.getCell('solvedDelta').alignment = { horizontal: 'center' };

      if (h.rankImprovementPct !== null && h.rankImprovementPct > 0) {
        row.getCell('rankImp').font = { color: { argb: 'FF15803D' }, bold: true };
      } else if (h.rankImprovementPct !== null && h.rankImprovementPct < 0) {
        row.getCell('rankImp').font = { color: { argb: 'FFDC2626' } };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
