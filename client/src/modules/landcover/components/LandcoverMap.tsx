import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, LayersControl, useMap, useMapEvents, ImageOverlay } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import LandcoverChart from './LandcoverChart';

// Show looping years synced with GIF
function GifYearDisplay({ isActive, datasetConfig }: { isActive: boolean; datasetConfig: any }) {
  const years = datasetConfig ? datasetConfig.gifLabels : [];
  const fps = datasetConfig?.fps || 1.5;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isActive || years.length === 0) return;
    const msPerFrame = 1000 / fps;
    const totalDuration = msPerFrame * years.length;
    const startTime = performance.now();

    let animFrame: number;
    const update = () => {
      const elapsed = (performance.now() - startTime) % totalDuration;
      setIndex(Math.floor(elapsed / msPerFrame));
      animFrame = requestAnimationFrame(update);
    };
    animFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animFrame);
  }, [isActive, years.length, fps]);

  if (!isActive || years.length === 0) return null;

  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900/85 text-white px-6 py-2.5 rounded-full text-2xl font-bold z-[1000] shadow-lg backdrop-blur border border-white/10 pointer-events-none">
      Year: {years[index]}
    </div>
  );
}

function GifYearDisplayContainer({ mapData }: { mapData: any }) {
  const [isOverlayActive, setIsOverlayActive] = useState(true);
  const layerName = `Earth Engine: ${mapData?.type || 'Layer'} (Time-lapse)`;

  useEffect(() => {
    setIsOverlayActive(true);
  }, [mapData?.gifLayer?.url]);

  useMapEvents({
    overlayadd(e) { if (e.name === layerName) setIsOverlayActive(true); },
    overlayremove(e) { if (e.name === layerName) setIsOverlayActive(false); }
  });

  return <GifYearDisplay isActive={!!mapData?.gifLayer && isOverlayActive} datasetConfig={mapData?.datasetConfig} />;
}

function MapUpdater({ center, zoom, roiBounds }: { center: [number, number]; zoom: number; roiBounds?: any }) {
  const map = useMap();
  useEffect(() => {
    if (roiBounds && roiBounds.length === 2) {
      map.fitBounds(roiBounds, { padding: [20, 20] });
    } else if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [center, zoom, roiBounds, map]);
  return null;
}

function LandcoverLegend({ stats, datasetConfig }: { stats: any; datasetConfig: any }) {
  const legendItems = datasetConfig ? datasetConfig.classNames.map((name: string, index: number) => ({
    color: '#' + datasetConfig.palette[index],
    label: name
  })) : [];

  const startYr = datasetConfig?.startYear || '2001';
  const endYr = datasetConfig?.endYear || '2022';

  const relevantItems = stats ? legendItems.filter((item: any) =>
    (stats[startYr] && stats[startYr][item.label]) || (stats[endYr] && stats[endYr][item.label])
  ) : [];

  return (
    <div className="bg-white/95 p-4 rounded-lg shadow-lg text-xs text-slate-700 backdrop-blur">
      <h4 className="font-bold text-sm mb-2.5">Land Cover</h4>
      <div className="flex flex-col gap-1.5">
        {relevantItems.map((item: any) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-4 h-4 border border-slate-300 shrink-0" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandcoverMap({ mapData }: { mapData: any }) {
  const [showChart, setShowChart] = useState(true);
  const center = mapData?.center || [0, 0];
  const zoom = mapData?.zoom || 2;

  return (
    <div className="h-full w-full relative">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <MapUpdater center={center} zoom={zoom} roiBounds={mapData?.roiBounds} />

        {/* Bottom Left: Legend */}
        <div className="absolute bottom-8 left-3 z-[1000] pointer-events-auto">
          {mapData?.type === 'landcover_change' && (
            <LandcoverLegend stats={mapData?.stats} datasetConfig={mapData?.datasetConfig} />
          )}
        </div>

        {/* Bottom Right: Chart */}
        <div className="absolute bottom-8 right-3 z-[1000] flex flex-col items-end gap-2.5">
          {mapData?.stats && (
            <button
              onClick={() => setShowChart(!showChart)}
              className="bg-white/95 border border-slate-300 px-3 py-1.5 rounded-md cursor-pointer font-bold text-sm shadow-md backdrop-blur pointer-events-auto text-slate-900"
            >
              {showChart ? 'Hide Transitions' : 'Show Transitions'}
            </button>
          )}
          <div className="pointer-events-auto">
            {mapData?.stats && showChart && <LandcoverChart stats={mapData.stats} datasetConfig={mapData?.datasetConfig} />}
          </div>
        </div>

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          {mapData?.gifLayer ? (
            <LayersControl.Overlay checked name={`Earth Engine: ${mapData.type || 'Layer'} (Time-lapse)`}>
              <ImageOverlay
                key={mapData.gifLayer.url}
                url={mapData.gifLayer.url}
                bounds={mapData.gifLayer.bounds}
                opacity={0.8}
              />
            </LayersControl.Overlay>
          ) : mapData?.layer && (
            <LayersControl.Overlay checked name={`Earth Engine: ${mapData.type || 'Layer'}`}>
              <TileLayer
                key={mapData.layer.url}
                url={mapData.layer.url}
                opacity={0.8}
              />
            </LayersControl.Overlay>
          )}
        </LayersControl>
      </MapContainer>
    </div>
  );
}
