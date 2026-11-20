import React, { useState, useEffect } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import { useTimeRangeStore, TimeRangePreset } from '../../store/timeRangeStore';

interface TimeRangeSelectorProps {
  className?: string;
  showBadge?: boolean;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  className = '',
  showBadge = false,
}) => {
  const { preset, from, to, label, setPreset, fetchDataRange, dataRange } = useTimeRangeStore();

  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Fetch true earliest/latest timestamps from the database on mount if needed
  useEffect(() => {
    if (!dataRange.earliest) {
      fetchDataRange();
    }
  }, [dataRange.earliest, fetchDataRange]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as TimeRangePreset;
    if (value === 'custom') {
      // Default custom inputs to current from/to or reasonable defaults
      const now = new Date();
      const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setCustomFrom(from ? from.slice(0, 16) : past24h.toISOString().slice(0, 16));
      setCustomTo(to ? to.slice(0, 16) : now.toISOString().slice(0, 16));
      setIsCustomOpen(true);
    } else {
      setIsCustomOpen(false);
      setPreset(value);
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    const fromIso = new Date(customFrom).toISOString();
    const toIso = new Date(customTo).toISOString();
    setPreset('custom', fromIso, toIso);
    setIsCustomOpen(false);
  };

  const handleCancelCustom = () => {
    setIsCustomOpen(false);
  };

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* Optional range pill badge */}
      {showBadge && (
        <div className="flex items-center gap-1.5 text-xs text-gray-300 bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-800">
          <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-medium truncate max-w-[280px]" title={label}>
            {label}
          </span>
        </div>
      )}

      {/* Preset Dropdown */}
      <div className="relative">
        <select
          value={preset}
          onChange={handleSelectChange}
          aria-label="Time range preset"
          className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer hover:border-gray-600 transition-colors"
        >
          <option value="all">All data</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Custom Range Popover */}
      {isCustomOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-[#111827] border border-gray-700 rounded-xl p-3 shadow-2xl w-72 text-xs">
          <form onSubmit={handleApplyCustom} className="space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-gray-800">
              <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Custom Range
              </span>
              <button
                type="button"
                onClick={handleCancelCustom}
                className="text-gray-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">From</label>
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-gray-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">To</label>
              <input
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-gray-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelCustom}
                className="px-2.5 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1 shadow-md shadow-cyan-900/30"
              >
                <Check className="w-3 h-3" /> Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
