import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, LayersControl, ZoomControl, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const QueryIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(245,158,11,0.6);"></div>',
  iconSize: [12, 12], iconAnchor: [6, 6],
});

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 12, { animate: true, duration: 1.5 });
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [center, map]);
  return null;
}

function CoordinateDisplay() {
  const map = useMap();
  useEffect(() => {
    const ctrl = new L.Control({ position: 'bottomleft' });
    let el: HTMLDivElement;
    ctrl.onAdd = () => {
      el = L.DomUtil.create('div', '') as HTMLDivElement;
      el.style.cssText = 'background:rgba(2,6,23,0.85);color:#34d399;padding:5px 10px;border-radius:8px;font-family:ui-monospace,monospace;font-size:11px;border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(8px);pointer-events:none;';
      el.textContent = '\u2014, \u2014';
      return el;
    };
    const onMove = (e: L.LeafletMouseEvent) => { el.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`; };
    const onOut = () => { el.textContent = '\u2014, \u2014'; };
    ctrl.addTo(map);
    map.on('mousemove', onMove);
    map.on('mouseout', onOut);
    return () => { ctrl.remove(); map.off('mousemove', onMove); map.off('mouseout', onOut); };
  }, [map]);
  return null;
}

function PixelQueryHandler({ layerType, onMapClick }: { layerType?: string; onMapClick?: (lat: number, lon: number) => void }) {
  const [queryPoint, setQueryPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      onMapClick?.(lat, lng);
      if (!layerType) return;
      setQueryPoint({ lat, lng });
      setQueryResult(null);
      setQuerying(true);
      try {
        const res = await fetch('/api/analyzer/pixel', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon: lng, layerType }),
        });
        const data = await res.json();
        setQueryResult(data.value ?? data.error ?? 'No data');
      } catch { setQueryResult('Query failed'); }
      finally { setQuerying(false); }
    },
  });

  if (!queryPoint) return null;
  return (
    <Marker position={[queryPoint.lat, queryPoint.lng]} icon={QueryIcon}>
      <Popup>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px', minWidth: '120px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: '#f59e0b' }}>{layerType}</div>
          <div style={{ color: '#64748b', fontSize: '10px' }}>{queryPoint.lat.toFixed(5)}, {queryPoint.lng.toFixed(5)}</div>
          <div style={{ marginTop: '4px', fontWeight: 700, color: '#10b981' }}>{querying ? 'Querying...' : queryResult}</div>
        </div>
      </Popup>
    </Marker>
  );
}

interface AOI { lat: number; lon: number; radiusKm: number; label?: string; }

interface Props {
  lat: number; lon: number;
  geeTileUrl?: string; layerName?: string;
  onMapClick?: (lat: number, lon: number) => void;
  aoi?: AOI | null;
}

export default function AnalyzerMap({ lat, lon, geeTileUrl, layerName, onMapClick, aoi }: Props) {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-900">
      <MapContainer center={[lat, lon]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <ZoomControl position="topright" />
        <ScaleControl position="bottomleft" />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          {geeTileUrl && (
            <LayersControl.Overlay checked name={layerName || 'GEE Data'}>
              <TileLayer key={geeTileUrl} url={geeTileUrl} opacity={0.8} />
            </LayersControl.Overlay>
          )}
        </LayersControl>
        <Marker position={[lat, lon]} />
        <MapController center={[lat, lon]} />
        <CoordinateDisplay />
        <PixelQueryHandler layerType={layerName} onMapClick={onMapClick} />
        {aoi && aoi.radiusKm > 0 && (
          <>
            <Circle center={[aoi.lat, aoi.lon]} radius={aoi.radiusKm * 1000}
              pathOptions={{ color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.08, dashArray: '6 4' }} />
            <Marker position={[aoi.lat, aoi.lon]} icon={QueryIcon} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
