import React from 'react';
import YearStudentsTable from '../../components/ui/YearStudentsTable';
import { Trophy } from 'lucide-react';

export default function Leaderboard() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FDF8EC] text-[#C58A22] border border-[#C58A22]/20">
            <Trophy size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2933]">
              Department Leaderboard
            </h1>
            <p className="text-xs text-[#6B7280]">
              Overall student rankings across all academic years & sections
            </p>
          </div>
        </div>
      </div>

      {/* Main Sortable & Excel Filterable Table */}
      <YearStudentsTable showAllYears={true} />
    </div>
  );
}
