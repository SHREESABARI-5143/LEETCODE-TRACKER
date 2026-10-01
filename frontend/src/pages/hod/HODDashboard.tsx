import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Code, Target, Activity,
  ChevronRight, ArrowUpRight, RefreshCw, AlertTriangle, Star, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import { reportsApi, studentsApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import KPICard from '../../components/ui/KPICard';
import DifficultyBar from '../../components/ui/DifficultyBar';
import YearStudentsTable from '../../components/ui/YearStudentsTable';
import { formatNumber } from '../../utils/helpers';
import { toast } from 'react-hot-toast';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <p style={{ color: '#1F2933', fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: '13px', fontWeight: 500, margin: 0 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function HODDashboard() {
  const navigate = useNavigate();
  const { user, institution } = useAuthStore();
  const [yearFilter, setYearFilter] = useState<number>(0);
  const [period, setPeriod] = useState('today');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Live data states
  const [overallStats, setOverallStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    analyzedStudents: 0,
    totalSolved: 0,
    avgSolved: 0,
    activePercentage: 0,
    analyzedPercentage: 0,
    difficultyBreakdown: { easy: 0, medium: 0, hard: 0 },
    syncHealth: { Success: 0, Pending: 0, Failed: 0 }
  });

  const [yearStats, setYearStats] = useState<any[]>([
    { year: 1, label: '1st Year', totalStudents: 0, activeStudents: 0, avgSolved: 0, avgEasy: 0, avgMedium: 0, avgHard: 0, topStudent: null },
    { year: 2, label: '2nd Year', totalStudents: 0, activeStudents: 0, avgSolved: 0, avgEasy: 0, avgMedium: 0, avgHard: 0, topStudent: null },
    { year: 3, label: '3rd Year', totalStudents: 0, activeStudents: 0, avgSolved: 0, avgEasy: 0, avgMedium: 0, avgHard: 0, topStudent: null },
    { year: 4, label: '4th Year', totalStudents: 0, activeStudents: 0, avgSolved: 0, avgEasy: 0, avgMedium: 0, avgHard: 0, topStudent: null }
  ]);

  const [topPerformers, setTopPerformers] = useState<any[]>([
    { year: 1, label: '1st Year', performers: [] },
    { year: 2, label: '2nd Year', performers: [] },
    { year: 3, label: '3rd Year', performers: [] },
    { year: 4, label: '4th Year', performers: [] }
  ]);

  const [attentionStudents, setAttentionStudents] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const [overallRes, yearRes, perfRes, studRes] = await Promise.all([
        reportsApi.getOverall(),
        reportsApi.getYearWise(),
        reportsApi.getDailyPerformers(period),
        studentsApi.getStudents({ limit: 10, sync_status: 'Failed' })
      ]);

      if (overallRes.data) setOverallStats(overallRes.data);
      if (yearRes.data && Array.isArray(yearRes.data)) setYearStats(yearRes.data);
      if (perfRes.data && Array.isArray(perfRes.data)) setTopPerformers(perfRes.data);
      if (studRes.data?.students) setAttentionStudents(studRes.data.students.slice(0, 6));
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const handleAnalyseNow = async () => {
    try {
      setIsAnalysing(true);
      const toastId = toast.loading('Starting LeetCode sync in background...');

      await studentsApi.syncAllWithProgress({
        pollIntervalMs: 1000,
        timeoutMs: 120_000,
        onProgress: ({ completed, total, progressPercentage, successful, failed }) => {
          toast.loading(
            `Syncing… ${completed}/${total} (${progressPercentage}%) — ${successful} OK, ${failed} failed`,
            { id: toastId }
          );
        },
      });

      toast.success('Sync and analysis completed!', { id: toastId });
      await fetchDashboardData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to analyse students');
    } finally {
      setIsAnalysing(false);
    }
  };

  const chartData = yearStats.map((ys) => ({
    year: ys.label,
    'Avg Solved': ys.avgSolved,
    'Avg Rating': Math.round((ys.avgContestRating || 0) / 10),
    Easy: ys.avgEasy,
    Medium: ys.avgMedium,
    Hard: ys.avgHard,
  }));

  const radarData = [
    { metric: 'Avg Solved',  '1st': yearStats[0]?.avgSolved || 0, '2nd': yearStats[1]?.avgSolved || 0, '3rd': yearStats[2]?.avgSolved || 0, '4th': yearStats[3]?.avgSolved || 0 },
    { metric: 'Easy',        '1st': yearStats[0]?.avgEasy || 0,   '2nd': yearStats[1]?.avgEasy || 0,   '3rd': yearStats[2]?.avgEasy || 0,   '4th': yearStats[3]?.avgEasy || 0 },
    { metric: 'Medium',      '1st': yearStats[0]?.avgMedium || 0, '2nd': yearStats[1]?.avgMedium || 0, '3rd': yearStats[2]?.avgMedium || 0, '4th': yearStats[3]?.avgMedium || 0 },
    { metric: 'Hard',        '1st': yearStats[0]?.avgHard || 0,   '2nd': yearStats[1]?.avgHard || 0,   '3rd': yearStats[2]?.avgHard || 0,   '4th': yearStats[3]?.avgHard || 0 },
    { metric: 'Rating/10',   '1st': Math.round((yearStats[0]?.avgContestRating || 0)/10), '2nd': Math.round((yearStats[1]?.avgContestRating || 0)/10), '3rd': Math.round((yearStats[2]?.avgContestRating || 0)/10), '4th': Math.round((yearStats[3]?.avgContestRating || 0)/10) },
  ];

  const deptTitle = user?.departmentName || `${user?.departmentCode || 'CSE'} Department Overview`;
  const subTitleText = `Academic Year ${institution?.academicYear || '2024-25'} · ${institution?.name || 'Nandha Engineering College'}`;

  if (yearFilter > 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1F2933' }}>{deptTitle}</h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{subTitleText}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
              {[{ v:0,l:'All' },{ v:1,l:'1st' },{ v:2,l:'2nd' },{ v:3,l:'3rd' },{ v:4,l:'4th' }].map(opt => (
                <button key={opt.v} onClick={() => setYearFilter(opt.v)}
                  className="px-3 py-1.5 text-sm font-medium transition-all"
                  style={{
                    background: yearFilter===opt.v ? '#C58A22' : 'transparent',
                    color: yearFilter===opt.v ? '#FFFFFF' : '#6B7280',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <YearStudentsTable year={yearFilter as 1|2|3|4} onYearChange={(newYear) => setYearFilter(newYear)} />
      </div>
    );
  }

  const analyzedCount = overallStats.analyzedStudents || 0;
  const totalCount = overallStats.totalStudents || 0;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((analyzedCount / totalCount) * 100)) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1F2933' }}>{deptTitle}</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{subTitleText}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
            {[{ v:0,l:'All' },{ v:1,l:'1st' },{ v:2,l:'2nd' },{ v:3,l:'3rd' },{ v:4,l:'4th' }].map(opt => (
              <button key={opt.v} onClick={() => setYearFilter(opt.v)}
                className="px-3 py-1.5 text-sm font-medium transition-all"
                style={{
                  background: yearFilter===opt.v ? '#C58A22' : 'transparent',
                  color: yearFilter===opt.v ? '#FFFFFF' : '#6B7280',
                  border: 'none', cursor: 'pointer',
                }}>
                {opt.l}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchDashboardData} 
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Analysis progress banner */}
      <div className="rounded-xl px-5 py-4 flex items-center gap-4" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <Zap size={18} color="#C58A22" />
        <div className="flex-1">
          <div className="flex justify-between mb-1.5">
            <span className="text-sm font-semibold" style={{ color: '#1F2933' }}>Students Analysed</span>
            <span className="text-sm font-semibold" style={{ color: '#C58A22' }}>{analyzedCount} / {totalCount}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%`, background: '#C58A22' }} />
          </div>
        </div>
        <button 
          onClick={handleAnalyseNow} 
          disabled={isAnalysing}
          className="btn btn-primary btn-sm cursor-pointer flex items-center gap-1.5"
        >
          {isAnalysing && <RefreshCw size={13} className="animate-spin" />}
          Analyse Now
        </button>
      </div>

      {/* Overall Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Students" value={overallStats.totalStudents} icon={<Users />} trend={3} trendLabel="vs last year" />
        <KPICard label="Active Students" value={overallStats.activeStudents} sub={`${overallStats.activePercentage}% active`} icon={<Activity />} color="#6BA66B" trend={5} trendLabel="this month" />
        <KPICard label="Total Solved" value={formatNumber(overallStats.totalSolved)} icon={<Code />} trend={12} trendLabel="vs last month" />
        <KPICard label="Average Solved" value={overallStats.avgSolved} icon={<Target />} trend={8} />
      </div>

      {/* Four Year Cards */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ color: '#1F2933' }}>Year-wise Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {yearStats.map((ys) => (
            <div key={ys.year}
              className="rounded-xl p-5 cursor-pointer transition-all hover:scale-[1.02] card"
              style={{ position: 'relative', overflow: 'hidden' }}
              onClick={() => navigate(`/hod/year/${ys.year}`)}>
              {/* Accent bar */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: '#C58A22' }} />

              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-sm font-semibold" style={{ color: '#6B7280' }}>{ys.label}</span>
                <ChevronRight size={16} style={{ color: '#C58A22' }} />
              </div>

              <div className="text-2xl font-bold mb-1" style={{ color: '#1F2933' }}>{ys.totalStudents}</div>
              <div className="text-xs mb-4" style={{ color: '#6B7280' }}>students enrolled</div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>Active Students</span>
                  <span className="font-semibold" style={{ color: '#1F2933' }}>{ys.activeStudents}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#6B7280' }}>Avg Solved</span>
                  <span className="font-semibold" style={{ color: '#1F2933' }}>{ys.avgSolved}</span>
                </div>
                {ys.topStudent && (
                  <div className="flex flex-col pt-1.5 border-t border-[#F3F4F6] mt-1.5">
                    <span style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Top Coder</span>
                    <span className="font-semibold truncate" style={{ color: '#C58A22', fontSize: '13px', marginTop: 1 }}>{ys.topStudent.name}</span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>{ys.topStudent.registerNo || ys.topStudent.rollNumber}</span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <DifficultyBar easy={ys.avgEasy} medium={ys.avgMedium} hard={ys.avgHard} showCounts={false} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="rounded-xl p-5 card">
          <h3 className="text-sm font-bold mb-4" style={{ color: '#1F2933' }}>Average Problems Solved by Year</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="year" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Easy" fill="#6BA66B" radius={[4,4,0,0]} />
              <Bar dataKey="Medium" fill="#E59A32" radius={[4,4,0,0]} />
              <Bar dataKey="Hard" fill="#D85C5C" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        <div className="rounded-xl p-5 card">
          <h3 className="text-sm font-bold mb-4" style={{ color: '#1F2933' }}>Year-wise Performance Radar</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#6B7280', fontSize: 11 }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar name="1st Year" dataKey="1st" stroke="#C58A22" fill="#C58A22" fillOpacity={0.1} />
              <Radar name="2nd Year" dataKey="2nd" stroke="#6BA66B" fill="#6BA66B" fillOpacity={0.1} />
              <Radar name="3rd Year" dataKey="3rd" stroke="#E59A32" fill="#E59A32" fillOpacity={0.1} />
              <Radar name="4th Year" dataKey="4th" stroke="#D85C5C" fill="#D85C5C" fillOpacity={0.1} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#6B7280', fontSize: '13px' }}>{v}</span>} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Today's Top Performers */}
      <div className="rounded-xl p-5 card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#1F2933' }}>
            <Star size={16} color="#C58A22" /> Today's Top Performers
          </h3>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            {['today','7d','30d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1 text-xs font-medium"
                style={{
                  background: period===p ? '#C58A22' : 'transparent',
                  color: period===p ? '#FFFFFF' : '#6B7280',
                  border:'none', cursor:'pointer'
                }}>
                {p==='today' ? 'Today' : p==='7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {topPerformers.map(({ year, label, performers }) => (
            <div key={year} className="rounded-xl p-4 border border-[#E5E7EB]" style={{ background: '#FAFAF9' }}>
              <div className="text-xs font-bold mb-3" style={{ color: '#C58A22' }}>{label}</div>
              {(!performers || performers.length === 0) && (
                <p className="text-xs" style={{ color: '#9CA3AF' }}>No synchronized coders</p>
              )}
              {performers && performers.slice(0, 3).map((p: any, i: number) => {
                const count = p.solvedInPeriod !== undefined ? p.solvedInPeriod : (p.dailySolved || 0);
                const periodText = period === 'today' ? 'today' : period === '7d' ? 'this week' : 'this month';
                return (
                  <div key={p.id} className="flex items-center gap-2 mb-2.5 cursor-pointer"
                    onClick={() => navigate(`/hod/student/${p.id}`)}>
                    <span className="text-sm font-bold w-5 flex-shrink-0" style={{ color: i===0?'#C58A22':i===1?'#6B7280':'#9CA3AF' }}>
                      {i===0?'🥇':i===1?'🥈':'🥉'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate hover:text-[#C58A22] transition-colors" style={{ color: '#1F2933' }}>{p.name}</div>
                      <div className="text-[11px] truncate" style={{ color: '#6B7280' }}>
                        {p.rollNumber} {p.leetcodeUsername ? `· @${p.leetcodeUsername}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: count > 0 ? '#16A34A' : '#6B7280', flexShrink: 0 }}>
                      {count > 0 ? `+${count}` : '0'} {periodText}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Attention / Sync Status Row */}
      {attentionStudents.length > 0 && (
        <div className="rounded-xl p-5 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#1F2933' }}>
              <AlertTriangle size={15} color="#E59A32" /> Profiles Needing Sync Attention
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/hod/import')}>Manage Rosters</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionStudents.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#F3F4F6] hover:bg-[#F9FAFB] cursor-pointer"
                onClick={() => navigate(`/hod/student/${s.id}`)}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: '#FBF0F0', color: '#D85C5C' }}>
                  {s.name?.charAt(0) || 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#1F2933' }}>{s.name}</div>
                  <div className="text-xs" style={{ color: '#6B7280' }}>{s.rollNumber} · Year {s.year}</div>
                </div>
                <div className="text-right">
                  <span className="badge" style={{ background: '#FBF0F0', color: '#D85C5C', fontSize: '11px' }}>
                    {s.syncStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
