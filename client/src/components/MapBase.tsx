import { useEffect, ReactNode } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapUpdater({ center, zoom, bounds }: {
  center?: [number, number];
  zoom?: number;
  bounds?: [[number, number], [number, number]] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length === 2) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (center && zoom) {
      map.flyTo(center, zoom, { duration: 2 });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

interface MapBaseProps {
  center?: [number, number];
  zoom?: number;
  bounds?: [[number, number], [number, number]] | null;
  children?: ReactNode;
  className?: string;
}

export default function MapBase({
  center = [0, 0],
  zoom = 2,
  bounds,
  children,
  className = ''
}: MapBaseProps) {
  return (
    <div className={`w-full h-full relative ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <MapUpdater center={center} zoom={zoom} bounds={bounds} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {children}
      </MapContainer>
    </div>
  );
}
