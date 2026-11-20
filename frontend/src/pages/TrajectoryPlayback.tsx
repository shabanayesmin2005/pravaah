import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Gauge,
  Navigation,
  Clock,
  Car,
  CameraOff,
  Route,
} from 'lucide-react';
import { getVehicleTrajectory } from '../services/vehicle.service';
import { getCameras } from '../services/camera.service';
import { Trajectory, Camera } from '../types';
import { TrajectoryMap } from '../components/map/TrajectoryMap';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { formatDuration, pluralize } from '../utils/date';

export const TrajectoryPlayback: React.FC = () => {
  const { plate: routePlate } = useParams<{ plate?: string }>();
  const navigate = useNavigate();

  const [plateInput, setPlateInput] = useState(routePlate || 'DL01AB1234');
  const [activePlate, setActivePlate] = useState(routePlate || 'DL01AB1234');
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [cameraMap, setCameraMap] = useState<Map<string, { lat: number; lng: number; name: string }>>(
    new Map()
  );
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update activePlate if route param changes
  useEffect(() => {
    if (routePlate && routePlate !== activePlate) {
      setActivePlate(routePlate);
      setPlateInput(routePlate);
    }
  }, [routePlate]);

  // Load cameras & trajectory
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setErrorMsg(null);
      setIsNotFound(false);
      setIsPlaying(false);
      setActiveStep(0);
      setImageError(false);

      try {
        const [trajData, cams] = await Promise.all([
          getVehicleTrajectory(activePlate),
          getCameras(),
        ]);

        const map = new Map<string, { lat: number; lng: number; name: string }>();
        cams.forEach((c: Camera) => {
          map.set(c.id, { lat: c.location.lat, lng: c.location.lng, name: c.name });
        });

        setCameraMap(map);
        setTrajectory(trajData);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setIsNotFound(true);
          setErrorMsg(null);
        } else {
          setIsNotFound(false);
          setErrorMsg(err.response?.data?.error || `Failed to load trajectory for ${activePlate}`);
        }
        setTrajectory(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [activePlate]);

  // Reset image error on step change
  useEffect(() => {
    setImageError(false);
  }, [activeStep]);

  // Playback timer loop
  useEffect(() => {
    if (isPlaying && trajectory && trajectory.waypoints.length > 1) {
      timerRef.current = setTimeout(() => {
        setActiveStep((prev) => {
          if (prev >= trajectory.waypoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500 / playSpeed);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, activeStep, trajectory, playSpeed]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (plateInput.trim()) {
      navigate(`/trajectories/${plateInput.trim().toUpperCase()}`);
    }
  };

  const waypoints = trajectory?.waypoints || [];
  const currentWaypoint = waypoints[activeStep];
  const currentCam = currentWaypoint ? cameraMap.get(currentWaypoint.camera_id) : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Search Form */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Trajectory Tracking & Playback
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Chronological multi-camera progression, corridor velocity & cloning anomaly analysis
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
            placeholder="Enter plate e.g. DL01AB1234"
            className="px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-700 text-xs font-mono font-bold text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 uppercase"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-md"
          >
            Track
          </button>
        </form>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-700/60 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 h-[500px]">
          <LoadingSkeleton rows={8} />
        </div>
      ) : isNotFound || !trajectory ? (
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xl">
          <div className="w-14 h-14 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-cyan-400">
            <Route className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">
            No Stored Trajectory for This Plate
          </h3>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            Vehicle <span className="font-mono font-bold text-cyan-400">{activePlate}</span> has not established a multi-camera trajectory in the current dataset, or plate readings were unreadable.
          </p>
          <button
            onClick={() => navigate('/plates')}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-lg"
          >
            Browse Available Plates
          </button>
        </div>
      ) : (
        <>
          {/* Telemetry Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="bg-[#111827] border border-gray-800 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Plate ID</span>
              <span className="font-mono text-base font-extrabold text-white">
                {trajectory.plate_text}
              </span>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Distance</span>
              <span className="text-base font-extrabold text-cyan-400">
                {(trajectory.total_distance_m / 1000).toFixed(1)} km
              </span>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Duration</span>
              <span className="text-base font-extrabold text-cyan-400">
                {formatDuration(trajectory.total_duration_s)}
              </span>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Camera Stops</span>
              <span className="text-base font-extrabold text-white">
                {waypoints.length} sightings
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[#111827] border border-gray-800 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Route Integrity</span>
              {trajectory.impossible_travel ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> Cloned Plate Flag
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                  ✓ Continuous Pass
                </span>
              )}
            </div>
          </div>

          {/* Impossible Travel Warning Alert */}
          {trajectory.impossible_travel && (
            <div className="p-4 rounded-xl bg-red-950/70 border border-red-700/80 text-red-300 text-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <span className="font-bold">IMPOSSIBLE TRAVEL ANOMALY DETECTED:</span> This vehicle
                  exceeded 120 km/h between non-adjacent cameras. Possible fraudulent cloned plate or duplicate registration in transit.
                </div>
              </div>
              <span className="shrink-0 px-2.5 py-1 rounded bg-red-900 font-mono text-[11px] font-bold text-white uppercase">
                High Priority
              </span>
            </div>
          )}

          {/* Map & Timeline Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Column */}
            <div className="lg:col-span-2 h-[460px]">
              <TrajectoryMap
                trajectory={trajectory}
                cameraCoords={cameraMap}
                activeWaypointIndex={activeStep}
                onSelectWaypoint={(idx) => setActiveStep(idx)}
              />
            </div>

            {/* Active Stop & Playback Controls */}
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Playback Telemetry
                  </span>
                  <span className="text-xs font-mono font-semibold text-cyan-400">
                    Step {activeStep + 1} of {waypoints.length}
                  </span>
                </div>

                {/* Current Stop Details */}
                {currentWaypoint && (
                  <div className="mt-4 p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase">
                        Current Sighting
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300">
                        {currentWaypoint.camera_id}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white">
                      {currentCam?.name || currentWaypoint.camera_id}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{new Date(currentWaypoint.timestamp).toLocaleString()}</span>
                    </div>

                    {currentWaypoint.snapshot_url && !imageError ? (
                      <div className="mt-2 rounded-lg overflow-hidden border border-gray-800">
                        <img
                          src={currentWaypoint.snapshot_url}
                          alt="Vehicle Capture"
                          onError={() => setImageError(true)}
                          className="w-full h-28 object-cover"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 rounded-lg bg-gray-900 border border-gray-800 h-24 flex flex-col items-center justify-center text-gray-500 text-xs gap-1 p-2 text-center">
                        <CameraOff className="w-5 h-5 text-gray-600" />
                        <span>No snapshot (simulated data)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Slider & Controls */}
              <div className="mt-6 pt-4 border-t border-gray-800 space-y-3">
                <input
                  type="range"
                  min={0}
                  max={waypoints.length - 1}
                  value={activeStep}
                  onChange={(e) => setActiveStep(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setActiveStep(0);
                      }}
                      className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Speed Selector */}
                  <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800 text-xs">
                    {[1, 2, 5].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaySpeed(spd)}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          playSpeed === spd
                            ? 'bg-cyan-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hop By Hop Segments Table */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-800 font-bold text-xs uppercase tracking-wider text-gray-300">
              Corridor Progression Telemetry ({pluralize(trajectory.segments.length, 'segment', 'segments')})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 uppercase text-[10px] bg-gray-900/50">
                    <th className="py-2.5 px-4">Segment</th>
                    <th className="py-2.5 px-4">From</th>
                    <th className="py-2.5 px-4">To</th>
                    <th className="py-2.5 px-4">Distance</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4">Calculated Speed</th>
                    <th className="py-2.5 px-4">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-gray-300">
                  {trajectory.segments.map((seg, i) => (
                    <tr
                      key={i}
                      className={seg.impossible_travel ? 'bg-red-950/20' : 'hover:bg-gray-800/30'}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-gray-400">#{i + 1}</td>
                      <td className="py-2.5 px-4 font-mono text-cyan-300">{seg.from_camera}</td>
                      <td className="py-2.5 px-4 font-mono text-cyan-300">{seg.to_camera}</td>
                      <td className="py-2.5 px-4">{(seg.distance_m / 1000).toFixed(1)} km</td>
                      <td className="py-2.5 px-4">{formatDuration(seg.delta_time_s)}</td>
                      <td className="py-2.5 px-4 font-bold font-mono">
                        <span className={seg.impossible_travel ? 'text-red-400' : 'text-emerald-400'}>
                          {seg.implied_speed_kmh} km/h
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {seg.impossible_travel ? (
                          <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700/60 text-[10px] font-bold">
                            ⚠️ Anomaly (&gt;120 km/h)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold">
                            ✓ Feasible
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
