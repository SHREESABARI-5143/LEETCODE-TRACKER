import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Calendar,
  Clock,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AddContestModal from '../../components/contest/AddContestModal';
import PastContestsAnalysis from '../../components/contest/PastContestsAnalysis';
import StudentContestHistoryModal from '../../components/contest/StudentContestHistoryModal';

const API = '/api/v1';

const YEAR_TABS: Array<{ label: string; value: number | 'all' }> = [
  { label: 'All Years', value: 'all' },
  { label: '1st Year', value: 1 },
  { label: '2nd Year', value: 2 },
  { label: '3rd Year', value: 3 },
  { label: '4th Year', value: 4 },
];

interface ProblemSummary {
  orderNum: number;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  verified: boolean;
  solvedCount: number;
}

interface StudentRecord {
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
  dailySolved: number;
  weeklySolved: number;
  monthlySolved: number;
  totalSolved: number;
  solvedSlugs: string[];
  exactProblems: Array<{
    orderNum: number;
    title: string;
    slug: string;
    difficulty: string;
    solved: boolean;
  }>;
}

interface CurrentContestData {
  currentContest: {
    id?: string;
    contestName: string;
    contestNumber: number | null;
    contestSlug: string;
    contestType: string;
    startTime: string;
    endTime: string | null;
    status: 'upcoming' | 'active' | 'completed';
    isManaged: boolean;
  } | null;
  selectedYear: number | 'all';
  summary: {
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
  };
  problems: ProblemSummary[];
  students: StudentRecord[];
}

