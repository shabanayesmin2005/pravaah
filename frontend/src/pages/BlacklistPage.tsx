import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Building2,
  Calendar,
  X,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
} from '../services/blacklist.service';
import { BlacklistEntry, AlertSeverity } from '../types';
import { Badge } from '../components/common/Badge';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { formatIST } from '../utils/date';

// Indian vehicle registration number format:
// e.g. DL01AB1234, MH12CD5678, KA03EF9012, 22BH1234AA
const INDIAN_PLATE_REGEX = /^([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/;

export const BlacklistPage: React.FC = () => {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [plateInput, setPlateInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [severityInput, setSeverityInput] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [agencyInput, setAgencyInput] = useState('Delhi Police');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remove confirmation modal state
  const [plateToRemove, setPlateToRemove] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const data = await getBlacklist();
      setEntries(data);
    } catch (err: any) {
      toast.error('Failed to load blacklist entries');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleOpenAddModal = () => {
    setPlateInput('');
    setReasonInput('');
    setSeverityInput('HIGH');
    setAgencyInput('Delhi Police');
    setValidationError(null);
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Normalize plate: uppercase and remove spaces/hyphens
    const normalizedPlate = plateInput.toUpperCase().replace(/[\s-]/g, '');

    if (!INDIAN_PLATE_REGEX.test(normalizedPlate)) {
      setValidationError(
        'Invalid Indian vehicle registration format. Example: DL01AB1234, MH12CD5678, or 22BH1234AA.'
      );
      return;
    }

    if (!reasonInput.trim()) {
      setValidationError('Reason is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addBlacklistEntry({
        plate_text: normalizedPlate,
        reason: reasonInput.trim(),
        severity: severityInput,
        agency: agencyInput.trim() || 'Delhi Police',
      });
      toast.success(`Vehicle '${normalizedPlate}' added to blacklist`);
      setIsAddModalOpen(false);
      fetchEntries();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to add plate to blacklist';
      toast.error(msg);
      setValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!plateToRemove) return;
    setIsRemoving(true);
    try {
      await removeBlacklistEntry(plateToRemove);
      toast.success(`Plate '${plateToRemove}' removed from blacklist`);
      setPlateToRemove(null);
      fetchEntries();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove vehicle');
    } finally {
      setIsRemoving(false);
    }
  };

  const filteredEntries = entries.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.plate_text.toLowerCase().includes(q) ||
      item.reason.toLowerCase().includes(q) ||
      item.agency.toLowerCase().includes(q) ||
      item.added_by.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            ANPR Hotlist & Blacklist Registry
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time synchronization with stream alerting engine • Flagged vehicles trigger instantaneous BLACKLIST_HIT alarms
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-red-900/40 transition-colors w-fit"
        >
          <Plus className="w-4 h-4" /> Add Hotlist Vehicle
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search hotlist by plate, reason, agency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <span className="text-xs text-gray-400">
          Showing <strong className="text-white">{filteredEntries.length}</strong> of{' '}
          <strong className="text-white">{entries.length}</strong> registered plates
        </span>
      </div>

      {/* Hotlist Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            title="No Blacklisted Vehicles Found"
            description={
              searchQuery
                ? 'No hotlist records match your search criteria.'
                : 'No vehicles are currently listed on the ANPR surveillance hotlist.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900/80 text-gray-400 uppercase tracking-wider text-[11px] border-b border-gray-800">
                <tr>
                  <th className="py-3.5 px-6">Plate Number</th>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Flag Reason</th>
                  <th className="py-3.5 px-4">Registering Agency</th>
                  <th className="py-3.5 px-4">Registered By</th>
                  <th className="py-3.5 px-4">Timestamp (IST)</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {filteredEntries.map((item) => (
                  <tr key={item.plate_text} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-white text-sm">
                      <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-700 text-yellow-300">
                        {item.plate_text}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          item.severity === 'CRITICAL'
                            ? 'critical'
                            : item.severity === 'HIGH'
                            ? 'high'
                            : item.severity === 'MEDIUM'
                            ? 'medium'
                            : 'low'
                        }
                      >
                        {item.severity}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-gray-200 font-medium max-w-xs truncate" title={item.reason}>
                      {item.reason}
                    </td>
                    <td className="py-3.5 px-4 text-gray-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-500" />
                      <span>{item.agency}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-400 text-[11px]">
                      {item.added_by}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 whitespace-nowrap">
                      {formatIST(item.added_at)}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => setPlateToRemove(item.plate_text)}
                        title={`Remove ${item.plate_text} from hotlist`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-900/50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-2xl max-w-md w-full shadow-2xl p-6 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-white">Add Vehicle to ANPR Hotlist</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              {validationError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  License Plate Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL01AB1234 or 22BH1234AA"
                  value={plateInput}
                  onChange={(e) => {
                    setPlateInput(e.target.value.toUpperCase());
                    setValidationError(null);
                  }}
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white font-mono uppercase tracking-wide focus:outline-none focus:border-red-500 text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Must follow Indian vehicle registration standards (2 letters + 2 digits + 2 letters + 4 digits).
                </p>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Reason / FIR Citation <span className="text-red-400">*</span>
                </label>
                <textarea
                  placeholder="e.g. Stolen luxury sedan reported under FIR #892/2026 PS Connaught Place"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  required
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Alert Severity</label>
                  <select
                    value={severityInput}
                    onChange={(e) => setSeverityInput(e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Registering Agency</label>
                  <input
                    type="text"
                    value={agencyInput}
                    onChange={(e) => setAgencyInput(e.target.value)}
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-red-900/30 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Add to Blacklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      {plateToRemove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-2xl max-w-sm w-full shadow-2xl p-6 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-800">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Confirm Removal</h3>
            </div>

            <p className="text-gray-300 leading-relaxed mb-4">
              Are you sure you want to remove plate <strong className="text-white font-mono">{plateToRemove}</strong> from the surveillance hotlist?
              <br />
              <span className="text-gray-400 text-[11px] block mt-2">
                This vehicle will immediately cease triggering real-time ANPR alarms across all cameras.
              </span>
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPlateToRemove(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isRemoving ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
