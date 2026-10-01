import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { studentsApi } from '../../api/client';

interface Props {
  year?: number;
  className?: string;
  onSyncComplete?: () => void;
  label?: string;
}

export default function GlobalSyncButton({ year, className = '', onSyncComplete, label }: Props) {
  const { user } = useAuthStore();
  const [isSyncing, setIsSyncing] = useState(false);

  // Allow only Admin, Placement or HOD to trigger overall sync
  const canSync = user?.role === 'admin' || user?.role === 'hod' || user?.role === 'placement';

  const handleStartSync = async () => {
    if (!canSync) {
      toast.error('Only Admins, Placement Officers, or HODs can trigger sync');
      return;
    }

    if (isSyncing) {
      toast('Sync is already running', { icon: '⏳' });
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading(
      year ? `Starting sync for Year ${year}…` : 'Starting live sync for all students…'
    );

    try {
      await studentsApi.syncAllWithProgress({
        year,
        pollIntervalMs: 900,
        timeoutMs: 120_000,
        onProgress: ({ completed, total, progressPercentage, successful, failed }) => {
          toast.loading(
            `Syncing… ${completed}/${total} (${progressPercentage}%) — ${successful} OK, ${failed} failed`,
            { id: toastId }
          );
        },
      });

      toast.success(`Sync complete!`, { id: toastId });
      if (onSyncComplete) onSyncComplete();
      window.dispatchEvent(new CustomEvent('sync-completed'));
    } catch (err: any) {
      const msg = err?.message || 'Failed to sync';
      toast.error(msg, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={handleStartSync}
        disabled={isSyncing}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#C58A22] hover:bg-[#A87418] transition-colors border-none cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-70"
        title="Fetch live LeetCode statistics and rankings"
      >
        <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
        <span>{label || (year ? `Sync Year ${year}` : 'Overall Sync')}</span>
      </button>
    </div>
  );
}
