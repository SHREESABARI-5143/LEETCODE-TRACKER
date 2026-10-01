import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const API = '/api/v1';

export default function ProctorAlerts() {
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
        setError(json.error?.message || json.message || 'Failed to load alerts.');
      }
    } catch {
      setError('Network error — unable to load alerts.');
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
        <span className="text-sm font-semibold text-[#6B7280]">Loading alerts...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FBF0F0] text-[#D85C5C] text-sm font-semibold border border-[#FCA5A5]">
          <AlertCircle size={20} />
          <span>{error || 'No alert data found.'}</span>
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

  const { students } = data;
  const attention = students.filter((s: any) => s.status === 'attention');
  const inactive = students.filter((s: any) => s.status === 'inactive');

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
            <AlertTriangle size={24} color="#D85C5C" /> Student Alerts
          </h1>
          <p className="text-sm mt-1 text-gray-500">Monitor students who need attention or are inactive.</p>
        </div>
      </div>

      {attention.length === 0 && inactive.length === 0 && (
         <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-2xl border border-[#E5E7EB]">
           <span className="text-lg font-bold text-[#4F8A63]">All clear! 🎉</span>
           <span className="text-sm font-medium text-[#6B7280]">None of your assigned students require attention.</span>
         </div>
      )}

      {attention.length > 0 && (
        <div className="rounded-2xl p-5 border border-[#FCA5A5] bg-[#FBF0F0]">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-[#D85C5C]">
            Students Needing Attention ({attention.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attention.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-[#FCA5A5] bg-white hover:bg-gray-50 transition-colors"
                onClick={() => navigate(`/proctor/student/${s.id}`)}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[#FFF9EC] text-[#B98228]">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1F2933] truncate">{s.name}</div>
                  <div className="text-xs text-[#6B7280]">{s.totalSolved} solved</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF9EC] text-[#B98228] border border-[#F5E6C8]">
                  Attention
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="rounded-2xl p-5 border border-[#E5E7EB] bg-gray-50">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-600">
            Inactive Students ({inactive.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inactive.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer border border-[#E5E7EB] bg-white hover:bg-gray-50 transition-colors"
                onClick={() => navigate(`/proctor/student/${s.id}`)}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gray-200 text-gray-600">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#1F2933] truncate">{s.name}</div>
                  <div className="text-xs text-[#6B7280]">{s.totalSolved} solved</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                  Inactive
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
