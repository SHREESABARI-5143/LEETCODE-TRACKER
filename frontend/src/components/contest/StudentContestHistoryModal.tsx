import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Download,
  Calendar,
  Loader2,
  AlertCircle,
  User,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const API = '/api/v1';

interface StudentHistoryData {
  student: {
    id: string;
    name: string;
    registerNumber: string;
    leetcodeUsername: string;
    year: number;
    section: string;
    proctorName: string;
    collegeEmail: string;
  };
  currentContest: {
    contestName: string;
    contestSlug: string;
    contestType: string;
    contestDate: string;
    status: 'Attended' | 'Not Attended';
    rank: number | null;
    problemsSolved: number;
    totalProblems: number;
    solvePercentage: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    rankImprovementPct: number | null;
    solvedDelta: number | null;
    exactProblems: Array<{
      orderNum: number;
      title: string;
      slug: string;
      difficulty: string;
      solved: boolean;
    }>;
  } | null;
  history: Array<{
    contestName: string;
    contestSlug: string;
    contestType: string;
    contestDate: string;
    status: 'Attended' | 'Not Attended';
    rank: number | null;
    problemsSolved: number;
    totalProblems: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    rating: number;
    ratingChange: number;
    previousRank: number | null;
    rankImprovementPct: number | null;
    solvedDelta: number | null;
  }>;
}

interface StudentContestHistoryModalProps {
  studentId: string | null;
  contestSlug?: string;
  onClose: () => void;
}

