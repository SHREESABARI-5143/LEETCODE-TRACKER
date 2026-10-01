import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, RefreshCw } from 'lucide-react';
import RatingBadge from '../../components/ui/RatingBadge';
import { reportsApi, leaderboardApi } from '../../api/client';

const YEAR_COLORS: Record<number, string> = { 1:'#C58A22', 2:'#6BA66B', 3:'#E59A32', 4:'#D85C5C' };
const YEAR_LABELS: Record<number, string> = { 1:'1st Year', 2:'2nd Year', 3:'3rd Year', 4:'4th Year' };
const PERIODS = [{ v:'today', l:'Today' }, { v:'7d', l:'Last 7 Days' }, { v:'30d', l:'Last 30 Days' }];

export default function DailyRankings() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('today');
  const [performersByYear, setPerformersByYear] = useState<any[]>([]);
  const [overallTop10, setOverallTop10] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const [perfRes, leaderRes] = await Promise.all([
        reportsApi.getDailyPerformers(period),
        leaderboardApi.getLeaderboard({ limit: 10 })
      ]);

      if (perfRes.data && Array.isArray(perfRes.data)) {
        setPerformersByYear(perfRes.data);
      }
      if (leaderRes.data?.leaderboard) {
        setOverallTop10(leaderRes.data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to load daily rankings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [period]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" style={{ color: '#1F2933' }}>
            <TrendingUp size={24} color="#C58A22" /> Daily Top Performers
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Rankings updated live from LeetCode sync</p>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
          {PERIODS.map(p => (
            <button key={p.v} onClick={() => setPeriod(p.v)}
              className="px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: period===p.v ? '#C58A22' : 'transparent',
                color: period===p.v ? '#FFFFFF' : '#6B7280',
                border:'none', cursor:'pointer'
              }}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1,2,3,4].map(y => {
          const yearData = performersByYear.find(p => p.year === y);
          const performers = yearData?.performers || [];
          const color = YEAR_COLORS[y];
          return (
            <div key={y} className="rounded-xl p-5 card" style={{ borderTop: `3px solid ${color}` }}>
              {/* Year header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="font-semibold text-sm" style={{ color: '#1F2933' }}>{YEAR_LABELS[y]}</span>
              </div>

              {performers.length === 0 && (
                <p className="text-sm py-8 text-center" style={{ color: '#9CA3AF' }}>No activity data</p>
              )}

              {performers.map((p: any, i: number) => {
                const count = p.solvedInPeriod !== undefined ? p.solvedInPeriod : (p.dailySolved || 0);
                const periodLabel = period === 'today' ? 'today' : period === '7d' ? 'this week' : 'this month';
                return (
                  <div key={p.id}
                    onClick={() => navigate(`/hod/student/${p.id}`)}
                    className="flex items-center gap-3 py-2.5 rounded-lg px-2 transition-colors hover:bg-gray-50 cursor-pointer"
                    style={{ borderBottom: i < performers.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    {/* Medal / Rank */}
                    <div className="w-6 text-base flex-shrink-0 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (
                        <span className="text-xs font-bold" style={{ color: '#9CA3AF' }}>#{i+1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ background: '#F5F1E8', color: '#C58A22' }}>
                      {p.name?.charAt(0) || 'S'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate hover:text-[#C58A22] transition-colors" style={{ color: '#1F2933' }}>
                        {p.name}
                      </div>
                      <div className="text-[11px] truncate flex items-center gap-1.5" style={{ color: '#6B7280' }}>
                        <span>{p.rollNumber}</span>
                        {p.leetcodeUsername && (
                          <a
                            href={`https://leetcode.com/u/${p.leetcodeUsername}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#C58A22] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{p.leetcodeUsername}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Score (Problems Solved Today / Period) */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold" style={{ color: count > 0 ? '#16A34A' : '#6B7280' }}>
                        {count > 0 ? `+${count}` : '0'}
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: count > 0 ? '#16A34A' : '#9CA3AF' }}>
                        {periodLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Overall top 10 */}
      <div className="rounded-xl p-5 card">
        <h3 className="text-sm font-bold mb-4" style={{ color: '#1F2933' }}>🏆 Overall Department Top 10</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Year</th>
              <th>Department</th>
              <th>Total Solved</th>
              <th>Easy</th>
              <th>Medium</th>
              <th>Hard</th>
              <th>Global Rank</th>
            </tr>
          </thead>
          <tbody>
            {overallTop10.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>
                  No students in leaderboard yet. Upload rosters to get started.
                </td>
              </tr>
            ) : (
              overallTop10.map((p, i) => (
                <tr key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/hod/student/${p.id}`)}>
                  <td className="font-bold" style={{ color: i===0?'#C58A22':i===1?'#6B7280':i===2?'#9CA3AF':'#9CA3AF' }}>
                    {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                  </td>
                  <td>
                    <div
                      className="text-sm font-semibold hover:text-[#C58A22] hover:underline transition-colors"
                      style={{ color: '#1F2933' }}
                    >
                      {p.name}
                    </div>
                    <a
                      href={`https://leetcode.com/u/${p.leetcodeUsername}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#C58A22] hover:underline block transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{p.leetcodeUsername}
                    </a>
                  </td>
                  <td><span className="badge badge-neutral" style={{ fontSize: '11px' }}>Year {p.year}</span></td>
                  <td style={{ color: '#1F2933' }}>{p.departmentCode || p.departmentName || 'CSE'}</td>
                  <td className="font-bold" style={{ color: '#C58A22' }}>{p.totalSolved}</td>
                  <td style={{ color: '#4F8A63' }}>{p.easySolved}</td>
                  <td style={{ color: '#E59A32' }}>{p.mediumSolved}</td>
                  <td style={{ color: '#D85C5C' }}>{p.hardSolved}</td>
                  <td style={{ color: '#6B7280', fontSize: '12px' }}>{p.ranking ? `#${p.ranking.toLocaleString()}` : 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
