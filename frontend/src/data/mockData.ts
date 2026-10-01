import type { Student, Proctor, User, DepartmentStats, YearStats, DailyTopPerformer, ProctorStats, ContestEntry, ActivityDay, Snapshot } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const firstNames = ['Aarav','Aditi','Aishwarya','Ajay','Akash','Ananya','Anil','Anirudh','Anjali','Arjun','Aryan','Bhavya','Chetan','Deepa','Deepak','Divya','Durga','Farhan','Gaurav','Harish','Ishaan','Janani','Karthik','Kavya','Keerthana','Kishore','Kritika','Lavanya','Manoj','Meera','Mohammed','Mohit','Nandini','Naveen','Nidhi','Nikhil','Nithin','Pavithra','Pooja','Pradeep','Priya','Rahul','Rajan','Ramya','Ravi','Rohit','Sakshi','Sandhya','Sanjay','Sara','Sathish','Shruti','Siddharth','Sneha','Sowmya','Suresh','Swetha','Tanvi','Teja','Uday','Varun','Vignesh','Vishal','Yamini','Zara'];
const lastNames = ['Sharma','Kumar','Patel','Reddy','Singh','Nair','Menon','Iyer','Pillai','Rao','Gupta','Joshi','Verma','Mishra','Pandey','Mehta','Shah','Bhat','Krishnan','Murthy','Venkat','Rajan','Subramaniam','Natarajan','Balaji'];
const proctorFirstNames = ['Dr. Anitha','Dr. Ramesh','Prof. Meenakshi','Dr. Suresh','Prof. Lakshmi','Dr. Karthikeyan','Prof. Priya','Dr. Venkatesh','Prof. Saranya','Dr. Murugan'];
const proctorLastNames = ['Kumar','Rajan','Devi','Pillai','Krishnan','Natarajan','Sharma','Reddy','Iyer','Balu'];

const generateActivity = (avgDaily: number): ActivityDay[] => {
  const days: ActivityDay[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const isActive = Math.random() < 0.55;
    days.push({ date: d.toISOString().split('T')[0], count: isActive ? rand(1, avgDaily * 2) : 0 });
  }
  return days;
};

const generateSnapshots = (base: number): Snapshot[] => {
  const snaps: Snapshot[] = [];
  let cur = Math.max(10, base - rand(80, 150));
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const easy = Math.floor(cur * 0.45);
    const medium = Math.floor(cur * 0.42);
    const hard = cur - easy - medium;
    snaps.push({ date: d.toISOString().split('T')[0], totalSolved: cur, easySolved: easy, mediumSolved: medium, hardSolved: hard, contestRating: rand(1100, 2000) });
    cur += rand(5, 20);
  }
  return snaps;
};

const generateContests = (rating: number): ContestEntry[] => {
  const contests: ContestEntry[] = [];
  let cur = rating - rand(100, 200);
  for (let i = 0; i < rand(8, 20); i++) {
    const change = rand(-60, 80);
    cur += change;
    const d = new Date();
    d.setDate(d.getDate() - i * 14);
    contests.push({
      contestTitle: `Weekly Contest ${420 - i * 2}`,
      rating: cur,
      ranking: rand(500, 8000),
      problemsSolved: rand(1, 4),
      finishTime: rand(40, 90),
      attended: true,
      ratingChange: change,
      date: d.toISOString().split('T')[0],
    });
  }
  return contests.reverse();
};

// ─── PROCTORS ────────────────────────────────────────────────────────────────
export const PROCTORS: Proctor[] = Array.from({ length: 12 }, (_, i) => ({
  id: `proctor-${i + 1}`,
  name: `${proctorFirstNames[i % proctorFirstNames.length]} ${proctorLastNames[i % proctorLastNames.length]}`,
  email: `proctor${i + 1}@svec.edu.in`,
  designation: i < 4 ? 'Assistant Professor' : i < 8 ? 'Associate Professor' : 'Professor',
  sections: [],
  studentIds: [],
}));

