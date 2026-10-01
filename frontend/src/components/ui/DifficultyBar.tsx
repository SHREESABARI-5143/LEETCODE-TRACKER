import React from 'react';
import { getDifficultyPercent } from '../../utils/helpers';

interface Props {
  easy: number;
  medium: number;
  hard: number;
  showLabels?: boolean;
  showCounts?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function DifficultyBar({ easy, medium, hard, showLabels = true, showCounts = true, size = 'md' }: Props) {
  const pct = getDifficultyPercent(easy, medium, hard);
  const total = easy + medium + hard;
  const height = size === 'sm' ? 5 : size === 'lg' ? 9 : 7;
  const fontSize = size === 'sm' ? '11px' : '13px';

  return (
    <div className="w-full">
      {/* Bar */}
      <div className="flex rounded-full overflow-hidden w-full" style={{ height, background: '#E5E7EB', gap: 1 }}>
        {pct.easy > 0 && (
          <div style={{ width: `${pct.easy}%`, background: '#6BA66B', borderRadius: '999px 0 0 999px', transition: 'width 0.6s ease' }} />
        )}
        {pct.medium > 0 && (
          <div style={{ width: `${pct.medium}%`, background: '#E59A32', transition: 'width 0.6s ease' }} />
        )}
        {pct.hard > 0 && (
          <div style={{ width: `${pct.hard}%`, background: '#D85C5C', borderRadius: '0 999px 999px 0', transition: 'width 0.6s ease' }} />
        )}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex gap-4 mt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#6BA66B' }} />
            <span style={{ fontSize, color: '#6B7280' }}>Easy</span>
            {showCounts && <span style={{ fontSize, color: '#6BA66B', fontWeight: 600 }}>{easy}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E59A32' }} />
            <span style={{ fontSize, color: '#6B7280' }}>Med</span>
            {showCounts && <span style={{ fontSize, color: '#E59A32', fontWeight: 600 }}>{medium}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#D85C5C' }} />
            <span style={{ fontSize, color: '#6B7280' }}>Hard</span>
            {showCounts && <span style={{ fontSize, color: '#D85C5C', fontWeight: 600 }}>{hard}</span>}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span style={{ fontSize, color: '#1F2933', fontWeight: 600 }}>{total}</span>
            <span style={{ fontSize, color: '#6B7280' }}>total</span>
          </div>
        </div>
      )}
    </div>
  );
}
