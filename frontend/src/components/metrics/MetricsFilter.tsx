import React, { useState, useEffect } from 'react';
import { Calendar, RotateCcw } from 'lucide-react';

interface MetricsFilterProps {
  startDate: string;
  endDate: string;
  onFilter: (start: string, end: string) => void;
}

export const MetricsFilter = ({ startDate, endDate, onFilter }: MetricsFilterProps) => {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  // Sync internal state if props change externally (though unlikely in this flow)
  useEffect(() => {
    setStart(startDate);
    setEnd(endDate);
  }, [startDate, endDate]);

  const handleApply = () => {
    onFilter(start, end);
  };

  const handleReset = () => {
    const now = new Date();
    // Local time formatted as YYYY-MM-DD
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Format manually to avoid timezone issues with toISOString
    const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const s = formatDate(firstDay);
    const e = formatDate(lastDay);

    setStart(s);
    setEnd(e);
    onFilter(s, e);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row items-end md:items-center gap-4">
      <div className="flex flex-col gap-1 w-full md:w-auto">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Начало периода
        </label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col gap-1 w-full md:w-auto">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Конец периода
        </label>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
        <button
          onClick={handleApply}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex-1 md:flex-none"
        >
          Применить
        </button>
        <button
          onClick={handleReset}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 flex-1 md:flex-none justify-center"
        >
          <RotateCcw className="w-4 h-4" /> Сбросить
        </button>
      </div>
    </div>
  );
};
