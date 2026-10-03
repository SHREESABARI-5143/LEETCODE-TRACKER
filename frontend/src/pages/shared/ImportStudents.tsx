import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download,
  RefreshCw, Search, Trash2, Edit2, X, ChevronDown, Users, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../../store/authStore';
import { uploadApi, studentsApi } from '../../api/client';

const YEAR_LABELS: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
const YEAR_COLORS: Record<number, { bg: string; accent: string; light: string }> = {
  1: { bg: '#FDF8EC', accent: '#C58A22', light: '#FEF3C7' },
  2: { bg: '#EEF6F1', accent: '#4F8A63', light: '#D1FAE5' },
  3: { bg: '#F0F4FF', accent: '#4F6AD8', light: '#DBEAFE' },
  4: { bg: '#FBF0F0', accent: '#D85C5C', light: '#FEE2E2' },
};

interface ImportStatus {
  stage: 'idle' | 'selected' | 'parsing' | 'review' | 'importing' | 'done' | 'error';
  fileName: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  message: string;
  errors: string[];
  mapped?: any[];
  unmatched?: any[];
  proctors?: any[];
}

interface Student {
  id: string;
  registerNumber: string;
  name: string;
  collegeEmail: string;
  leetcodeUsername: string;
  section: string;
  batch: string;
  status: string;
}

interface StudentCounts {
  year1: number; year2: number; year3: number; year4: number; total: number;
}

function downloadTemplate(year: number) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Roll Number', 'Student Name', 'Year of Study', 'Placement Status', 'LeetCode Username', 'LeetCode Profile URL'],
    [`2${(26 - year).toString().padStart(2, '0')}CS001`, 'Sample Student A', String(year), 'Placement', 'tourist', 'https://leetcode.com/u/tourist/'],
    [`2${(26 - year).toString().padStart(2, '0')}CS002`, 'Sample Student B', String(year), 'Placement', 'neal_wu', 'https://leetcode.com/u/neal_wu/'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, `Year${year}_Import_Template.xlsx`);
}

