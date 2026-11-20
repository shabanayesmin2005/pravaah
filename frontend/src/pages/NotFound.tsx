import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#111827] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center mx-auto mb-4 text-cyan-400">
          <Compass className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">404 - Page Not Found</h2>
        <p className="mt-2 text-xs text-gray-400">
          The requested urban monitoring module or vehicle route does not exist.
        </p>
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
