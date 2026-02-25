import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UserMetricsTable } from './UserMetricsTable';
import { ChevronUp } from 'lucide-react';

interface Department {
  name: string;
  total: number;
  approved: number;
  rejected: number;
  avgTime: number;
  users: any[];
}

export const DepartmentStats = ({ data }: { data: Department[] }) => {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  const formatTime = (ms: number) => {
    if (!ms) return '-';
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours.toFixed(1)} ч`;
    return `${(hours / 24).toFixed(1)} дн`;
  };

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Загрузка по департаментам</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                onClick={(state) => {
                    if (state && state.activeLabel) {
                        const dept = data.find(d => d.name === state.activeLabel);
                        setSelectedDept(dept || null);
                    }
                }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip cursor={{fill: '#f3f4f6'}} />
                <Legend />
                <Bar dataKey="approved" name="Согласовано" fill="#22c55e" stackId="a" />
                <Bar dataKey="rejected" name="Отклонено" fill="#ef4444" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">Кликните на столбец или строку таблицы для детализации</p>
        </div>

        {/* Table */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Сводка по департаментам</h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Департамент</th>
                  <th className="px-4 py-3 font-medium text-center">Всего</th>
                  <th className="px-4 py-3 font-medium text-center">Ср. время</th>
                </tr>
              </thead>
              <tbody>
                {data.map((dept) => (
                  <tr
                    key={dept.name}
                    onClick={() => setSelectedDept(dept)}
                    className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${selectedDept?.name === dept.name ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{dept.name}</td>
                    <td className="px-4 py-3 text-center">{dept.total}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{formatTime(dept.avgTime)}</td>
                  </tr>
                ))}
                 {data.length === 0 && (
                    <tr><td colSpan={3} className="p-4 text-center text-gray-400">Нет данных</td></tr>
                 )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drill Down */}
      {selectedDept && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="flex justify-between items-center mb-4 border-b pb-2">
             <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-800">
                Детализация: {selectedDept.name}
                </h3>
                <span className="text-sm text-gray-500">({selectedDept.users.length} сотр.)</span>
             </div>

             <button
                onClick={() => setSelectedDept(null)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
             >
               <ChevronUp className="w-4 h-4" /> Скрыть
             </button>
           </div>
           <UserMetricsTable users={selectedDept.users} />
        </div>
      )}
    </div>
  );
};