function YearImportPanel({ year, counts, onCountsRefresh }: { year: number; counts: StudentCounts | null; onCountsRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>({ stage: 'idle', fileName: '', totalRows: 0, validCount: 0, invalidCount: 0, message: '', errors: [] });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState('');
  const [showTable, setShowTable] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const colors = YEAR_COLORS[year];
  const yearCount = counts ? (counts as any)[`year${year}`] : 0;

  useEffect(() => {
    if (showTable) fetchStudents();
  }, [showTable]);

  async function fetchStudents() {
    setLoadingStudents(true);
    try {
      const res = await studentsApi.getStudents({ year, limit: 200 });
      const data = res.data;
      if (data?.students) {
        setStudents(data.students.map((s: any) => ({
          id: String(s.id),
          registerNumber: s.registerNumber || s.rollNumber,
          name: s.name,
          collegeEmail: s.proctorEmail || `${s.rollNumber?.toLowerCase()}@nec.edu.in`,
          leetcodeUsername: s.leetcodeUsername,
          section: s.section || 'A',
          batch: `Year ${s.year}`,
          status: s.syncStatus === 'Success' ? 'active' : 'inactive'
        })));
      }
    } catch {
      // ignore
    } finally {
      setLoadingStudents(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setStatus({ stage: 'selected', fileName: file.name, totalRows: 0, validCount: 0, invalidCount: 0, message: '', errors: [] });
  }

  async function handleImport() {
    if (!selectedFile) return;
    setStatus(s => ({ ...s, stage: 'parsing', message: 'Uploading and parsing Excel roster...' }));

    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('year', String(year));

    try {
      const res = await uploadApi.uploadFile(fd);
      const json = res.data;

      if (json.preview) {
        setStatus({
          stage: 'review',
          fileName: selectedFile.name,
          totalRows: json.totalRecords || 0,
          validCount: json.mapped?.length || 0,
          invalidCount: json.invalidRecords?.length || 0,
          message: 'Review unmatched proctors before committing.',
          errors: (json.errorReport || []).map((e: any) => e.message || String(e)).slice(0, 5),
          mapped: json.mapped || [],
          unmatched: json.unmatched || [],
          proctors: json.proctors || []
        });
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Import failed';
      const errors = err.response?.data?.errorReport || [];
      setStatus(s => ({
        ...s,
        stage: 'error',
        message: errMsg,
        errors: Array.isArray(errors) ? errors.map((e: any) => e.message || String(e)) : []
      }));
    }
  }

  async function handleCommit() {
    setStatus(s => ({ ...s, stage: 'importing', message: 'Committing to database...' }));
    try {
      const payload = {
        fileName: status.fileName,
        defaultYear: year,
        mapped: status.mapped,
        unmatched: status.unmatched,
        errors: status.errors
      };
      const res = await uploadApi.commitUpload(payload);
      const json = res.data;

      setStatus({
        stage: 'done',
        fileName: status.fileName,
        totalRows: status.totalRows,
        validCount: json.successfulCount || 0,
        invalidCount: json.failedCount || 0,
        message: `Successfully imported ${json.successfulCount || 0} students!`,
        errors: [],
      });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onCountsRefresh();
      if (showTable) fetchStudents();
    } catch (err: any) {
      setStatus(s => ({
        ...s,
        stage: 'error',
        message: err.message || 'Commit failed',
        errors: []
      }));
    }
  }

  function updateUnmatchedProctor(index: number, proctorId: number) {
    if (!status.unmatched || !status.proctors) return;
    const newUnmatched = [...status.unmatched];
    const p = status.proctors.find((x: any) => x.id === proctorId);
    newUnmatched[index] = { ...newUnmatched[index], proctor_id: p?.id || null };
    setStatus(s => ({ ...s, unmatched: newUnmatched }));
  }


  async function handleDelete(studentId: string) {
    if (!confirm('Delete this student? This cannot be undone.')) return;
    setDeleting(studentId);
    try {
      await studentsApi.deleteStudent(studentId);
      setStudents(s => s.filter(x => x.id !== studentId));
      onCountsRefresh();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
    }
  }

  const filteredStudents = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.registerNumber.toLowerCase().includes(search.toLowerCase()) ||
    s.leetcodeUsername.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${colors.accent}30`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div className="p-5 flex items-center justify-between" style={{ background: colors.bg, borderBottom: `1px solid ${colors.accent}20` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: colors.accent }}>
            <Users size={18} color="#fff" />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: '#1F2933' }}>{YEAR_LABELS[year]} Students</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>Upload Excel or CSV to import</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: colors.accent }}>{yearCount}</div>
            <div className="text-xs" style={{ color: '#6B7280' }}>Total Students</div>
          </div>
          <button onClick={() => downloadTemplate(year)} className="btn btn-ghost btn-sm flex items-center gap-1.5" title="Download Template">
            <Download size={13} /> Template
          </button>
        </div>
      </div>

      {/* Import Area */}
      <div className="p-5 bg-white">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>
              Upload Excel / CSV
            </label>
            <div className="flex gap-2 flex-wrap">
              <label className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer">
                <FileSpreadsheet size={14} />
                {selectedFile ? selectedFile.name.slice(0, 30) + (selectedFile.name.length > 30 ? 'â€¦' : '') : 'Choose File'}
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
              </label>
              <button
                onClick={handleImport}
                disabled={!selectedFile || status.stage === 'importing'}
                className="btn btn-sm flex items-center gap-1.5 font-semibold"
                style={{ background: colors.accent, color: '#fff', opacity: (!selectedFile || status.stage === 'importing') ? 0.5 : 1, cursor: (!selectedFile || status.stage === 'importing') ? 'not-allowed' : 'pointer' }}
              >
                {status.stage === 'importing' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Import Students
              </button>
              {selectedFile && status.stage !== 'importing' && (
                <button onClick={() => { setSelectedFile(null); setStatus(s => ({ ...s, stage: 'idle' })); if (fileRef.current) fileRef.current.value = ''; }} className="btn btn-ghost btn-sm">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Status Stats */}
          {(status.stage === 'done' || status.stage === 'error') && (
            <div className="flex gap-3">
              <div className="text-center px-3 py-1.5 rounded-lg" style={{ background: '#EEF6F1' }}>
                <div className="text-sm font-bold" style={{ color: '#4F8A63' }}>{status.validCount}</div>
                <div className="text-xs" style={{ color: '#6B7280' }}>Imported</div>
              </div>
              <div className="text-center px-3 py-1.5 rounded-lg" style={{ background: '#FBF0F0' }}>
                <div className="text-sm font-bold" style={{ color: '#D85C5C' }}>{status.invalidCount}</div>
                <div className="text-xs" style={{ color: '#6B7280' }}>Failed</div>
              </div>
              <div className="text-center px-3 py-1.5 rounded-lg card">
                <div className="text-sm font-bold" style={{ color: '#1F2933' }}>{status.totalRows}</div>
                <div className="text-xs" style={{ color: '#6B7280' }}>Total</div>
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {status.stage === 'importing' && (
          <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: colors.accent }}>
            <Loader2 size={14} className="animate-spin" /> {status.message}
          </div>
        )}
        {status.stage === 'done' && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg" style={{ background: '#EEF6F1', border: '1px solid #BBF7D0' }}>
            <CheckCircle size={15} color="#4F8A63" />
            <span className="text-sm font-medium" style={{ color: '#4F8A63' }}>{status.message}</span>
          </div>
        )}
        {status.stage === 'review' && (
          <div className="mt-4 p-4 rounded-xl" style={{ border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
            <h4 className="font-bold text-gray-800 mb-2">Review Proctors</h4>
            <p className="text-sm text-gray-600 mb-4">
              {status.unmatched?.length} students have unmatched proctors. Please select the correct proctor for them below.
            </p>
            {status.unmatched && status.unmatched.length > 0 ? (
              <div className="overflow-x-auto mb-4 border rounded">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2 text-red-600">Unmatched Name (Excel)</th>
                      <th className="px-3 py-2">Select Correct Proctor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.unmatched.map((u, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2 font-mono">{u.roll_number}</td>
                        <td className="px-3 py-2">{u.name}</td>
                        <td className="px-3 py-2 text-red-600 font-medium">{u.raw_proctor_name || 'N/A'}</td>
                        <td className="px-3 py-2">
                          <select 
                            className="select select-bordered select-sm w-full max-w-xs" 
                            value={u.proctor_id || ''}
                            onChange={(e) => updateUnmatchedProctor(i, Number(e.target.value))}
                          >
                            <option value="">-- Select Proctor --</option>
                            {status.proctors?.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.full_name} ({p.department})</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setStatus({ stage: 'idle', fileName: '', totalRows: 0, validCount: 0, invalidCount: 0, message: '', errors: [] })} 
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleCommit} 
                className="btn btn-primary btn-sm"
                disabled={status.unmatched?.some(u => !u.proctor_id)}
              >
                Commit Upload
              </button>
            </div>
          </div>
        )}
        {status.stage === 'error' && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: '#FBF0F0', border: '1px solid #FCA5A5' }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={15} color="#D85C5C" />
              <span className="text-sm font-semibold" style={{ color: '#D85C5C' }}>{status.message}</span>
            </div>
            {status.errors.map((e, i) => (
              <div key={i} className="text-xs mt-1 ml-5" style={{ color: '#B91C1C' }}>â€¢ {e}</div>
            ))}
          </div>
        )}
      </div>

      {/* Student Table Toggle */}
      <div style={{ borderTop: `1px solid ${colors.accent}15` }}>
        <button
          onClick={() => setShowTable(t => !t)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold transition-colors hover:bg-gray-50"
          style={{ color: '#374151' }}
        >
          <span>View {YEAR_LABELS[year]} Students ({yearCount})</span>
          <ChevronDown size={16} style={{ transform: showTable ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {showTable && (
          <div className="p-4 pt-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Search by name, reg no, username..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg"
                  style={{ border: '1px solid #E5E7EB', outline: 'none', background: '#FAFAFA' }}
                />
              </div>
              <button onClick={fetchStudents} className="btn btn-ghost btn-sm flex items-center gap-1" title="Refresh">
                <RefreshCw size={13} className={loadingStudents ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {loadingStudents ? (
              <div className="flex items-center justify-center py-8 gap-2" style={{ color: '#9CA3AF' }}>
                <Loader2 size={18} className="animate-spin" /> Loading students...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>
                {yearCount === 0 ? `No ${YEAR_LABELS[year]} students imported yet.` : 'No results match your search.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Register No</th>
                      <th>Student Name</th>
                      <th>LeetCode Username</th>
                      <th>Email</th>
                      <th>Section</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, i) => (
                      <tr key={s.id}>
                        <td style={{ color: '#9CA3AF', fontSize: '12px' }}>{i + 1}</td>
                        <td className="font-mono font-semibold" style={{ color: colors.accent, fontSize: '13px' }}>{s.registerNumber}</td>
                        <td className="font-medium" style={{ color: '#1F2933' }}>{s.name}</td>
                        <td style={{ color: '#6B7280', fontSize: '13px' }}>@{s.leetcodeUsername}</td>
                        <td style={{ color: '#6B7280', fontSize: '12px' }}>{s.collegeEmail}</td>
                        <td><span className="badge badge-neutral text-xs">{s.section}</span></td>
                        <td>
                          <span className="badge text-xs" style={{ background: s.status === 'active' ? '#EEF6F1' : '#FBF0F0', color: s.status === 'active' ? '#4F8A63' : '#D85C5C' }}>
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Delete">
                              {deleting === s.id ? <Loader2 size={13} className="animate-spin" style={{ color: '#D85C5C' }} /> : <Trash2 size={13} style={{ color: '#D85C5C' }} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>Showing {filteredStudents.length} of {yearCount} students</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ImportStudents() {
  const { token } = useAuthStore();
  const [counts, setCounts] = useState<StudentCounts | null>(null);

  async function fetchCounts() {
    try {
      const res = await reportsApi.getYearWise();
      const years = res.data?.years || [];
      const yMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      let total = 0;
      years.forEach((y: any) => {
        const yr = Number(y.year);
        const count = Number(y.totalStudents || 0);
        if (yMap[yr] !== undefined) yMap[yr] = count;
        total += count;
      });
      setCounts({
        year1: yMap[1],
        year2: yMap[2],
        year3: yMap[3],
        year4: yMap[4],
        total
      });
    } catch {
      // ignore
    }
  }

  useEffect(() => { fetchCounts(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1F2933' }}>Import Students</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Import students separately for each academic year. Each section enforces year-level isolation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {counts && (
            <div className="text-center px-4 py-2 rounded-xl card">
              <div className="text-xl font-bold" style={{ color: '#1F2933' }}>{counts.total}</div>
              <div className="text-xs" style={{ color: '#6B7280' }}>Total Students</div>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <AlertCircle size={16} color="#1E40AF" className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#1E40AF' }}>Required Excel Columns</p>
          <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
            Register Number Â· Name Â· College Email Â· Year Â· Section Â· Batch Â· Proctor Â· LeetCode Username
          </p>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            The Year column must match the import section (e.g., only Year 2 rows in the 2nd Year import panel).
          </p>
        </div>
      </div>

      {/* Four Year Panels */}
      <div className="space-y-5">
        {[1, 2, 3, 4].map(year => (
          <YearImportPanel key={year} year={year} counts={counts} onCountsRefresh={fetchCounts} />
        ))}
      </div>
    </div>
  );
}