// ─── STUDENTS ────────────────────────────────────────────────────────────────
const generateStudent = (id: string, idx: number, year: 1|2|3|4, section: string, proctorId: string, proctorName: string, batchYear: number): Student => {
  const firstName = firstNames[idx % firstNames.length];
  const lastName = lastNames[idx % lastNames.length];
  const name = `${firstName} ${lastName}`;
  const regNo = `${batchYear}CS${String(idx + 1).padStart(3, '0')}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${idx}@svec.edu.in`;
  const lcUser = `${firstName.toLowerCase()}_${lastName.toLowerCase()}${rand(10, 99)}`;

  // Year-based difficulty ranges
  const baseEasy   = year === 1 ? rand(20, 80)  : year === 2 ? rand(50, 120)  : year === 3 ? rand(80, 160)  : rand(120, 200);
  const baseMedium = year === 1 ? rand(10, 50)  : year === 2 ? rand(30, 90)   : year === 3 ? rand(60, 140)  : rand(100, 200);
  const baseHard   = year === 1 ? rand(0, 15)   : year === 2 ? rand(5, 30)    : year === 3 ? rand(15, 60)   : rand(30, 90);
  const total = baseEasy + baseMedium + baseHard;
  const rating  = year === 1 ? rand(0, 1400)  : year === 2 ? rand(800, 1650) : year === 3 ? rand(1000, 1900) : rand(1200, 2200);
  const isActive = Math.random() < (year === 4 ? 0.88 : year === 3 ? 0.82 : year === 2 ? 0.75 : 0.68);
  const status: Student['status'] = !isActive ? (Math.random() < 0.5 ? 'inactive' : 'attention') : 'active';

  return {
    id,
    registerNo: regNo,
    name,
    email,
    year,
    section,
    batch: `${batchYear}-${batchYear + 4}`,
    proctorId,
    proctorName,
    leetcodeUsername: lcUser,
    status,
    lastAnalyzed: new Date(Date.now() - rand(0, 86400000 * 3)).toISOString(),
    dailySolved: status === 'active' ? rand(0, 12) : 0,
    weeklySolved: status === 'active' ? rand(0, 35) : rand(0, 5),
    monthlySolved: status === 'active' ? rand(5, 90) : rand(0, 15),
    profile: {
      username: lcUser,
      totalSolved: total,
      easySolved: baseEasy,
      mediumSolved: baseMedium,
      hardSolved: baseHard,
      contestRating: rating,
      globalRank: rand(50000, 500000),
      acceptanceRate: rand(45, 75),
      contributionPoints: rand(100, 2000),
      reputation: rand(0, 500),
      badges: [
        { id: '1', name: '50 Days Badge', icon: '🏅' },
        ...(total > 100 ? [{ id: '2', name: '100 Problems', icon: '💯' }] : []),
        ...(rating > 1500 ? [{ id: '3', name: 'Knight', icon: '♞' }] : []),
        ...(rating > 1800 ? [{ id: '4', name: 'Guardian', icon: '🛡️' }] : []),
      ],
      recentActivity: generateActivity(status === 'active' ? 4 : 1),
      contestHistory: generateContests(rating),
      topicsStrong: [
        { name: 'Arrays', solved: rand(20, 60) },
        { name: 'Dynamic Programming', solved: rand(5, 40) },
        { name: 'Trees', solved: rand(5, 35) },
        { name: 'Graphs', solved: rand(2, 25) },
        { name: 'Strings', solved: rand(10, 40) },
        { name: 'Hash Map', solved: rand(5, 30) },
        { name: 'Two Pointers', solved: rand(5, 25) },
        { name: 'Binary Search', solved: rand(3, 20) },
      ],
    },
    snapshots: generateSnapshots(total),
  };
};

let studentIdCounter = 1;
const allStudents: Student[] = [];

// Year configs: [year, section, proctorIdx, count, batchYear]
const yearConfigs: Array<{ year: 1|2|3|4; sections: string[]; batchYear: number }> = [
  { year: 1, sections: ['A','B','C'], batchYear: 2025 },
  { year: 2, sections: ['A','B','C'], batchYear: 2024 },
  { year: 3, sections: ['A','B'],    batchYear: 2023 },
  { year: 4, sections: ['A','B'],    batchYear: 2022 },
];

