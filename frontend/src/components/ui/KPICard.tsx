import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../utils/helpers';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color?: string;
  className?: string;
}

export default function KPICard({ label, value, sub, icon, trend, trendLabel, color = '#C58A22', className }: Props) {
  const isPositive = (trend ?? 0) > 0;
  const isNeutral  = trend === 0 || trend === undefined;

  return (
    <div className={cn('rounded-xl p-5 flex flex-col gap-3 transition-all hover:scale-[1.01]', className)}
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}10`, color: color }}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 16 })}
          </div>
        )}
      </div>

      <div>
        <div className="text-2xl font-bold leading-none" style={{ color: '#1F2933' }}>{value}</div>
        {sub && <div className="text-xs mt-1.5" style={{ color: '#6B7280' }}>{sub}</div>}
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {isNeutral
            ? <Minus size={13} style={{ color: '#6B7280' }} />
            : isPositive
              ? <TrendingUp size={13} style={{ color: '#4F8A63' }} />
              : <TrendingDown size={13} style={{ color: '#B85C5C' }} />
          }
          <span style={{ color: isNeutral ? '#6B7280' : isPositive ? '#4F8A63' : '#B85C5C' }}>
            {!isNeutral && (isPositive ? '↑' : '↓')} {Math.abs(trend)}%
          </span>
          {trendLabel && <span style={{ color: '#9CA3AF' }}>{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