export default function StudentContestHistoryModal({
  studentId,
  contestSlug,
  onClose,
}: StudentContestHistoryModalProps) {
  const { token } = useAuthStore();

  const [data, setData] = useState<StudentHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!studentId) return;

    const fetchStudentHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (contestSlug) params.set('contestSlug', contestSlug);

        const res = await fetch(`${API}/analytics/students/${studentId}/contest-history?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error?.message || json.message || 'Failed to fetch student performance data');
        }
      } catch {
        setError('Network error — unable to load student contest details.');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentHistory();
  }, [studentId, contestSlug, token]);

  const handleDownloadReport = async () => {
    if (!studentId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (contestSlug) params.set('contestSlug', contestSlug);

      const res = await fetch(`${API}/analytics/students/${studentId}/contest-report?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Student_Report_${data?.student.registerNumber || studentId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download student report.');
    } finally {
      setDownloading(false);
    }
  };

  if (!studentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white text-[#1F2933] rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAFAF9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5F1E8] border border-[#C58A22]/30 flex items-center justify-center text-[#C58A22]">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#1F2933]">
                {data ? data.student.name : 'Student Contest Performance'}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-0.5">
                <span>{data?.student.registerNumber}</span>
                <span>•</span>
                <span>Year {data?.student.year} ({data?.student.section})</span>
                <span>•</span>
                <span>Proctor: {data?.student.proctorName}</span>
                <span>•</span>
                <span className="font-mono text-[#C58A22]">@{data?.student.leetcodeUsername}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={handleDownloadReport}
                disabled={downloading}
                className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#374151] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                {downloading ? (
                  <Loader2 size={13} className="animate-spin text-[#C58A22]" />
                ) : (
                  <Download size={13} className="text-[#C58A22]" />
                )}
                Download Report (.xlsx)
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2933] hover:bg-[#F3F4F6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#6B7280] gap-2">
              <Loader2 size={24} className="animate-spin text-[#C58A22]" /> Loading student performance data...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-[#FBF0F0] border border-[#FCA5A5] flex items-center gap-2 text-[#D85C5C] text-sm">
              <AlertCircle size={18} /> {error}
            </div>
          ) : data ? (
            <>
              {/* Current Contest Overview */}
              {data.currentContest && (
                <div className="p-5 rounded-2xl bg-[#FAFAF9] border border-[#E5E7EB] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                    <div>
                      <span className="text-[11px] font-bold text-[#C58A22] uppercase tracking-wider">
                        Current Contest Performance
                      </span>
                      <h3 className="text-base font-bold text-[#1F2933] mt-0.5">
                        {data.currentContest.contestName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          data.currentContest.status === 'Attended'
                            ? 'bg-[#EEF6F1] text-[#4F8A63] border border-[#4F8A63]/30'
                            : 'bg-gray-100 text-[#6B7280]'
                        }`}
                      >
                        {data.currentContest.status}
                      </span>
                      {data.currentContest.rank ? (
                        <span className="px-3 py-1 rounded-full bg-[#FDF8EC] text-[#C58A22] border border-[#C58A22]/30 font-bold text-xs">
                          Rank #{data.currentContest.rank}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-[#6B7280] font-medium text-xs">
                          Rank unavailable
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Solved Stats & Improvement Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] shadow-sm">
                      <div className="text-xs text-[#6B7280]">Problems Solved</div>
                      <div className="text-xl font-bold text-[#1F2933] mt-0.5">
                        {data.currentContest.problemsSolved} / {data.currentContest.totalProblems}
                        <span className="text-xs font-normal text-[#6B7280] ml-1.5">
                          ({data.currentContest.solvePercentage}%)
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] shadow-sm">
                      <div className="text-xs text-[#6B7280]">Difficulty Split</div>
                      <div className="flex items-center gap-2 mt-1 text-xs font-bold">
                        <span className="text-[#4F8A63]">E: {data.currentContest.easyCount}</span>
                        <span className="text-[#C58A22]">M: {data.currentContest.mediumCount}</span>
                        <span className="text-[#D85C5C]">H: {data.currentContest.hardCount}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] shadow-sm">
                      <div className="text-xs text-[#6B7280]">Rank Improvement</div>
                      <div className="text-sm font-bold mt-1">
                        {data.currentContest.rankImprovementPct !== null ? (
                          data.currentContest.rankImprovementPct > 0 ? (
                            <span className="text-[#4F8A63] flex items-center gap-1">
                              <TrendingUp size={14} /> ↑ {data.currentContest.rankImprovementPct}% Improved
                            </span>
                          ) : data.currentContest.rankImprovementPct < 0 ? (
                            <span className="text-[#D85C5C] flex items-center gap-1">
                              <TrendingDown size={14} /> ↓ {Math.abs(data.currentContest.rankImprovementPct)}% Declined
                            </span>
                          ) : (
                            <span className="text-[#6B7280] flex items-center gap-1">
                              <Minus size={14} /> No Change
                            </span>
                          )
                        ) : (
                          <span className="text-[#9CA3AF] text-xs font-medium">First Contest Record</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] shadow-sm">
                      <div className="text-xs text-[#6B7280]">Solved Delta</div>
                      <div className="text-sm font-bold mt-1">
                        {data.currentContest.solvedDelta !== null ? (
                          <span
                            className={
                              data.currentContest.solvedDelta > 0
                                ? 'text-[#4F8A63]'
                                : data.currentContest.solvedDelta < 0
                                ? 'text-[#D85C5C]'
                                : 'text-[#6B7280]'
                            }
                          >
                            {data.currentContest.solvedDelta > 0 ? '+' : ''}
                            {data.currentContest.solvedDelta} problems vs prev
                          </span>
                        ) : (
                          <span className="text-[#9CA3AF] text-xs font-medium">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Exact Questions Solved in Current Contest */}
                  {data.currentContest.exactProblems && data.currentContest.exactProblems.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-semibold text-[#374151]">Questions in this contest:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.currentContest.exactProblems.map((ep) => (
                          <div
                            key={ep.orderNum}
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                              ep.solved
                                ? 'bg-[#EEF6F1] border-[#4F8A63]/30 text-[#1F2933]'
                                : 'bg-white border-[#E5E7EB] text-[#6B7280]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {ep.solved ? (
                                <CheckCircle2 size={15} className="text-[#4F8A63] shrink-0" />
                              ) : (
                                <XCircle size={15} className="text-[#9CA3AF] shrink-0" />
                              )}
                              <span className="font-semibold text-[#1F2933] truncate">
                                Q{ep.orderNum}. {ep.title}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 ${
                                ep.difficulty === 'Easy'
                                  ? 'bg-[#EEF6F1] text-[#4F8A63]'
                                  : ep.difficulty === 'Hard'
                                  ? 'bg-[#FBF0F0] text-[#D85C5C]'
                                  : 'bg-[#FDF8EC] text-[#C58A22]'
                              }`}
                            >
                              {ep.difficulty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Historical Contest Performance Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1F2933] flex items-center gap-2">
                    <Calendar size={15} className="text-[#C58A22]" /> Past Contest Performance History ({data.history.length})
                  </h3>
                  <span className="text-xs text-[#6B7280]">Sorted newest first</span>
                </div>

                {data.history.length === 0 ? (
                  <div className="text-center py-10 text-[#9CA3AF] text-xs bg-white rounded-xl border border-[#E5E7EB]">
                    No past contest records found for this student.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAFAF9] text-[#374151] font-semibold border-b border-[#E5E7EB]">
                          <th className="px-3.5 py-2.5">Contest</th>
                          <th className="px-3.5 py-2.5">Date</th>
                          <th className="px-3.5 py-2.5 text-center">Rank</th>
                          <th className="px-3.5 py-2.5 text-center">Solved</th>
                          <th className="px-3.5 py-2.5 text-center">E / M / H</th>
                          <th className="px-3.5 py-2.5 text-center">Rating</th>
                          <th className="px-3.5 py-2.5 text-center">Rank Improvement %</th>
                          <th className="px-3.5 py-2.5 text-center">Solved Δ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {data.history.map((h, i) => {
                          const hasRankImp = h.rankImprovementPct !== null;
                          return (
                            <tr key={i} className="hover:bg-[#F9FAFB] transition-colors">
                              <td className="px-3.5 py-2.5 font-bold text-[#1F2933]">
                                {h.contestName}
                              </td>
                              <td className="px-3.5 py-2.5 text-[#6B7280]">
                                {new Date(h.contestDate).toLocaleDateString()}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-bold text-[#C58A22]">
                                {h.rank ? `#${h.rank}` : 'N/A'}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-semibold text-[#1F2933]">
                                {h.problemsSolved} / {h.totalProblems}
                              </td>
                              <td className="px-3.5 py-2.5 text-center text-[#6B7280]">
                                <span className="text-[#4F8A63]">{h.easyCount}</span> /{' '}
                                <span className="text-[#C58A22]">{h.mediumCount}</span> /{' '}
                                <span className="text-[#D85C5C]">{h.hardCount}</span>
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-mono text-[#1F2933] font-semibold">
                                {Math.round(h.rating)}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                {hasRankImp ? (
                                  h.rankImprovementPct! > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 text-[#4F8A63] font-bold">
                                      <TrendingUp size={12} /> ↑ {h.rankImprovementPct}%
                                    </span>
                                  ) : h.rankImprovementPct! < 0 ? (
                                    <span className="inline-flex items-center gap-0.5 text-[#D85C5C] font-bold">
                                      <TrendingDown size={12} /> ↓ {Math.abs(h.rankImprovementPct!)}%
                                    </span>
                                  ) : (
                                    <span className="text-[#6B7280]">0%</span>
                                  )
                                ) : (
                                  <span className="text-[#9CA3AF]">—</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-semibold">
                                {h.solvedDelta !== null ? (
                                  <span
                                    className={
                                      h.solvedDelta > 0
                                        ? 'text-[#4F8A63]'
                                        : h.solvedDelta < 0
                                        ? 'text-[#D85C5C]'
                                        : 'text-[#6B7280]'
                                    }
                                  >
                                    {h.solvedDelta > 0 ? '+' : ''}
                                    {h.solvedDelta}
                                  </span>
                                ) : (
                                  <span className="text-[#9CA3AF]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