let proctorIdx = 0;
yearConfigs.forEach(({ year, sections, batchYear }) => {
  sections.forEach((section) => {
    const proctor = PROCTORS[proctorIdx % PROCTORS.length];
    const count = year <= 2 ? 40 : 35;
    for (let i = 0; i < count; i++) {
      const sid = `student-${studentIdCounter}`;
      const s = generateStudent(sid, studentIdCounter - 1, year, section, proctor.id, proctor.name, batchYear);
      allStudents.push(s);
      proctor.studentIds.push(sid);
      studentIdCounter++;
    }
    proctor.sections.push(`Y${year}-${section}`);
    proctorIdx++;
  });
});

// Assign ranks within year, section, proctor group
[1,2,3,4].forEach(y => {
  const byYear = allStudents.filter(s => s.year === y).sort((a,b) => (b.profile?.totalSolved||0) - (a.profile?.totalSolved||0));
  byYear.forEach((s,i) => { s.yearRank = i+1; });
});
allStudents.forEach(s => {
  const bySec = allStudents.filter(x => x.year === s.year && x.section === s.section).sort((a,b) => (b.profile?.totalSolved||0) - (a.profile?.totalSolved||0));
  s.sectionRank = bySec.findIndex(x => x.id === s.id) + 1;
  const byPG = allStudents.filter(x => x.proctorId === s.proctorId).sort((a,b) => (b.profile?.totalSolved||0) - (a.profile?.totalSolved||0));
  s.proctorGroupRank = byPG.findIndex(x => x.id === s.id) + 1;
});

export const STUDENTS = allStudents;

// ─── USERS ───────────────────────────────────────────────────────────────────
export const DEMO_USERS: User[] = [
  { id: 'u-admin', name: 'Admin User', email: 'admin@svec.edu.in', role: 'admin' },
  { id: 'u-hod',   name: 'Dr. P. Venkatesan', email: 'hod@svec.edu.in',   role: 'hod' },
  { id: 'u-p1',    name: PROCTORS[0].name,  email: PROCTORS[0].email, role: 'proctor', proctorId: PROCTORS[0].id },
  { id: 'u-p2',    name: PROCTORS[1].name,  email: PROCTORS[1].email, role: 'proctor', proctorId: PROCTORS[1].id },
  { id: 'u-s1',    name: STUDENTS[0].name,  email: STUDENTS[0].email, role: 'student', studentId: STUDENTS[0].id },
];

export const DEMO_CREDENTIALS: Record<string, { password: string; userId: string }> = {
  'admin@svec.edu.in':     { password: 'Admin@123',   userId: 'u-admin' },
  'hod@svec.edu.in':       { password: 'HOD@1234',    userId: 'u-hod' },
  [PROCTORS[0].email]:     { password: 'Proctor@123', userId: 'u-p1' },
  [PROCTORS[1].email]:     { password: 'Proctor@123', userId: 'u-p2' },
  [STUDENTS[0].email]:     { password: 'Student@123', userId: 'u-s1' },
};

// ─── YEAR STATS ──────────────────────────────────────────────────────────────
const computeYearStats = (year: 1|2|3|4): YearStats => {
  const labels = { 1:'1st Year', 2:'2nd Year', 3:'3rd Year', 4:'4th Year' } as const;
  const ys = STUDENTS.filter(s => s.year === year);
  const solved = ys.map(s => s.profile?.totalSolved || 0).sort((a,b)=>a-b);
  const mid = Math.floor(solved.length/2);
  const top = [...ys].sort((a,b)=>(b.profile?.totalSolved||0)-(a.profile?.totalSolved||0))[0];
  return {
    year, label: labels[year],
    totalStudents: ys.length,
    activeStudents: ys.filter(s=>s.status==='active').length,
    inactiveStudents: ys.filter(s=>s.status==='inactive').length,
    avgSolved: Math.round(solved.reduce((a,b)=>a+b,0)/solved.length),
    medianSolved: solved.length%2===0 ? Math.round((solved[mid-1]+solved[mid])/2) : solved[mid],
    maxSolved: solved[solved.length-1],
    minSolved: solved[0],
    avgContestRating: Math.round(ys.map(s=>s.profile?.contestRating||0).reduce((a,b)=>a+b,0)/ys.length),
    avgEasy:   Math.round(ys.map(s=>s.profile?.easySolved||0).reduce((a,b)=>a+b,0)/ys.length),
    avgMedium: Math.round(ys.map(s=>s.profile?.mediumSolved||0).reduce((a,b)=>a+b,0)/ys.length),
    avgHard:   Math.round(ys.map(s=>s.profile?.hardSolved||0).reduce((a,b)=>a+b,0)/ys.length),
    totalEasy:   ys.reduce((a,s)=>a+(s.profile?.easySolved||0),0),
    totalMedium: ys.reduce((a,s)=>a+(s.profile?.mediumSolved||0),0),
    totalHard:   ys.reduce((a,s)=>a+(s.profile?.hardSolved||0),0),
    topStudent: top || null,
  };
};

