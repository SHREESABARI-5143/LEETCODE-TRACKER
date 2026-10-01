import React, { useState, useEffect } from 'react';
import KPICard from '../../components/ui/KPICard';
import { Users, Settings, Database, Shield, Upload, Activity, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { formatNumber } from '../../utils/helpers';
import { reportsApi, usersApi, departmentsApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'react-hot-toast';

export default function AdminDashboard() {
  const { institution } = useAuthStore();
  const [overall, setOverall] = useState<any>({
    totalStudents: 0,
    activeStudents: 0,
    analyzedStudents: 0,
    totalSolved: 0,
    avgSolved: 0
  });
  const [usersList, setUsersList] = useState<any[]>([]);
  const [deptsList, setDeptsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN'|'PLACEMENT'|'HOD'|'PROCTOR'>('HOD');
  const [newUserDept, setNewUserDept] = useState<number | ''>('');

  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [repRes, usersRes, deptsRes] = await Promise.all([
        reportsApi.getOverall(),
        usersApi.getAll(),
        departmentsApi.getAll()
      ]);
      if (repRes.data) setOverall(repRes.data);
      if (usersRes.data) setUsersList(usersRes.data);
      if (deptsRes.data) setDeptsList(deptsRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await usersApi.create({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
        department_id: newUserDept || null
      });
      toast.success('User account created successfully!');
      setIsModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      await loadAdminData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) return;
    try {
      await departmentsApi.create({ name: newDeptName, code: newDeptCode });
      toast.success(`Department ${newDeptCode} created!`);
      setNewDeptName('');
      setNewDeptCode('');
      await loadAdminData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create department');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await usersApi.delete(userId);
      toast.success('User deleted.');
      await loadAdminData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1F2933' }}>System Administration</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            CodeTrack · {institution?.name || 'Nandha Engineering College'} · Global Access
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm flex items-center gap-1.5 cursor-pointer">
            <Plus size={14} /> Add User
          </button>
          <button onClick={loadAdminData} className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Students" value={overall.totalStudents || 0} icon={<Users size={18}/>} />
        <KPICard label="Total Solved" value={formatNumber(overall.totalSolved || 0)} icon={<Activity size={18}/>} color="#4F8A63" />
        <KPICard label="Active Users" value={usersList.length} icon={<Shield size={18}/>} color="#C58A22" />
        <KPICard label="Departments" value={deptsList.length} icon={<Database size={18}/>} color="#E59A32" />
      </div>

      {/* Department creation & listing */}
      <div className="rounded-xl p-5 card">
        <h3 className="text-sm font-bold mb-4" style={{ color: '#1F2933' }}>Departments Management</h3>
        <form onSubmit={handleCreateDept} className="flex gap-3 mb-4 flex-wrap">
          <input 
            type="text" 
            placeholder="Department Name (e.g. Computer Science)" 
            value={newDeptName}
            onChange={e => setNewDeptName(e.target.value)}
            className="input flex-1 min-w-[200px]"
            required
          />
          <input 
            type="text" 
            placeholder="Code (e.g. CSE)" 
            value={newDeptCode}
            onChange={e => setNewDeptCode(e.target.value)}
            className="input w-32"
            required
          />
          <button type="submit" className="btn btn-primary btn-sm">Add Department</button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {deptsList.map(d => (
            <div key={d.id} className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between">
              <div>
                <div className="font-bold text-sm" style={{ color: '#1F2933' }}>{d.name}</div>
                <div className="text-xs text-[#C58A22] font-semibold">{d.code}</div>
              </div>
            </div>
          ))}
          {deptsList.length === 0 && (
            <div className="text-xs text-[#9CA3AF] py-3 col-span-full">No departments configured yet. Add one above.</div>
          )}
        </div>
      </div>

      {/* User accounts table */}
      <div className="rounded-xl p-5 card">
        <h3 className="text-sm font-bold mb-4" style={{ color: '#1F2933' }}>System User Accounts (RBAC)</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersList.map(u => (
              <tr key={u.id}>
                <td>
                  <span className="badge" style={{
                    background: u.role==='ADMIN'?'#FBF0F0':u.role==='HOD'?'#FDF8EC':u.role==='PROCTOR'?'#F5F3FF':'#EEF6F1',
                    color: u.role==='ADMIN'?'#D85C5C':u.role==='HOD'?'#C58A22':u.role==='PROCTOR'?'#7C3AED':'#4F8A63',
                    fontSize:'11px'
                  }}>
                    {u.role}
                  </span>
                </td>
                <td className="font-semibold" style={{ color: '#1F2933' }}>{u.name}</td>
                <td style={{ color:'#6B7280', fontSize:'13px' }}>{u.email}</td>
                <td style={{ color:'#1F2933' }}>{u.department_code || u.department_name || 'Global'}</td>
                <td>
                  <span className="badge text-xs" style={{ background: u.is_active ? '#EEF6F1' : '#FBF0F0', color: u.is_active ? '#4F8A63' : '#D85C5C' }}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button onClick={() => handleDeleteUser(u.id)} className="p-1 text-[#D85C5C] hover:bg-[#FBF0F0] rounded cursor-pointer" title="Delete User">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-fade-in">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#1F2933' }}>Create New User Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Full Name</label>
                <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="input w-full" required />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Email Address</label>
                <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="input w-full" required />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Password</label>
                <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="input w-full" required />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Role</label>
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as any)} className="input w-full">
                  <option value="HOD">HOD (Head of Department)</option>
                  <option value="PROCTOR">PROCTOR (Faculty Proctor)</option>
                  <option value="PLACEMENT">PLACEMENT (Placement Officer)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                </select>
              </div>
              {(newUserRole === 'HOD' || newUserRole === 'PROCTOR') && (
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Assigned Department</label>
                  <select value={newUserDept} onChange={e => setNewUserDept(Number(e.target.value))} className="input w-full" required>
                    <option value="">Select Department...</option>
                    {deptsList.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
