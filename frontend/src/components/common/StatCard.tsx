import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  accentColor?: 'cyan' | 'emerald' | 'amber' | 'red' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = 'cyan',
}) => {
  const accentClasses = {
    cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-950/20',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-950/20',
    red: 'text-red-400 border-red-500/20 bg-red-950/20',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-950/20',
  };

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </span>
        <div className={`p-2.5 rounded-lg border ${accentClasses[accentColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-extrabold text-white tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500 truncate">{subtitle}</p>
      )}
    </div>
  );
};
