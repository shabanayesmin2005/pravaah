import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Info,
  User as UserIcon,
  Globe,
  Clock,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuditLogs } from '../services/audit.service';
import { AuditLogEntry } from '../types';
import { Badge } from '../components/common/Badge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { formatIST } from '../utils/date';

const AUDIT_ACTIONS = [
  'ALL',
  'ACCESS_DENIED',
  'LOGIN_FAILED',
  'LOGIN',
  'PLATE_SEARCH',
  'TRAJECTORY_VIEW',
  'BLACKLIST_ADD',
  'BLACKLIST_REMOVE',
  'ALERT_ACKNOWLEDGE',
  'ALERT_RESOLVE',
];

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [pagination, setPagination] = useState<{ total: number; pages: number }>({
    total: 0,
    pages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async (currentPage = 1, currentAction = actionFilter) => {
    setIsLoading(true);
    try {
      const params: any = { page: currentPage, limit };
      if (currentAction !== 'ALL') {
        params.action = currentAction;
      }
      const data = await getAuditLogs(params);
      setLogs(data.logs);
      if (data.pagination) {
        setPagination({
          total: data.pagination.total,
          pages: data.pagination.pages,
        });
      }
    } catch (err: any) {
      toast.error('Failed to load audit logs');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchLogs(1, actionFilter);
  }, [actionFilter]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPage(newPage);
    fetchLogs(newPage, actionFilter);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            Compliance & System Audit Trail
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Immutable security log for user logins, RBAC policy denials, plate searches & administrative actions
          </p>
        </div>

        <div className="text-xs text-gray-400 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-xl w-fit">
          Total Records: <strong className="text-white">{pagination.total.toLocaleString()}</strong>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-400">
            <Filter className="w-4 h-4 text-purple-400" /> Action:
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {AUDIT_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act === 'ALL' ? 'All Actions' : act}
              </option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 ring-2 ring-red-950" />
            <span>ACCESS_DENIED (403)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 ring-2 ring-amber-950" />
            <span>LOGIN_FAILED</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={8} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No Audit Logs Found"
            description="No audit logs matched the selected action filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900/80 text-gray-400 uppercase tracking-wider text-[11px] border-b border-gray-800">
                <tr>
                  <th className="py-3.5 px-6">Timestamp (IST)</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target / Route</th>
                  <th className="py-3.5 px-4">Client IP</th>
                  <th className="py-3.5 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {logs.map((item) => {
                  const isAccessDenied = item.action === 'ACCESS_DENIED';
                  const isLoginFailed = item.action === 'LOGIN_FAILED';

                  const rowClass = isAccessDenied
                    ? 'bg-red-950/25 border-l-4 border-l-red-500 hover:bg-red-950/40'
                    : isLoginFailed
                    ? 'bg-amber-950/25 border-l-4 border-l-amber-500 hover:bg-amber-950/40'
                    : 'hover:bg-gray-800/30';

                  return (
                    <tr key={item._id} className={`${rowClass} transition-colors`}>
                      <td className="py-3.5 px-6 whitespace-nowrap text-gray-300 font-mono text-[11px]">
                        {formatIST(item.timestamp)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-white truncate max-w-[180px]">
                          <UserIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span title={item.email || item.user_id || 'System'}>
                            {item.email || item.user_id || 'System'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-gray-900 text-gray-300 border-gray-700">
                          {item.role || 'Unauthenticated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            isAccessDenied
                              ? 'critical'
                              : isLoginFailed
                              ? 'high'
                              : item.action.includes('BLACKLIST')
                              ? 'info'
                              : 'success'
                          }
                        >
                          {item.action}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-300 max-w-xs truncate" title={item.target}>
                        {item.target || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-400 text-[11px]">
                        {item.ip || '—'}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {item.details && Object.keys(item.details).length > 0 ? (
                          <button
                            onClick={() => setSelectedLog(item)}
                            className="p-1 rounded text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 text-[11px] font-medium"
                          >
                            Inspect
                          </button>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 bg-gray-900/60 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <div>
            Page <strong className="text-white">{page}</strong> of{' '}
            <strong className="text-white">{pagination.pages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.pages}
              className="p-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-2xl max-w-lg w-full shadow-2xl p-6 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Audit Event Details</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-gray-300">
                <div>
                  <span className="text-gray-500 block text-[11px]">Action</span>
                  <strong className="text-white">{selectedLog.action}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Timestamp (IST)</span>
                  <span>{formatIST(selectedLog.timestamp)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">User</span>
                  <span className="font-mono">{selectedLog.email || selectedLog.user_id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Client IP</span>
                  <span className="font-mono">{selectedLog.ip || '—'}</span>
                </div>
              </div>

              <div>
                <span className="text-gray-500 block text-[11px] mb-1">Payload Details (JSON)</span>
                <pre className="p-3 bg-gray-950 rounded-xl border border-gray-800 font-mono text-[11px] text-gray-300 overflow-x-auto max-h-56">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-800 mt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
