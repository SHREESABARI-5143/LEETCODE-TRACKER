import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Code2, Lock, Mail, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isLoading, error, clearError, institution } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (user) {
      const routes: Record<string, string> = { admin: '/admin', hod: '/hod', proctor: '/proctor', placement: '/admin' };
      navigate(routes[user.role] || '/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login(email, password);
    if (success) {
      // Handled by useEffect redirect
    }
  };

  const instName = institution?.name || 'Nandha Engineering College';
  const instCode = institution?.code || 'NEC';
  const deptCode = institution?.defaultDepartmentCode || 'DEPT';

  return (
    <div className="min-h-screen flex" style={{ background: '#F4F6F5' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] p-12" style={{ background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F5F1E8', border: '1px solid rgba(197, 138, 34, 0.2)' }}>
            <Code2 size={22} color="#C58A22" />
          </div>
          <div>
            <div className="font-semibold text-lg tracking-tight" style={{ color: '#1F2933' }}>CodeTrack</div>
            <div className="text-xs" style={{ color: '#6B7280' }}>{instCode} · {deptCode} Department</div>
          </div>
        </div>

        <div>
          <div className="mb-6">
            <div className="text-3xl font-bold mb-3 leading-tight" style={{ color: '#1F2933' }}>
              Track Every Student's<br />
              <span style={{ color: '#C58A22' }}>LeetCode Journey</span>
            </div>
            <p style={{ color: '#6B7280', lineHeight: 1.6 }}>
              A centralised analytics platform to monitor performance, evaluate contests, and celebrate achievements with department-level role-based access.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { n: 'Live Sync', label: 'LeetCode GraphQL' },
              { n: '4 Roles', label: 'Admin, HOD, Proctor, Placement' },
              { n: 'Daily Ranks', label: 'Automated Snapshots' },
              { n: 'Export', label: 'Multi-Sheet Excel' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 border border-[#E5E7EB]" style={{ background: '#FFFFFF' }}>
                <div className="text-xl font-bold" style={{ color: '#C58A22' }}>{s.n}</div>
                <div className="text-xs mt-1" style={{ color: '#6B7280' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs" style={{ color: '#9CA3AF' }}>© {new Date().getFullYear()} {instName}. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] animate-fade-in p-8 card" style={{ background: '#FFFFFF' }}>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#F5F1E8' }}>
              <Code2 size={18} color="#C58A22" />
            </div>
            <span className="font-bold" style={{ color: '#1F2933' }}>CodeTrack</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#1F2933' }}>Welcome back</h1>
            <p style={{ color: '#6B7280' }}>Sign in to your CodeTrack account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: '#6B7280' }}>Email Address</label>
              <div className="relative">
                <Mail size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color: '#9CA3AF' }} />
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="name@institution.edu"
                  className="input pl-10" 
                  required 
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: '#6B7280' }}>Password</label>
              <div className="relative">
                <Lock size={16} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color: '#9CA3AF' }} />
                <input 
                  type={showPw ? 'text' : 'password'} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  className="input pl-10 pr-10" 
                  required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPw(!showPw)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color: '#9CA3AF' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg px-4 py-3 border border-[#FCA5A5]" style={{ background: '#FBF0F0' }}>
                <AlertCircle size={15} color="#D85C5C" />
                <span className="text-sm font-semibold" style={{ color:'#D85C5C' }}>{error}</span>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full justify-center" style={{ width:'100%' }}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">Sign In <ChevronRight size={16} /></span>
              )}
            </button>
          </form>

          <p className="text-xs text-center mt-8" style={{ color: '#9CA3AF' }}>
            {instName} · {deptCode} Department
          </p>
        </div>
      </div>
    </div>
  );
}
