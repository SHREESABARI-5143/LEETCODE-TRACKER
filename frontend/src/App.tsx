import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Layout
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';

// HOD
import HODDashboard from './pages/hod/HODDashboard';
import YearDashboard from './pages/hod/YearDashboard';
import Leaderboard from './pages/hod/Leaderboard';
import DailyRankings from './pages/hod/DailyRankings';
import ContestAnalytics from './pages/hod/ContestAnalytics';
import ContestDetail from './pages/hod/ContestDetail';
import ProctorPerformance from './pages/hod/ProctorPerformance';
import Reports from './pages/hod/Reports';

// Proctor
import ProctorDashboard from './pages/proctor/ProctorDashboard';
import ProctorStudents from './pages/proctor/ProctorStudents';
import ProctorAlerts from './pages/proctor/ProctorAlerts';
import ProctorProgress from './pages/proctor/ProctorProgress';

// Student
import StudentDashboard from './pages/student/StudentDashboard';

// Shared
import StudentProfile from './pages/shared/StudentProfile';
import ImportStudents from './pages/shared/ImportStudents';

function RoleRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  const routes: Record<string, string> = { admin: '/admin', hod: '/hod', proctor: '/proctor', student: '/student' };
  return <Navigate to={routes[user.role] || '/login'} replace />;
}

export default function App() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && user.role && user.role !== user.role.toLowerCase()) {
      useAuthStore.setState({
        user: { ...user, role: user.role.toLowerCase() as any }
      });
    }
  }, [user]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#111827', color: '#f1f5f9', border: '1px solid #1f2937' },
      }} />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RoleRedirect />} />

        {/* Admin */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/admin"        element={<AdminDashboard />} />
            <Route path="/admin/import" element={<ImportStudents />} />
            <Route path="/admin/users"  element={<AdminDashboard />} />
            <Route path="/admin/dept"   element={<AdminDashboard />} />
            <Route path="/admin/student/:studentId" element={<StudentProfile />} />
          </Route>
        </Route>

        {/* HOD */}
        <Route element={<ProtectedRoute allowedRoles={['hod', 'admin']} />}>
          <Route element={<AppShell />}>
            <Route path="/hod"                     element={<HODDashboard />} />
            <Route path="/hod/year/:yearId"        element={<YearDashboard />} />
            <Route path="/hod/leaderboard"         element={<Leaderboard />} />
            <Route path="/hod/daily"               element={<DailyRankings />} />
            <Route path="/hod/contests"            element={<ContestAnalytics />} />
            <Route path="/hod/contests/:contestSlug" element={<ContestDetail />} />
            <Route path="/hod/proctors"            element={<ProctorPerformance />} />
            <Route path="/hod/reports"             element={<Reports />} />
            <Route path="/hod/import"              element={<ImportStudents />} />
            <Route path="/hod/student/:studentId"  element={<StudentProfile />} />
          </Route>
        </Route>

        {/* Proctor */}
        <Route element={<ProtectedRoute allowedRoles={['proctor']} />}>
          <Route element={<AppShell />}>
            <Route path="/proctor"                        element={<ProctorDashboard />} />
            <Route path="/proctor/students"               element={<ProctorStudents />} />
            <Route path="/proctor/alerts"                 element={<ProctorAlerts />} />
            <Route path="/proctor/progress"               element={<ProctorProgress />} />
            <Route path="/proctor/student/:studentId"     element={<StudentProfile />} />
          </Route>
        </Route>

        {/* Student */}
        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route element={<AppShell />}>
            <Route path="/student"             element={<StudentDashboard />} />
            <Route path="/student/profile"     element={<StudentDashboard />} />
            <Route path="/student/contests"    element={<StudentDashboard />} />
            <Route path="/student/rankings"    element={<StudentDashboard />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
