import React, { useMemo } from 'react';
import { getActivityColor } from '../../utils/helpers';
import type { ActivityDay } from '../../types';

interface Props { activity: ActivityDay[]; weeks?: number; }

export default function ActivityHeatmap({ activity, weeks = 26 }: Props) {
  const grid = useMemo(() => {
    const today = new Date();
    const startDay = new Date(today);
    startDay.setDate(startDay.getDate() - weeks * 7 + 1);

    const map = new Map(activity.map(a => [a.date, a.count]));
    const cols: { date: string; count: number }[][] = [];

    let cur = new Date(startDay);
    // Align to Sunday
    while (cur.getDay() !== 0) cur.setDate(cur.getDate() - 1);

    while (cur <= today) {
      const col: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const ds = cur.toISOString().split('T')[0];
        col.push({ date: ds, count: cur <= today ? (map.get(ds) ?? 0) : -1 });
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  }, [activity, weeks]);

  const months = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((col, ci) => {
      const d = new Date(col[0].date);
      const m = d.getMonth();
      if (m !== lastMonth) {
        labels.push({ label: d.toLocaleString('default', { month: 'short' }), col: ci });
        lastMonth = m;
      }
    });
    return labels;
  }, [grid]);

  const totalSolved = activity.reduce((a, d) => a + d.count, 0);
  const activeDays  = activity.filter(d => d.count > 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>ACTIVITY — LAST {weeks} WEEKS</span>
        <div className="flex gap-4">
          <span className="text-xs" style={{ color: '#6B7280' }}>{totalSolved} submissions</span>
          <span className="text-xs" style={{ color: '#6B7280' }}>{activeDays} active days</span>
        </div>
      </div>

      {/* Month labels */}
      <div className="flex gap-1 mb-1" style={{ paddingLeft: 0 }}>
        {grid.map((_, ci) => {
          const ml = months.find(m => m.col === ci);
          return (
            <div key={ci} className="flex-shrink-0" style={{ width: 11 }}>
              {ml ? <span className="text-xs" style={{ color: '#6B7280', fontSize: '10px' }}>{ml.label}</span> : null}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {grid.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((cell, ri) => (
              <div key={ri} title={cell.count >= 0 ? `${cell.date}: ${cell.count} solved` : ''}
                style={{
                  width: 11, height: 11,
                  borderRadius: 2,
                  background: cell.count < 0 ? 'transparent' : getActivityColor(cell.count),
                  cursor: cell.count > 0 ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-xs" style={{ color: '#6B7280' }}>Less</span>
        {[0,2,4,6,9].map(n => (
          <div key={n} style={{ width: 10, height: 10, borderRadius: 2, background: getActivityColor(n), flexShrink: 0 }} />
        ))}
        <span className="text-xs" style={{ color: '#6B7280' }}>More</span>
      </div>
    </div>
  );
}
