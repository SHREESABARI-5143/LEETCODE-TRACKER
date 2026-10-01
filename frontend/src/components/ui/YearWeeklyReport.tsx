import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Trophy, Activity, Award, Globe, Filter, Calendar,
  ChevronLeft, ChevronRight, Star, AlertTriangle, TrendingUp,
  TrendingDown, Minus, Info, Search, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuthStore } from '../../store/authStore';
import KPICard from './KPICard';
import DifficultyBar from './DifficultyBar';
import RatingBadge from './RatingBadge';
import { cn } from '../../utils/helpers';

interface Props {
  year: 1 | 2 | 3 | 4;
  onBack?: () => void;
}

interface SummaryItem {
  current: number;
  previous: number;
  change: number;
  rate?: number;
}

interface WeeklyData {
  summary: {
    totalStudents: number;
    activeStudents: SummaryItem;
    contestParticipants: SummaryItem;
    problemsSolved: SummaryItem;
    averageSolved: SummaryItem;
  };
  weeklyContestParticipation: {
    name: string;
    date: string;
    participants: number;
    percentage: number;
  }[];
  globalRanking: {
    rank: number;
    id: string;
    name: string;
    registerNumber: string;
    leetcodeUsername: string;
    globalRank: number | null;
    totalSolved: number;
    contestRating: number;
    contestsCount: number;
    solvedThisWeek: number;
  }[];
  yearRanking: {
    id: string;
    name: string;
    registerNumber: string;
    leetcodeUsername: string;
    solved: number;
    solvedThisWeek: number;
    contestRating: number;
    globalRank: number | null;
    contests: number;
    activity: number;
    submissions: number;
  }[];
  studentActivity: {
    id: string;
    name: string;
    registerNumber: string;
    problemsSolved: number;
    easy: number;
    medium: number;
    hard: number;
    contests: number;
    contestRating: number;
    globalRank: number | null;
    status: 'active' | 'low' | 'none';
  }[];
  heatmap: {
    section: string;
    days: { day: string; count: number }[];
  }[];
  topPerformers: {
    rank: number;
    id: string;
    name: string;
    registerNumber: string;
    solvedThisWeek: number;
    contestsThisWeek: number;
    contestRating: number;
    globalRank: number | null;
    yearRank: number;
  }[];
  lowActivityStudents: {
    id: string;
    name: string;
    registerNumber: string;
    solvedLastWeek: number;
    solvedThisWeek: number;
    change: number;
    status: 'Inactive' | 'Declining';
  }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <p style={{ color: '#1F2933', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: '#C58A22', fontSize: '13px', fontWeight: 500, margin: 0 }}>
          {p.name}: {p.value} ({payload[0].payload.percentage}%)
        </p>
      ))}
    </div>
  );
};

