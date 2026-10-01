import React, { useState, useEffect, useMemo } from 'react';
import KPICard from '../../components/ui/KPICard';
import { Users, Shield, ShieldCheck, Activity, Plus, RefreshCw, Trash2, Key, Edit, Power } from 'lucide-react';
import { usersApi, departmentsApi } from '../../api/client';
import client from '../../api/client';
import { toast } from 'react-hot-toast';
import AccountModal from '../../components/admin/AccountModal';

export default function StaffAccountsPage() {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [deptsList, setDeptsList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'global' | 'department'>('global');
  const [selectedDeptId, setSelectedDeptId] = useState<number | 'all'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetUserName, setResetUserName] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, deptsRes, statsRes] = await Promise.all([
        usersApi.getAll(),
        departmentsApi.getAll(),
        usersApi.getStats()
      ]);
      if (usersRes.data) setUsersList(usersRes.data);
      if (deptsRes.data) setDeptsList(deptsRes.data);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load accounts data:', err);
      toast.error('Failed to load accounts data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveUser = async (data: any) => {
    try {
      if (editingUser) {
        // Edit mode (do not send password if empty)
        const updateData = { ...data };
        if (!updateData.password) delete updateData.password;
        await usersApi.update(editingUser.id, updateData);
        toast.success('User account updated!');
      } else {
        // Create mode
        await usersApi.create(data);
        toast.success('User account created!');
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save user account.');
      throw err; // throw to stop modal from closing
    }
  };

  const handleToggleStatus = async (user: any) => {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      toast.success(`Account ${!user.is_active ? 'reactivated' : 'deactivated'}.`);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to update account status.');
    }
  };

  const openResetModal = (u: any) => {
    setResetUserId(u.id);
    setResetUserName(u.name);
    setResetPassword('');
    setIsResetModalOpen(true);
  };

  const generateSecurePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let p = '';
    for (let i = 0; i < 14; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    return p;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId || !resetPassword) return;
    try {
      await client.request(`/api/users/${resetUserId}/reset-password`, { 
        method: 'POST', 
        body: JSON.stringify({ password: resetPassword }) 
      });
      toast.success(`Password reset successfully for ${resetUserName}. Sessions invalidated.`);
      setIsResetModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const filteredUsers = useMemo(() => {
    if (viewMode === 'global') return usersList;
    if (selectedDeptId === 'all') return usersList.filter(u => u.role === 'HOD' || u.role === 'PROCTOR');
    return usersList.filter(u => u.department_id === selectedDeptId);
  }, [usersList, viewMode, selectedDeptId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1F2933' }}>Staff Accounts</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Manage all system roles, access, and permissions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingUser(null); setIsModalOpen(true); }} className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Plus size={14} /> Add Account
          </button>
          <button onClick={loadData} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Accounts" value={stats.total || 0} icon={<Users size={18}/>} />
          <KPICard label="Active Admins" value={stats.byRole?.ADMIN || 0} icon={<Shield size={18}/>} color="#D85C5C" />
          <KPICard label="Total HODs" value={stats.byRole?.HOD || 0} icon={<ShieldCheck size={18}/>} color="#C58A22" />
          <KPICard label="Total Proctors" value={stats.byRole?.PROCTOR || 0} icon={<Activity size={18}/>} color="#7C3AED" />
        </div>
      )}

      <div className="rounded-xl p-5 card">
        <div className="flex items-center justify-between mb-4 border-b border-[#E5E7EB] pb-3">
          <div className="flex gap-4">
            <button 
              className={`text-sm font-semibold pb-1 ${viewMode === 'global' ? 'border-b-2 border-[#1F2933] text-[#1F2933]' : 'text-[#6B7280]'}`}
              onClick={() => setViewMode('global')}
            >
              Global View
            </button>
            <button 
              className={`text-sm font-semibold pb-1 ${viewMode === 'department' ? 'border-b-2 border-[#1F2933] text-[#1F2933]' : 'text-[#6B7280]'}`}
              onClick={() => setViewMode('department')}
            >
              Department-wise View
            </button>
          </div>
          
          {viewMode === 'department' && (
            <select 
              value={selectedDeptId} 
              onChange={e => setSelectedDeptId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="input py-1 px-3 text-sm h-8"
            >
              <option value="all">All Departments</option>
              {deptsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>

        <div className="overflow-x-auto">
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
              {filteredUsers.map(u => (
                <tr key={u.id} className={!u.is_active ? 'opacity-70' : ''}>
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} className="p-1 text-[#374151] hover:bg-[#F3F4F6] rounded" title="Edit">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleToggleStatus(u)} className={`p-1 rounded ${u.is_active ? 'text-[#D85C5C] hover:bg-[#FBF0F0]' : 'text-[#4F8A63] hover:bg-[#EEF6F1]'}`} title={u.is_active ? 'Deactivate' : 'Reactivate'}>
                        <Power size={14} />
                      </button>
                      <button onClick={() => openResetModal(u)} className="p-1 text-[#C58A22] hover:bg-[#FDF8EC] rounded" title="Reset Password">
                        <Key size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#6B7280]">No accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AccountModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingUser(null); }}
        onSave={handleSaveUser}
        initialData={editingUser}
        departments={deptsList}
      />

      {/* Reset Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl animate-fade-in">
            <h3 className="text-lg font-bold mb-2" style={{ color: '#1F2933' }}>Reset Password</h3>
            <p className="text-xs text-[#6B7280] mb-4">Resetting password for <strong>{resetUserName}</strong>. This will log them out immediately.</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>New Temporary Password</label>
                <div className="flex gap-2">
                  <input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="input flex-1" required placeholder="Type or generate..." />
                  <button type="button" onClick={() => setResetPassword(generateSecurePassword())} className="btn btn-secondary btn-sm" title="Generate secure password">
                    <Key size={14} />
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsResetModalOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Force Reset</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
