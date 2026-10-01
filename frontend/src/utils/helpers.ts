export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`;
  return String(n);
}

export function getRatingTier(rawRating: number): { label: string; color: string; bg: string } {
  const rating = Math.round(Number(rawRating) || 0);
  if (rating >= 2150) return { label: 'Guardian', color: '#B98228', bg: '#FDF8EC' };
  if (rating >= 1850) return { label: 'Knight',   color: '#7C3AED', bg: '#F5F3FF' };
  if (rating >= 1600) return { label: 'Advanced', color: '#2563EB', bg: '#EFF6FF' };
  if (rating >= 1400) return { label: 'Intermediate', color: '#16A34A', bg: '#F0FDF4' };
  if (rating >= 1200) return { label: 'Contestant', color: '#059669', bg: '#ECFDF5' };
  if (rating > 0)     return { label: 'Participant', color: '#4B5563', bg: '#F3F4F6' };
  return { label: 'Unrated', color: '#6B7280', bg: '#F3F4F6' };
}

export function getStatusColor(status: string): string {
  if (status === 'active')    return '#4F8A63';
  if (status === 'attention') return '#B98228';
  return '#B85C5C';
}

export function getActivityColor(count: number): string {
  if (count === 0) return '#E5E7EB';
  if (count <= 2)  return '#C2E0C6';
  if (count <= 4)  return '#93C49B';
  if (count <= 7)  return '#62A76D';
  return '#4F8A63';
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

export function getDifficultyPercent(easy: number, medium: number, hard: number) {
  const total = easy + medium + hard;
  if (!total) return { easy: 0, medium: 0, hard: 0 };
  return {
    easy:   Math.round((easy   / total) * 100),
    medium: Math.round((medium / total) * 100),
    hard:   Math.round((hard   / total) * 100),
  };
}
