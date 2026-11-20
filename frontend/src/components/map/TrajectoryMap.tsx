import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Trajectory, TrajectoryWaypoint } from '../../types';

interface TrajectoryMapProps {
  trajectory: Trajectory;
  cameraCoords: Map<string, { lat: number; lng: number; name: string }>;
  activeWaypointIndex: number;
  onSelectWaypoint?: (index: number) => void;
}

const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function createWaypointIcon(index: number, isActive: boolean, isImpossible: boolean) {
  const bgClass = isImpossible
    ? 'bg-red-600 text-white border-red-300'
    : isActive
    ? 'bg-cyan-500 text-white border-white scale-125'
    : 'bg-[#1F2937] text-cyan-400 border-cyan-500/50';

  return L.divIcon({
    className: 'custom-waypoint-icon',
    html: `
      <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center font-black text-[10px] shadow-xl transition-transform ${bgClass}">
        ${index + 1}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export const TrajectoryMap: React.FC<TrajectoryMapProps> = ({
  trajectory,
  cameraCoords,
  activeWaypointIndex,
  onSelectWaypoint,
}) => {
  const waypoints = trajectory.waypoints || [];
  const segments = trajectory.segments || [];

  // Determine center based on first waypoint or Delhi center
  const firstCoords = waypoints[0] ? cameraCoords.get(waypoints[0].camera_id) : null;
  const center: [number, number] = firstCoords
    ? [firstCoords.lat, firstCoords.lng]
    : [28.625, 77.225];

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-gray-800 shadow-xl relative">
      <MapContainer center={center} zoom={12} scrollWheelZoom={true} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={TILE_URL}
        />

        {/* Draw Segments */}
        {segments.map((seg, idx) => {
          const fromLoc = cameraCoords.get(seg.from_camera);
          const toLoc = cameraCoords.get(seg.to_camera);

          if (!fromLoc || !toLoc) return null;

          const isImpossible = seg.impossible_travel;

          return (
            <Polyline
              key={`seg-${idx}`}
              positions={[
                [fromLoc.lat, fromLoc.lng],
                [toLoc.lat, toLoc.lng],
              ]}
              pathOptions={{
                color: isImpossible ? '#EF4444' : '#06B6D4',
                weight: isImpossible ? 5 : 3.5,
                dashArray: isImpossible ? '8, 8' : undefined,
                opacity: 0.9,
              }}
            >
              <Popup>
                <div className="p-1 min-w-[180px] text-xs">
                  <div className="font-bold text-white mb-1">
                    {seg.from_camera} → {seg.to_camera}
                  </div>
                  <div className="text-[11px] text-gray-300 space-y-0.5">
                    <p>Distance: {(seg.distance_m / 1000).toFixed(1)} km</p>
                    <p>Duration: {Math.round(seg.delta_time_s / 60)} mins</p>
                    <p className={`font-semibold ${isImpossible ? 'text-red-400' : 'text-cyan-400'}`}>
                      Speed: {seg.implied_speed_kmh} km/h
                    </p>
                  </div>
                  {isImpossible && (
                    <div className="mt-2 p-1.5 rounded bg-red-950 border border-red-700 text-red-300 text-[10px] font-semibold">
                      ⚠️ Cloned Plate / Anomaly (&gt;120 km/h)
                    </div>
                  )}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Draw Waypoint Markers */}
        {waypoints.map((wp: TrajectoryWaypoint, idx: number) => {
          const loc = cameraCoords.get(wp.camera_id);
          if (!loc) return null;

          const isActive = idx === activeWaypointIndex;
          const isImpossible = !!wp.impossible;
          const icon = createWaypointIcon(idx, isActive, isImpossible);

          return (
            <Marker
              key={`wp-${idx}`}
              position={[loc.lat, loc.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectWaypoint?.(idx),
              }}
            >
              <Popup>
                <div className="p-1 text-xs">
                  <div className="font-bold text-white flex items-center gap-1.5 pb-1 border-b border-gray-700 mb-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px]">
                      Stop #{idx + 1}
                    </span>
                    <span>{loc.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Sighted: {new Date(wp.timestamp).toLocaleString()}
                  </p>
                  {wp.snapshot_url && (
                    <div className="mt-2 rounded overflow-hidden border border-gray-700">
                      <img
                        src={wp.snapshot_url}
                        alt="Camera snapshot"
                        className="w-full h-24 object-cover"
                      />
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
