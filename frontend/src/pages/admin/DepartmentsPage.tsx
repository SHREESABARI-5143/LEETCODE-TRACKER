import React, { useState, useEffect } from 'react';
import { Database, Plus, RefreshCw, Trash2, Edit } from 'lucide-react';
import { departmentsApi } from '../../api/client';
import { toast } from 'react-hot-toast';

export default function DepartmentsPage() {
  const [deptsList, setDeptsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await departmentsApi.getAll();
      if (res.data) setDeptsList(res.data);
    } catch (err) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName || !newDeptCode) return;
    try {
      if (editingDeptId) {
        await departmentsApi.update(editingDeptId, { name: newDeptName, code: newDeptCode });
        toast.success(`Department updated!`);
      } else {
        await departmentsApi.create({ name: newDeptName, code: newDeptCode });
        toast.success(`Department ${newDeptCode} created!`);
      }
      setNewDeptName('');
      setNewDeptCode('');
      setEditingDeptId(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save department');
    }
  };

  const handleEdit = (dept: any) => {
    setEditingDeptId(dept.id);
    setNewDeptName(dept.name);
    setNewDeptCode(dept.code);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await departmentsApi.delete(id);
      toast.success('Department deleted.');
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete department');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1F2933' }}>Departments</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Manage academic departments and view resource allocation.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl p-5 card">
        <h3 className="text-sm font-bold mb-4" style={{ color: '#1F2933' }}>
          {editingDeptId ? 'Edit Department' : 'Create New Department'}
        </h3>
        <form onSubmit={handleSaveDept} className="flex gap-3 mb-6 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Department Name</label>
            <input 
              type="text" 
              placeholder="e.g. Computer Science and Engineering" 
              value={newDeptName}
              onChange={e => setNewDeptName(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div className="w-32">
            <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Code</label>
            <input 
              type="text" 
              placeholder="e.g. CSE" 
              value={newDeptCode}
              onChange={e => setNewDeptCode(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div className="flex gap-2">
            {editingDeptId && (
              <button type="button" onClick={() => { setEditingDeptId(null); setNewDeptName(''); setNewDeptCode(''); }} className="btn btn-secondary h-10">
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary h-10 flex items-center gap-1.5">
              {editingDeptId ? 'Update' : <><Plus size={16} /> Add</>}
            </button>
          </div>
        </form>

        <h3 className="text-sm font-bold mb-4" style={{ color: '#1F2933' }}>All Departments</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deptsList.map(d => (
            <div key={d.id} className="p-4 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] flex flex-col justify-between hover:border-[#D1D5DB] transition-colors group">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-base" style={{ color: '#1F2933' }}>{d.name}</div>
                  <div className="text-xs font-bold px-2 py-1 rounded" style={{ background: '#FDF8EC', color: '#C58A22' }}>{d.code}</div>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold" style={{ color: '#1F2933' }}>{d.studentCount || 0}</span>
                    <span className="text-[10px] uppercase font-bold text-[#6B7280]">Students</span>
                  </div>
                  <div className="w-px bg-[#E5E7EB]"></div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold" style={{ color: '#1F2933' }}>{d.activeStaffCount || 0}</span>
                    <span className="text-[10px] uppercase font-bold text-[#6B7280]">Active Staff</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#E5E7EB] opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(d)} className="p-1.5 text-[#374151] hover:bg-[#F3F4F6] rounded" title="Edit">
                  <Edit size={16} />
                </button>
                <button onClick={() => handleDelete(d.id)} className="p-1.5 text-[#D85C5C] hover:bg-[#FBF0F0] rounded" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {deptsList.length === 0 && !loading && (
            <div className="text-sm text-[#9CA3AF] py-4 col-span-full text-center">No departments configured yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