export default function YearWeeklyReport({ year, onBack }: Props) {
  const navigate = useNavigate();
  const { token, logout } = useAuthStore();
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Date Management
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Default to current date (Aug 21, 2026 local context, or Date.now())
    const d = new Date();
    // Normalize to date
    d.setHours(0,0,0,0);
    return d;
  });
  
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filtering States
  const [activeTab, setActiveTab] = useState<'global' | 'year' | 'activity' | 'needingAttention'>('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [yearSortField, setYearSortField] = useState<'solved' | 'solvedThisWeek' | 'contestRating' | 'globalRank' | 'contests' | 'activity'>('solvedThisWeek');
  const [yearSortAsc, setYearSortAsc] = useState(false);

  // Helper: Get Monday and Sunday formatted string YYYY-MM-DD
  const weekRange = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust Mon-Sun
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const pad = (n: number) => String(n).padStart(2, '0');
    const weekStart = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    const weekEnd = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
    
    const formatLabel = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    
    return {
      weekStart,
      weekEnd,
      label: `${formatLabel(monday)} – ${formatLabel(sunday)}`
    };
  }, [selectedDate]);

  useEffect(() => {
    const fetchWeeklyReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/v1/analytics/year/${year}/weekly?weekStart=${weekRange.weekStart}&weekEnd=${weekRange.weekEnd}`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || 'Failed to fetch weekly report');
        }
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error?.message || 'Failed to fetch weekly report');
        }
        setData(json.data);
      } catch (err: any) {
        setError(err.message || 'Server connection error');
      } finally {
        setLoading(false);
      }
    };

    fetchWeeklyReport();
  }, [year, weekRange.weekStart, weekRange.weekEnd, token]);

  const handlePrevWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setSelectedDate(new Date());
  };

  const isCurrentWeek = useMemo(() => {
    const now = new Date();
    const currentMonday = new Date(now.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)));
    currentMonday.setHours(0,0,0,0);
    
    const selectedCopy = new Date(selectedDate);
    const selectedMonday = new Date(selectedCopy.setDate(selectedCopy.getDate() - selectedCopy.getDay() + (selectedCopy.getDay() === 0 ? -6 : 1)));
    selectedMonday.setHours(0,0,0,0);
    
    return currentMonday.getTime() === selectedMonday.getTime();
  }, [selectedDate]);

  // Filtered & Sorted Lists
  const filteredGlobalRanking = useMemo(() => {
    if (!data) return [];
    return data.globalRanking.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.leetcodeUsername.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const filteredAndSortedYearRanking = useMemo(() => {
    if (!data) return [];
    let result = data.yearRanking.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.leetcodeUsername.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      let valA: any = a[yearSortField];
      let valB: any = b[yearSortField];

      // Handle nulls
      if (valA === null || valA === undefined) return yearSortAsc ? 1 : -1;
      if (valB === null || valB === undefined) return yearSortAsc ? -1 : 1;

      if (valA < valB) return yearSortAsc ? -1 : 1;
      if (valA > valB) return yearSortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchQuery, yearSortField, yearSortAsc]);

  const filteredStudentActivity = useMemo(() => {
    if (!data) return [];
    return data.studentActivity.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const filteredLowActivityStudents = useMemo(() => {
    if (!data) return [];
    return data.lowActivityStudents.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const toggleSort = (field: typeof yearSortField) => {
    if (yearSortField === field) {
      setYearSortAsc(!yearSortAsc);
    } else {
      setYearSortField(field);
      setYearSortAsc(false); // default desc for numeric ranking
    }
  };

  const getYearName = (y: number) => {
    const map = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
    return map[y as 1|2|3|4] || `${y}th Year`;
  };

  // Heatmap helper for cell background color matching student count
  const getHeatmapColor = (count: number) => {
    if (count === 0) return '#F3F4F6'; // Grey
    if (count <= 3) return '#E6F4EA'; // Very Light Green
    if (count <= 8) return '#C2E7CD'; // Light Green
    if (count <= 15) return '#81C784'; // Medium Green
    return '#34A853'; // Dark Green
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-[#F5F1E8] border-t-[#C58A22] rounded-full animate-spin" />
        <span className="text-sm font-medium" style={{ color: '#6B7280' }}>Loading weekly report...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl p-8 border border-red-200 text-center space-y-4" style={{ background: '#FEF2F2' }}>
        <AlertTriangle size={32} color="#D85C5C" className="mx-auto" />
        <h3 className="font-bold text-red-800">Connection Failed</h3>
        <p className="text-sm text-red-600 max-w-md mx-auto">{error || 'Unable to load weekly analytics report.'}</p>
        <button onClick={handleCurrentWeek} className="btn btn-secondary btn-sm">Retry Current Week</button>
      </div>
    );
  }

  const { summary, weeklyContestParticipation, topPerformers, heatmap } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Title & Weekly Navigation */}
      <div className="rounded-xl p-5 card flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#1F2933' }}>
            {getYearName(year)} — Current Week Report
          </h2>
          <div className="flex items-center gap-2 mt-1 text-sm font-medium" style={{ color: '#C58A22' }}>
            <Calendar size={15} />
            <span>{weekRange.label}</span>
            {isCurrentWeek && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FDF8EC] border border-[#C58A22]">
                Current Week
              </span>
            )}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <button onClick={handlePrevWeek} className="btn btn-ghost btn-sm flex items-center gap-1.5" style={{ color: '#6B7280' }}>
            <ChevronLeft size={16} /> Previous Week
          </button>
          <button onClick={handleCurrentWeek}
            className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg transition-all", 
              isCurrentWeek ? "bg-[#C58A22] text-[#FFFFFF]" : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
            )}>
            Current Week
          </button>
          <button onClick={handleNextWeek} className="btn btn-ghost btn-sm flex items-center gap-1.5" style={{ color: '#6B7280' }}>
            Next Week <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-xl p-4 card flex flex-col justify-between">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Total Students</span>
          <div className="text-2xl font-bold mt-2" style={{ color: '#1F2933' }}>{summary.totalStudents}</div>
          <span className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>enrolled in {getYearName(year)}</span>
        </div>

        <KPICard
          label="Active Students"
          value={summary.activeStudents.current}
          sub={`${Math.round((summary.activeStudents.current / summary.totalStudents) * 100)}% active`}
          icon={<Activity />}
          color="#6BA66B"
          trend={summary.activeStudents.change}
          trendLabel="vs last week"
        />

        <KPICard
          label="Contest Participants"
          value={summary.contestParticipants.current}
          sub={`${summary.contestParticipants.rate}% participation`}
          icon={<Trophy />}
          color="#C58A22"
          trend={summary.contestParticipants.change}
          trendLabel="vs last week"
        />

        <KPICard
          label="Problems Solved"
          value={summary.problemsSolved.current}
          sub="solves in selected week"
          icon={<Globe />}
          color="#2563EB"
          trend={summary.problemsSolved.change}
          trendLabel="vs last week"
        />

        <KPICard
          label="Average Solved"
          value={summary.averageSolved.current}
          sub="problems per student"
          icon={<Award />}
          color="#7C3AED"
          trend={summary.averageSolved.change}
          trendLabel="vs last week"
        />

        <div className="rounded-xl p-4 card flex flex-col justify-between">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Participation Rate</span>
          <div className="text-2xl font-bold mt-2" style={{ color: '#C58A22' }}>{summary.contestParticipants.rate}%</div>
          <span className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>active contest coders</span>
        </div>
      </div>

      {/* Row 2: Contest Participation Chart & Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Weekly Contest Participation Bar Chart */}
        <div className="rounded-xl p-5 card flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-bold" style={{ color: '#1F2933' }}>Weekly Contest Participation</h3>
            <p className="text-xs" style={{ color: '#6B7280' }}>Number of {getYearName(year)} students participating in each contest</p>
          </div>
          {weeklyContestParticipation.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10 text-xs" style={{ color: '#9CA3AF' }}>
              No contest data found for this week
            </div>
          ) : (
            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyContestParticipation}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="participants" fill="#C58A22" radius={[4, 4, 0, 0]} name="Participants" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center flex-wrap">
                {weeklyContestParticipation.map(c => (
                  <div key={c.name} className="flex flex-col text-center">
                    <span className="text-xs font-semibold" style={{ color: '#1F2933' }}>{c.name}</span>
                    <span className="text-[10px]" style={{ color: '#6B7280' }}>{c.participants} / {summary.totalStudents} ({c.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comparison Block: This Week vs Last Week */}
        <div className="rounded-xl p-5 card">
          <div className="mb-4">
            <h3 className="text-sm font-bold" style={{ color: '#1F2933' }}>This Week vs Last Week</h3>
            <p className="text-xs" style={{ color: '#6B7280' }}>Weekly progress comparison for the selected academic year</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Problems Solved', current: summary.problemsSolved.current, prev: summary.problemsSolved.previous, change: summary.problemsSolved.change },
              { label: 'Contest Participants', current: summary.contestParticipants.current, prev: summary.contestParticipants.previous, change: summary.contestParticipants.change },
              { label: 'Active Students', current: summary.activeStudents.current, prev: summary.activeStudents.previous, change: summary.activeStudents.change },
              { label: 'Average Solved', current: summary.averageSolved.current, prev: summary.averageSolved.previous, change: summary.averageSolved.change }
            ].map(item => {
              const isIncrease = item.change > 0;
              const isDeclined = item.change < 0;
              return (
                <div key={item.label} className="rounded-xl p-4 border border-[#E5E7EB]" style={{ background: '#FAFAF9' }}>
                  <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>{item.label}</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold" style={{ color: '#1F2933' }}>{item.current}</span>
                    <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>L/W: {item.prev}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs font-semibold">
                    {isDeclined ? (
                      <div className="flex items-center gap-0.5 text-red-600">
                        <TrendingDown size={14} />
                        <span>{item.change}% decrease</span>
                      </div>
                    ) : isIncrease ? (
                      <div className="flex items-center gap-0.5 text-green-600">
                        <TrendingUp size={14} />
                        <span>+{item.change}% increase</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 text-gray-500">
                        <Minus size={14} />
                        <span>No change</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Heatmap & Top Performers */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Heatmap */}
        <div className="rounded-xl p-5 card xl:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-1" style={{ color: '#1F2933' }}>
              Student Activity Heatmap
            </h3>
            <p className="text-xs text-secondary mb-4">Number of students actively solving problems/participating in contests per section</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-8 gap-2 text-center text-xs font-semibold text-secondary">
              <div>Section</div>
              {daysOfWeek.map(d => <div key={d}>{d}</div>)}
            </div>

            {heatmap.map(row => (
              <div key={row.section} className="grid grid-cols-8 gap-2 items-center text-center">
                <div className="text-xs font-bold" style={{ color: '#1F2933' }}>Section {row.section}</div>
                {row.days.map((day, idx) => (
                  <div key={idx}
                    title={`Section ${row.section} - ${day.day}: ${day.count} active students`}
                    className="aspect-square flex items-center justify-center rounded text-[10px] font-bold transition-all hover:scale-105"
                    style={{
                      background: getHeatmapColor(day.count),
                      color: day.count > 4 ? '#FFFFFF' : '#4B5563',
                      border: '1px solid rgba(0,0,0,0.03)'
                    }}>
                    {day.count > 0 ? day.count : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 justify-end mt-4 text-xs text-secondary">
            <span>Inactive</span>
            <div className="w-3 h-3 rounded" style={{ background: getHeatmapColor(0) }} />
            <div className="w-3 h-3 rounded" style={{ background: getHeatmapColor(2) }} />
            <div className="w-3 h-3 rounded" style={{ background: getHeatmapColor(5) }} />
            <div className="w-3 h-3 rounded" style={{ background: getHeatmapColor(10) }} />
            <div className="w-3 h-3 rounded" style={{ background: getHeatmapColor(20) }} />
            <span>Highly Active</span>
          </div>
        </div>

        {/* Top Performers */}
        <div className="rounded-xl p-5 card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-1" style={{ color: '#1F2933' }}>
              <Star size={16} color="#C58A22" /> Top Performers This Week
            </h3>
            <p className="text-xs text-secondary mb-4">Highest problem solves in {getYearName(year)}</p>
          </div>

          <div className="space-y-3.5">
            {topPerformers.length === 0 && (
              <div className="text-center py-6 text-xs text-secondary">No solves recorded this week</div>
            )}
            {topPerformers.map(item => (
              <div key={item.id} className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/hod/student/${item.id}`)}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: '#FDF8EC', color: '#C58A22', border: '1px solid rgba(197, 138, 34, 0.15)' }}>
                  #{item.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate" style={{ color: '#1F2933' }}>{item.name}</div>
                  <div className="text-[10px]" style={{ color: '#6B7280' }}>
                    {item.registerNumber} · Year Rank: #{item.yearRank}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-[#4F8A63]">+{item.solvedThisWeek} solved</span>
                  <div className="text-[10px]" style={{ color: '#9CA3AF' }}>{item.contestsThisWeek} contests</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabbed Interactive Tables */}
      <div className="rounded-xl card overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#E5E7EB] px-5 py-4 gap-4" style={{ background: '#FAFAFA' }}>
          <div className="flex rounded-lg overflow-hidden border border-[#E5E7EB] bg-[#FFFFFF]">
            {[
              { id: 'global', label: 'Global LeetCode Rank' },
              { id: 'year', label: 'Year-wise Ranking' },
              { id: 'activity', label: 'Student Weekly Activity' },
              { id: 'needingAttention', label: 'Students Needing Attention' }
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
                className={cn("px-4 py-2 text-xs font-semibold transition-all border-none cursor-pointer",
                  activeTab === tab.id ? "bg-[#C58A22] text-[#FFFFFF]" : "text-[#4B5563] hover:text-[#1F2933]"
                )}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-[#FFFFFF] w-full sm:w-64">
            <Search size={14} style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search by student, reg no..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs bg-transparent border-none outline-none w-full"
            />
          </div>
        </div>

        {/* Tab 1: Global Ranking Table */}
        {activeTab === 'global' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Register No</th>
                  <th>LeetCode Username</th>
                  <th>Global Rank</th>
                  <th>Problems Solved</th>
                  <th>Contest Rating</th>
                  <th>Contests</th>
                  <th>This Week</th>
                </tr>
              </thead>
              <tbody>
                {filteredGlobalRanking.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-6 text-xs text-secondary">No students found matching query</td></tr>
                ) : (
                  filteredGlobalRanking.map(item => (
                    <tr key={item.id} className="cursor-pointer" onClick={() => navigate(`/hod/student/${item.id}`)}>
                      <td className="font-semibold text-secondary">#{item.rank}</td>
                      <td>
                        <span className="font-semibold" style={{ color: '#1F2933' }}>{item.name}</span>
                      </td>
                      <td style={{ color: '#4B5563' }}>{item.registerNumber}</td>
                      <td style={{ color: '#C58A22' }}>@{item.leetcodeUsername}</td>
                      <td className="font-bold">
                        {item.globalRank ? `#${item.globalRank.toLocaleString()}` : 'Unranked'}
                      </td>
                      <td>{item.totalSolved}</td>
                      <td>
                        <RatingBadge rating={item.contestRating} showLabel={false} size="sm" />
                      </td>
                      <td>{item.contestsCount}</td>
                      <td className="font-extrabold text-[#4F8A63]">+{item.solvedThisWeek}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Year Ranking Table */}
        {activeTab === 'year' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Register No</th>
                  <th onClick={() => toggleSort('solved')} className="cursor-pointer select-none">
                    Total Solved {yearSortField === 'solved' && (yearSortAsc ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />)}
                  </th>
                  <th onClick={() => toggleSort('solvedThisWeek')} className="cursor-pointer select-none">
                    Solved This Week {yearSortField === 'solvedThisWeek' && (yearSortAsc ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />)}
                  </th>
                  <th onClick={() => toggleSort('contestRating')} className="cursor-pointer select-none">
                    Contest Rating {yearSortField === 'contestRating' && (yearSortAsc ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />)}
                  </th>
                  <th onClick={() => toggleSort('globalRank')} className="cursor-pointer select-none">
                    Global Rank {yearSortField === 'globalRank' && (yearSortAsc ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />)}
                  </th>
                  <th onClick={() => toggleSort('contests')} className="cursor-pointer select-none">
                    Contests {yearSortField === 'contests' && (yearSortAsc ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />)}
                  </th>
                  <th onClick={() => toggleSort('activity')} className="cursor-pointer select-none">
                    Activity {yearSortField === 'activity' && (yearSortAsc ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedYearRanking.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-6 text-xs text-secondary">No students found matching query</td></tr>
                ) : (
                  filteredAndSortedYearRanking.map((item, idx) => (
                    <tr key={item.id} className="cursor-pointer" onClick={() => navigate(`/hod/student/${item.id}`)}>
                      <td className="font-bold text-[#C58A22]">#{idx + 1}</td>
                      <td>
                        <span className="font-semibold" style={{ color: '#1F2933' }}>{item.name}</span>
                      </td>
                      <td style={{ color: '#4B5563' }}>{item.registerNumber}</td>
                      <td>{item.solved}</td>
                      <td className="font-extrabold text-[#4F8A63]">+{item.solvedThisWeek}</td>
                      <td>
                        <RatingBadge rating={item.contestRating} showLabel={true} size="sm" />
                      </td>
                      <td>
                        {item.globalRank ? `#${item.globalRank.toLocaleString()}` : 'Unranked'}
                      </td>
                      <td>{item.contests}</td>
                      <td>
                        <span className="badge bg-[#EEF6F1] text-[#4F8A63] text-xs font-semibold">
                          {item.activity} active days
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Student Activity Table */}
        {activeTab === 'activity' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Register No</th>
                  <th>Problems Solved</th>
                  <th colSpan={3}>Difficulty (Easy / Med / Hard)</th>
                  <th>Contests</th>
                  <th>Contest Rating</th>
                  <th>Global Rank</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentActivity.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-6 text-xs text-secondary">No students found matching query</td></tr>
                ) : (
                  filteredStudentActivity.map(item => {
                    return (
                      <tr key={item.id} className="cursor-pointer" onClick={() => navigate(`/hod/student/${item.id}`)}>
                        <td>
                          <span className="font-semibold" style={{ color: '#1F2933' }}>{item.name}</span>
                        </td>
                        <td style={{ color: '#4B5563' }}>{item.registerNumber}</td>
                        <td className="font-extrabold text-[#C58A22]">{item.problemsSolved} solved</td>
                        <td colSpan={3} className="min-w-[150px]">
                          <DifficultyBar easy={item.easy} medium={item.medium} hard={item.hard} size="sm" />
                        </td>
                        <td>{item.contests}</td>
                        <td>
                          <RatingBadge rating={item.contestRating} showLabel={false} size="sm" />
                        </td>
                        <td>{item.globalRank ? `#${item.globalRank.toLocaleString()}` : 'N/A'}</td>
                        <td>
                          <span className={cn("badge text-xs",
                            item.status === 'active' ? "bg-[#EEF6F1] text-[#4F8A63]" :
                            item.status === 'low' ? "bg-[#FFF9EC] text-[#B98228]" :
                            "bg-[#FDF2F2] text-[#B85C5C]"
                          )}>
                            {item.status === 'active' ? 'Active' :
                             item.status === 'low' ? 'Low Activity' :
                             'No Activity'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Students Needing Attention Table */}
        {activeTab === 'needingAttention' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Register No</th>
                  <th>Last Week Solved</th>
                  <th>This Week Solved</th>
                  <th>Solves Change</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLowActivityStudents.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-xs text-secondary">No students needing attention this week</td></tr>
                ) : (
                  filteredLowActivityStudents.map(item => {
                    const isDeclining = item.status === 'Declining';
                    return (
                      <tr key={item.id} className="cursor-pointer" onClick={() => navigate(`/hod/student/${item.id}`)}>
                        <td>
                          <span className="font-semibold" style={{ color: '#1F2933' }}>{item.name}</span>
                        </td>
                        <td style={{ color: '#4B5563' }}>{item.registerNumber}</td>
                        <td style={{ color: '#6B7280' }}>{item.solvedLastWeek}</td>
                        <td className="font-bold" style={{ color: '#1F2933' }}>{item.solvedThisWeek}</td>
                        <td className="font-extrabold" style={{ color: isDeclining ? '#B85C5C' : '#6B7280' }}>
                          {item.change > 0 ? `+${item.change}` : item.change}
                        </td>
                        <td>
                          <span className={cn("badge text-xs",
                            isDeclining ? "bg-[#FDF2F2] text-[#B85C5C]" : "bg-[#FFF9EC] text-[#B98228]"
                          )}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
