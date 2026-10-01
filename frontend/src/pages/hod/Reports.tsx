import React, { useState, useEffect } from 'react';
import { FileText, Download, TrendingUp } from 'lucide-react';
import { reportsApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const COLORS = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
  active: '#22c55e',
  pending: '#f59e0b',
  failed: '#ef4444',
  inactive: '#9ca3af',
  primary: '#C58A22',
  year1: '#3b82f6',
  year2: '#8b5cf6',
  year3: '#ec4899',
  year4: '#14b8a6',
};

const EmptyChartState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-full w-full bg-gray-50 rounded-lg text-gray-400 text-sm italic">
    {message}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600 capitalize">{entry.name}:</span>
            <span className="font-bold text-gray-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const { user } = useAuthStore();
  const [reportType, setReportType] = useState<'daily'|'weekly'|'monthly'>('daily');
  const [loading, setLoading] = useState<boolean>(true);
  
  const [overall, setOverall] = useState<any>(null);
  const [yearWise, setYearWise] = useState<any[]>([]);
  const [deptComparison, setDeptComparison] = useState<any[]>([]);

  const today = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const isAdminOrPlacement = user?.role === 'admin' || user?.role === 'placement';

  const fetchReports = async () => {
    setLoading(true);
    try {
      const promises = [reportsApi.getOverall(), reportsApi.getYearWise()];
      if (isAdminOrPlacement) {
        promises.push(reportsApi.getDepartmentComparison());
      }
      
      const results = await Promise.all(promises);
      
      if (results[0].data) setOverall(results[0].data);
      if (results[1].data) setYearWise(results[1].data);
      if (isAdminOrPlacement && results[2]?.data) {
        setDeptComparison(results[2].data);
      }
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportType]);

  const handleExport = () => {
    const url = reportsApi.getExportUrl();
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CodeTrack_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-xl"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!overall) return <div className="text-gray-500">Failed to load dashboard.</div>;

  const difficultyData = [
    { name: 'Easy', value: overall.difficultyBreakdown?.easy || 0, color: COLORS.easy },
    { name: 'Medium', value: overall.difficultyBreakdown?.medium || 0, color: COLORS.medium },
    { name: 'Hard', value: overall.difficultyBreakdown?.hard || 0, color: COLORS.hard },
  ].filter(d => d.value > 0);

  const syncHealthData = [
    { name: 'Success', count: overall.syncHealth?.Success || 0, color: COLORS.active },
    { name: 'Pending', count: overall.syncHealth?.Pending || 0, color: COLORS.pending },
    { name: 'Failed', count: overall.syncHealth?.Failed || 0, color: COLORS.failed },
  ];

  const trendData = overall.trendData || [];
  const contestTrend = overall.contestTrend || [];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
            <FileText size={24} color={COLORS.primary} /> Reports
          </h1>
          <p className="text-sm mt-1 text-gray-500">{today}</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white">
            {(['daily','weekly','monthly'] as const).map(t => (
              <button key={t} onClick={() => setReportType(t)}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition-all ${reportType === t ? 'bg-[#C58A22] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={handleExport} className="btn btn-secondary btn-sm flex items-center gap-1.5 shadow-sm cursor-pointer">
            <Download size={14}/> Export Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Enrolled', value: overall.totalStudents || 0, color: '#374151', bg: '#f3f4f6' },
          { label: 'Active Students', value: overall.activeStudents || 0, color: COLORS.active, bg: '#f0fdf4' },
          { label: 'Total Solved', value: overall.totalSolved || 0, color: COLORS.primary, bg: '#fef3c7' },
          { label: 'Avg Solved / Student', value: overall.avgSolved || 0, color: '#6366f1', bg: '#e0e7ff' },
          { label: 'Sync Health %', value: `${overall.analyzedPercentage}%`, color: COLORS.active, bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} className="p-5 rounded-xl border border-gray-100 shadow-sm" style={{ backgroundColor: s.bg }}>
            <div className="text-3xl font-bold tracking-tight mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overall Report Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Overall Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Difficulty Split (Donut) */}
          <div className="card p-5 bg-white shadow-sm border border-gray-100 rounded-xl lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-600 mb-4">Total Solved Breakdown</h3>
            <div className="h-64 relative">
              {difficultyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={difficultyData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                      {difficultyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No solved problems recorded yet." />
              )}
              {difficultyData.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                  <span className="text-2xl font-bold text-gray-800">{overall.totalSolved}</span>
                  <span className="text-[10px] text-gray-400 font-semibold uppercase">Total</span>
                </div>
              )}
            </div>
          </div>

          {/* Sync Health (Bar) */}
          <div className="card p-5 bg-white shadow-sm border border-gray-100 rounded-xl lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-600 mb-4">Sync Health Status</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={syncHealthData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} width={60} />
                  <RechartsTooltip cursor={{fill: '#f9fafb'}} content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {syncHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Line */}
          <div className="card p-5 bg-white shadow-sm border border-gray-100 rounded-xl lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-600 mb-4 flex justify-between">
              <span>Total Solved Trend (30 Days)</span>
              <TrendingUp size={16} className="text-gray-400" />
            </h3>
            <div className="h-64">
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="totalSolved" name="Total Solved" stroke={COLORS.primary} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: COLORS.primary, stroke: '#fff', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="Not enough history yet — check back after a few days of syncing." />
              )}
            </div>
          </div>
          
        </div>
      </div>

      {/* Year-wise Report Section */}
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Year-wise Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Key Metrics Grouped Bar */}
          <div className="card p-5 bg-white shadow-sm border border-gray-100 rounded-xl lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-600 mb-4">Performance & Engagement across Cohorts</h3>
            <div className="h-72">
              {yearWise.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearWise} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <RechartsTooltip cursor={{fill: '#f9fafb'}} content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="avgSolved" name="Avg Solved" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="activePercentage" name="Active %" fill={COLORS.active} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="attendancePercentage" name="Contest Attendance %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No year-wise data available." />
              )}
            </div>
          </div>

          {/* Difficulty Breakdown Stacked */}
          <div className="card p-5 bg-white shadow-sm border border-gray-100 rounded-xl lg:col-span-1">
            <h3 className="text-sm font-bold text-gray-600 mb-4">Difficulty Distribution</h3>
            <div className="h-72">
               {yearWise.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearWise} layout="vertical" margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="label" type="category" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} axisLine={false} width={60} />
                    <RechartsTooltip cursor={{fill: '#f9fafb'}} content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="avgEasy" name="Easy" stackId="a" fill={COLORS.easy} />
                    <Bar dataKey="avgMedium" name="Medium" stackId="a" fill={COLORS.medium} />
                    <Bar dataKey="avgHard" name="Hard" stackId="a" fill={COLORS.hard} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No difficulty data available." />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Department Comparison (Admin Only) */}
      {isAdminOrPlacement && (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center justify-between">
            <span>Department Comparison</span>
            <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded">ADMIN ONLY</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Dept Total Solved (Bar) */}
            <div className="card p-5 bg-white shadow-sm border border-gray-100 rounded-xl lg:col-span-2">
              <h3 className="text-sm font-bold text-gray-600 mb-4">Total Solved by Department</h3>
              <div className="h-72">
                {deptComparison.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptComparison} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="code" tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <RechartsTooltip cursor={{fill: '#f9fafb'}} content={<CustomTooltip />} />
                      <Bar dataKey="totalSolved" name="Total Solved" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message="No department data available." />
                )}
              </div>
            </div>

            {/* Dept Radar */}
            <div className="card p-5 bg-white shadow-sm border border-gray-100 rounded-xl lg:col-span-1">
              <h3 className="text-sm font-bold text-gray-600 mb-4">KPI Radar</h3>
              <div className="h-72">
                {deptComparison.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={deptComparison}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="code" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Radar name="Active %" dataKey="activePercentage" stroke={COLORS.active} fill={COLORS.active} fillOpacity={0.3} />
                      <Radar name="Attendance %" dataKey="attendancePercentage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message="Not enough data for radar." />
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
