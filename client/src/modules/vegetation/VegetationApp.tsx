import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, Download, Send, Leaf } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from '../../context/LocationContext';

const VegetationMap = lazy(() => import('./components/VegetationMap'));

interface Dataset { id: string; name: string; description: string; }
interface DataPoint { year: number; value: number; metric: string; }

export default function VegetationApp() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [city, setCity] = useState('Austin');
  const [datasetId, setDatasetId] = useState('sentinel2_ndvi');
  const [timeframe, setTimeframe] = useState(3);
  const routerLocation = useRouterLocation();
  const hasAutoRun = useRef(false);
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<any>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  const { setLocation } = useLocation();

  // Fetch dataset list
  useEffect(() => {
    fetch('/api/vegetation/datasets')
      .then(r => r.json())
      .then(d => { setDatasets(d); if (d.length > 0) setDatasetId(d[0].id); })
      .catch(() => {});
  }, []);

  // Auto-run from orchestrator redirect
  useEffect(() => {
    const state = routerLocation.state as any;
    if (state?.fromOrchestrator && !hasAutoRun.current) {
      hasAutoRun.current = true;
      const vq = state.fromOrchestrator;
      setCity(vq.location);
      setDatasetId(vq.datasetId);
      setTimeframe(vq.timeframeYears);
      window.history.replaceState({}, '');
      // Run analysis after state settles
      setTimeout(() => {
        const ds = datasets.find(d => d.id === vq.datasetId);
        const q = `Analyze ${ds?.name || vq.datasetId} in ${vq.location} over the last ${vq.timeframeYears} years`;
        setMessages(prev => [...prev, { role: 'user', content: q }]);
        runAnalysis({ location: vq.location, datasetId: vq.datasetId, timeframeYears: vq.timeframeYears });
      }, 200);
    }
  }, [routerLocation.state, datasets]);

  const runAnalysis = useCallback(async (params: { location: string; datasetId?: string; timeframeYears?: number; query?: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/vegetation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
      if (data.narrative) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.narrative }]);
      }
      if (data.mapCenter) {
        setLocation({ lat: data.mapCenter[0], lon: data.mapCenter[1], name: data.location, zoom: 11 });
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  const handleAnalyze = () => {
    if (!city.trim()) return;
    const ds = datasets.find(d => d.id === datasetId);
    const query = `Analyze ${ds?.name || datasetId} in ${city} over the last ${timeframe} years`;
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    runAnalysis({ location: city.trim(), datasetId, timeframeYears: timeframe });
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    runAnalysis({ location: city.trim() || 'Austin', query: chatInput });
    setChatInput('');
  };

  const handleDownloadCSV = () => {
    if (!result?.dataPoints) return;
    const header = 'year,value,metric\n';
    const rows = result.dataPoints.map((dp: DataPoint) => `${dp.year},${dp.value},${dp.metric}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'urban_dynamics_data.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDataset = datasets.find(d => d.id === datasetId);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Leaf className="w-6 h-6 text-emerald-400" />
            <h1 className="text-lg font-semibold tracking-tight">Vegetation Explorer</h1>
          </div>
          <p className="text-xs text-slate-400">Analyze environmental trends for any city worldwide</p>
        </div>

        <div className="p-6 flex-1 space-y-5 overflow-y-auto">
          {/* City input */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">City / Region</label>
            <input
              value={city} onChange={e => setCity(e.target.value)}
              placeholder="e.g., Amsterdam, Tokyo"
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Dataset selector */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GEE Dataset</label>
            <select
              value={datasetId} onChange={e => setDatasetId(e.target.value)}
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {selectedDataset && (
              <p className="mt-1.5 text-xs text-slate-500">{selectedDataset.description}</p>
            )}
          </div>

          {/* Timeframe slider */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Timeframe: {timeframe} year{timeframe > 1 ? 's' : ''}
            </label>
            <input
              type="range" min={1} max={5} value={timeframe}
              onChange={e => setTimeframe(Number(e.target.value))}
              className="mt-1.5 w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1 yr</span><span>3 yrs</span><span>5 yrs</span>
            </div>
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !city.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>

          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-400 font-medium">Or ask a question below to let the agent pick the best dataset.</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Visualizations */}
        {result?.dataPoints && result.dataPoints.length > 0 && (
          <div className="grid grid-cols-2 gap-0 border-b border-slate-200 shrink-0" style={{ height: '55%' }}>
            {/* Chart */}
            <div className="p-6 bg-white border-r border-slate-200 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">Trend: {result.dataPoints[0]?.metric}</h3>
                <button onClick={handleDownloadCSV}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.dataPoints} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3}
                      dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, fill: '#10b981', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Map */}
            <div className="bg-white relative">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-emerald-500 text-sm animate-pulse">Loading map...</div>}>
                <VegetationMap
                  center={result.mapCenter}
                  tileUrl={result.tileUrl}
                  layerName={result.datasetName}
                  geometryGeojson={result.geometryGeojson}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && !loading && (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Select a dataset and city, then click Analyze — or ask a question below.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                }`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm prose-slate max-w-none [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-2 [&_li]:mb-1 [&_strong]:text-slate-900 [&_p]:mb-2">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2 text-emerald-600 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing your request...
                </div>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={handleChat} className="relative">
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                placeholder="Or ask a question, e.g. 'Show me nighttime lights in Tokyo'"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pr-14 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !chatInput.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:text-emerald-400 disabled:opacity-30">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
