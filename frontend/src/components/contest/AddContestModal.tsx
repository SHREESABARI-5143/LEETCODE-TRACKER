import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  Trophy,
  Loader2,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const API = '/api/v1';

interface QuestionRow {
  id: string;
  orderNum: number;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  verified: boolean;
  isVerifying?: boolean;
  manualOverride?: boolean;
}

interface UpcomingContest {
  contestName: string;
  contestNumber: number | null;
  contestSlug: string;
  contestType: 'weekly' | 'biweekly';
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  status: 'upcoming' | 'active' | 'completed';
}

interface AddContestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContestCreated: (newContestSlug: string) => void;
}

export default function AddContestModal({
  isOpen,
  onClose,
  onContestCreated,
}: AddContestModalProps) {
  const { token } = useAuthStore();

  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [upcomingContest, setUpcomingContest] = useState<UpcomingContest | null>(null);

  // Form Fields
  const [contestName, setContestName] = useState('');
  const [contestNumber, setContestNumber] = useState<string>('');
  const [contestType, setContestType] = useState<'weekly' | 'biweekly'>('weekly');
  const [contestDate, setContestDate] = useState('');
  const [contestTime, setContestTime] = useState('');

  // Questions
  const [questions, setQuestions] = useState<QuestionRow[]>([
    { id: '1', orderNum: 1, title: '', slug: '', difficulty: 'Easy', verified: false },
    { id: '2', orderNum: 2, title: '', slug: '', difficulty: 'Medium', verified: false },
    { id: '3', orderNum: 3, title: '', slug: '', difficulty: 'Medium', verified: false },
    { id: '4', orderNum: 4, title: '', slug: '', difficulty: 'Hard', verified: false },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Auto-detect upcoming contest from backend
  const fetchUpcoming = useCallback(async () => {
    setLoadingUpcoming(true);
    try {
      const res = await fetch(`${API}/analytics/contests/upcoming`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        const u = json.data as UpcomingContest;
        setUpcomingContest(u);
        setContestName(u.contestName);
        setContestNumber(u.contestNumber ? String(u.contestNumber) : '');
        setContestType(u.contestType);

        if (u.startTime) {
          const dt = new Date(u.startTime);
          setContestDate(dt.toISOString().split('T')[0]);
          const hh = String(dt.getHours()).padStart(2, '0');
          const mm = String(dt.getMinutes()).padStart(2, '0');
          setContestTime(`${hh}:${mm}`);
        }
      }
    } catch {
      // fallback to manual mode gracefully
    } finally {
      setLoadingUpcoming(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      setFormError('');
      fetchUpcoming();
    }
  }, [isOpen, fetchUpcoming]);

  // Real-time verification of question title -> slug & difficulty
  const verifyQuestionRow = async (rowId: string, titleInput: string) => {
    if (!titleInput.trim()) return;

    setQuestions((prev) =>
      prev.map((q) => (q.id === rowId ? { ...q, isVerifying: true } : q))
    );

    try {
      const res = await fetch(`${API}/analytics/contests/verify-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: titleInput }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        const result = json.data;
        setQuestions((prev) =>
          prev.map((q) => {
            if (q.id === rowId) {
              return {
                ...q,
                slug: result.slug,
                difficulty: q.manualOverride ? q.difficulty : result.difficulty,
                verified: result.verified,
                isVerifying: false,
              };
            }
            return q;
          })
        );
      } else {
        setQuestions((prev) =>
          prev.map((q) => (q.id === rowId ? { ...q, isVerifying: false } : q))
        );
      }
    } catch {
      setQuestions((prev) =>
        prev.map((q) => (q.id === rowId ? { ...q, isVerifying: false } : q))
      );
    }
  };

  const handleTitleChange = (rowId: string, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === rowId ? { ...q, title: value, verified: false } : q))
    );
  };

  const handleTitleBlur = (rowId: string, value: string) => {
    verifyQuestionRow(rowId, value);
  };

  const handleDifficultyChange = (rowId: string, diff: 'Easy' | 'Medium' | 'Hard') => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === rowId ? { ...q, difficulty: diff, manualOverride: true } : q))
    );
  };

  const addQuestionRow = () => {
    const nextNum = questions.length + 1;
    setQuestions((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        orderNum: nextNum,
        title: '',
        slug: '',
        difficulty: 'Medium',
        verified: false,
      },
    ]);
  };

  const removeQuestionRow = (rowId: string) => {
    if (questions.length <= 1) return;
    const filtered = questions.filter((q) => q.id !== rowId);
    const reordered = filtered.map((q, idx) => ({ ...q, orderNum: idx + 1 }));
    setQuestions(reordered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!contestName.trim()) {
      setFormError('Please enter a contest name.');
      return;
    }
    const finalDate = contestDate || new Date().toISOString().split('T')[0];

    const filledQuestions = questions.filter((q) => q.title.trim() !== '');
    if (filledQuestions.length === 0) {
      setFormError('Please add at least one contest question.');
      return;
    }

    setSubmitting(true);

    try {
      const startDateTime = contestTime
        ? `${finalDate}T${contestTime}:00`
        : `${finalDate}T00:00:00`;

      const numParsed = contestNumber ? parseInt(contestNumber, 10) : undefined;

      const payload = {
        contestName: contestName.trim(),
        contestNumber: isNaN(numParsed!) ? undefined : numParsed,
        contestType,
        startTime: new Date(startDateTime).toISOString(),
        questions: filledQuestions.map((q, idx) => ({
          orderNum: idx + 1,
          title: q.title.trim(),
          slug: q.slug || undefined,
          difficulty: q.difficulty,
          verified: q.verified,
        })),
      };

      const res = await fetch(`${API}/analytics/contests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        onContestCreated(json.data.contestSlug);
        onClose();
      } else {
        setFormError(json.error?.message || json.message || 'Failed to save contest.');
      }
    } catch {
      setFormError('Network error — unable to create contest.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white text-[#1F2933] rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAFAF9]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F5F1E8] border border-[#C58A22]/30 flex items-center justify-center text-[#C58A22]">
              <Trophy size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#1F2933]">Create New Contest</h2>
              <p className="text-xs text-[#6B7280]">
                Automatic LeetCode contest detection & problem verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2933] hover:bg-[#F3F4F6] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between bg-[#F3F4F6] p-1.5 rounded-xl border border-[#E5E7EB]">
            <button
              type="button"
              onClick={() => {
                setMode('auto');
                if (upcomingContest) {
                  setContestName(upcomingContest.contestName);
                  setContestNumber(upcomingContest.contestNumber ? String(upcomingContest.contestNumber) : '');
                  setContestType(upcomingContest.contestType);
                } else {
                  fetchUpcoming();
                }
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'auto'
                  ? 'bg-[#C58A22] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#1F2933]'
              }`}
            >
              <Sparkles size={14} /> Automatic LeetCode Detection
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'manual'
                  ? 'bg-[#C58A22] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#1F2933]'
              }`}
            >
              <Edit3 size={14} /> Manual Contest Entry
            </button>
          </div>

          {/* Auto Detection Banner */}
          {mode === 'auto' && (
            <div className="p-4 rounded-xl bg-[#FDF8EC] border border-[#C58A22]/20 text-xs text-[#1F2933]">
              {loadingUpcoming ? (
                <div className="flex items-center gap-2 text-[#C58A22]">
                  <Loader2 size={16} className="animate-spin" /> Detecting next upcoming LeetCode contest...
                </div>
              ) : upcomingContest ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#C58A22] uppercase tracking-wider text-[11px] flex items-center gap-1">
                      <CheckCircle2 size={13} /> Next Upcoming LeetCode Contest
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#F5F1E8] text-[#C58A22] border border-[#C58A22]/30 font-bold capitalize text-[10px]">
                      {upcomingContest.contestType}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#1F2933]">
                    {upcomingContest.contestName} (#{upcomingContest.contestNumber})
                  </div>
                  <div className="text-[#6B7280] flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-[#C58A22]" />{' '}
                      {new Date(upcomingContest.startTime).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-[#C58A22]" />{' '}
                      {new Date(upcomingContest.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[#6B7280]">
                  Unable to connect to LeetCode API. You can switch to Manual Entry mode.
                </div>
              )}
            </div>
          )}

          {/* Contest Meta Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Contest Name <span className="text-[#C58A22]">*</span>
              </label>
              <input
                type="text"
                value={contestName}
                onChange={(e) => setContestName(e.target.value)}
                placeholder="e.g. Weekly Contest 519"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2933] text-sm focus:outline-none focus:border-[#C58A22] focus:ring-1 focus:ring-[#C58A22] transition-all placeholder:text-[#9CA3AF]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Contest Number
              </label>
              <input
                type="number"
                value={contestNumber}
                onChange={(e) => setContestNumber(e.target.value)}
                placeholder="e.g. 519"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2933] text-sm focus:outline-none focus:border-[#C58A22] focus:ring-1 focus:ring-[#C58A22] transition-all placeholder:text-[#9CA3AF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Contest Date <span className="text-[#C58A22]">*</span>
              </label>
              <input
                type="date"
                value={contestDate}
                onChange={(e) => setContestDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2933] text-sm focus:outline-none focus:border-[#C58A22] focus:ring-1 focus:ring-[#C58A22] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={contestTime}
                onChange={(e) => setContestTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-[#1F2933] text-sm focus:outline-none focus:border-[#C58A22] focus:ring-1 focus:ring-[#C58A22] transition-all"
              />
            </div>
          </div>

          {/* Question Rows Section */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1F2933] flex items-center gap-1.5">
                  Contest Questions ({questions.length})
                </h3>
                <p className="text-[10px] text-[#6B7280]">
                  Enter full titles — slugs and difficulty are auto-verified.
                </p>
              </div>
              <button
                type="button"
                onClick={addQuestionRow}
                className="px-2 py-1 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#374151] text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
              >
                <Plus size={13} /> Add Question
              </button>
            </div>

            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-2.5 rounded-xl bg-[#FAFAF9] border border-[#E5E7EB] space-y-2 hover:border-[#D1D5DB] transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-[#F5F1E8] text-[#C58A22] font-bold text-xs flex items-center justify-center shrink-0 border border-[#C58A22]/20">
                      Q{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={q.title}
                      onChange={(e) => handleTitleChange(q.id, e.target.value)}
                      onBlur={(e) => handleTitleBlur(q.id, e.target.value)}
                      placeholder="e.g. Minimum Bishop Moves to Reach Target"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#1F2933] text-xs focus:outline-none focus:border-[#C58A22] placeholder:text-[#9CA3AF]"
                    />

                    {/* Difficulty Dropdown / Override */}
                    <div className="flex items-center gap-1">
                      <select
                        value={q.difficulty}
                        onChange={(e) =>
                          handleDifficultyChange(q.id, e.target.value as any)
                        }
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold border focus:outline-none cursor-pointer ${
                          q.difficulty === 'Easy'
                            ? 'bg-[#EEF6F1] text-[#4F8A63] border-[#4F8A63]/30'
                            : q.difficulty === 'Medium'
                            ? 'bg-[#FDF8EC] text-[#C58A22] border-[#C58A22]/30'
                            : 'bg-[#FBF0F0] text-[#D85C5C] border-[#D85C5C]/30'
                        }`}
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestionRow(q.id)}
                          className="w-6 h-6 rounded text-[#9CA3AF] flex items-center justify-center hover:text-[#D85C5C] hover:bg-[#FEE2E2] transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Slug & Verification Status Feedback */}
                  <div className="flex items-center justify-between text-[11px] px-1 text-[#6B7280]">
                    <span className="font-mono text-[#6B7280] truncate max-w-[280px]">
                      {q.slug ? `slug: ${q.slug}` : 'slug: (type title above)'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {q.isVerifying ? (
                        <span className="inline-flex items-center gap-1 text-[#C58A22]">
                          <Loader2 size={12} className="animate-spin" /> Verifying...
                        </span>
                      ) : q.verified ? (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] font-semibold">
                          <CheckCircle2 size={12} /> Verified ({q.difficulty})
                        </span>
                      ) : q.title.trim() ? (
                        <span className="inline-flex items-center gap-1 text-[#D97706]">
                          <AlertTriangle size={12} /> Custom / Unverified
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-[#FBF0F0] border border-[#FCA5A5] text-[#D85C5C] text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={15} /> {formError}
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3 bg-[#FAFAF9]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#374151] text-xs font-semibold transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-[#C58A22] hover:bg-[#A8741C] text-white text-xs font-bold shadow-md shadow-[#C58A22]/20 flex items-center gap-2 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Creating Contest...
              </>
            ) : (
              <>Create Contest</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
