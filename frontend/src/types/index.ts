// ─── Types ───────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'hod' | 'proctor' | 'student' | 'placement';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  proctorId?: string;
  studentId?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  hodName: string;
}

export interface Year {
  id: string;
  label: string;
  value: 1 | 2 | 3 | 4;
  sections: Section[];
}

export interface Section {
  id: string;
  name: string;
  yearId: string;
  proctorId?: string;
}

export interface Proctor {
  id: string;
  name: string;
  email: string;
  designation: string;
  sections: string[];
  studentIds: string[];
}

export interface LeetCodeProfile {
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestRating: number;
  globalRank: number;
  acceptanceRate: number;
  contributionPoints: number;
  reputation: number;
  badges: Badge[];
  recentActivity: ActivityDay[];
  contestHistory: ContestEntry[];
  topicsStrong: Topic[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface ContestEntry {
  contestTitle: string;
  rating: number;
  ranking: number;
  problemsSolved: number;
  finishTime: number;
  attended: boolean;
  ratingChange: number;
  date: string;
}

export interface Topic {
  name: string;
  solved: number;
}

export interface Student {
  id: string;
  registerNo: string;
  name: string;
  email: string;
  year: 1 | 2 | 3 | 4;
  section: string;
  batch: string;
  proctorId: string;
  proctorName: string;
  leetcodeUsername: string;
  status: 'active' | 'inactive' | 'attention';
  lastAnalyzed?: string;
  profile?: LeetCodeProfile;
  snapshots?: Snapshot[];
  dailySolved?: number | null;
  weeklySolved?: number;
  monthlySolved?: number;
  yearRank?: number;
  sectionRank?: number;
  proctorGroupRank?: number;
}

export interface Snapshot {
  date: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestRating: number;
}

export interface YearStats {
  year: 1 | 2 | 3 | 4;
  label: string;
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  avgSolved: number;
  medianSolved: number;
  maxSolved: number;
  minSolved: number;
  avgContestRating: number;
  avgEasy: number;
  avgMedium: number;
  avgHard: number;
  totalEasy: number;
  totalMedium: number;
  totalHard: number;
  topStudent: Student | null;
}

export interface DepartmentStats {
  totalStudents: number;
  activeStudents: number;
  totalSolved: number;
  avgSolved: number;
  avgContestRating: number;
  totalContests: number;
  analyzedStudents: number;
  pendingStudents: number;
  yearStats: YearStats[];
}

export interface ImportResult {
  total: number;
  valid: number;
  duplicates: number;
  errors: ImportError[];
  preview: Partial<Student>[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface AnalysisJob {
  id: string;
  yearId?: string;
  total: number;
  completed: number;
  failed: number;
  status: 'pending' | 'running' | 'done' | 'error';
  startedAt: string;
}

export interface DailyTopPerformer {
  student: Student;
  solvedToday: number;
  rank: number;
}

export interface ProctorStats {
  proctor: Proctor;
  studentCount: number;
  activeCount: number;
  avgSolved: number;
  avgContestRating: number;
  activePercentage: number;
  attentionCount: number;
}