export default function ContestAnalytics() {
  const { token } = useAuthStore();
  const navigate = useNavigate();

  // Tab: 'current' = active/latest contest view; 'past' = past contests grid
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current');

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  // Separate year filter for past contests tab
  const [pastYear, setPastYear] = useState<number | 'all'>('all');

  const [data, setData] = useState<CurrentContestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncingYear, setSyncingYear] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [downloadingContest, setDownloadingContest] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Student Performance Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Attended' | 'Not Attended'>('All');
  const [sectionFilter, setSectionFilter] = useState<string>('All');
  const [proctorFilter, setProctorFilter] = useState<string>('All');

  const fetchCurrentContestAnalytics = useCallback(
    async (isRefresh = false, yearToFetch = selectedYear) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const queryParam = yearToFetch === 'all' ? 'year=all' : `year=${yearToFetch}`;
        const res = await fetch(`${API}/analytics/contests/current?${queryParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error?.message || json.message || 'Unable to load contest data');
        }
      } catch {
        setError('Network error — could not connect to contest analytics API.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, selectedYear]
  );

  useEffect(() => {
    fetchCurrentContestAnalytics(false, selectedYear);
  }, [fetchCurrentContestAnalytics, selectedYear]);

  const handleYearChange = (year: number | 'all') => {
    setSelectedYear(year);
    setSearch('');
    setStatusFilter('All');
    setSectionFilter('All');
    setProctorFilter('All');
  };

  const handleSyncSelectedYear = async () => {
    if (!data?.currentContest?.contestSlug) return;
    setSyncingYear(true);
    setSyncMessage('');
    try {
      const slug = data.currentContest.contestSlug;
      const res = await fetch(`${API}/analytics/contests/${slug}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ year: selectedYear })
      });
      const json = await res.json();
      if (json.success) {
        setSyncMessage(`✓ ${json.message || 'Sync completed successfully!'}`);
        await fetchCurrentContestAnalytics(true, selectedYear);
        setTimeout(() => setSyncMessage(''), 4000);
      } else {
        alert(json.error?.message || 'Sync failed.');
      }
    } catch {
      alert('Network error during sync.');
    } finally {
      setSyncingYear(false);
    }
  };

  const handleContestCreated = (newContestSlug: string) => {
    fetchCurrentContestAnalytics(true, selectedYear);
  };

  const handleDownloadReport = async () => {
    if (!data?.currentContest?.contestSlug) return;
    setDownloadingContest(true);
    try {
      const slug = data.currentContest.contestSlug;
      const queryParam = selectedYear === 'all' ? 'year=all' : `year=${selectedYear}`;
      const res = await fetch(`${API}/analytics/contests/${slug}/export?${queryParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const yearLabel = selectedYear === 'all' ? 'All_Years' : `Year_${selectedYear}`;
      a.download = `Contest_Report_${slug}_${yearLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download contest report.');
    } finally {
      setDownloadingContest(false);
    }
  };

  const students = data?.students || [];
  const sections = Array.from(new Set(students.map((s) => s.section))).filter(Boolean).sort();
  const proctors = Array.from(new Set(students.map((s) => s.proctorName))).filter(Boolean).sort();

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.registerNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.leetcodeUsername.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    const matchesSection = sectionFilter === 'All' || s.section === sectionFilter;
    const matchesProctor = proctorFilter === 'All' || s.proctorName === proctorFilter;

    return matchesSearch && matchesStatus && matchesSection && matchesProctor;
  });

  const contest = data?.currentContest;
  const summary = data?.summary;
  const problems = data?.problems || [];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1F2933] flex items-center gap-2.5">
            <Trophy size={28} color="#C58A22" /> Contest Management & Analytics
          </h1>
          <p className="text-sm mt-1 text-[#6B7280]">
            Live LeetCode contest tracking, verified problem resolution, and real student performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'current' && (
            <>
              <button
                onClick={() => fetchCurrentContestAnalytics(true, selectedYear)}
                disabled={refreshing}
                className="px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#1F2933] text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Plus size={16} /> Add Contest
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'current'
              ? 'bg-white text-[#1F2933] shadow-sm border border-[#E5E7EB]'
              : 'text-[#6B7280] hover:text-[#1F2933]'
          }`}
        >
          <Zap size={13} className={activeTab === 'current' ? 'text-[#C58A22]' : ''} />
          Current Contest
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'past'
              ? 'bg-white text-[#1F2933] shadow-sm border border-[#E5E7EB]'
              : 'text-[#6B7280] hover:text-[#1F2933]'
          }`}
        >
          <Clock size={13} className={activeTab === 'past' ? 'text-[#C58A22]' : ''} />
          Past Contests
        </button>
      </div>

      {/* ── PAST CONTESTS TAB ──────────────────────────────────── */}
      {activeTab === 'past' && (
        <div className="space-y-6 animate-fade-in">
          <PastContestsAnalysis
            selectedYear={pastYear === 'all' ? undefined : pastYear}
            onSelectContest={(slug) => navigate(`/hod/contests/${slug}?year=${pastYear}`)}
          />
        </div>
      )}

      {/* ── CURRENT CONTEST TAB ────────────────────────────────── */}
      {activeTab === 'current' && loading ? (
        <div className="flex items-center justify-center py-24 text-[#9CA3AF] gap-2 bg-white rounded-2xl border border-[#E5E7EB]">
          <Loader2 size={24} className="animate-spin text-[#C58A22]" /> Loading real-time contest analytics...
        </div>
      ) : activeTab === 'current' && error ? (
        <div className="p-5 rounded-2xl bg-[#FBF0F0] border border-[#FCA5A5] flex items-center justify-between text-[#D85C5C] text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={20} />
            <div>
              <div className="font-bold">Unable to load contest data</div>
              <div className="text-xs text-[#D85C5C]/80">{error}</div>
            </div>
          </div>
          <button
            onClick={() => fetchCurrentContestAnalytics(false, selectedYear)}
            className="px-3 py-1.5 bg-[#D85C5C] text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activeTab === 'current' && !contest ? (
        <div className="rounded-2xl bg-white border border-[#E5E7EB] p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-[#C58A22]">
            <Trophy size={32} />
          </div>
          <h3 className="text-lg font-bold text-[#1F2933]">No Active or Past Contests Found</h3>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">
            Click "+ Add Contest" to automatically detect the upcoming LeetCode contest.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <Plus size={14} /> Add Contest
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Active/Latest Contest Hero Card (Compact) */}
          <div className="space-y-4">
            {/* YEAR FILTER MOVED TO BOTTOM OF PAGE */}

            {/* Centered Professional Contest Meta Header */}
            <div className="flex flex-col items-center text-center gap-4 bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm relative">
              <div className="flex items-center justify-center gap-2.5">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#C58A22]">
                  LATEST COMPLETED CONTEST
                </span>
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 leading-none">
                  {contest.contestType}
                </span>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 leading-none">
                  ✓ Completed
                </span>
              </div>
              
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-[#1F2933] leading-none mb-2">
                  {contest.contestName}
                </h2>
                <div className="flex justify-center items-center gap-3 text-xs text-[#6B7280] font-medium">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#9CA3AF]" />
                    {new Date(contest.startTime).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-[#9CA3AF]" />
                    {new Date(contest.startTime).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {summary && (
                <div className="flex justify-center flex-wrap items-center gap-3 text-xs mt-1">
                  <div className="flex items-center gap-1.5 bg-[#FAFAF9] border border-[#E5E7EB] px-3 py-1.5 rounded-lg text-[#1F2933]">
                    <span className="font-bold">{summary.totalStudents}</span>
                    <span className="text-[#6B7280]">Total</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-emerald-800">
                    <span className="font-bold">{summary.attendedCount}</span>
                    <span>Attended ({summary.attendancePercentage}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg text-rose-800">
                    <span className="font-bold">{summary.notAttendedCount}</span>
                    <span>Absent</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg text-amber-800">
                    <span className="font-bold">{problems.length}</span>
                    <span>Problems (E{summary.easyProblemsCount}/M{summary.mediumProblemsCount}/H{summary.hardProblemsCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#FAFAF9] border border-[#E5E7EB] px-3 py-1.5 rounded-lg text-[#1F2933]">
                    <span className="text-[#6B7280]">Avg Solved:</span>
                    <span className="font-bold">{summary.avgSolved}</span>
                  </div>
                </div>
              )}

              <div className="mt-2 flex justify-center">
                <button
                  onClick={handleDownloadReport}
                  disabled={downloadingContest}
                  className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold flex items-center justify-center gap-2 shadow-sm shadow-amber-500/20 transition-all whitespace-nowrap"
                >
                  {downloadingContest ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download Report (.xlsx)
                </button>
              </div>
            </div>

            {/* YEAR-WISE SELECTION MOVED HERE (Above Contest Problems) */}
            <div className="rounded-xl p-4 bg-[#FAFAF9] border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold text-[#1F2933] mr-2">Filter by Year / Cohort:</span>
                {YEAR_TABS.map(tab => {
                  const isActive = selectedYear === tab.value;
                  return (
                    <button
                      key={String(tab.value)}
                      type="button"
                      onClick={() => handleYearChange(tab.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        isActive
                          ? 'bg-[#C58A22] text-white shadow-md shadow-amber-900/10'
                          : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:text-[#1F2933] hover:border-amber-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Real-time Year Sync Action Button */}
              <div className="flex items-center gap-3">
                {syncMessage && (
                  <span className="text-sm font-semibold text-[#4F8A63] animate-fade-in">
                    {syncMessage}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSyncSelectedYear}
                  disabled={syncingYear}
                  className="px-4 py-2 rounded-lg border-2 border-[#C58A22] bg-amber-50 hover:bg-amber-100 text-[#C58A22] text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title={`Sync real-time LeetCode statistics for ${selectedYear === 'all' ? 'All Years' : `Year ${selectedYear}`}`}
                >
                  {syncingYear ? (
                    <Loader2 size={16} className="animate-spin text-[#C58A22]" />
                  ) : (
                    <Zap size={16} className="text-[#C58A22]" />
                  )}
                  <span>
                    {syncingYear
                      ? 'Syncing...'
                      : `Sync ${selectedYear === 'all' ? 'All Students' : `Year ${selectedYear}`}`}
                  </span>
                </button>
              </div>
            </div>

          {/* Problems breakdown remains directly under the meta block, no outer card */}

            {/* Problem Breakdown preview */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#1F2933]">
                <span>Contest Problems ({problems.length})</span>
                <span className="text-[#6B7280]">
                  Easy: {summary?.easyProblemsCount || 0} | Med: {summary?.mediumProblemsCount || 0} | Hard:{' '}
                  {summary?.hardProblemsCount || 0}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {problems.map((p) => {
                  const solveRate =
                    summary && summary.attendedCount > 0
                      ? Math.round((p.solvedCount / summary.attendedCount) * 100)
                      : 0;

                  return (
                    <div
                      key={p.orderNum}
                      className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col justify-between space-y-2 hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold text-[#C58A22]">Q{p.orderNum}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            p.difficulty === 'Easy'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.difficulty === 'Hard'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {p.difficulty}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#1F2933] line-clamp-2">{p.title}</div>
                      <div className="text-[11px] text-[#6B7280] flex justify-between border-t border-[#F3F4F6] pt-1.5">
                        <span>Solved: {p.solvedCount}</span>
                        <span className="font-semibold text-[#4F8A63]">{solveRate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: Student Performance Breakdown & Roster */}
          <div className="rounded-2xl bg-white border border-[#E5E7EB] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1F2933]">
                  Student Performance ({filteredStudents.length} of {students.length})
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Click any student name to view comprehensive historical performance & comparison.
                </p>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Search by name, reg no, username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-amber-400 bg-[#FAFAFA]"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold focus:outline-none bg-[#FAFAFA]"
                >
                  <option value="All">Contest Status: All</option>
                  <option value="Attended">Attended Only</option>
                  <option value="Not Attended">Not Attended Only</option>
                </select>
              </div>

              <div>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold focus:outline-none bg-[#FAFAFA]"
                >
                  <option value="All">Section: All</option>
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={proctorFilter}
                  onChange={(e) => setProctorFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold focus:outline-none bg-[#FAFAFA]"
                >
                  <option value="All">Proctor: All</option>
                  {proctors.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student Table */}
            <div className="overflow-x-auto rounded-xl border border-[#F3F4F6]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAFAFA] border-b border-[#E5E7EB] z-10">
                  <tr className="text-[#6B7280] font-semibold">
                    <th className="px-3.5 py-2.5 text-center w-10">#</th>
                    <th className="px-3.5 py-2.5">Rank</th>
                    <th className="px-3.5 py-2.5">Student Name</th>
                    <th className="px-3.5 py-2.5">Reg No</th>
                    {selectedYear === 'all' && <th className="px-3.5 py-2.5 text-center">Year</th>}
                    <th className="px-3.5 py-2.5 text-center">Section</th>
                    <th className="px-3.5 py-2.5">Proctor</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                    <th className="px-3.5 py-2.5 text-center">Contest Solved</th>
                    <th className="px-3.5 py-2.5 text-center">Exact Questions Solved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={selectedYear === 'all' ? 10 : 9} className="px-4 py-8 text-center text-[#9CA3AF]">
                        No students match current search/filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const isAttended = st.status === 'Attended';

                      return (
                        <tr
                          key={st.id}
                          className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                          onClick={() => setSelectedStudentId(st.studentId || st.id)}
                        >
                          <td className="px-3.5 py-2.5 text-center font-bold text-[#9CA3AF]">
                            {idx + 1}
                          </td>

                          <td className="px-3.5 py-2.5 font-bold text-[#7C3AED]">
                            {st.rank ? `#${st.rank.toLocaleString()}` : '-'}
                          </td>

                          <td className="px-3.5 py-2.5 font-bold text-[#1F2933] hover:text-[#C58A22]">
                            {st.name}
                          </td>

                          <td className="px-3.5 py-2.5 font-mono text-[#6B7280]">
                            {st.registerNumber}
                          </td>

                          {selectedYear === 'all' && (
                            <td className="px-3.5 py-2.5 text-center font-bold text-[#6B7280]">
                              Y{st.year}
                            </td>
                          )}

                          <td className="px-3.5 py-2.5 text-center font-bold text-[#1F2933]">
                            {st.section}
                          </td>

                          <td className="px-3.5 py-2.5 text-[#6B7280]">
                            {st.proctorName}
                          </td>

                          <td className="px-3.5 py-2.5 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                                isAttended
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isAttended ? 'Attended' : 'Not Attended'}
                            </span>
                          </td>

                          <td className="px-3.5 py-2.5 text-center font-bold text-[#1F2933]">
                            {st.solvedCount} / {st.totalProblems}
                          </td>

                          <td className="px-3.5 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {st.exactProblems?.map((prob) => (
                                <span
                                  key={prob.orderNum}
                                  title={`${prob.title} (${prob.difficulty}): ${
                                    prob.solved ? 'SOLVED' : 'UNSOLVED'
                                  }`}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    prob.solved
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  Q{prob.orderNum}
                                  {prob.solved ? '✓' : '✗'}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Contest Modal */}
      <AddContestModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContestCreated={handleContestCreated}
      />

      {/* Student Contest History Modal */}
      {selectedStudentId && (
        <StudentContestHistoryModal
          studentId={selectedStudentId}
          isOpen={Boolean(selectedStudentId)}
          onClose={() => setSelectedStudentId(null)}
        />
      )}
    </div>
  );
}
