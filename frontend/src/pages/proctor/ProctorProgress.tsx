import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import DifficultyBar from '../../components/ui/DifficultyBar';
import { Loader2, AlertCircle, RefreshCw, Activity, Star } from 'lucide-react';

const API = '/api/v1';

export default function ProctorProgress() {
  const { token } = useAuthStore();
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
        setError(json.error?.message || json.message || 'Failed to load progress.');
      }
    } catch {
      setError('Network error — unable to load progress.');
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
        <span className="text-sm font-semibold text-[#6B7280]">Loading progress...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FBF0F0] text-[#D85C5C] text-sm font-semibold border border-[#FCA5A5]">
          <AlertCircle size={20} />
          <span>{error || 'No progress data found.'}</span>
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

  const { stats, students } = data;
  const topStudents = [...students].sort((a: any, b: any) => (b.totalSolved || 0) - (a.totalSolved || 0)).slice(0, 10);

  const totalEasy = stats?.totalEasy || 0;
  const totalMedium = stats?.totalMedium || 0;
  const totalHard = stats?.totalHard || 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
            <Activity size={24} color="#4F8A63" /> Batch Progress
          </h1>
          <p className="text-sm mt-1 text-gray-500">Track overall difficulty breakdown and top performers.</p>
        </div>
      </div>

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
            <Star size={15} color="#C58A22" /> Top 10 Performers
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
                  <span className="text-lg w-7 flex-shrink-0 text-center font-bold text-gray-400">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#1F2933] truncate">{s.name}</div>
                    <div className="text-xs text-[#6B7280]">{s.registerNo}</div>
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
    </div>
  );
}
