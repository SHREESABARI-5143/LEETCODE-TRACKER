import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle, Check, Download, Users, Percent, ArrowLeft, Search, Filter, X, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';

const API = '/api/v1';

const YEARS = [1, 2, 3, 4];
const YEAR_LABELS: Record<number, string> = {
  1: '1st Year Proctors',
  2: '2nd Year Proctors',
  3: '3rd Year Proctors',
  4: '4th Year Proctors',
};

const getYearName = (y: number) => {
  const map: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
  return map[y] || `${y}th Year`;
};

export interface ProctorStudent {
  id: string;
  name: string;
  registerNo: string;
  rollNumber?: string;
  leetcodeUsername: string;
  year: number;
  section: string;
  proctorId: string;
  proctorName: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number | null;
  contestRating: number;
  dailySolved: number;
  weeklySolved: number;
  monthlySolved: number;
  status: 'active' | 'attention' | 'inactive';
}

export interface ProctorMetrics {
  id: string;
  name: string;
  email: string;
  year: number;
  assignedSections: string[];
  studentCount: number;
  activePercentage: number;
  attentionCount: number;
  attendedStudents: ProctorStudent[];
  notAttendedStudents: ProctorStudent[];
}

export interface YearGroup {
  year: number;
  label: string;
  proctors: ProctorMetrics[];
}

