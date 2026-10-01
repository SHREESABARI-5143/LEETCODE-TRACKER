import React, { useState, useEffect } from 'react';
import { Key } from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  departments: any[];
}

export default function AccountModal({ isOpen, onClose, onSave, initialData, departments }: AccountModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'PLACEMENT' | 'HOD' | 'PROCTOR'>('HOD');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setEmail(initialData.email || '');
      setRole(initialData.role || 'HOD');
      setDepartmentId(initialData.department_id || '');
      setPassword(''); // Password is only set on create or reset
    } else {
      setName('');
      setEmail('');
      setRole('HOD');
      setDepartmentId('');
      setPassword('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const generateSecurePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let p = '';
    for (let i = 0; i < 14; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    return p;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ name, email, role, department_id: departmentId || null, password });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-fade-in">
        <h3 className="text-lg font-bold mb-4" style={{ color: '#1F2933' }}>
          {initialData ? 'Edit User Account' : 'Create New User Account'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input w-full" required />
          </div>
          
          {!initialData && (
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Password</label>
              <div className="flex gap-2">
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="input flex-1" required placeholder="Auto-generated or typed" />
                <button type="button" onClick={() => setPassword(generateSecurePassword())} className="btn btn-secondary btn-sm" title="Generate secure password">
                  <Key size={14} /> Generate
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value as any)} className="input w-full">
              <option value="HOD">HOD (Head of Department)</option>
              <option value="PROCTOR">PROCTOR (Faculty Proctor)</option>
              <option value="PLACEMENT">PLACEMENT (Placement Officer)</option>
              <option value="ADMIN">ADMIN (System Administrator)</option>
            </select>
          </div>

          {(role === 'HOD' || role === 'PROCTOR') && (
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#374151' }}>Assigned Department</label>
              <select value={departmentId} onChange={e => setDepartmentId(Number(e.target.value))} className="input w-full" required>
                <option value="">Select Department...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
              {loading ? 'Saving...' : (initialData ? 'Update Account' : 'Create User')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
