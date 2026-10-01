import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Users,
  ChevronRight,
  Loader2,
  AlertCircle,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const API = '/api/v1';

export interface PastContestItem {
  id?: string;
  contestName: string;
  contestNumber: number | null;
  contestSlug: string;
  contestType: string;
  contestDate: string;
  status: 'upcoming' | 'active' | 'completed';
  questionsCount: number;
  totalStudents: number;
  attended: number;
  notAttended: number;
  attendancePercentage: number;
  averageSolved: number;
  isManaged: boolean;
}

interface PastContestsAnalysisProps {
  selectedYear?: number;
  onSelectContest?: (contestSlug: string) => void;
}

export default function PastContestsAnalysis({
  selectedYear,
  onSelectContest,
}: PastContestsAnalysisProps) {
  const { token } = useAuthStore();
  const navigate = useNavigate();

  const [contests, setContests] = useState<PastContestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingSlug, setDownloadingSlug] = useState<string | null>(null);

  const fetchPastContests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedYear !== undefined) params.set('year', String(selectedYear));

      const res = await fetch(`${API}/analytics/contests?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setContests(json.data?.contests || []);
      } else {
        setError(json.error?.message || json.message || 'Failed to load past contests.');
      }
    } catch {
      setError('Network error — could not load past contests.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, token]);

  useEffect(() => {
    fetchPastContests();
  }, [fetchPastContests]);

  const handleDownloadExcel = async (e: React.MouseEvent, contestSlug: string) => {
    e.stopPropagation();
    setDownloadingSlug(contestSlug);
    try {
      const res = await fetch(`${API}/analytics/contests/${contestSlug}/export?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contest_Report_${contestSlug}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download contest report.');
    } finally {
      setDownloadingSlug(null);
    }
  };

  const handleViewContest = (contestSlug: string) => {
    if (onSelectContest) {
      onSelectContest(contestSlug);
    } else {
      navigate(`/hod/contests/${contestSlug}?year=${selectedYear}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#1F2933] flex items-center gap-2">
            <History size={20} color="#C58A22" /> Past Contests
          </h3>
          <p className="text-xs text-[#6B7280]">
            Complete historical contest records, attendance, and student performance
          </p>
        </div>
        {!loading && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-[#C58A22] border border-amber-200">
            {contests.length} Contests
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#9CA3AF] gap-2 bg-white rounded-2xl border border-[#E5E7EB]">
          <Loader2 size={22} className="animate-spin text-[#C58A22]" /> Loading past contests...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl flex items-center justify-between bg-[#FBF0F0] text-[#D85C5C] text-sm border border-[#FCA5A5]">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
          <button
            onClick={fetchPastContests}
            className="px-3 py-1 bg-[#D85C5C] text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : contests.length === 0 ? (
        <div className="text-center py-12 text-[#9CA3AF] text-sm bg-white rounded-2xl border border-[#E5E7EB]">
          No past contest records available.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contests.map((c) => {
            const isUpcoming = c.status === 'upcoming';
            const isActive = c.status === 'active';

            return (
              <div
                key={c.contestSlug}
                onClick={() => handleViewContest(c.contestSlug)}
                className="group p-5 rounded-2xl bg-white border border-[#E5E7EB] hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        c.contestType === 'biweekly'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {c.contestType}
                    </span>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isUpcoming
                          ? 'bg-amber-100 text-amber-800'
                          : isActive
                          ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {isUpcoming ? '🟡 Upcoming' : isActive ? '🟢 Active' : '✓ Completed'}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-[#1F2933] group-hover:text-[#C58A22] transition-colors">
                    {c.contestName}
                  </h4>

                  <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-[#9CA3AF]" />
                      {new Date(c.contestDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span>•</span>
                    <span>{c.questionsCount} Questions</span>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F3F4F6] text-center">
                  <div className="p-2 rounded-xl bg-[#FAFAFA]">
                    <div className="text-[10px] uppercase font-bold text-[#9CA3AF]">Attended</div>
                    <div className="text-sm font-bold text-[#1F2933] mt-0.5">
                      {c.attended} <span className="text-[10px] text-[#9CA3AF]">/ {c.totalStudents}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#FAFAFA]">
                    <div className="text-[10px] uppercase font-bold text-[#9CA3AF]">Attendance</div>
                    <div className="text-sm font-bold text-[#4F8A63] mt-0.5">
                      {c.attendancePercentage}%
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#FAFAFA]">
                    <div className="text-[10px] uppercase font-bold text-[#9CA3AF]">Avg Solved</div>
                    <div className="text-sm font-bold text-[#C58A22] mt-0.5">
                      {c.averageSolved}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewContest(c.contestSlug);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Eye size={13} /> View Contest
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDownloadExcel(e, c.contestSlug)}
                    disabled={downloadingSlug === c.contestSlug}
                    className="py-2 px-3 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#1F2933] text-xs font-semibold transition-all flex items-center gap-1.5"
                    title="Download Excel Report"
                  >
                    {downloadingSlug === c.contestSlug ? (
                      <Loader2 size={13} className="animate-spin text-[#C58A22]" />
                    ) : (
                      <Download size={13} />
                    )}
                    Report (.xlsx)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
