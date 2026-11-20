import React from 'react';
import { LogOut, Calendar, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTimeRangeStore, TimeRangePreset } from '../../store/timeRangeStore';

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { preset, setPreset, label } = useTimeRangeStore();

  const roleColorMap = {
    Admin: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
    Police: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
    TrafficAuthority: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    Analyst: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
  };

  const badgeClass = user?.role ? roleColorMap[user.role] : 'bg-gray-800 text-gray-300';

  return (
    <header className="h-16 bg-[#111827] border-b border-gray-800 px-6 flex items-center justify-between shrink-0">
      {/* Left: Demo Data Warning & Span Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-600/50 text-amber-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>DEMO DATA (simulated)</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-900/60 px-3 py-1 rounded-lg border border-gray-800">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-gray-300 font-medium">{label}</span>
        </div>
      </div>

      {/* Right: Controls, Role Badge, Logout */}
      <div className="flex items-center gap-3">
        {/* Time Filter Selector */}
        <div className="relative">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as TimeRangePreset)}
            className="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Demo Data (Nov 2026)</option>
            <option value="24h">Peak Window (24h)</option>
            <option value="7d">Demo Week (7d)</option>
          </select>
        </div>

        {/* Role Badge */}
        {user && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${badgeClass}`}>
            {user.role}
          </span>
        )}

        {/* Logout */}
        <button
          onClick={() => logout()}
          title="Sign out"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
