import React from 'react';
import { FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

interface SummaryData {
  totalSent: number;
  approved: number;
  rejected: number;
  onApproval: number;
}

const Card = ({ title, count, icon: Icon, color, bg }: any) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{count}</h3>
    </div>
    <div className={`p-3 rounded-full ${bg}`}>
      <Icon className={`w-6 h-6 ${color}`} />
    </div>
  </div>
);

export const SummaryCards = ({ data }: { data: SummaryData }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card
        title="Всего отправлено"
        count={data.totalSent}
        icon={FileText}
        color="text-blue-600"
        bg="bg-blue-50"
      />
      <Card
        title="Согласовано"
        count={data.approved}
        icon={CheckCircle}
        color="text-green-600"
        bg="bg-green-50"
      />
      <Card
        title="Отклонено"
        count={data.rejected}
        icon={XCircle}
        color="text-red-600"
        bg="bg-red-50"
      />
      <Card
        title="В процессе"
        count={data.onApproval}
        icon={Clock}
        color="text-yellow-600"
        bg="bg-yellow-50"
      />
    </div>
  );
};
