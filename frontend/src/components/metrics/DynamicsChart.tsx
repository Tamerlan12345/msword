import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DynamicsPoint {
  date: string;
  count: number;
}

export const DynamicsChart = ({ data }: { data: DynamicsPoint[] }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Динамика создания документов</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
                dataKey="date"
                tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getDate()}.${d.getMonth() + 1}`;
                }}
            />
            <YAxis allowDecimals={false} />
            <Tooltip
                labelFormatter={(val) => new Date(val).toLocaleDateString()}
            />
            <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" name="Документов" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
