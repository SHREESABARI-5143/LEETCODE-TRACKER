import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, ArrowUp, ArrowDown, ArrowUpDown, Filter, X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import RatingBadge from './RatingBadge';
import ExcelColumnFilter, { FilterValue } from './ExcelColumnFilter';
import GlobalSyncButton from './GlobalSyncButton';
import { studentsApi } from '../../api/client';

export interface StudentRow {
  id: string;
  registerNumber: string;
  name: string;
  year: number;
  section: string;
  proctorName: string;
  leetcodeUsername: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  globalRank: number | null;
  contestRating: number;
  dailySolved: number | null;
  weeklySolved: number;
  monthlySolved: number;
  status: 'active' | 'attention' | 'inactive';
}

interface Props {
  year?: 1 | 2 | 3 | 4;
  showAllYears?: boolean;
  onYearChange?: (newYear: 1 | 2 | 3 | 4) => void;
}

type SortField =
  | 'index'
  | 'registerNumber'
  | 'name'
  | 'year'
  | 'section'
  | 'proctorName'
  | 'leetcodeUsername'
  | 'totalSolved'
  | 'easySolved'
  | 'mediumSolved'
  | 'hardSolved'
  | 'globalRank'
  | 'contestRating'
  | 'dailySolved';

export default function YearStudentsTable({ year, showAllYears = false }: Props) {
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, FilterValue | null>>({});

  // Sorting
  const [sortField, setSortField] = useState<SortField>('totalSolved');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const getYearLabel = (y: number) => {
    const map: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
    return map[y] || `${y}th Year`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 500 };
      if (year && !showAllYears) {
        params.year = year;
      }
      const res = await studentsApi.getStudents(params);
      const studentList = res.data?.students || [];

      const mapped: StudentRow[] = studentList.map((s: any) => ({
        id: String(s.id),
        registerNumber: s.registerNumber || s.rollNumber || '',
        name: s.name || '',
        year: s.year || s.yearOfStudy || 1,
        section: s.section || 'A',
        proctorName: s.proctorName || 'Unassigned',
        leetcodeUsername: s.leetcodeUsername || '',
        totalSolved: s.totalSolved || 0,
        easySolved: s.easySolved || 0,
        mediumSolved: s.mediumSolved || 0,
        hardSolved: s.hardSolved || 0,
        globalRank: s.ranking ? Math.round(Number(s.ranking)) : null,
        contestRating: Math.round(Number(s.contestRating) || 0),
        dailySolved: s.dailySolved != null ? Number(s.dailySolved) : null,
        weeklySolved: s.weeklySolved || 0,
        monthlySolved: s.monthlySolved || 0,
        status: s.syncStatus === 'Success' && s.totalSolved > 0 ? 'active' : s.syncStatus === 'Failed' ? 'attention' : 'inactive',
      }));

      setStudents(mapped);
    } catch (err) {
      console.error('Failed to load students table data:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setColumnFilters({});

    const handleSyncComplete = () => {
      loadData();
    };

    window.addEventListener('sync-completed', handleSyncComplete);
    return () => {
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, [year, showAllYears, token]);

  const handleColumnFilterChange = (colId: string, filterVal: FilterValue | null) => {
    setColumnFilters(prev => ({
      ...prev,
      [colId]: filterVal,
    }));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setColumnFilters({});
  };

  // Options for Checkbox filters (ONLY for Section, Proctor, Year)
  const yearOptions = useMemo(() => {
    const years = [1, 2, 3, 4];
    return years.map(y => {
      const count = students.filter(s => s.year === y).length;
      return { value: getYearLabel(y), label: getYearLabel(y), count };
    });
  }, [students]);

  const sectionOptions = useMemo(() => {
    const secs = Array.from(new Set(students.map(s => s.section))).sort();
    return secs.map(sec => {
      const count = students.filter(s => s.section === sec).length;
      return { value: sec, label: `Section ${sec}`, count };
    });
  }, [students]);

  const proctorOptions = useMemo(() => {
    const proctors = Array.from(new Set(students.map(s => s.proctorName))).sort();
    return proctors.map(p => {
      const count = students.filter(s => s.proctorName === p).length;
      return { value: p, label: p, count };
    });
  }, [students]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const textFields: SortField[] = ['name', 'registerNumber', 'section', 'proctorName', 'leetcodeUsername'];
      setSortAsc(textFields.includes(field));
    }
  };

  // Filtered & Sorted Student List
  const processedStudents = useMemo(() => {
    let result = [...students];

    // Global Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.registerNumber.toLowerCase().includes(q) ||
          s.leetcodeUsername.toLowerCase().includes(q) ||
          s.proctorName.toLowerCase().includes(q)
      );
    }

    // Per-column filters (Section, Proctor, Year)
    Object.entries(columnFilters).forEach(([colId, filter]) => {
      if (!filter) return;

      if (filter.type === 'checkbox') {
        const selected = filter.selectedValues;
        result = result.filter(s => {
          let val = '';
          if (colId === 'year') val = getYearLabel(s.year);
          else if (colId === 'section') val = s.section;
          else if (colId === 'proctor') val = s.proctorName;
          return selected.includes(val);
        });
      }
    });

    // Sorting
    result.sort((a, b) => {
      let valA: any = a[sortField as keyof StudentRow];
      let valB: any = b[sortField as keyof StudentRow];

      if (sortField === 'index') {
        valA = a.totalSolved;
        valB = b.totalSolved;
      }

      if (sortField === 'globalRank') {
        const rA = valA === null || valA === 0 ? Infinity : valA;
        const rB = valB === null || valB === 0 ? Infinity : valB;
        return sortAsc ? rA - rB : rB - rA;
      }

      if (valA === null || valA === undefined) return sortAsc ? 1 : -1;
      if (valB === null || valB === undefined) return sortAsc ? -1 : 1;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [students, searchQuery, columnFilters, sortField, sortAsc]);

  const activeFilterCount = useMemo(() => {
    let count = Object.values(columnFilters).filter(Boolean).length;
    if (searchQuery.trim()) count++;
    return count;
  }, [columnFilters, searchQuery]);

  // Overall Metric Summary
  const summary = useMemo(() => {
    const total = students.length;
    const activeToday = students.filter(s => (s.dailySolved ?? 0) > 0).length;
    const activeWeekly = students.filter(s => s.weeklySolved > 0).length;
    return { total, activeToday, activeWeekly };
  }, [students]);

  // CSV Export Handler
  const exportToCSV = () => {
    if (processedStudents.length === 0) return;

    const headers = [
      'S.No',
      'Register Number',
      'Student Name',
      'Year',
      'Section',
      'Proctor',
      'LeetCode Username',
      'Total Solved',
      'Easy Solved',
      'Medium Solved',
      'Hard Solved',
      'Global Rank',
      'Contest Rating',
      'Daily Solved'
    ];

    const rows = processedStudents.map((s, idx) => [
      idx + 1,
      `"${s.registerNumber}"`,
      `"${s.name}"`,
      `"${getYearLabel(s.year)}"`,
      `"${s.section}"`,
      `"${s.proctorName}"`,
      `"${s.leetcodeUsername}"`,
      s.totalSolved,
      s.easySolved,
      s.mediumSolved,
      s.hardSolved,
      s.globalRank ? s.globalRank : 'Unranked',
      s.contestRating,
      s.dailySolved
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filename = year ? `${getYearLabel(year).replace(' ', '_')}_Students.csv` : 'Students_Leaderboard.csv';
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={10} className="inline ml-0.5 opacity-30 group-hover:opacity-70 transition-opacity" />;
    }
    return sortAsc ? (
      <ArrowUp size={10} className="inline ml-0.5 text-[#C58A22]" />
    ) : (
      <ArrowDown size={10} className="inline ml-0.5 text-[#C58A22]" />
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-9 h-9 border-3 border-[#F5F1E8] border-t-[#C58A22] rounded-full animate-spin" />
        <span className="text-xs font-medium text-[#6B7280]">
          Loading student data...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Single Horizontal Row Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Enrolled */}
        <div className="rounded-xl p-3.5 card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">TOTAL ENROLLED</span>
            <div className="text-xl font-bold mt-0.5" style={{ color: '#1F2933' }}>
              {summary.total}
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F5F1E8] text-[#C58A22]">
            {year ? getYearLabel(year) : 'All Years'}
          </span>
        </div>

        {/* Active Today */}
        <div className="rounded-xl p-3.5 card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#4F8A63' }}>ACTIVE TODAY</span>
            <div className="text-xl font-bold mt-0.5" style={{ color: '#4F8A63' }}>
              {summary.activeToday}
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EEF6F1] text-[#4F8A63]">
            {summary.total ? Math.round((summary.activeToday / summary.total) * 100) : 0}% Active
          </span>
        </div>

        {/* Active Week */}
        <div className="rounded-xl p-3.5 card flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#2563EB' }}>ACTIVE WEEK</span>
            <div className="text-xl font-bold mt-0.5" style={{ color: '#2563EB' }}>
              {summary.activeWeekly}
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB]">
            {summary.total ? Math.round((summary.activeWeekly / summary.total) * 100) : 0}% Active
          </span>
        </div>
      </div>

      {/* ── Main Student Table Container (Fits smoothly in single slide view) ── */}
      <div className="rounded-xl card overflow-hidden">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#E5E7EB] px-3.5 py-2.5 gap-3 bg-[#FAFAFA]">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-2.5 py-1 bg-[#FFFFFF] w-full sm:w-64 focus-within:border-[#C58A22]">
              <Search size={13} className="text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search name, reg no, username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-xs bg-transparent border-none outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[#9CA3AF] hover:text-[#1F2933] bg-transparent border-none cursor-pointer">
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Active Filters Clear Button */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="btn btn-ghost btn-sm text-[#C58A22] flex items-center gap-1 hover:bg-[#F5F1E8]"
              >
                <Filter size={11} />
                <span>Reset Filters ({activeFilterCount})</span>
              </button>
            )}
          </div>

          {/* Showing Count, Sync & Export */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs font-medium text-[#6B7280]">
              Showing <strong className="text-[#1F2933]">{processedStudents.length}</strong> of {summary.total}
            </span>

            <GlobalSyncButton year={year} onSyncComplete={loadData} />

            <button
              onClick={exportToCSV}
              className="btn btn-secondary btn-sm flex items-center gap-1 hover:border-[#C58A22] transition-colors"
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
        </div>

        {/* ── Table Area (Tight compact padding, no slide scroll required) ── */}
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10.5px] text-[#4B5563] uppercase tracking-wider border-b border-[#E5E7EB]">
                {/* S.No */}
                <th className="py-2 px-2 text-center w-10">#</th>

                {/* Student Name */}
                <th className="py-2 px-2">
                  <span onClick={() => handleSort('name')} className="cursor-pointer select-none group">
                    STUDENT {renderSortIcon('name')}
                  </span>
                </th>

                {/* Reg. No */}
                <th className="py-2 px-2">
                  <span onClick={() => handleSort('registerNumber')} className="cursor-pointer select-none group">
                    REG. NO {renderSortIcon('registerNumber')}
                  </span>
                </th>

                {/* Year (only shown if showAllYears is true) */}
                {showAllYears && (
                  <th className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center">
                      <span onClick={() => handleSort('year')} className="cursor-pointer select-none group">
                        YEAR {renderSortIcon('year')}
                      </span>
                      <ExcelColumnFilter
                        columnId="year"
                        columnLabel="Academic Year"
                        filterType="checkbox"
                        options={yearOptions}
                        value={columnFilters['year']}
                        onChange={val => handleColumnFilterChange('year', val)}
                      />
                    </div>
                  </th>
                )}

                {/* Section — WITH EXCEL FILTER */}
                <th className="py-2 px-2 text-center">
                  <div className="flex items-center justify-center">
                    <span onClick={() => handleSort('section')} className="cursor-pointer select-none group">
                      SEC {renderSortIcon('section')}
                    </span>
                    <ExcelColumnFilter
                      columnId="section"
                      columnLabel="Section"
                      filterType="checkbox"
                      options={sectionOptions}
                      value={columnFilters['section']}
                      onChange={val => handleColumnFilterChange('section', val)}
                    />
                  </div>
                </th>

                {/* Proctor — WITH EXCEL FILTER */}
                <th className="py-2 px-2">
                  <div className="flex items-center justify-between">
                    <span onClick={() => handleSort('proctorName')} className="cursor-pointer select-none group">
                      PROCTOR {renderSortIcon('proctorName')}
                    </span>
                    <ExcelColumnFilter
                      columnId="proctor"
                      columnLabel="Proctor"
                      filterType="checkbox"
                      options={proctorOptions}
                      value={columnFilters['proctor']}
                      onChange={val => handleColumnFilterChange('proctor', val)}
                    />
                  </div>
                </th>

                {/* Solved */}
                <th className="py-2 px-2 text-right">
                  <span onClick={() => handleSort('totalSolved')} className="cursor-pointer select-none group">
                    SOLVED {renderSortIcon('totalSolved')}
                  </span>
                </th>

                {/* Difficulty */}
                <th className="py-2 px-2 text-center">
                  DIFFICULTY
                </th>

                {/* Global Rank */}
                <th className="py-2 px-2 text-center">
                  <span onClick={() => handleSort('globalRank')} className="cursor-pointer select-none group">
                    GLOBAL RANK {renderSortIcon('globalRank')}
                  </span>
                </th>

                {/* Contest Rating */}
                <th className="py-2 px-2 text-center">
                  <span onClick={() => handleSort('contestRating')} className="cursor-pointer select-none group">
                    RATING {renderSortIcon('contestRating')}
                  </span>
                </th>

                {/* Today */}
                <th className="py-2 px-2 text-right bg-[#FDF8EC]">
                  <span onClick={() => handleSort('dailySolved')} className="cursor-pointer select-none group">
                    TODAY {renderSortIcon('dailySolved')}
                  </span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E5E7EB] text-xs">
              {processedStudents.length === 0 ? (
                <tr>
                  <td colSpan={showAllYears ? 11 : 10} className="text-center py-10 text-[#6B7280]">
                    <p className="font-semibold text-sm">No matching students found</p>
                    <p className="text-xs mt-0.5">Try adjusting your search query or section/proctor filters.</p>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="btn btn-secondary btn-sm mt-2"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                processedStudents.map((s, idx) => (
                  <tr
                    key={s.id}
                    className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                    onClick={() => navigate(`/hod/student/${s.id}`)}
                  >
                    {/* Index */}
                    <td className="py-2 px-2 text-center font-mono text-[10.5px] text-[#9CA3AF]">
                      {idx + 1}
                    </td>

                    {/* Student Name */}
                    <td className="py-2 px-2 font-semibold text-[#1F2933]">
                      <div
                        className="truncate max-w-[140px] hover:text-[#C58A22] hover:underline cursor-pointer transition-colors font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/hod/student/${s.id}`);
                        }}
                        title={`View details for ${s.name}`}
                      >
                        {s.name}
                      </div>
                      <a
                        href={`https://leetcode.com/u/${s.leetcodeUsername}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10.5px] font-medium text-[#C58A22] hover:text-[#9A6B17] hover:underline truncate max-w-[140px] block cursor-pointer transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title={`Open LeetCode profile for @${s.leetcodeUsername}`}
                      >
                        @{s.leetcodeUsername}
                      </a>
                    </td>

                    {/* Reg No */}
                    <td className="py-2 px-2 font-mono font-medium text-[#4B5563] whitespace-nowrap">
                      {s.registerNumber}
                    </td>

                    {/* Year (if showAllYears is true) */}
                    {showAllYears && (
                      <td className="py-2 px-2 text-center">
                        <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-[#F5F1E8] text-[#C58A22]">
                          {getYearLabel(s.year)}
                        </span>
                      </td>
                    )}

                    {/* Section */}
                    <td className="py-2 px-2 text-center">
                      <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-[#F3F4F6] text-[#4B5563]">
                        {s.section}
                      </span>
                    </td>

                    {/* Proctor */}
                    <td className="py-2 px-2 text-[#4B5563] text-[11.5px]">
                      <div className="truncate max-w-[130px]" title={s.proctorName}>{s.proctorName}</div>
                    </td>

                    {/* Solved */}
                    <td className="py-2 px-2 text-right font-extrabold text-xs text-[#1F2933]">
                      {s.totalSolved}
                    </td>

                    {/* Difficulty */}
                    <td className="py-2 px-2 text-center">
                      <div className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap">
                        <span className="text-[#4F8A63] bg-[#EEF6F1] px-1 py-0.5 rounded">
                          Easy {s.easySolved}
                        </span>
                        <span className="text-[#C58A22] bg-[#FDF8EC] px-1 py-0.5 rounded">
                          Med {s.mediumSolved}
                        </span>
                        <span className="text-[#B85C5C] bg-[#FBF0F0] px-1 py-0.5 rounded">
                          Hard {s.hardSolved}
                        </span>
                      </div>
                    </td>

                    {/* Global Rank */}
                    <td className="py-2 px-2 text-center font-medium text-[11px]">
                      {s.globalRank ? (
                        <span className="text-[#1F2933]">#{s.globalRank.toLocaleString()}</span>
                      ) : (
                        <span className="text-[#9CA3AF]">Unranked</span>
                      )}
                    </td>

                    {/* Contest Rating */}
                    <td className="py-2 px-2 text-center">
                      <RatingBadge rating={s.contestRating} showLabel={false} size="sm" />
                    </td>

                    {/* Today */}
                    <td className="py-2 px-2 text-right font-bold bg-[#FDF8EC]">
                    {/* Today — three states: null=no baseline, 0=nothing new, >0=green delta */}
                    {s.dailySolved === null ? (
                      <span
                        className="text-[#9CA3AF] cursor-help"
                        title="Baseline not captured yet — will update after next sync"
                      >
                        —
                      </span>
                    ) : s.dailySolved > 0 ? (
                      <span className="text-[#4F8A63] bg-[#EEF6F1] px-1.5 py-0.5 rounded-full font-bold">
                        +{s.dailySolved}
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">0</span>
                    )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
