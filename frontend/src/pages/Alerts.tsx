import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Filter,
  Route,
  Shield,
  Clock,
  MapPin,
  X,
  CameraOff,
} from 'lucide-react';
import { getAlerts, patchAlert } from '../services/alert.service';
import { Alert, AlertStatus, AlertType, AlertSeverity } from '../types';
import { Badge } from '../components/common/Badge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useTimeRangeStore } from '../store/timeRangeStore';

export const Alerts: React.FC = () => {
  const { user } = useAuthStore();
  const { from, to } = useTimeRangeStore();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [modalImageError, setModalImageError] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const isLawEnforcement = user?.role === 'Admin' || user?.role === 'Police';

  const fetchAlertList = async () => {
    setIsLoading(true);
    try {
      const params: any = { from, to, limit: 100 };
      if (filterType !== 'ALL') params.type = filterType;
      if (filterSeverity !== 'ALL') params.severity = filterSeverity;
      if (filterStatus !== 'ALL') params.status = filterStatus;

      const data = await getAlerts(params);
      setAlerts(data.alerts);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertList();
  }, [filterType, filterSeverity, filterStatus, from, to]);

  const openAlertDetails = (alert: Alert) => {
    setModalImageError(false);
    setSelectedAlert(alert);
  };

  const handleUpdateStatus = async (alertId: string, status: AlertStatus) => {
    setIsUpdating(true);
    try {
      const updated = await patchAlert(alertId, status);
      setAlerts((prev) =>
        prev.map((a) => (a.alert_id === alertId ? { ...a, ...updated } : a))
      );
      if (selectedAlert?.alert_id === alertId) {
        setSelectedAlert({ ...selectedAlert, ...updated });
      }
    } catch (err) {
      console.error('Failed to update alert:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          Security & Incident Alerts
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Blacklist violations, impossible travel speeds, and suspicious shuttle routes
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-400">
          <Filter className="w-4 h-4 text-cyan-400" /> Filters:
        </div>

        {/* Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
        >
          <option value="ALL">All Types</option>
          <option value="BLACKLIST_HIT">Blacklist Hit</option>
          <option value="IMPOSSIBLE_TRAVEL">Impossible Travel</option>
          <option value="SUSPICIOUS_ROUTE">Suspicious Route</option>
        </select>

        {/* Severity Filter */}
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
        >
          <option value="ALL">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
        </select>

        <span className="ml-auto text-xs text-gray-500">
          Showing <strong className="text-white">{alerts.length}</strong> alerts
        </span>
      </div>

      {/* Alerts Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No Incidents Found"
            description="No alerts matched the selected filters. Change filter criteria or widen the time range."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/50">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Plate Identifier</th>
                  <th className="py-3 px-4">Camera</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {alerts.map((alert) => (
                  <tr
                    key={alert.alert_id}
                    className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                    onClick={() => openAlertDetails(alert)}
                  >
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          alert.severity === 'CRITICAL'
                            ? 'critical'
                            : alert.severity === 'HIGH'
                            ? 'high'
                            : 'medium'
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {alert.type}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                      {alert.plate_text}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-400">
                      {alert.camera_id}
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(alert.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          alert.status === 'OPEN'
                            ? 'bg-red-950/80 text-red-400 border border-red-700/50'
                            : alert.status === 'ACKNOWLEDGED'
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAlertDetails(alert);
                        }}
                        className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-cyan-400"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alert Details Modal / Drawer */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedAlert(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Badge
                variant={
                  selectedAlert.severity === 'CRITICAL'
                    ? 'critical'
                    : selectedAlert.severity === 'HIGH'
                    ? 'high'
                    : 'medium'
                }
              >
                {selectedAlert.severity}
              </Badge>
              <span className="font-bold text-white text-base">
                {selectedAlert.type}
              </span>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <div className="p-3 bg-gray-900 rounded-xl border border-gray-800 space-y-1">
                <p className="text-gray-400 font-semibold">Incident Description:</p>
                <p className="text-white text-sm">{selectedAlert.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-gray-900 rounded-lg border border-gray-800">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                    Vehicle Registration
                  </span>
                  <span className="font-mono text-sm font-bold text-cyan-400">
                    {selectedAlert.plate_text}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-900 rounded-lg border border-gray-800">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                    Sighting Camera
                  </span>
                  <span className="font-mono text-sm font-bold text-white">
                    {selectedAlert.camera_id}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Captured: {new Date(selectedAlert.timestamp).toLocaleString()}</span>
              </div>

              {/* Evidence Snapshot (Role Protected: Only Police/Admin when present) */}
              {isLawEnforcement && (
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-gray-400 block mb-1.5">
                    Camera Evidence Snapshot:
                  </span>
                  {selectedAlert.snapshot_url && !modalImageError ? (
                    <div className="rounded-xl overflow-hidden border border-gray-800 max-h-48">
                      <img
                        src={selectedAlert.snapshot_url}
                        alt="Plate evidence snapshot"
                        onError={() => setModalImageError(true)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-900 border border-gray-800 h-28 flex flex-col items-center justify-center text-gray-500 text-xs gap-1.5 p-3 text-center">
                      <CameraOff className="w-5 h-5 text-gray-600" />
                      <span>No snapshot (simulated data)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between gap-3">
              {isLawEnforcement &&
                selectedAlert.plate_text &&
                !selectedAlert.plate_text.includes('*') && (
                  <button
                    onClick={() => {
                      navigate(`/trajectories/${selectedAlert.plate_text}`);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Route className="w-3.5 h-3.5" /> Track Route
                  </button>
                )}

              <div className="flex items-center gap-2 ml-auto">
                {selectedAlert.status === 'OPEN' && (
                  <button
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'ACKNOWLEDGED')}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )}
                {selectedAlert.status !== 'RESOLVED' && (
                  <button
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus(selectedAlert.alert_id, 'RESOLVED')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Resolve Incident
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
