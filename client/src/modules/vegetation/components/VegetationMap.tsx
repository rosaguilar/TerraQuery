import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 11, { duration: 1.5 });
  }, [center, map]);
  return null;
}

interface Props {
  center?: [number, number];
  tileUrl?: string | null;
  layerName?: string;
  geometryGeojson?: any;
}

export default function VegetationMap({ center, tileUrl, layerName, geometryGeojson }: Props) {
  const mapCenter = center || [0, 0];

  return (
    <div className="w-full h-full">
      <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
        <MapUpdater center={mapCenter} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          {tileUrl && (
            <LayersControl.Overlay checked name={layerName || 'GEE Layer'}>
              <TileLayer key={tileUrl} url={tileUrl} opacity={0.8} attribution="Google Earth Engine" />
            </LayersControl.Overlay>
          )}
        </LayersControl>

        {geometryGeojson && (
          <GeoJSON
            key={JSON.stringify(geometryGeojson).slice(0, 100)}
            data={{ type: 'Feature', geometry: geometryGeojson, properties: {} } as any}
            style={() => ({
              fillColor: 'transparent',
              color: 'white',
              weight: 2,
              dashArray: '5, 5',
            })}
          />
        )}

        {!tileUrl && center && (
          <CircleMarker center={mapCenter} radius={50}
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }} />
        )}
      </MapContainer>
    </div>
  );
}
