import React from 'react';
import { useParams } from 'react-router-dom';
import YearStudentsTable from '../../components/ui/YearStudentsTable';

export default function YearDashboard() {
  const { yearId } = useParams<{ yearId: string }>();
  const year = (parseInt(yearId || '1') as 1 | 2 | 3 | 4) || 1;

  const getYearName = (y: number) => {
    const map: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
    return map[y] || `${y}th Year`;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Simple Clean Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F2933]">
          {getYearName(year)} Students Details
        </h1>
      </div>

      {/* Main Sortable & Filterable Student Table */}
      <YearStudentsTable key={year} year={year} />
    </div>
  );
}
