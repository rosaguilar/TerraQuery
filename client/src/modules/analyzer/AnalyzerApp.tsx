import { useLocation as useRouterLocation } from 'react-router-dom';
import { Send, Map as MapIcon, Loader2, Globe, ChevronRight, Info, Layers, Clock, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
const AnalyzerMap = lazy(() => import('./components/AnalyzerMap'));
import { LAYER_CONFIGS, TIME_OPTIONS, TRANSLATIONS } from './constants';
import { useLocation } from '../../context/LocationContext';
import { useAnalyzerChat } from './useAnalyzerChat';

const t = TRANSLATIONS.en;

export default function AnalyzerApp() {
  const { messages, sendMessage, isLoading } = useAnalyzerChat();
  const { location, setLocation } = useLocation();
  const routerLocation = useRouterLocation();
  const [input, setInput] = useState('');

  const [mapState, setMapState] = useState({
    lat: 35.6895, lon: 139.6917,
    geeTileUrl: undefined as string | undefined,
    layerName: undefined as string | undefined,
    timeSelection: 'recent_90d' as string,
  });
  const [aoi, setAoi] = useState<{ lat: number; lon: number; radiusKm: number; label?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-submit from orchestrator redirect
  const hasAutoSubmitted = useRef(false);
  useEffect(() => {
    const state = routerLocation.state as any;
    if (state?.initialQuery && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      window.history.replaceState({}, '');
      setTimeout(() => sendMessage(state.initialQuery), 100);
    }
  }, [routerLocation.state]);

  // Pre-fill from shared location
  useEffect(() => {
    if (location.lat && location.lon && location.name) {
      setMapState(prev => ({ ...prev, lat: location.lat, lon: location.lon }));
    }
  }, [location]);

  const getYearAndPeriod = (time: string) => {
    const isRecent = time.startsWith('recent_');
    return { year: isRecent ? new Date().getFullYear().toString() : time, timePeriod: isRecent ? time : 'full_year' };
  };

  const refreshLayer = useCallback((layerType: string, time: string) => {
    if (isLoading) return;
    const { year, timePeriod } = getYearAndPeriod(time);
    sendMessage(`[System Command: Switch to ${layerType} at lat:${mapState.lat}, lon:${mapState.lon} for the year ${year}, timePeriod: ${timePeriod}]`);
  }, [isLoading, mapState.lat, mapState.lon, sendMessage]);

  const handleTimeChange = (time: string) => {
    setMapState(prev => ({ ...prev, timeSelection: time }));
    if (mapState.layerName) refreshLayer(mapState.layerName, time);
  };

  const handleLayerChange = (type: string) => { refreshLayer(type, mapState.timeSelection); };

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setMapState(prev => ({ ...prev, lat, lon }));
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  // Update map from tool results
  useEffect(() => {
    for (const m of [...messages].reverse()) {
      if (m.role !== 'assistant' || !m.toolResults) continue;
      for (const tr of m.toolResults) {
        const result = tr.result;
        if (!result?.coordinates) continue;
        const { lat, lon } = result.coordinates;
        setMapState(prev => ({
          lat, lon,
          geeTileUrl: result.tileUrl || prev.geeTileUrl,
          layerName: result.layerType || prev.layerName,
          timeSelection: result.timePeriod?.startsWith('recent_') ? result.timePeriod : (result.year || prev.timeSelection),
        }));
        setLocation({ lat, lon, name: result.location || '', zoom: 12 });
        if (result.aoi) setAoi(result.aoi);
        return; // only use the latest
      }
    }
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConfig = mapState.layerName ? (LAYER_CONFIGS as any)[mapState.layerName] : null;

  const renderLegend = () => {
    if (!activeConfig || !mapState.layerName) return null;
    const legendT = t.legend[mapState.layerName];
    if (!legendT) return null;
    if (activeConfig.type === 'categorical') {
      return (
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {activeConfig.categories.map((cat: any) => (
            <div key={cat.key} className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/10" style={{ backgroundColor: cat.color }} />
              <span className="text-[11px] text-slate-300">{legendT[cat.key]}</span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2 mt-2">
        <div className="h-3 w-full rounded-full overflow-hidden flex shadow-inner">
          {activeConfig.palette.map((color: string, i: number) => (
            <div key={i} className="flex-1" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>{legendT.minLabel}</span><span>{legendT.maxLabel}</span>
        </div>
      </div>
    );
  };

  const renderToolResult = (tr: any) => {
    const result = tr.result;
    if (!result) return null;
    if (result.toolType === 'timeSeries') {
      return (
        <div className="font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-violet-500/20 space-y-2">
          <div className="flex items-center space-x-1.5 text-violet-400 font-bold">
            <TrendingUp size={12} /><span>{result.type} Time Series — {result.location}</span>
          </div>
          {result.series?.length > 0 && typeof result.series[0]?.value === 'number' && (
            <div className="space-y-1">
              {(() => {
                const vals = result.series.filter((p: any) => p.value != null).map((p: any) => p.value as number);
                const maxV = Math.max(...vals, 0.001);
                return result.series.map((pt: any) => (
                  <div key={pt.year} className="flex items-center space-x-2">
                    <span className="w-8 text-right text-slate-500 text-[10px]">{pt.year}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                      {pt.value != null && <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${Math.max((pt.value / maxV) * 100, 2)}%` }} />}
                    </div>
                    <span className="w-14 text-right text-emerald-400 text-[10px]">{pt.value ?? 'N/A'}</span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      );
    }
    if (result.toolType === 'pixelValue') {
      return (
        <div className="font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-amber-500/20 space-y-1">
          <div className="text-amber-400 font-bold">{result.layerType} @ {result.location}</div>
          <div className="text-emerald-400 text-sm font-bold">{result.value}</div>
        </div>
      );
    }
    if (result.toolType === 'regionStats') {
      return (
        <div className="font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-cyan-500/20 space-y-1">
          <div className="text-cyan-400 font-bold">{result.type} Stats — {result.location} ({result.radiusKm}km)</div>
          {result.distribution ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
              {Object.entries(result.distribution).map(([k, v]) => (
                <div key={k}><span className="text-slate-500">{k}:</span> {v as string}</div>
              ))}
            </div>
          ) : (
            <div className="text-slate-300 space-y-0.5">
              <div>Mean: <span className="text-emerald-400">{result.mean}</span></div>
              <div>Min: <span className="text-blue-400">{result.min}</span>  Max: <span className="text-red-400">{result.max}</span></div>
              <div>StdDev: <span className="text-slate-400">{result.stdDev}</span></div>
            </div>
          )}
        </div>
      );
    }
    if (result.layerType) {
      return (
        <div className="flex items-center space-x-2 text-emerald-400 font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-white/5">
          <ChevronRight size={12} /><span>{t.layerSync}: {result.layerType}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-black text-slate-300">
      {/* Map */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-emerald-500 font-mono text-sm animate-pulse">MAP_ENGINE_LOADING...</div>}>
          <AnalyzerMap
            lat={mapState.lat} lon={mapState.lon}
            geeTileUrl={mapState.geeTileUrl} layerName={mapState.layerName}
            onMapClick={handleMapClick}
            aoi={aoi && aoi.radiusKm > 0 ? aoi : null}
          />
        </Suspense>

        {/* Top-left: Time + Layers */}
        <div className="absolute top-4 left-4 z-[1000] flex items-start space-x-2">
          <div className="bg-slate-950/90 backdrop-blur-lg border border-white/10 p-2.5 rounded-xl shadow-2xl flex flex-col space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center px-1">
                <Clock size={10} className="mr-1" />{t.timePeriodLabel}
              </span>
              {TIME_OPTIONS.map(opt => {
                const label = opt.type === 'recent' ? (t.timePeriods[opt.value] || opt.value) : opt.value;
                return (
                  <button key={opt.value} onClick={() => handleTimeChange(opt.value)} disabled={isLoading}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${mapState.timeSelection === opt.value ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-white/10 text-slate-400'} ${opt.type === 'year' ? 'font-mono' : ''}`}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex space-x-1 border-t border-white/10 pt-2">
              {(['NDVI', 'ELEVATION', 'LANDCOVER'] as const).map(type => (
                <button key={type} onClick={() => handleLayerChange(type)} disabled={isLoading}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all flex items-center space-x-1.5 ${mapState.layerName === type ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-white/10 text-slate-400'}`}>
                  <Layers size={12} /><span>{t.layers[type]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        {activeConfig && (
          <div className="absolute bottom-8 right-4 z-[1000] w-64 bg-slate-950/90 backdrop-blur-xl border border-emerald-500/20 rounded-2xl shadow-2xl p-4">
            <div className="flex items-center space-x-2 mb-1">
              <Info size={14} className="text-emerald-500 shrink-0" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                {t.legend[mapState.layerName!]?.name || mapState.layerName}
              </h3>
            </div>
            {renderLegend()}
            <div className="mt-2 pt-2 border-t border-white/10">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">{t.dataSource}: </span>
              <span className="text-[9px] text-emerald-400/70 font-mono">{activeConfig.source}</span>
            </div>
          </div>
        )}
      </div>

      {/* Chat panel */}
      <div className="w-[420px] flex flex-col bg-slate-950 border-l border-white/5 relative z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
        <header className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
          <div className="flex items-center space-x-3">
            <Globe size={20} className="text-emerald-500" />
            <div>
              <h1 className="text-sm font-black tracking-widest text-white uppercase">{t.title}</h1>
              <div className="flex items-center space-x-2 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                  {isLoading ? t.statusBusy : t.statusReady}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center opacity-15 space-y-4 grayscale">
              <MapIcon size={56} />
              <p className="text-xs font-mono text-center uppercase tracking-[0.3em] leading-relaxed">{t.waitingInput}</p>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white max-w-[85%] rounded-tr-none border border-emerald-500'
                  : 'bg-slate-900 border border-white/5 text-slate-300 max-w-[90%] rounded-tl-none'
              }`}>
                {m.text}
                {m.toolResults?.map((tr, idx) => (
                  <div key={idx} className="mt-3 border-t border-white/5 pt-3">
                    {renderToolResult(tr)}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="font-mono text-[11px] bg-black/40 p-3 rounded-lg border border-emerald-500/20 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-[10px] uppercase tracking-wider font-bold">{t.analyzePrompt}</span>
                </div>
                <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} className="h-4" />
        </div>

        <footer className="p-5 bg-black/40 border-t border-white/5 shrink-0">
          <form onSubmit={handleFormSubmit} className="relative">
            <input
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 pr-14 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all shadow-inner"
              value={input} onChange={e => setInput(e.target.value)} placeholder={t.placeholder}
            />
            <button type="submit" disabled={isLoading || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-30">
              <Send size={18} />
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
