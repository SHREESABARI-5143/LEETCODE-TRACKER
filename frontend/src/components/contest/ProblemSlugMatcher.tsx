import React, { useState } from 'react';
import { Search, CheckCircle2, AlertTriangle, XCircle, Sparkles, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const API = '/api/v1';

export interface SlugMatchResult {
  originalTitle: string;
  normalizedTitle: string;
  generatedSlug: string;
  matchedSlug: string;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'unresolved';
  confidence: number;
}

interface ProblemSlugMatcherProps {
  knownSlugs?: string[];
  contestSlug?: string;
  onConfirmSlug?: (result: SlugMatchResult) => void;
}

export default function ProblemSlugMatcher({
  knownSlugs = [],
  contestSlug,
  onConfirmSlug,
}: ProblemSlugMatcherProps) {
  const { token } = useAuthStore();
  const [inputTitle, setInputTitle] = useState('');
  const [result, setResult] = useState<SlugMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMatch = async () => {
    const title = inputTitle.trim();
    if (!title) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API}/analytics/contests/match-slug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          contestSlug: contestSlug || undefined,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        const matchResult: SlugMatchResult = {
          originalTitle: json.data.originalTitle,
          normalizedTitle: json.data.normalizedTitle,
          generatedSlug: json.data.generatedSlug,
          matchedSlug: json.data.matchedSlug,
          matchType: json.data.matchType,
          confidence: json.data.confidence,
        };
        setResult(matchResult);
        if (onConfirmSlug) onConfirmSlug(matchResult);
      } else {
        setError(json.error?.message || 'Failed to match problem slug');
      }
    } catch {
      setError('Network error — could not reach the matching service.');
    } finally {
      setLoading(false);
    }
  };

  const renderMatchStatus = () => {
    if (!result) return null;

    switch (result.matchType) {
      case 'exact':
        return (
          <span className="text-[#4F8A63] flex items-center gap-1">
            <CheckCircle2 size={13} /> ✓ Exact Match
          </span>
        );
      case 'normalized':
        return (
          <span className="text-[#4F8A63] flex items-center gap-1">
            <CheckCircle2 size={13} /> ✓ Normalized Match
          </span>
        );
      case 'fuzzy':
        return (
          <span className="text-[#C58A22] flex items-center gap-1">
            <AlertTriangle size={13} /> ⚠ Fuzzy Match
          </span>
        );
      case 'unresolved':
        return (
          <span className="text-[#D85C5C] flex items-center gap-1">
            <XCircle size={13} /> ⚠ Unable to confidently identify problem
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-xl card p-5 bg-white border border-[#E5E7EB] shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} color="#C58A22" />
        <h3 className="text-base font-bold text-[#1F2933]">Problem Slug Matcher</h3>
      </div>
      <p className="text-xs text-[#6B7280] mb-4">
        Enter full contest problem title to automatically generate and match LeetCode problem slug.
      </p>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputTitle}
            onChange={e => setInputTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleMatch()}
            placeholder="e.g. Minimum Bishop Moves to Reach Target"
            className="w-full px-3.5 py-2 text-sm rounded-lg border border-[#E5E7EB] focus:outline-none focus:border-[#C58A22] bg-[#FAFAFA]"
          />
        </div>
        <button
          onClick={handleMatch}
          disabled={loading || !inputTitle.trim()}
          className="px-4 py-2 bg-[#C58A22] hover:bg-[#b07b1e] disabled:opacity-50 text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          Match Problem
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#FBF0F0] border border-[#FCA5A5] text-xs text-[#D85C5C] font-medium">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#9CA3AF] block font-medium">Full Question Title:</span>
              <span className="font-semibold text-[#1F2933]">{result.originalTitle}</span>
            </div>
            <div>
              <span className="text-[#9CA3AF] block font-medium">Generated Slug:</span>
              <code className="px-2 py-0.5 rounded bg-amber-50 text-[#C58A22] font-mono text-xs border border-amber-200">
                {result.generatedSlug}
              </code>
            </div>
            <div>
              <span className="text-[#9CA3AF] block font-medium">Matched Slug:</span>
              {result.matchedSlug ? (
                <code className="px-2 py-0.5 rounded bg-emerald-50 text-[#4F8A63] font-mono text-xs border border-emerald-200">
                  {result.matchedSlug}
                </code>
              ) : (
                <span className="text-[#D85C5C] text-xs font-medium">No match found</span>
              )}
            </div>
            <div>
              <span className="text-[#9CA3AF] block font-medium">Match Status:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-xs mt-0.5">
                {renderMatchStatus()}
              </span>
            </div>
            <div>
              <span className="text-[#9CA3AF] block font-medium">Confidence Score:</span>
              <span className="font-bold text-[#1F2933]">{result.confidence}%</span>
            </div>
            <div>
              <span className="text-[#9CA3AF] block font-medium">Match Type:</span>
              <span className="font-semibold text-[#1F2933] capitalize">{result.matchType}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
