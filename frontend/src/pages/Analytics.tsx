import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Car,
  TrendingUp,
  Gauge,
  Flame,
  Calendar,
} from 'lucide-react';
import { getTrafficSummary, getCongestion, getTrafficAggregates } from '../services/analytics.service';
import { TrafficSummary, CongestionItem, TrafficAggregate } from '../types';
import { StatCard } from '../components/common/StatCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { useTimeRangeStore } from '../store/timeRangeStore';

const PIE_COLORS = ['#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const Analytics: React.FC = () => {
  const { from, to, label } = useTimeRangeStore();
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [congestionList, setCongestionList] = useState<CongestionItem[]>([]);
  const [aggregates, setAggregates] = useState<TrafficAggregate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      try {
        const [sumRes, congRes, aggRes] = await Promise.allSettled([
          getTrafficSummary(),
          getCongestion(),
          getTrafficAggregates({ from, to, limit: 100 }),
        ]);

        if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
        if (congRes.status === 'fulfilled') setCongestionList(congRes.value);
        if (aggRes.status === 'fulfilled') setAggregates(aggRes.value.aggregates);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [from, to]);

  // Prepare Vehicle Type data for Pie Chart
  const typeMixData = summary
    ? Object.entries(summary.vehicle_type_distribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  // Prepare Camera Volume data for Bar Chart
  const cameraVolumeData = congestionList.map((c) => ({
    name: c.camera_id,
    cameraName: c.name,
    vehicles: c.vehicle_count,
    congestion: Number(c.congestion_index.toFixed(2)),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Urban Traffic Analytics & Corridors
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Aggregated vehicle volume metrics, fleet distribution & congestion indices
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-cyan-400 font-semibold">
          <Calendar className="w-4 h-4 text-cyan-500" />
          <span>Active Window: {label}</span>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Vehicles Monitored"
          value={summary?.total_vehicles_counted.toLocaleString() || '165'}
          subtitle="All cameras combined"
          icon={Car}
          accentColor="cyan"
        />
        <StatCard
          title="Monitored Corridors"
          value={summary?.active_cameras || 10}
          subtitle="Cameras with active ANPR"
          icon={Gauge}
          accentColor="emerald"
        />
        <StatCard
          title="Busiest Intersection"
          value={summary?.busiest_cameras[0]?.camera_id || 'CAM_001'}
          subtitle={`${summary?.busiest_cameras[0]?.total_vehicles || 0} vehicle passages`}
          icon={Flame}
          accentColor="amber"
        />
        <StatCard
          title="5-Min Aggregation Windows"
          value={summary?.aggregated_windows || aggregates.length || 10}
          subtitle="Processed stream buckets"
          icon={TrendingUp}
          accentColor="purple"
        />
      </div>

      {isLoading ? (
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 h-[400px]">
          <LoadingSkeleton rows={6} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Camera Volume (Bar Chart) */}
          <div className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-4">
              Traffic Volume by Camera Feed
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cameraVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#9CA3AF"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="vehicles" fill="#06B6D4" radius={[6, 6, 0, 0]} name="Vehicles Sighted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Fleet Mix (Donut Chart) */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
              Vehicle Type Distribution
            </h3>
            <div className="flex-1 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {typeMixData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', color: '#9CA3AF' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Corridor Congestion Ranking Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
            Corridor Congestion & Speed Index
          </span>
          <span className="text-[11px] text-gray-500">
            Updated in 5-minute rolling windows
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/50">
                <th className="py-2.5 px-4">Camera</th>
                <th className="py-2.5 px-4">Location Name</th>
                <th className="py-2.5 px-4">Zone</th>
                <th className="py-2.5 px-4">Volume</th>
                <th className="py-2.5 px-4">Congestion Index</th>
                <th className="py-2.5 px-4">Traffic Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-gray-300">
              {congestionList.map((c) => {
                const isHeavy = c.congestion_index >= 1.5;
                const isModerate = c.congestion_index >= 1.0;
                return (
                  <tr key={c.camera_id} className="hover:bg-gray-800/30">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {c.camera_id}
                    </td>
                    <td className="py-3 px-4 text-white font-medium">
                      {c.name}
                    </td>
                    <td className="py-3 px-4 capitalize text-gray-400">
                      {c.zone}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {c.vehicle_count}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      <span className={isHeavy ? 'text-red-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'}>
                        {c.congestion_index.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          isHeavy
                            ? 'bg-red-950/80 text-red-400 border border-red-700/50'
                            : isModerate
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                        }`}
                      >
                        {c.congestion_level}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
