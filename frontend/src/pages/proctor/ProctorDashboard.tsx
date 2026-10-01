import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import StudentTable from '../../components/ui/StudentTable';
import KPICard from '../../components/ui/KPICard';
import { Users, Activity, Target, Trophy, AlertTriangle, Star, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import DifficultyBar from '../../components/ui/DifficultyBar';

const API = '/api/v1';

export default function ProctorDashboard() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/analytics/proctors/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error?.message || json.message || 'Failed to load proctor dashboard.');
      }
    } catch {
      setError('Network error — unable to load proctor dashboard.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-[#E5E7EB] animate-fade-in">
        <Loader2 size={26} className="animate-spin text-[#C58A22]" />
        <span className="text-sm font-semibold text-[#6B7280]">Loading proctor dashboard...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FBF0F0] text-[#D85C5C] text-sm font-semibold border border-[#FCA5A5]">
          <AlertCircle size={20} />
          <span>{error || 'No proctor data found.'}</span>
        </div>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { proctor, stats, students } = data;

  const active = students.filter((s: any) => s.status === 'active');
  const attention = students.filter((s: any) => s.status === 'attention');
  const inactive = students.filter((s: any) => s.status === 'inactive');
  const topStudents = [...students].sort((a: any, b: any) => (b.totalSolved || 0) - (a.totalSolved || 0)).slice(0, 3);

  const totalEasy = stats?.totalEasy || 0;
  const totalMedium = stats?.totalMedium || 0;
  const totalHard = stats?.totalHard || 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm" style={{ borderTop: '3px solid #C58A22' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1 text-[#C58A22]">Proctor Dashboard</div>
            <h1 className="text-2xl font-bold text-[#1F2933]">{proctor?.name}</h1>
            <p className="text-sm text-[#6B7280]">{proctor?.designation} · {proctor?.email}</p>
          </div>
          <div className="text-right sm:text-right text-left">
            <div className="text-3xl font-bold text-[#C58A22]">{students.length}</div>
            <div className="text-xs text-[#6B7280]">assigned students</div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Students" value={students.length} icon={<Users />} />
        <KPICard label="Active Students" value={active.length}
          sub={`${students.length > 0 ? Math.round(active.length / students.length * 100) : 0}% active`}
          icon={<Activity />} color="#4F8A63" />
        <KPICard label="Avg Solved" value={stats?.avgSolved || 0} icon={<Target />} color="#C58A22" />
        <KPICard label="Avg Contest Rating" value={stats?.avgContestRating || 0} icon={<Trophy />} color="#7C3AED" />
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4 text-center bg-[#EEF6F1] border border-[#C6E7D0]">
          <div className="text-2xl font-bold text-[#4F8A63]">{active.length}</div>
          <div className="text-xs font-semibold mt-1 text-[#6B7280]">Active</div>
        </div>
        <div className="rounded-xl p-4 text-center bg-[#FFF9EC] border border-[#F5E6C8]">
          <div className="text-2xl font-bold text-[#B98228]">{attention.length}</div>
          <div className="text-xs font-semibold mt-1 text-[#6B7280]">Need Attention</div>
        </div>
        <div className="rounded-xl p-4 text-center bg-[#FBF0F0] border border-[#FCA5A5]">
          <div className="text-2xl font-bold text-[#D85C5C]">{inactive.length}</div>
          <div className="text-xs font-semibold mt-1 text-[#6B7280]">Inactive</div>
        </div>
      </div>

      {/* Difficulty breakdown + Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
          <h3 className="text-sm font-bold mb-4 text-[#1F2933]">Group Difficulty Breakdown</h3>
          <DifficultyBar easy={totalEasy} medium={totalMedium} hard={totalHard} size="lg" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { l: 'Easy', v: totalEasy, c: '#4F8A63', bg: '#EEF6F1' },
              { l: 'Medium', v: totalMedium, c: '#C58A22', bg: '#FFF9EC' },
              { l: 'Hard', v: totalHard, c: '#D85C5C', bg: '#FBF0F0' }
            ].map(d => (
              <div key={d.l} className="text-center p-3 rounded-xl border border-[#E5E7EB]" style={{ background: d.bg }}>
                <div className="font-bold text-lg" style={{ color: d.c }}>{d.v.toLocaleString()}</div>
                <div className="text-xs font-semibold text-[#6B7280]">{d.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#1F2933]">
            <Star size={15} color="#C58A22" /> Top Performers
          </h3>
          <div className="space-y-3">
            {topStudents.length === 0 ? (
              <div className="text-xs text-[#9CA3AF] py-6 text-center">No student records available yet.</div>
            ) : (
              topStudents.map((s: any, i: number) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors border border-[#E5E7EB]"
                  onClick={() => navigate(`/proctor/student/${s.id}`)}
                >
                  <span className="text-lg w-7 flex-shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#1F2933]">{s.name}</div>
                    <div className="text-xs text-[#6B7280]">{s.registerNo} · @{s.leetcodeUsername}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#1F2933]">{s.totalSolved}</div>
                    <div className="text-xs text-[#6B7280]">solved</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Students Needing Attention */}
      {attention.length > 0 && (
        <div className="rounded-2xl p-5 border border-[#FCA5A5] bg-[#FBF0F0]">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#D85C5C]">
            <AlertTriangle size={15} color="#D85C5C" /> Students Needing Attention ({attention.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attention.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-[#FCA5A5] bg-white"
                onClick={() => navigate(`/proctor/student/${s.id}`)}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[#FFF9EC] text-[#B98228]">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1F2933]">{s.name}</div>
                  <div className="text-xs text-[#6B7280]">{s.totalSolved} solved · Rating: {s.contestRating}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF9EC] text-[#B98228] border border-[#F5E6C8]">
                  Attention
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All students table */}
      <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
        <h3 className="text-sm font-bold mb-4 text-[#1F2933]">All Assigned Students</h3>
        <StudentTable students={students} showRank navigateTo={(s) => `/proctor/student/${s.id}`} />
      </div>
    </div>
  );
}
