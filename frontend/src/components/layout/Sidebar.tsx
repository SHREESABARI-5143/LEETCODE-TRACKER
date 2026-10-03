import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Code2, LayoutDashboard, Users, Trophy, TrendingUp, FileText,
  BarChart3, LogOut, ChevronLeft, ChevronRight,
  Star, AlertTriangle, Upload, ShieldCheck, BookOpen
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { cn } from '../../utils/helpers';
import type { Role } from '../../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Role[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Admin
  { label: 'Dashboard',     path: '/admin',          icon: <LayoutDashboard size={18} />, roles: ['admin'] },
  { label: 'Users',         path: '/admin/users',    icon: <Users size={18} />,           roles: ['admin'] },
  { label: 'Department',    path: '/admin/dept',     icon: <BookOpen size={18} />,        roles: ['admin'] },
  // HOD
  { label: 'Dashboard',     path: '/hod',            icon: <LayoutDashboard size={18} />, roles: ['hod'] },
  { label: '1st Year',      path: '/hod/year/1',     icon: <BookOpen size={18} />,        roles: ['hod'] },
  { label: '2nd Year',      path: '/hod/year/2',     icon: <BookOpen size={18} />,        roles: ['hod'] },
  { label: '3rd Year',      path: '/hod/year/3',     icon: <BookOpen size={18} />,        roles: ['hod'] },
  { label: '4th Year',      path: '/hod/year/4',     icon: <BookOpen size={18} />,        roles: ['hod'] },
  { label: 'Leaderboard',   path: '/hod/leaderboard',icon: <Trophy size={18} />,          roles: ['hod'] },
  { label: 'Daily Rankings', path: '/hod/daily',     icon: <Star size={18} />,            roles: ['hod'] },
  { label: 'Contests',      path: '/hod/contests',   icon: <BarChart3 size={18} />,       roles: ['hod'] },
  { label: 'Proctors',      path: '/hod/proctors',   icon: <ShieldCheck size={18} />,     roles: ['hod'] },
  { label: 'Reports',       path: '/hod/reports',    icon: <FileText size={18} />,        roles: ['hod'] },
  { label: 'Import Students', path: '/hod/import',   icon: <Upload size={18} />,          roles: ['hod'] },
  // Proctor
  { label: 'Dashboard',     path: '/proctor',        icon: <LayoutDashboard size={18} />, roles: ['proctor'] },
  { label: 'My Students',   path: '/proctor/students', icon: <Users size={18} />,         roles: ['proctor'] },
  { label: 'Alerts',        path: '/proctor/alerts', icon: <AlertTriangle size={18} />,   roles: ['proctor'], badge: '!' },
  { label: 'Progress',      path: '/proctor/progress', icon: <TrendingUp size={18} />,    roles: ['proctor'] },
  // Student
  { label: 'My Dashboard',  path: '/student',        icon: <LayoutDashboard size={18} />, roles: ['student'] },
  { label: 'My Profile',    path: '/student/profile',icon: <Users size={18} />,           roles: ['student'] },
  { label: 'Contests',      path: '/student/contests', icon: <Trophy size={18} />,        roles: ['student'] },
  { label: 'Rankings',      path: '/student/rankings', icon: <Star size={18} />,          roles: ['student'] },
];

export default function Sidebar() {
  const { user, institution, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const navigate = useNavigate();

  if (!user) return null;

  const items = NAV_ITEMS.filter(i => i.roles.includes(user.role));

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside
      className="flex flex-col h-screen transition-all duration-300 flex-shrink-0"
      style={{
        width: sidebarCollapsed ? 68 : 240,
        background: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid #E5E7EB', minHeight: 64 }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#F5F1E8', border: '1px solid rgba(197, 138, 34, 0.2)' }}>
          <Code2 size={20} color="#C58A22" />
        </div>
        {!sidebarCollapsed && (
          <div className="animate-fade-in">
            <div className="font-semibold text-sm leading-tight" style={{ color: '#1F2933' }}>CodeTrack</div>
            <div className="text-xs font-medium" style={{ color: '#6B7280' }}>
              {institution?.code || 'NEC'} · {institution?.defaultDepartmentCode || 'DEPT'}
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button onClick={toggleSidebar}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer z-10"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#6B7280' }}>
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Role pill */}
      {!sidebarCollapsed && (
        <div className="px-4 pt-4 pb-2">
          <div className="text-xs font-semibold px-2 py-1 rounded-md inline-block"
            style={{ background: '#F5F1E8', color: '#C58A22', letterSpacing: '0.04em' }}>
            {user.role.toUpperCase()}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {items.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path.split('/').length <= 2}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group',
              isActive
                ? 'text-[#9A6B19] font-semibold'
                : 'text-[#4B5563] hover:text-[#1F2933] hover:bg-[#F9FAFB]'
            )}
            style={({ isActive }) => isActive
              ? {
                  background: '#F5F1E8',
                  borderLeft: '3px solid #C58A22',
                  borderTopLeftRadius: '0px',
                  borderBottomLeftRadius: '0px',
                }
              : { border: '1px solid transparent' }
            }
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!sidebarCollapsed && (
              <span className="truncate animate-fade-in">{item.label}</span>
            )}
            {!sidebarCollapsed && item.badge && (
              <span className="ml-auto text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#B85C5C', color: '#FFFFFF' }}>{item.badge}</span>
            )}
            {sidebarCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 rounded-md text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md"
                style={{ background: '#FFFFFF', color: '#1F2933', border: '1px solid #E5E7EB' }}>
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div style={{ borderTop: '1px solid #E5E7EB', padding: '12px 8px' }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: '#F5F1E8', color: '#C58A22' }}>
            {user.name.charAt(0)}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <div className="text-sm font-medium truncate" style={{ color: '#1F2933' }}>{user.name}</div>
              <div className="text-xs truncate" style={{ color: '#6B7280' }}>{user.email}</div>
            </div>
          )}
          {!sidebarCollapsed && (
            <button onClick={handleLogout} title="Logout"
              className="p-1.5 rounded-md transition-colors flex-shrink-0"
              style={{ color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseOver={e => (e.currentTarget.style.color = '#B85C5C')}
              onMouseOut={e => (e.currentTarget.style.color = '#9CA3AF')}>
              <LogOut size={15} />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <button onClick={handleLogout} className="w-full flex justify-center mt-2 p-2 rounded-lg transition-colors"
            style={{ color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseOver={e => (e.currentTarget.style.color = '#B85C5C')}
            onMouseOut={e => (e.currentTarget.style.color = '#9CA3AF')}>
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}
