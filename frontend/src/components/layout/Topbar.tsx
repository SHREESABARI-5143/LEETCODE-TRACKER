import React from 'react';
import { Sun, Moon, Bell } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import GlobalSyncButton from '../ui/GlobalSyncButton';

interface Props { title?: string; subtitle?: string; actions?: React.ReactNode; }

export default function Topbar({ title, subtitle, actions }: Props) {
  const { user } = useAuthStore();

  const roleLabels: Record<string, string> = { admin: 'System Admin', hod: 'Head of Department', proctor: 'Faculty Proctor', student: 'Student' };

  return (
    <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
      {/* Title */}
      <div className="flex-1 min-w-0">
        {title && <h2 className="font-semibold text-base leading-tight truncate" style={{ color: '#1F2933' }}>{title}</h2>}
        {subtitle && <p className="text-xs truncate" style={{ color: '#6B7280', marginTop: 2 }}>{subtitle}</p>}
      </div>

      {/* Actions & Overall Sync */}
      <div className="flex items-center gap-2">
        {actions}
        <GlobalSyncButton />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto">
        <div className="flex items-center gap-2 pl-3 ml-1" style={{ borderLeft: '1px solid #E5E7EB' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: '#F5F1E8', color: '#C58A22' }}>
            {user?.name?.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-medium leading-tight" style={{ color: '#1F2933' }}>{user?.name}</div>
            <div className="text-xs" style={{ color: '#6B7280' }}>{roleLabels[user?.role || '']}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
