import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Route,
  BellRing,
  BarChart3,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types';

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    name: 'Command Center',
    to: '/',
    icon: LayoutDashboard,
    roles: ['Admin', 'Police', 'TrafficAuthority', 'Analyst'],
  },
  {
    name: 'Traffic Analytics',
    to: '/analytics',
    icon: BarChart3,
    roles: ['Admin', 'Police', 'TrafficAuthority', 'Analyst'],
  },
  {
    name: 'Alerts Feed',
    to: '/alerts',
    icon: BellRing,
    roles: ['Admin', 'Police', 'TrafficAuthority'],
  },
  {
    name: 'Plate Search',
    to: '/plates',
    icon: Search,
    roles: ['Admin', 'Police'],
  },
  {
    name: 'Trajectories',
    to: '/trajectories',
    icon: Route,
    roles: ['Admin', 'Police'],
  },
];

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  const userRole = user?.role || 'Analyst';

  const accessibleItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-[#111827] border-r border-gray-800 flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-cyan-900/40">
          प्र
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-base tracking-wide">PRAVAAH</span>
            <span className="text-xs text-cyan-400 font-semibold">प्रवाह</span>
          </div>
          <span className="text-[10px] text-gray-400 block leading-tight">AI Traffic Command</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Modules
        </div>
        {accessibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/50 shadow-inner'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Badge Footer */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-300 font-semibold">
            {user?.name?.slice(0, 2).toUpperCase() || 'US'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-200 truncate">{user?.name}</p>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span className="truncate">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