export default function ProctorPerformance() {
  const { token } = useAuthStore();
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected proctor for full-sized detail view
  const [selectedProctor, setSelectedProctor] = useState<ProctorMetrics | null>(null);

  // In-page Detail View Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'attended' | 'notAttended'>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  const fetchProctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/analytics/proctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data?.yearGroups) {
        setYearGroups(json.data.yearGroups);
      } else {
        setError(json.error?.message || json.message || 'Failed to load proctor performance data.');
      }
    } catch {
      setError('Network error — unable to reach proctor performance service.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProctors();
  }, [fetchProctors]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProctorName, setNewProctorName] = useState('');
  const [newProctorEmail, setNewProctorEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const { user } = useAuthStore();

  const handleCreateProctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProctorName || !newProctorEmail) return;
    
    setCreating(true);
    try {
      const generatedPassword = newProctorEmail.split('@')[0];
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: newProctorName,
          email: newProctorEmail,
          password: generatedPassword,
          role: 'PROCTOR',
          department_id: user?.departmentId
        })
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create proctor');
      
      setIsAddModalOpen(false);
      setNewProctorName('');
      setNewProctorEmail('');
      alert('Proctor created successfully! Password is: ' + generatedPassword);
      fetchProctors();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectProctor = (p: ProctorMetrics) => {
    setSelectedProctor(p);
    setSearchQuery('');
    setStatusFilter('all');
    setSectionFilter('all');
  };

  // Combine Not Attended (FIRST) and Attended (SECOND) into single roster
  const allProctorStudents = useMemo(() => {
    if (!selectedProctor) return [];
    const notAttendedMapped = selectedProctor.notAttendedStudents.map(s => ({
      ...s,
      contestStatus: 'notAttended' as const,
    }));
    const attendedMapped = selectedProctor.attendedStudents.map(s => ({
      ...s,
      contestStatus: 'attended' as const,
    }));
    // Default order: NOT ATTENDED FIRST, ATTENDED SECOND
    return [...notAttendedMapped, ...attendedMapped];
  }, [selectedProctor]);

  // Filtered Student List for Detail View
  const filteredProctorStudents = useMemo(() => {
    let list = [...allProctorStudents];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.registerNo.toLowerCase().includes(q) ||
        s.leetcodeUsername.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(s => s.contestStatus === statusFilter);
    }

    // Section filter
    if (sectionFilter !== 'all') {
      list = list.filter(s => s.section === sectionFilter);
    }

    return list;
  }, [allProctorStudents, searchQuery, statusFilter, sectionFilter]);

  // Download Proctor Excel/CSV Report Handler
  const handleDownloadProctorReport = (p: ProctorMetrics) => {
    const yearLabel = getYearName(p.year);
    const sectionsLabel = p.assignedSections.join(', ');

    const summaryLines = [
      'PROCTOR PERFORMANCE REPORT',
      `Proctor Name,${p.name}`,
      `Academic Year,${yearLabel}`,
      `Assigned Sections,"${sectionsLabel}"`,
      `Total Students,${p.studentCount}`,
      `Active Students,${p.attendedStudents.length}`,
      `Inactive / Attention Needed,${p.notAttendedStudents.length}`,
      `Active Percentage,${p.activePercentage}%`,
      `Attention Needed Count,${p.attentionCount}`,
      '',
      'STUDENT ATTENDANCE & LEETCODE PERFORMANCE DETAILS',
      'S.No,Student Name,Register No,Year,Section,LeetCode Handle,Total Solved,Easy,Medium,Hard,Status'
    ];

    // Export ALL students (Not Attended first, Attended second)
    const notAttendedRows = p.notAttendedStudents.map((s, idx) => [
      idx + 1,
      `"${s.name}"`,
      `"${s.registerNo}"`,
      `"${yearLabel}"`,
      `"Y${p.year}-${s.section}"`,
      `"${s.leetcodeUsername}"`,
      s.totalSolved,
      s.easySolved,
      s.mediumSolved,
      s.hardSolved,
      '"Inactive / Low Solved"'
    ]);

    const attendedRows = p.attendedStudents.map((s, idx) => [
      p.notAttendedStudents.length + idx + 1,
      `"${s.name}"`,
      `"${s.registerNo}"`,
      `"${yearLabel}"`,
      `"Y${p.year}-${s.section}"`,
      `"${s.leetcodeUsername}"`,
      s.totalSolved,
      s.easySolved,
      s.mediumSolved,
      s.hardSolved,
      '"Active"'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      ...summaryLines,
      ...notAttendedRows.map(e => e.join(',')),
      ...attendedRows.map(e => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);

    const sanitizedName = p.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Proctor_Report_${sanitizedName}_${yearLabel.replace(' ', '_')}.csv`;

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-[#E5E7EB] animate-fade-in">
        <Loader2 size={26} className="animate-spin text-[#C58A22]" />
        <span className="text-sm font-semibold text-[#6B7280]">Loading live proctor performance records...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FBF0F0] text-[#D85C5C] text-sm font-semibold border border-[#FCA5A5]">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchProctors}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center gap-2"
        >
          <RefreshCw size={14} /> Retry Loading
        </button>
      </div>
    );
  }

  // ── VIEW 1: FULL-SIZED IN-PAGE PROCTOR DETAIL VIEW ──
  if (selectedProctor) {
    const rawSections = Array.from(new Set(selectedProctor.attendedStudents.concat(selectedProctor.notAttendedStudents).map(s => s.section))).sort();

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
          <button
            onClick={() => setSelectedProctor(null)}
            className="btn btn-ghost btn-sm flex items-center gap-1.5 text-[#6B7280] hover:text-[#1F2933] hover:bg-[#F3F4F6] font-semibold"
          >
            <ArrowLeft size={16} />
            <span>Back to Proctors</span>
          </button>
        </div>

        {/* Compact Summary Header Card */}
        <div className="rounded-2xl card p-5 border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#C58A22]">
                PROCTOR PERFORMANCE DETAILS
              </div>
              <h1 className="text-2xl font-bold text-[#1F2933] mt-0.5">
                {selectedProctor.name}
              </h1>
              <div className="text-xs text-[#6B7280] font-medium mt-1 flex items-center gap-2">
                <span className="font-semibold text-[#1F2933]">{getYearName(selectedProctor.year)}</span>
                <span>•</span>
                <span>Sections: <strong>{selectedProctor.assignedSections.join(', ')}</strong></span>
              </div>
            </div>

            {/* Metric Summary Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl p-2.5 bg-[#FAFAFA] border border-[#E5E7EB] flex items-center gap-2">
                <Users size={16} className="text-[#6B7280]" />
                <div>
                  <div className="text-[10px] uppercase font-semibold text-[#6B7280]">Total Students</div>
                  <div className="text-base font-bold text-[#1F2933]">{selectedProctor.studentCount}</div>
                </div>
              </div>

              <div className="rounded-xl p-2.5 bg-[#EEF6F1] border border-[#C6E7D0] flex items-center gap-2">
                <CheckCircle size={16} className="text-[#4F8A63]" />
                <div>
                  <div className="text-[10px] uppercase font-semibold text-[#4F8A63]">Active Solvers</div>
                  <div className="text-base font-bold text-[#4F8A63]">{selectedProctor.attendedStudents.length}</div>
                </div>
              </div>

              <div className="rounded-xl p-2.5 bg-[#FFF9EC] border border-[#F5E6C8] flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#B98228]" />
                <div>
                  <div className="text-[10px] uppercase font-semibold text-[#B98228]">Need Attention</div>
                  <div className="text-base font-bold text-[#B98228]">{selectedProctor.notAttendedStudents.length}</div>
                </div>
              </div>

              <div className={cn(
                "rounded-xl p-2.5 border flex items-center gap-2",
                selectedProctor.activePercentage >= 80 ? "bg-[#EEF6F1] border-[#C6E7D0]" :
                selectedProctor.activePercentage >= 60 ? "bg-[#FFF9EC] border-[#F5E6C8]" :
                "bg-[#FBF0F0] border-[#FCA5A5]"
              )}>
                <Percent size={16} className={
                  selectedProctor.activePercentage >= 80 ? "text-[#4F8A63]" :
                  selectedProctor.activePercentage >= 60 ? "text-[#B98228]" : "text-[#B85C5C]"
                } />
                <div>
                  <div className="text-[10px] uppercase font-semibold text-[#6B7280]">Active %</div>
                  <div className="text-base font-bold" style={{
                    color: selectedProctor.activePercentage >= 80 ? '#4F8A63' : selectedProctor.activePercentage >= 60 ? '#B98228' : '#B85C5C'
                  }}>
                    {selectedProctor.activePercentage}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls & Download Action Bar */}
        <div className="rounded-2xl card p-3 border border-[#E5E7EB] bg-[#FAFAFA] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 bg-[#FFFFFF] w-full sm:w-64 focus-within:border-[#C58A22]">
              <Search size={14} className="text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search student, reg no..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-xs bg-transparent border-none outline-none w-full text-[#1F2933]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[#9CA3AF] hover:text-[#1F2933]">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 bg-[#FFFFFF]">
              <Filter size={14} className="text-[#9CA3AF]" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="text-xs font-semibold bg-transparent border-none outline-none text-[#1F2933] cursor-pointer"
              >
                <option value="all">All Statuses ({allProctorStudents.length})</option>
                <option value="notAttended">Need Attention ({selectedProctor.notAttendedStudents.length})</option>
                <option value="attended">Active Solvers ({selectedProctor.attendedStudents.length})</option>
              </select>
            </div>

            {/* Section Filter */}
            {rawSections.length > 1 && (
              <div className="flex items-center gap-1.5 border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 bg-[#FFFFFF]">
                <span className="text-[11px] font-bold text-[#6B7280]">Sec:</span>
                <select
                  value={sectionFilter}
                  onChange={e => setSectionFilter(e.target.value)}
                  className="text-xs font-semibold bg-transparent border-none outline-none text-[#1F2933] cursor-pointer"
                >
                  <option value="all">All Sections</option>
                  {rawSections.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Download CSV Action Button */}
          <button
            onClick={() => handleDownloadProctorReport(selectedProctor)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all w-full sm:w-auto justify-center"
          >
            <Download size={14} />
            <span>Download Report (.csv)</span>
          </button>
        </div>

        {/* Student Table Roster */}
        <div className="rounded-2xl card border border-[#E5E7EB] overflow-hidden bg-white shadow-sm">
          <div className="px-5 py-3 border-b border-[#E5E7EB] bg-[#FAFAF9] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1F2933] flex items-center gap-2">
              <Users size={16} className="text-[#C58A22]" />
              <span>Assigned Students Roster ({filteredProctorStudents.length} of {allProctorStudents.length})</span>
            </h3>
            <span className="text-xs font-medium text-[#6B7280]">
              Showing live LeetCode solve records
            </span>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="table w-full text-xs">
              <thead className="sticky top-0 bg-[#FAFAFA] border-b border-[#E5E7EB] z-10">
                <tr className="text-[#6B7280]">
                  <th className="w-12 text-center">#</th>
                  <th>Student Info</th>
                  <th>LeetCode Handle</th>
                  <th className="text-center">Section</th>
                  <th className="text-center">Total Solved</th>
                  <th className="text-center">Easy / Med / Hard</th>
                  <th className="text-center">Today Solved</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredProctorStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-[#9CA3AF] font-medium">
                      No students found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredProctorStudents.map((st, index) => {
                    const isAttended = st.contestStatus === 'attended';
                    return (
                      <tr
                        key={st.id}
                        className={cn(
                          "transition-colors",
                          !isAttended ? "bg-[#FFFDF7] hover:bg-[#FFF9EC]" : "hover:bg-[#F9FAFB]"
                        )}
                      >
                        <td className="text-center font-bold text-[#9CA3AF]">{index + 1}</td>
                        <td>
                          <div className="font-bold text-[#1F2933]">{st.name}</div>
                          <div className="text-[11px] text-[#6B7280] font-mono">{st.registerNo}</div>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-[#FAFAFA] border border-[#E5E7EB] text-[#C58A22]">
                            @{st.leetcodeUsername}
                          </span>
                        </td>
                        <td className="text-center font-bold text-[#1F2933]">
                          {st.section}
                        </td>
                        <td className="text-center font-bold text-sm text-[#1F2933]">
                          {st.totalSolved}
                        </td>
                        <td className="text-center text-[11px]">
                          <span className="text-emerald-700 font-bold">{st.easySolved}</span> /{' '}
                          <span className="text-amber-700 font-bold">{st.mediumSolved}</span> /{' '}
                          <span className="text-rose-700 font-bold">{st.hardSolved}</span>
                        </td>
                        <td className="text-center font-bold">
                          {st.dailySolved === null ? (
                            <span className="text-[#9CA3AF] cursor-help" title="Baseline not captured yet">—</span>
                          ) : st.dailySolved > 0 ? (
                            <span className="text-[#C58A22]">+{st.dailySolved}</span>
                          ) : (
                            <span className="text-[#9CA3AF]">0</span>
                          )}
                        </td>
                        <td className="text-center">
                          {isAttended ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#EEF6F1] text-[#4F8A63] border border-[#C6E7D0]">
                              <CheckCircle size={12} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF9EC] text-[#B98228] border border-[#F5E6C8]">
                              <AlertTriangle size={12} /> Needs Attention
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW 2: FULL PROCTOR OVERVIEW MATRIX ──
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={26} className="text-[#C58A22]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2933]">
              Proctor Performance
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Real-time proctor group metrics and live student LeetCode progress across all years.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#C58A22] text-white text-xs font-semibold hover:bg-[#B37A1B] flex items-center gap-1.5 shadow-sm transition-all"
          >
            Add Proctor
          </button>
          <button
            onClick={fetchProctors}
            className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-[#1F2933] text-xs font-semibold hover:bg-[#FAFAFA] flex items-center gap-1.5 shadow-sm transition-all"
          >
            <RefreshCw size={13} className="text-[#C58A22]" /> Refresh
          </button>
        </div>
      </div>

      {/* Year-by-Year Proctor Group Sections */}
      {yearGroups.map(group => {
        if (group.proctors.length === 0) return null;

        return (
          <div key={group.year} className="space-y-3">
            {/* Year Sub-heading */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <h2 className="text-base font-bold text-[#1F2933] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C58A22]"></span>
                {group.label}
              </h2>
              <span className="text-xs font-semibold text-[#6B7280]">
                {group.proctors.length} {group.proctors.length === 1 ? 'Proctor' : 'Proctors'} Assigned
              </span>
            </div>

            {/* Proctors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.proctors.map(proctor => {
                const isGreat = proctor.activePercentage >= 80;
                const isOk = proctor.activePercentage >= 60;

                return (
                  <div
                    key={proctor.id}
                    onClick={() => handleSelectProctor(proctor)}
                    className="group rounded-2xl bg-white border border-[#E5E7EB] p-5 shadow-sm hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-[#1F2933] group-hover:text-[#C58A22] transition-colors">
                            {proctor.name}
                          </h3>
                          <p className="text-xs text-[#6B7280]">{proctor.email}</p>
                        </div>
                        <span
                          className={cn(
                            "text-xs font-extrabold px-2.5 py-0.5 rounded-full border",
                            isGreat ? "bg-[#EEF6F1] text-[#4F8A63] border-[#C6E7D0]" :
                            isOk ? "bg-[#FFF9EC] text-[#B98228] border-[#F5E6C8]" :
                            "bg-[#FBF0F0] text-[#B85C5C] border-[#FCA5A5]"
                          )}
                        >
                          {proctor.activePercentage}% Active
                        </span>
                      </div>

                      <div className="text-xs font-medium text-[#6B7280] flex items-center gap-1.5">
                        <span className="font-semibold text-[#1F2933]">Sections:</span>
                        <span>{proctor.assignedSections.join(', ')}</span>
                      </div>
                    </div>

                    {/* Quick Metric Breakdown */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F3F4F6] text-center">
                      <div className="p-2 rounded-xl bg-[#FAFAFA]">
                        <div className="text-[10px] uppercase font-bold text-[#9CA3AF]">Students</div>
                        <div className="text-sm font-bold text-[#1F2933] mt-0.5">{proctor.studentCount}</div>
                      </div>

                      <div className="p-2 rounded-xl bg-[#EEF6F1]">
                        <div className="text-[10px] uppercase font-bold text-[#4F8A63]">Active</div>
                        <div className="text-sm font-bold text-[#4F8A63] mt-0.5">{proctor.attendedStudents.length}</div>
                      </div>

                      <div className="p-2 rounded-xl bg-[#FFF9EC]">
                        <div className="text-[10px] uppercase font-bold text-[#B98228]">Attention</div>
                        <div className="text-sm font-bold text-[#B98228] mt-0.5">{proctor.attentionCount}</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProctor(proctor);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        View Students Roster
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadProctorReport(proctor);
                        }}
                        className="py-2 px-3 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#1F2933] text-xs font-semibold transition-all flex items-center gap-1.5"
                        title="Download CSV Report"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Proctor Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-start justify-center z-50 p-4 pt-32">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-[#E5E7EB] animate-fade-in">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#1F2933' }}>Create New Proctor</h3>
            <form onSubmit={handleCreateProctor} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Full Name</label>
                <input type="text" value={newProctorName} onChange={e => setNewProctorName(e.target.value)} className="input w-full" required />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Email Address</label>
                <input type="email" value={newProctorEmail} onChange={e => setNewProctorEmail(e.target.value)} className="input w-full" required />
                <p className="text-[10px] mt-1 text-gray-500">Password will be automatically set to the email prefix.</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary btn-sm" disabled={creating}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Proctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
