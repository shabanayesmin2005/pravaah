import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  AlertTriangle,
  Flame,
  Video,
  ExternalLink,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { CameraMap } from '../components/map/CameraMap';
import { getCameras } from '../services/camera.service';
import { getTrafficSummary, getCongestion } from '../services/analytics.service';
import { getAlerts } from '../services/alert.service';
import { useAuthStore } from '../store/authStore';
import { Camera, CongestionItem, TrafficSummary, Alert } from '../types';

export const CommandCenter: React.FC = () => {
  const { user } = useAuthStore();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [congestion, setCongestion] = useState<CongestionItem[]>([]);
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isLawEnforcement = user?.role === 'Admin' || user?.role === 'Police';

  const fetchData = async () => {
    try {
      const [cams, cong, summ, alts] = await Promise.allSettled([
        getCameras(),
        getCongestion(),
        getTrafficSummary(),
        getAlerts({ limit: 5 }),
      ]);

      if (cams.status === 'fulfilled') setCameras(cams.value);
      if (cong.status === 'fulfilled') setCongestion(cong.value);
      if (summ.status === 'fulfilled') setSummary(summ.value);
      if (alts.status === 'fulfilled') setRecentAlerts(alts.value.alerts);

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to poll dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 10-second polling refresh interval
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const busiest = summary?.busiest_cameras[0];

  return (
    <div className="space-y-6">
      {/* Top Header with live pulse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            City Command Center
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time multi-camera ANPR tracking and corridor congestion grid • Delhi NCR
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Refreshed: {lastRefreshed.toLocaleTimeString()}</span>
          </div>
          <button
            onClick={fetchData}
            title="Refresh now"
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Vehicles Processed"
          value={summary?.total_vehicles_counted.toLocaleString() || '165'}
          subtitle="Aggregated across all feeds"
          icon={Car}
          accentColor="cyan"
        />
        <StatCard
          title="Active Alerts"
          value={recentAlerts.filter((a) => a.status === 'OPEN').length}
          subtitle="Critical & High incidents"
          icon={AlertTriangle}
          accentColor="red"
        />
        <StatCard
          title="Busiest Camera"
          value={busiest ? busiest.camera_id : 'CAM_001'}
          subtitle={busiest ? `${busiest.total_vehicles} total vehicles` : 'Inner Circle'}
          icon={Flame}
          accentColor="amber"
        />
        <StatCard
          title="Camera Feeds"
          value={`${cameras.filter((c) => c.active).length} / ${cameras.length || 10}`}
          subtitle="Online & streaming"
          icon={Video}
          accentColor="emerald"
        />
      </div>

      {/* Main Grid: Map & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[540px]">
        {/* Left 2 Cols: City Map */}
        <div className="lg:col-span-2 h-full flex flex-col bg-[#111827] border border-gray-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Interactive Camera Network & Congestion Heat
            </span>
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Normal (&lt;1.0)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Moderate (1.0-1.5)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Heavy (&gt;1.5)
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <CameraMap cameras={cameras} congestionData={congestion} />
          </div>
        </div>

        {/* Right Col: Incident Feed / Alert Ticker */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 shadow-xl flex flex-col h-full">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Latest Alerts Feed
            </span>
            {user?.role !== 'Analyst' && (
              <Link
                to="/alerts"
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
              >
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {recentAlerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-xs">
                <AlertTriangle className="w-6 h-6 mb-2 text-gray-600" />
                <span>No active alerts detected.</span>
              </div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert.alert_id}
                  className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge
                      variant={
                        alert.severity === 'CRITICAL'
                          ? 'critical'
                          : alert.severity === 'HIGH'
                          ? 'high'
                          : 'medium'
                      }
                      size="sm"
                    >
                      {alert.type}
                    </Badge>
                    <span className="text-[10px] text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-white">
                      {alert.plate_text}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-medium">
                      {alert.camera_id}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-gray-400 line-clamp-2">
                    {alert.description}
                  </p>

                  {isLawEnforcement && alert.plate_text && !alert.plate_text.includes('*') && (
                    <div className="mt-2 pt-2 border-t border-gray-800/80 flex justify-end">
                      <Link
                        to={`/trajectories/${alert.plate_text}`}
                        className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        Inspect Trajectory →
                      </Link>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
