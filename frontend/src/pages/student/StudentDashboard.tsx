import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import ActivityHeatmap from '../../components/ui/ActivityHeatmap';
import DifficultyBar from '../../components/ui/DifficultyBar';
import RatingBadge from '../../components/ui/RatingBadge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExternalLink, TrendingUp, Trophy, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const API = '/api/v1';

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <p style={{ color: '#1F2933', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: '13px', fontWeight: 500, margin: 0 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function StudentDashboard() {
  const { user, token } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStudentProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const studentId = user?.studentId || user?.id || 1;
      const res = await fetch(`${API}/students/${studentId}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
      } else {
        setError(json.error?.message || json.message || 'Failed to load student profile.');
      }
    } catch {
      setError('Network error — unable to load student dashboard.');
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => {
    fetchStudentProfile();
  }, [fetchStudentProfile]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-[#E5E7EB] animate-fade-in">
        <Loader2 size={26} className="animate-spin text-[#C58A22]" />
        <span className="text-sm font-semibold text-[#6B7280]">Loading student profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FBF0F0] text-[#D85C5C] text-sm font-semibold border border-[#FCA5A5]">
          <AlertCircle size={20} />
          <span>{error || 'No student data found.'}</span>
        </div>
        <button
          onClick={fetchStudentProfile}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const st = profile.student || profile;
  const stats = profile.stats || {};
  const totalSolved = stats.totalSolved || profile.totalSolved || 0;
  const easySolved = stats.easySolved || profile.easySolved || 0;
  const mediumSolved = stats.mediumSolved || profile.mediumSolved || 0;
  const hardSolved = stats.hardSolved || profile.hardSolved || 0;
  const contestRating = Math.round(stats.contestRating || profile.contestRating || 0);

  const snaps = profile.snapshots || [];
  const progressData = snaps.map((s: any) => ({
    date: new Date(s.snapshot_date || s.date).toLocaleString('default', { month: 'short' }),
    Solved: s.total_solved || s.totalSolved,
  }));

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Welcome banner */}
      <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm" style={{ borderTop: '3px solid #C58A22' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold bg-[#FDF8EC] text-[#C58A22] border border-[#F5E6C8]">
              {st.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1F2933]">Welcome back, {st.name?.split(' ')[0]}!</h1>
              <p className="text-sm text-[#6B7280]">{st.rollNumber || st.roll_number} · Year {st.yearOfStudy || st.year_of_study || 4}</p>
              <p className="text-xs mt-0.5 text-[#9CA3AF]">Proctor: {st.proctorName || 'Dr. Anitha Kumar'}</p>
            </div>
          </div>
          {st.leetcodeUsername && (
            <a
              href={`https://leetcode.com/u/${st.leetcodeUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[#1F2933] text-xs font-semibold hover:bg-[#FAFAFA] flex items-center gap-1.5 shadow-sm transition-all"
            >
              <ExternalLink size={13} /> @{st.leetcodeUsername}
            </a>
          )}
        </div>
      </div>

      {/* Solved stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 text-center bg-white border border-[#E5E7EB] shadow-sm">
          <div className="text-3xl font-bold text-[#1F2933]">{totalSolved}</div>
          <div className="text-xs font-semibold uppercase tracking-wider mt-1 text-[#6B7280]">Total Solved</div>
        </div>
        <div className="rounded-2xl p-4 text-center bg-[#EEF6F1] border border-[#C6E7D0]">
          <div className="text-3xl font-bold text-[#4F8A63]">{easySolved}</div>
          <div className="text-xs font-semibold uppercase tracking-wider mt-1 text-[#6B7280]">Easy</div>
        </div>
        <div className="rounded-2xl p-4 text-center bg-[#FFF9EC] border border-[#F5E6C8]">
          <div className="text-3xl font-bold text-[#B98228]">{mediumSolved}</div>
          <div className="text-xs font-semibold uppercase tracking-wider mt-1 text-[#6B7280]">Medium</div>
        </div>
        <div className="rounded-2xl p-4 text-center bg-[#FBF0F0] border border-[#FCA5A5]">
          <div className="text-3xl font-bold text-[#D85C5C]">{hardSolved}</div>
          <div className="text-xs font-semibold uppercase tracking-wider mt-1 text-[#6B7280]">Hard</div>
        </div>
      </div>

      {/* Contest + Difficulty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#1F2933]">
            <Trophy size={14} color="#C58A22" /> Contest Rating
          </h3>
          <RatingBadge rating={contestRating} size="lg" />
          <div className="mt-4 space-y-0">
            <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
              <span className="text-sm text-[#6B7280]">Global Rank</span>
              <span className="text-sm font-semibold text-[#1F2933]">
                {stats.ranking ? `#${stats.ranking.toLocaleString()}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
              <span className="text-sm text-[#6B7280]">Today Solved (from 5:30 AM IST)</span>
              <span className={`text-sm font-bold ${stats.dailySolved === null ? 'text-[#9CA3AF]' : 'text-[#C58A22]'}`}>
                {stats.dailySolved === null ? '—' : `+${stats.dailySolved || 0}`}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
          <h3 className="text-sm font-bold mb-4 text-[#1F2933]">Difficulty Breakdown</h3>
          <DifficultyBar easy={easySolved} medium={mediumSolved} hard={hardSolved} size="lg" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { l: 'Easy', v: easySolved, c: '#4F8A63', bg: '#EEF6F1' },
              { l: 'Medium', v: mediumSolved, c: '#C58A22', bg: '#FFF9EC' },
              { l: 'Hard', v: hardSolved, c: '#D85C5C', bg: '#FBF0F0' }
            ].map(d => (
              <div key={d.l} className="text-center p-3 rounded-xl border border-[#E5E7EB]" style={{ background: d.bg }}>
                <div className="font-bold text-lg" style={{ color: d.c }}>{d.v.toLocaleString()}</div>
                <div className="text-xs font-semibold text-[#6B7280]">{d.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress chart */}
      {progressData.length > 0 && (
        <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#1F2933]">
            <TrendingUp size={14} color="#C58A22" /> Progress Over Time
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} />
              <Line type="monotone" dataKey="Solved" stroke="#C58A22" strokeWidth={2.5} dot={{ fill: '#C58A22', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Activity heatmap */}
      {profile.calendarActivity && (
        <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
          <ActivityHeatmap activity={profile.calendarActivity} weeks={26} />
        </div>
      )}
    </div>
  );
}
