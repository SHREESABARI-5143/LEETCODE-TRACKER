import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Student } from '../../types';
import DifficultyBar from '../ui/DifficultyBar';
import RatingBadge from '../ui/RatingBadge';

type SortKey = 'name' | 'totalSolved' | 'easySolved' | 'mediumSolved' | 'hardSolved' | 'contestRating' | 'yearRank' | 'dailySolved';

interface Props {
  students: Student[];
  showYear?: boolean;
  showSection?: boolean;
  showProctor?: boolean;
  showRank?: boolean;
  clickable?: boolean;
  navigateTo?: (s: Student) => string;
}

export default function StudentTable({ students, showYear, showSection, showProctor, showRank, clickable = true, navigateTo }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('totalSolved');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const sorted = useMemo(() => {
    let arr = [...students].filter(s =>
      !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.registerNo.toLowerCase().includes(search.toLowerCase()) ||
      s.leetcodeUsername.toLowerCase().includes(search.toLowerCase())
    );
    arr.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'name':          av = a.name.charCodeAt(0); bv = b.name.charCodeAt(0); break;
        case 'totalSolved':   av = a.profile?.totalSolved ?? 0;   bv = b.profile?.totalSolved ?? 0;   break;
        case 'easySolved':    av = a.profile?.easySolved ?? 0;    bv = b.profile?.easySolved ?? 0;    break;
        case 'mediumSolved':  av = a.profile?.mediumSolved ?? 0;  bv = b.profile?.mediumSolved ?? 0;  break;
        case 'hardSolved':    av = a.profile?.hardSolved ?? 0;    bv = b.profile?.hardSolved ?? 0;    break;
        case 'contestRating': av = a.profile?.contestRating ?? 0; bv = b.profile?.contestRating ?? 0; break;
        case 'yearRank':      av = a.yearRank ?? 999;  bv = b.yearRank ?? 999;  break;
        case 'dailySolved':   av = a.dailySolved ?? 0; bv = b.dailySolved ?? 0; break;
        default: av = 0; bv = 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [students, sortKey, sortDir, search]);

  const pages = Math.ceil(sorted.length / PER_PAGE);
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    sortKey === k ? (sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null
  );

  const statusColors: Record<string, string> = { active: '#4F8A63', attention: '#B98228', inactive: '#B85C5C' };
  const statusBgs: Record<string, string> = { active: '#EEF6F1', attention: '#FBF5E8', inactive: '#FBF0F0' };

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search name, register, or username…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              {showRank && <th>#</th>}
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                <span className="flex items-center gap-1">Student <SortIcon k="name" /></span>
              </th>
              <th>Reg. No</th>
              {showYear    && <th>Year</th>}
              {showSection && <th>Sec</th>}
              {showProctor && <th>Proctor</th>}
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('totalSolved')}>
                <span className="flex items-center gap-1">Solved <SortIcon k="totalSolved" /></span>
              </th>
              <th>Difficulty</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('contestRating')}>
                <span className="flex items-center gap-1">Rating <SortIcon k="contestRating" /></span>
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('dailySolved')}>
                <span className="flex items-center gap-1">Today <SortIcon k="dailySolved" /></span>
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s, i) => (
              <tr key={s.id}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                onClick={() => clickable && navigate(navigateTo ? navigateTo(s) : `/hod/student/${s.id}`)}>
                {showRank && (
                  <td className="font-semibold" style={{
                    color: i+(page-1)*PER_PAGE === 0 ? '#C58A22' : i+(page-1)*PER_PAGE === 1 ? '#6B7280' : i+(page-1)*PER_PAGE === 2 ? '#9CA3AF' : '#6B7280',
                    width: 48
                  }}>
                    {i + (page - 1) * PER_PAGE + 1}
                  </td>
                )}
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ background: '#F5F1E8', color: '#C58A22' }}>
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div
                        className="font-semibold text-sm hover:text-[#C58A22] hover:underline cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (clickable) navigate(navigateTo ? navigateTo(s) : `/hod/student/${s.id}`);
                        }}
                      >
                        {s.name}
                      </div>
                      <a
                        href={`https://leetcode.com/u/${s.leetcodeUsername}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#C58A22] hover:underline block cursor-pointer transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{s.leetcodeUsername}
                      </a>
                    </div>
                  </div>
                </td>
                <td style={{ color: '#6B7280', fontSize: '13px' }}>{s.registerNo}</td>
                {showYear    && <td><span className="badge badge-primary" style={{ fontSize: '11px' }}>Year {s.year}</span></td>}
                {showSection && <td style={{ color: '#1F2933' }}>{s.section}</td>}
                {showProctor && <td style={{ color: '#6B7280', fontSize: '13px', maxWidth: 140 }}><span className="truncate block">{s.proctorName}</span></td>}
                <td className="font-semibold" style={{ color: '#1F2933' }}>{s.profile?.totalSolved ?? 'N/A'}</td>
                <td style={{ minWidth: 160 }}>
                  <DifficultyBar easy={s.profile?.easySolved||0} medium={s.profile?.mediumSolved||0} hard={s.profile?.hardSolved||0} showLabels={false} showCounts={false} size="sm" />
                  <div className="flex gap-2 mt-0.5">
                    <span style={{ fontSize:'10px', color:'#6BA66B' }}>E {s.profile?.easySolved}</span>
                    <span style={{ fontSize:'10px', color:'#E59A32' }}>M {s.profile?.mediumSolved}</span>
                    <span style={{ fontSize:'10px', color:'#D85C5C' }}>H {s.profile?.hardSolved}</span>
                  </div>
                </td>
                <td><RatingBadge rating={s.profile?.contestRating||0} size="sm" showLabel={false} /></td>
                <td>
                  {s.dailySolved === null || s.dailySolved === undefined ? (
                    <span style={{ color: '#9CA3AF', fontWeight: 600 }} title="Baseline not captured yet — will update after next sync">—</span>
                  ) : s.dailySolved > 0 ? (
                    <span style={{ color: '#4F8A63', fontWeight: 600 }}>+{s.dailySolved}</span>
                  ) : (
                    <span style={{ color: '#6B7280', fontWeight: 600 }}>0</span>
                  )}
                </td>
                <td>
                  <span className="badge" style={{
                    background: statusBgs[s.status],
                    color: statusColors[s.status],
                    fontSize: '11px',
                    textTransform: 'capitalize',
                  }}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm flex-wrap gap-2" style={{ color: '#6B7280' }}>
          <span>Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, sorted.length)} of {sorted.length} students</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</button>
            {Array.from({ length: Math.min(pages,7) }, (_,i) => {
              const p = pages <= 7 ? i+1 : page <= 4 ? i+1 : page >= pages-3 ? pages-6+i : page-3+i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className="btn btn-sm"
                  style={{
                    background: p===page ? '#C58A22' : '#FFFFFF',
                    color: p===page ? '#FFFFFF' : '#374151',
                    border: '1px solid #D1D5DB'
                  }}>
                  {p}
                </button>
              );
            })}
            <button className="btn btn-secondary btn-sm" disabled={page===pages} onClick={() => setPage(p=>p+1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
