import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Header } from '../components/Header';
import { Loader2, AlertTriangle } from 'lucide-react';
import { MetricsFilter } from '../components/metrics/MetricsFilter';
import { SummaryCards } from '../components/metrics/SummaryCards';
import { DepartmentStats } from '../components/metrics/DepartmentStats';
import { Bottlenecks } from '../components/metrics/Bottlenecks';
import { DynamicsChart } from '../components/metrics/DynamicsChart';
import { useNavigate } from 'react-router-dom';

export const Metrics = () => {
  const navigate = useNavigate();

  // Initialize dates
  const now = new Date();
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const defaultStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEnd = formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/metrics', {
        params: { start: startDate, end: endDate }
      });
      setData(res.data);
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.status === 403) {
        setError('Доступ запрещен. Только для администраторов.');
      } else {
        setError('Не удалось загрузить данные аналитики. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Role Check & Data Fetch
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role !== 'ADMIN') {
        navigate('/'); // Redirect non-admins
        return;
      }
    } else {
        navigate('/login');
        return;
    }

    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleFilter = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="min-h-screen pt-16 bg-[#F5F6F8]">
      <Header />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Аналитика и Метрики</h1>
          <p className="text-gray-500">Обзор эффективности процессов согласования</p>
        </div>

        <MetricsFilter
            startDate={startDate}
            endDate={endDate}
            onFilter={handleFilter}
        />

        {loading && (
           <div className="flex flex-col items-center justify-center py-20">
             <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
             <p className="text-gray-500">Сбор данных...</p>
           </div>
        )}

        {error && !loading && (
           <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-600 flex flex-col items-center">
             <AlertTriangle className="w-8 h-8 mb-2" />
             <h3 className="font-medium text-lg mb-1">Ошибка доступа</h3>
             <p>{error}</p>
           </div>
        )}

        {!loading && !error && data && (
            <div className="animate-in fade-in duration-500 space-y-8">
                <SummaryCards data={data.summary} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                         <DynamicsChart data={data.dynamics} />
                    </div>
                    <div className="h-full">
                         <Bottlenecks data={data.bottlenecks} />
                    </div>
                </div>

                <DepartmentStats data={data.departments} />
            </div>
        )}
      </div>
    </div>
  );
};
