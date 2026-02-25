import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Bottleneck {
  id: string;
  name: string;
  department: string;
  count: number;
}

export const Bottlenecks = ({ data }: { data: Bottleneck[] }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
      <div className="flex items-center gap-2 mb-4">
         <AlertCircle className="w-5 h-5 text-red-500" />
         <h3 className="text-lg font-semibold text-gray-800">Узкие места (Топ-5)</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">Сотрудники с наибольшим количеством документов на рассмотрении.</p>

      <div className="space-y-4">
        {data.map((user, index) => (
          <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-100">
             <div className="flex items-center gap-3">
               <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                 {index + 1}
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-900">{user.name}</p>
                 <p className="text-xs text-gray-500">{user.department}</p>
               </div>
             </div>
             <div className="text-right">
                <span className="text-lg font-bold text-red-600">{user.count}</span>
                <p className="text-xs text-gray-400">док.</p>
             </div>
          </div>
        ))}
        {data.length === 0 && (
            <div className="text-center py-8 text-gray-400">
                Все задачи разобраны!
            </div>
        )}
      </div>
    </div>
  );
};
