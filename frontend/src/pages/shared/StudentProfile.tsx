import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Award,
  Calendar,
  CheckCircle,
  TrendingUp,
  Flame,
  UserCheck,
  Code2,
  RefreshCw,
  Trophy,
  Edit3,
  Search,
  Globe,
  Zap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import ActivityHeatmap from '../../components/ui/ActivityHeatmap';
import DifficultyBar from '../../components/ui/DifficultyBar';
import RatingBadge from '../../components/ui/RatingBadge';
import { formatDate } from '../../utils/helpers';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { profileApi, studentsApi } from '../../api/client';

interface StudentDetails {
  id: string;
  registerNumber: string;
  name: string;
  collegeEmail: string;
  year: number;
  section: string;
  batch: string;
  leetcodeUsername: string;
  leetcodeProfileUrl: string;
  status: string;
  proctor?: {
    id: string;
    name: string;
    email: string;
    designation: string;
  };
  dailySolved?: number;
  dailyStartTotal?: number;
  weeklySolved?: number;
  monthlySolved?: number;
  profile?: {
    ranking: number | null;
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
    lastSyncedAt: string;
    badges: { id: string; name: string; icon: string }[];
  };
  problems?: {
    id: string;
    title: string;
    slug: string;
    difficulty: string;
    solvedAt: string;
  }[];
  contestResults?: {
    id: string;
    contestName: string;
    contestSlug: string;
    contestType: string;
    contestDate: string;
    rating: number;
    ratingChange: number;
    rank: number;
    problemsSolved: number;
  }[];
  activityDays?: {
    date: string;
    submissionCount: number;
    problemsSolved: number;
  }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      <p style={{ color: '#1F2933', fontSize: '11px', fontWeight: 600, marginBottom: 2 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: '12px', fontWeight: 500, margin: 0 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function StudentProfile() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Username Simple Dialog
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Contest search state
  const [contestSearch, setContestSearch] = useState('');

  const loadProfile = async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const [profileRes, trendRes] = await Promise.all([
        profileApi.getProfile(studentId),
        profileApi.getRankingTrend(studentId)
      ]);

      const data = profileRes.data;
      const st = data.student;
      const qLists = data.questionLists || [];
      const snapshots = trendRes.data?.snapshots || [];

      const mapped: StudentDetails = {
        id: String(st.id),
        registerNumber: st.rollNumber || st.registerNumber,
        name: st.name,
        collegeEmail: st.proctorEmail || `${st.rollNumber?.toLowerCase()}@nec.edu.in`,
        year: st.year || st.yearOfStudy || 1,
        section: 'A',
        batch: `202${(st.year||1)+1}–202${(st.year||1)+5}`,
        leetcodeUsername: st.leetcodeUsername,
        leetcodeProfileUrl: st.profileUrl || `https://leetcode.com/u/${st.leetcodeUsername}/`,
        status: st.syncStatus === 'Success' ? 'active' : 'attention',
        proctor: st.proctorName ? {
          id: String(st.proctorId || 1),
          name: st.proctorName,
          email: st.proctorEmail || '',
          designation: 'Faculty Proctor'
        } : undefined,
        dailySolved: Number(st.dailySolved) || 0,
        dailyStartTotal: Number(st.dailyStartTotal !== undefined ? st.dailyStartTotal : (st.totalSolved - (st.dailySolved || 0))),
        weeklySolved: Number(st.weeklySolved) || 0,
        monthlySolved: Number(st.monthlySolved) || 0,
        profile: {
          ranking: st.ranking,
          reputation: st.reputation || 0,
          totalSolved: st.totalSolved || 0,
          easySolved: st.easySolved || 0,
          mediumSolved: st.mediumSolved || 0,
          hardSolved: st.hardSolved || 0,
          acceptanceRate: st.acceptanceRate || 0,
          contestRating: st.contestRating || 0,
          highestContestRating: st.highestContestRating || st.contestRating || 0,
          contestGlobalRanking: st.contestGlobalRank,
          contestsAttended: st.attendedContestsCount || (st.contestResults?.length || 0),
          badgeCount: (st.badges || []).length,
          lastSyncedAt: st.lastSyncedAt || new Date().toISOString(),
          badges: (st.badges || []).map((b: any) => ({
            id: b.id || b.displayName,
            name: b.displayName || b.name,
            icon: b.icon?.startsWith('http') ? b.icon : `https://leetcode.com${b.icon}`
          }))
        },
        contestResults: (st.contestResults || []).map((c: any, i: number) => ({
          id: String(i + 1),
          contestName: c.contestName || 'Weekly Contest',
          contestSlug: c.contestName?.toLowerCase().replace(/\s+/g, '-') || '',
          contestType: 'Weekly',
          contestDate: c.contestDate ? new Date(c.contestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
          rating: c.rating || 0,
          ratingChange: c.ratingChange || 0,
          rank: c.rank || 0,
          problemsSolved: c.problemsSolved !== undefined ? c.problemsSolved : 0
        })),
        activityDays: (st.activityDays && st.activityDays.length > 0)
          ? st.activityDays.map((a: any) => ({
              date: a.date,
              submissionCount: a.count || 0,
              problemsSolved: a.count || 0
            }))
          : snapshots.map((sn: any) => ({
              date: sn.date,
              submissionCount: 0,
              problemsSolved: sn.totalSolved
            }))
      };

      setStudent(mapped);
      setInputUsername(st.leetcodeUsername || '');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load student profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [studentId]);

  const handleOpenEdit = () => {
    setInputUsername(student?.leetcodeUsername || '');
    setIsEditModalOpen(true);
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !inputUsername.trim()) return;

    let finalUsername = inputUsername.trim();
    
    // Extract username if user pasted a full URL
    if (finalUsername.includes('leetcode.com')) {
      const match = finalUsername.match(/leetcode\.com\/(?:u\/)?([^/]+)/i);
      if (match && match[1]) {
        finalUsername = match[1];
      }
    }

    setSaving(true);
    const toastId = toast.loading('Updating LeetCode username & syncing live data...');

    try {
      await studentsApi.updateStudent(student.id, { leetcode_username: finalUsername });
      await studentsApi.syncStudent(student.id);
      await loadProfile();
      setIsEditModalOpen(false);
      toast.success('LeetCode account updated & live stats fetched successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to update username', { id: toastId });
    } finally {
      setSaving(false);
    }
  };


  const handleManualSync = async () => {
    if (!student || syncing) return;

    setSyncing(true);
    const toastId = toast.loading(`Fetching latest LeetCode stats for @${student.leetcodeUsername}...`);

    try {
      await studentsApi.syncStudent(student.id);
      await loadProfile();
      toast.success('Live LeetCode statistics refreshed successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to refresh LeetCode stats', { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const contestHistory = student?.contestResults || [];

  // Filtered contests based on search
  const filteredContests = useMemo(() => {
    if (!contestSearch.trim()) return contestHistory;
    const q = contestSearch.toLowerCase().trim();
    return contestHistory.filter(
      (c) =>
        c.contestName.toLowerCase().includes(q) ||
        c.contestSlug.toLowerCase().includes(q) ||
        String(c.rank).includes(q) ||
        String(Math.round(c.rating)).includes(q)
    );
  }, [contestHistory, contestSearch]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <RefreshCw className="w-8 h-8 text-[#C58A22] animate-spin" />
        <p className="text-sm text-[#6B7280]">Loading student profile...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-4 max-w-lg mx-auto text-center py-16">
        <div className="w-12 h-12 rounded-full bg-[#FBF0F0] text-[#B85C5C] flex items-center justify-center mx-auto">
          <UserCheck size={24} />
        </div>
        <h2 className="text-lg font-bold text-[#1F2933]">Student Profile Not Found</h2>
        <p className="text-sm text-[#6B7280]">
          {error || 'Unable to retrieve the requested student details.'}
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm inline-flex items-center gap-1 mt-2">
          <ArrowLeft size={14} /> Go Back
        </button>
      </div>
    );
  }

  const p = student.profile || {
    ranking: null,
    reputation: 0,
    totalSolved: 0,
    easySolved: 0,
    mediumSolved: 0,
    hardSolved: 0,
    acceptanceRate: 0,
    contestRating: 0,
    highestContestRating: 0,
    contestGlobalRanking: null,
    contestsAttended: 0,
    badgeCount: 0,
    lastSyncedAt: new Date().toISOString(),
    badges: [],
  };

  const activityList = (student.activityDays || []).map((a) => ({
    date: typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0],
    count: a.submissionCount || a.problemsSolved || 0,
  }));

  const contestTrend = [...contestHistory]
    .sort((a, b) => new Date(a.contestDate).getTime() - new Date(b.contestDate).getTime())
    .map((c) => ({
      name: c.contestName.replace('Weekly Contest', 'WC').replace('Biweekly Contest', 'BW'),
      Rating: Math.round(c.rating),
      Solved: c.problemsSolved,
    }));

  const leetcodeUrl = student.leetcodeProfileUrl || `https://leetcode.com/u/${student.leetcodeUsername}/`;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-10">
      {/* Navigation & Action Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost btn-sm flex items-center gap-1.5 text-[#4B5563] hover:text-[#1F2933]"
        >
          <ArrowLeft size={15} /> Back to Students
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Re-sync Button */}
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 text-[#4B5563] hover:text-[#1F2933]"
            title="Fetch latest submissions from LeetCode right now"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin text-[#C58A22]' : ''} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>

          {/* Edit LeetCode Username Button */}
          <button
            onClick={handleOpenEdit}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 text-[#1F2933] hover:border-[#C58A22]"
          >
            <Edit3 size={13} className="text-[#C58A22]" /> Change LeetCode Account
          </button>

          {/* Direct Link to LeetCode */}
          <a
            href={leetcodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <ExternalLink size={13} /> View on LeetCode
          </a>
        </div>
      </div>

      {/* Main Student Header Card */}
      <div className="rounded-2xl p-6 card bg-white border border-[#E5E7EB] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar Icon */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
            style={{ background: '#F5F1E8', color: '#C58A22', border: '1px solid rgba(197, 138, 34, 0.25)' }}
          >
            {student.name.charAt(0)}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-[#1F2933] tracking-tight">{student.name}</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EEF6F1] text-[#4F8A63] border border-[#4F8A63]/20">
                    {student.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-1.5 flex-wrap">
                  <span className="font-mono font-medium text-[#1F2933]">{student.registerNumber}</span>
                  <span>•</span>
                  <span>{student.collegeEmail}</span>
                  <span>•</span>
                  <div className="inline-flex items-center gap-1.5 bg-[#F5F1E8] px-2 py-0.5 rounded-md border border-[#C58A22]/20">
                    <Globe size={11} className="text-[#C58A22]" />
                    <a
                      href={leetcodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C58A22] font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      @{student.leetcodeUsername} <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={handleOpenEdit}
                      className="text-[#9CA3AF] hover:text-[#C58A22] ml-0.5 cursor-pointer bg-transparent border-none p-0"
                      title="Edit username"
                    >
                      <Edit3 size={11} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#F5F1E8] text-[#C58A22]">
                    Year {student.year}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#F3F4F6] text-[#4B5563]">
                    Section {student.section}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#F3F4F6] text-[#6B7280]">
                    Batch {student.batch}
                  </span>
                </div>
              </div>

              {student.proctor && (
                <div className="text-right sm:text-right text-xs bg-[#F9FAFB] p-3 rounded-xl border border-[#E5E7EB]">
                  <span className="text-[10px] uppercase font-bold text-[#9CA3AF] tracking-wider block">
                    ASSIGNED PROCTOR
                  </span>
                  <span className="font-bold text-[#1F2933] text-sm block mt-0.5">{student.proctor.name}</span>
                  <span className="text-[#6B7280] block text-[11px]">{student.proctor.designation}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Solved Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Today's Count */}
        <div className={`rounded-xl p-4 card border flex flex-col justify-between ${
          student.dailySolved === null
            ? 'bg-gray-50 border-gray-200'
            : (student.dailySolved || 0) > 0
              ? 'bg-[#F0FDF4] border-[#16A34A]/25'
              : 'bg-white border-[#E5E7EB]'
        }`}>
          <div className={`flex items-center justify-between text-xs font-semibold uppercase tracking-wider ${
            student.dailySolved === null || (student.dailySolved || 0) === 0 ? 'text-gray-500' : 'text-[#16A34A]'
          }`}>
            <span>TODAY'S COUNT</span>
            <Zap size={16} />
          </div>
          <div className="mt-3">
            <div className={`text-3xl font-extrabold ${
              student.dailySolved === null
                ? 'text-gray-400'
                : (student.dailySolved || 0) > 0
                  ? 'text-[#16A34A]'
                  : 'text-gray-600'
            }`}>
              {student.dailySolved === null ? '—' : `+${student.dailySolved || 0}`}
            </div>
            <div className={`text-[10px] mt-0.5 font-medium ${student.dailySolved === null ? 'text-gray-400' : 'text-[#15803D]'}`}>
              {student.dailySolved === null 
                ? 'Baseline not captured yet' 
                : `${p.totalSolved} − ${student.dailyStartTotal ?? (p.totalSolved - (student.dailySolved || 0))} (5:30 AM)`}
            </div>
          </div>
        </div>

        {/* Total Solved */}
        <div className="rounded-xl p-4 card bg-white border border-[#E5E7EB] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            <span>TOTAL SOLVED</span>
            <Code2 size={16} className="text-[#1F2933]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-[#1F2933]">{p.totalSolved}</div>
            <div className="text-[11px] text-[#6B7280] mt-0.5">Problems across all difficulties</div>
          </div>
        </div>

        {/* Easy */}
        <div className="rounded-xl p-4 card bg-[#EEF6F1] border border-[#4F8A63]/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#4F8A63] uppercase tracking-wider">
            <span>EASY</span>
            <CheckCircle size={16} className="text-[#4F8A63]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-[#4F8A63]">{p.easySolved}</div>
            <div className="text-[11px] text-[#4F8A63]/80 mt-0.5">
              {p.totalSolved ? Math.round((p.easySolved / p.totalSolved) * 100) : 0}% of solved
            </div>
          </div>
        </div>

        {/* Medium */}
        <div className="rounded-xl p-4 card bg-[#FDF8EC] border border-[#C58A22]/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#C58A22] uppercase tracking-wider">
            <span>MEDIUM</span>
            <Flame size={16} className="text-[#C58A22]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-[#C58A22]">{p.mediumSolved}</div>
            <div className="text-[11px] text-[#C58A22]/80 mt-0.5">
              {p.totalSolved ? Math.round((p.mediumSolved / p.totalSolved) * 100) : 0}% of solved
            </div>
          </div>
        </div>

        {/* Hard */}
        <div className="rounded-xl p-4 card bg-[#FBF0F0] border border-[#B85C5C]/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#B85C5C] uppercase tracking-wider">
            <span>HARD</span>
            <Trophy size={16} className="text-[#B85C5C]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-[#B85C5C]">{p.hardSolved}</div>
            <div className="text-[11px] text-[#B85C5C]/80 mt-0.5">
              {p.totalSolved ? Math.round((p.hardSolved / p.totalSolved) * 100) : 0}% of solved
            </div>
          </div>
        </div>
      </div>

      {/* Contest Performance & Difficulty Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contest Performance Card */}
        <div className="rounded-2xl p-5 card bg-white border border-[#E5E7EB]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#1F2933] flex items-center gap-1.5">
              <TrendingUp size={15} className="text-[#C58A22]" /> Contest Performance
            </h3>
            <RatingBadge rating={p.contestRating} size="md" />
          </div>

          <div className="divide-y divide-[#F3F4F6] text-xs">
            <div className="flex justify-between items-center py-2.5">
              <span className="text-[#6B7280]">Current Rating</span>
              <span className="font-bold text-[#1F2933] text-sm">{Math.round(p.contestRating)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-[#6B7280]">Highest Rating</span>
              <span className="font-bold text-[#4F8A63] text-sm">
                {Math.round(p.highestContestRating || p.contestRating)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-[#6B7280]">LeetCode Global Rank</span>
              <span className="font-semibold text-[#1F2933]">
                {p.ranking ? `#${p.ranking.toLocaleString()}` : 'Unranked'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-[#6B7280]">Contests Attended</span>
              <span className="font-semibold text-[#1F2933]">{p.contestsAttended || contestHistory.length}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-[#6B7280]">Acceptance Rate</span>
              <span className="font-semibold text-[#1F2933]">{p.acceptanceRate ? `${p.acceptanceRate}%` : '50.0%'}</span>
            </div>
          </div>
        </div>

        {/* Difficulty Breakdown Bar Card */}
        <div className="rounded-2xl p-5 card bg-white border border-[#E5E7EB] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1F2933] mb-4 flex items-center gap-1.5">
              <Award size={15} className="text-[#C58A22]" /> Difficulty Breakdown
            </h3>
            <DifficultyBar easy={p.easySolved} medium={p.mediumSolved} hard={p.hardSolved} size="lg" />
          </div>

          <div className="mt-4 pt-3 border-t border-[#F3F4F6]">
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span>Last Synced with LeetCode</span>
              <span className="font-mono text-[#1F2933]">{formatDate(p.lastSyncedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contest Rating Progress Chart (if has history) */}
      {contestTrend.length > 0 && (
        <div className="rounded-2xl p-5 card bg-white border border-[#E5E7EB]">
          <h3 className="text-sm font-bold text-[#1F2933] mb-3 flex items-center gap-1.5">
            <TrendingUp size={15} className="text-[#C58A22]" /> Contest Rating Progression
          </h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={contestTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={['dataMin - 50', 'dataMax + 50']}
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Rating"
                  stroke="#C58A22"
                  strokeWidth={2.5}
                  dot={{ fill: '#C58A22', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity Heatmap */}
      <div className="rounded-2xl p-5 card bg-white border border-[#E5E7EB]">
        <ActivityHeatmap activity={activityList} weeks={26} />
      </div>

      {/* Contest Results Table with Search Bar */}
      {contestHistory.length > 0 && (
        <div className="rounded-2xl card bg-white border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1F2933] flex items-center gap-1.5">
                <Calendar size={14} className="text-[#C58A22]" /> Contest Participation History
              </h3>
              <span className="text-xs text-[#6B7280] font-medium">
                ({filteredContests.length} of {contestHistory.length})
              </span>
            </div>

            {/* Quick Search for Contest */}
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search contest (e.g. 517, 190, weekly)..."
                value={contestSearch}
                onChange={(e) => setContestSearch(e.target.value)}
                className="w-full pl-7 pr-7 py-1 text-xs border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:border-[#C58A22]"
              />
              {contestSearch && (
                <button
                  onClick={() => setContestSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1F2933] text-xs bg-transparent border-none cursor-pointer p-0"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredContests.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#6B7280]">
                No contests match "{contestSearch}".
              </div>
            ) : (
              <table className="data-table w-full text-xs">
                <thead className="bg-[#F9FAFB] text-[#6B7280] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Contest</th>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-center">Rating</th>
                    <th className="py-2.5 px-3 text-center">Change</th>
                    <th className="py-2.5 px-3 text-center">Contest Rank</th>
                    <th className="py-2.5 px-3 text-center">Solved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredContests.map((c, i) => (
                    <tr key={i} className="hover:bg-[#F9FAFB]">
                      <td className="py-2.5 px-4 font-semibold text-[#1F2933]">
                        <a
                          href={`https://leetcode.com/contest/${c.contestSlug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#C58A22] hover:underline inline-flex items-center gap-1"
                        >
                          {c.contestName} <ExternalLink size={10} className="text-[#9CA3AF]" />
                        </a>
                      </td>
                      <td className="py-2.5 px-3 text-[#6B7280]">{formatDate(c.contestDate)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <RatingBadge rating={c.rating} size="sm" showLabel={false} />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`font-semibold ${
                            c.ratingChange > 0
                              ? 'text-[#4F8A63]'
                              : c.ratingChange < 0
                              ? 'text-[#B85C5C]'
                              : 'text-[#9CA3AF]'
                          }`}
                        >
                          {c.ratingChange > 0 ? `+${c.ratingChange}` : c.ratingChange}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#4B5563]">#{c.rank?.toLocaleString() || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#1F2933]">{c.problemsSolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Recent Problems Table */}
      {student.problems && student.problems.length > 0 && (
        <div className="rounded-2xl card bg-white border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1F2933] flex items-center gap-1.5">
              <Code2 size={14} className="text-[#C58A22]" /> Recent Solved Problems
            </h3>
            <span className="text-xs text-[#6B7280] font-medium">{student.problems.length} problems</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full text-xs">
              <thead className="bg-[#F9FAFB] text-[#6B7280] border-b border-[#E5E7EB]">
                <tr>
                  <th className="py-2.5 px-4 text-left">Problem Title</th>
                  <th className="py-2.5 px-3 text-center">Difficulty</th>
                  <th className="py-2.5 px-3 text-right">Solved Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {student.problems.slice(0, 15).map((p, i) => (
                  <tr key={i} className="hover:bg-[#F9FAFB]">
                    <td className="py-2.5 px-4 font-medium text-[#1F2933]">
                      <a
                        href={`https://leetcode.com/problems/${p.slug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#C58A22] hover:underline inline-flex items-center gap-1"
                      >
                        {p.title} <ExternalLink size={10} className="text-[#9CA3AF]" />
                      </a>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10.5px] ${
                          p.difficulty === 'Easy'
                            ? 'bg-[#EEF6F1] text-[#4F8A63]'
                            : p.difficulty === 'Hard'
                            ? 'bg-[#FBF0F0] text-[#B85C5C]'
                            : 'bg-[#FDF8EC] text-[#C58A22]'
                        }`}
                      >
                        {p.difficulty}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#6B7280] font-mono">{formatDate(p.solvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Username Simple Dialog */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-lg border border-[#D1D5DB] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-white">
              <h3 className="text-sm font-bold text-[#111827]">Edit LeetCode Username</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#6B7280] hover:text-[#111827] text-sm p-1 cursor-pointer bg-transparent border-none"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveUsername} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Username or LeetCode URL
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  placeholder="e.g. Sabari_5143"
                  className="w-full px-3 py-1.5 text-xs border border-[#D1D5DB] rounded-md focus:outline-none focus:border-[#C58A22] font-mono text-[#111827]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F3F4F6]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] rounded-md border border-[#D1D5DB] bg-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !inputUsername.trim()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#C58A22] hover:bg-[#A87418] rounded-md border-none cursor-pointer flex items-center gap-1"
                >
                  {saving ? 'Syncing...' : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