export const YEAR_STATS: YearStats[] = [1,2,3,4].map(y => computeYearStats(y as 1|2|3|4));

// ─── DEPARTMENT STATS ────────────────────────────────────────────────────────
export const DEPT_STATS: DepartmentStats = {
  totalStudents: STUDENTS.length,
  activeStudents: STUDENTS.filter(s=>s.status==='active').length,
  totalSolved: STUDENTS.reduce((a,s)=>a+(s.profile?.totalSolved||0),0),
  avgSolved: Math.round(STUDENTS.reduce((a,s)=>a+(s.profile?.totalSolved||0),0)/STUDENTS.length),
  avgContestRating: Math.round(STUDENTS.reduce((a,s)=>a+(s.profile?.contestRating||0),0)/STUDENTS.length),
  totalContests: STUDENTS.reduce((a,s)=>a+(s.profile?.contestHistory?.length||0),0),
  analyzedStudents: Math.floor(STUDENTS.length * 0.91),
  pendingStudents: Math.ceil(STUDENTS.length * 0.09),
  yearStats: YEAR_STATS,
};

// ─── DAILY TOP PERFORMERS ────────────────────────────────────────────────────
export const getDailyTopPerformers = (year?: 1|2|3|4, days: number = 1): DailyTopPerformer[] => {
  const pool = year ? STUDENTS.filter(s=>s.year===year) : STUDENTS;
  return pool
    .filter(s=>s.status==='active')
    .map(s => ({ student: s, solvedToday: s.dailySolved || 0, rank: 0 }))
    .sort((a,b)=>b.solvedToday-a.solvedToday)
    .slice(0,10)
    .map((p,i)=>({ ...p, rank: i+1 }));
};

// ─── PROCTOR STATS ───────────────────────────────────────────────────────────
export const PROCTOR_STATS: ProctorStats[] = PROCTORS.filter(p=>p.studentIds.length>0).map(proctor => {
  const students = STUDENTS.filter(s=>s.proctorId===proctor.id);
  const active = students.filter(s=>s.status==='active');
  const avgSolved = students.length ? Math.round(students.reduce((a,s)=>a+(s.profile?.totalSolved||0),0)/students.length) : 0;
  const avgRating = students.length ? Math.round(students.reduce((a,s)=>a+(s.profile?.contestRating||0),0)/students.length) : 0;
  return {
    proctor,
    studentCount: students.length,
    activeCount: active.length,
    avgSolved,
    avgContestRating: avgRating,
    activePercentage: students.length ? Math.round((active.length/students.length)*100) : 0,
    attentionCount: students.filter(s=>s.status==='attention').length,
  };
});

// ─── SECTION LIST ────────────────────────────────────────────────────────────
export const getSections = (year?: 1|2|3|4): string[] => {
  const students = year ? STUDENTS.filter(s=>s.year===year) : STUDENTS;
  return [...new Set(students.map(s=>s.section))].sort();
};

export const getStudentsByYear = (year: 1|2|3|4) => STUDENTS.filter(s=>s.year===year);
export const getStudentsByProctor = (proctorId: string) => STUDENTS.filter(s=>s.proctorId===proctorId);
export const getStudentById = (id: string) => STUDENTS.find(s=>s.id===id);
export const getProctorById = (id: string) => PROCTORS.find(p=>p.id===id);
