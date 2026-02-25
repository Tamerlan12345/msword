import React from 'react';
import { Clock, Check, X, Zap, Snail } from 'lucide-react';

interface UserMetric {
  id: string;
  name: string;
  total: number;
  approved: number;
  rejected: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
}

const formatTime = (ms: number) => {
    if (!ms && ms !== 0) return '-';
    // If less than a minute, show seconds? Or "< 1 min"
    if (ms < 60000) return '< 1 мин';

    const mins = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}д ${hours % 24}ч`;
    if (hours > 0) return `${hours}ч ${mins % 60}м`;
    return `${mins} мин`;
};

export const UserMetricsTable = ({ users }: { users: UserMetric[] }) => {
  // Sort by name or total? Default by name
  const sortedUsers = [...users].sort((a, b) => b.total - a.total);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            <th className="px-4 py-3">Сотрудник</th>
            <th className="px-4 py-3 text-center">Всего</th>
            <th className="px-4 py-3 text-center text-green-600"><Check className="w-4 h-4 mx-auto" /></th>
            <th className="px-4 py-3 text-center text-red-600"><X className="w-4 h-4 mx-auto" /></th>
            <th className="px-4 py-3 text-center">Ср. время</th>
            <th className="px-4 py-3 text-center" title="Самое быстрое"><Zap className="w-4 h-4 mx-auto text-yellow-500" /></th>
            <th className="px-4 py-3 text-center" title="Самое долгое"><Snail className="w-4 h-4 mx-auto text-orange-500" /></th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => (
            <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
              <td className="px-4 py-3 text-center font-bold">{user.total}</td>
              <td className="px-4 py-3 text-center text-green-600">{user.approved}</td>
              <td className="px-4 py-3 text-center text-red-600">{user.rejected}</td>
              <td className="px-4 py-3 text-center">{formatTime(user.avgTime)}</td>
              <td className="px-4 py-3 text-center text-green-600 font-medium">{formatTime(user.minTime)}</td>
              <td className="px-4 py-3 text-center text-red-600 font-medium">{formatTime(user.maxTime)}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Нет данных за выбранный период</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
