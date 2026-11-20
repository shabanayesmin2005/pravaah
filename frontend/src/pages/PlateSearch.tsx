import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Car, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { searchPlates } from '../services/plate.service';
import { PlateSearchResult } from '../types';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';

export const PlateSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('DL');
  const [results, setResults] = useState<PlateSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await searchPlates(searchTerm.trim(), 1, 50);
      setResults(data.plates);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to execute plate query');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSearch(submittedQuery);
  }, [submittedQuery]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSubmittedQuery(query.trim());
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          Vehicle Plate Search
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Authorized investigation portal • Search partial or exact ANPR plates across city cameras
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 shadow-xl">
        <form onSubmit={onSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search registration e.g. DL01, MH12, 1234..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs tracking-wider uppercase transition-colors shadow-lg disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-700/60 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Results Section */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
            Matching Vehicles ({results.length})
          </span>
          <span className="text-xs text-gray-500">
            Query: <strong className="text-cyan-400 font-mono">{submittedQuery}</strong>
          </span>
        </div>

        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="No Plates Found"
            description={`No non-empty license plate sightings matched "${submittedQuery}". Try a different keyword.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/50">
                  <th className="py-3 px-4">License Plate</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Sightings</th>
                  <th className="py-3 px-4">First Sighted</th>
                  <th className="py-3 px-4">Last Sighted</th>
                  <th className="py-3 px-4">Last Camera</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-xs text-gray-300">
                {results.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => navigate(`/trajectories/${row.plate_text}`)}
                    className="hover:bg-gray-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                      {row.plate_text}
                    </td>
                    <td className="py-3.5 px-4 capitalize">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 text-[11px]">
                        <Car className="w-3 h-3 text-cyan-400" />
                        {row.vehicle_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-cyan-300">
                      {row.detection_count}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        {new Date(row.first_seen).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        {new Date(row.last_seen).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-amber-400 font-mono font-medium">
                        <MapPin className="w-3 h-3" />
                        {row.latest_camera_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-cyan-400 font-medium group-hover:translate-x-1 transition-transform">
                        Trajectory <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
