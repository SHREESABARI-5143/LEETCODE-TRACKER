import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import StudentTable from '../../components/ui/StudentTable';
import { Loader2, AlertCircle, RefreshCw, Users } from 'lucide-react';

const API = '/api/v1';

export default function ProctorStudents() {
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
        setError(json.error?.message || json.message || 'Failed to load students.');
      }
    } catch {
      setError('Network error — unable to load students.');
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
        <span className="text-sm font-semibold text-[#6B7280]">Loading students...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FBF0F0] text-[#D85C5C] text-sm font-semibold border border-[#FCA5A5]">
          <AlertCircle size={20} />
          <span>{error || 'No student data found.'}</span>
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
            <Users size={24} color="#C58A22" /> My Students
          </h1>
          <p className="text-sm mt-1 text-gray-500">View and search through all your assigned students.</p>
        </div>
      </div>

      <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB] shadow-sm">
        <StudentTable students={students} showRank navigateTo={(s) => `/proctor/student/${s.id}`} />
      </div>
    </div>
  );
}
