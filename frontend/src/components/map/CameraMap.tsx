import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Camera, CongestionItem } from '../../types';

interface CameraMapProps {
  cameras: Camera[];
  congestionData: CongestionItem[];
  selectedCameraId?: string;
  onSelectCamera?: (camera: Camera) => void;
}

const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function createCameraIcon(congestionIndex: number) {
  let colorClass = 'bg-emerald-500 border-emerald-300 text-emerald-950';
  let pulseClass = 'bg-emerald-400';

  if (congestionIndex >= 1.5) {
    colorClass = 'bg-red-500 border-red-300 text-red-950 animate-bounce';
    pulseClass = 'bg-red-400';
  } else if (congestionIndex >= 1.0) {
    colorClass = 'bg-amber-500 border-amber-300 text-amber-950';
    pulseClass = 'bg-amber-400';
  }

  return L.divIcon({
    className: 'custom-camera-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute w-7 h-7 rounded-full opacity-40 animate-ping ${pulseClass}"></span>
        <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-[10px] shadow-lg ${colorClass}">
          📹
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export const CameraMap: React.FC<CameraMapProps> = ({
  cameras,
  congestionData,
  onSelectCamera,
}) => {
  // Delhi NCR center coordinates
  const defaultCenter: [number, number] = [28.625, 77.225];

  const congestionMap = new Map(congestionData.map((c) => [c.camera_id, c]));

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-gray-800 shadow-xl relative">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={TILE_URL}
        />

        {cameras.map((camera) => {
          const congestion = congestionMap.get(camera.id);
          const index = congestion?.congestion_index || 0.8;
          const icon = createCameraIcon(index);

          return (
            <Marker
              key={camera.id}
              position={[camera.location.lat, camera.location.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectCamera?.(camera),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-700 mb-2">
                    <span className="font-bold text-xs text-white">{camera.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-cyan-400">
                      {camera.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mb-2">{camera.address}</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                    <div>
                      <span className="text-gray-500 block">Congestion</span>
                      <span className={`font-semibold ${index >= 1.5 ? 'text-red-400' : index >= 1.0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {index.toFixed(2)} ({congestion?.congestion_level || 'NORMAL'})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Vehicles</span>
                      <span className="font-semibold text-white">
                        {congestion?.vehicle_count ?? '--'}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
