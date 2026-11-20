import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { UserRole } from '../../types';

interface UnauthorizedProps {
  requiredRoles: UserRole[];
  currentRole: UserRole;
}

export const Unauthorized: React.FC<UnauthorizedProps> = ({
  requiredRoles,
  currentRole,
}) => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#111827] border border-red-900/50 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-red-950/60 border border-red-700/60 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Access Restricted</h2>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          Your account role (<span className="text-amber-400 font-semibold">{currentRole}</span>) is not permitted to access this module.
        </p>

        {currentRole === 'Analyst' && (
          <div className="mt-4 p-3.5 rounded-lg bg-gray-900 border border-gray-800 text-left text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-cyan-400">Privacy Notice:</p>
            <p>
              Under urban data privacy standards, Analyst access is strictly constrained to aggregated statistical trends. Plate-level tracking and individual camera snapshots are restricted to law enforcement roles.
            </p>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500">
          Required roles: {requiredRoles.join(', ')}
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Command Center
        </Link>
      </div>
    </div>
  );
};
