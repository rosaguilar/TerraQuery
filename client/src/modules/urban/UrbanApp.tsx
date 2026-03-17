import { useState, useEffect } from 'react';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Map, TrendingUp, Leaf, Factory, Building, Send,
  Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import MapBase from '../../components/MapBase';
import { useLocation } from '../../context/LocationContext';

type AgentStatus = 'idle' | 'working' | 'done' | 'error';

interface ParsedIntent {
  city: string;
  timeframeYears: number;
  metric: string;
  latitude: number;
  longitude: number;
}

export default function UrbanApp() {
  const [geeConnected, setGeeConnected] = useState(false);
  const [geeConnecting, setGeeConnecting] = useState(false);
  const [geeMessage, setGeeMessage] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [agent1Status, setAgent1Status] = useState<AgentStatus>('idle');
  const [agent2Status, setAgent2Status] = useState<AgentStatus>('idle');
  const [agent3Status, setAgent3Status] = useState<AgentStatus>('idle');

  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [story, setStory] = useState('');

  const { location, setLocation } = useLocation();
  const routerLocation = useRouterLocation();

  // Auto-connect to GEE
  useEffect(() => { handleConnectGEE(); }, []);

  // Hydrate from orchestrator results passed via navigation state
  useEffect(() => {
    const state = routerLocation.state as any;
    if (state?.fromOrchestrator) {
      const orch = state.fromOrchestrator;
      if (orch.data) {
        setChartData(orch.data);
        // Build a parsedIntent from the orchestrator response
        setParsedIntent({
          city: orch.city || '',
          timeframeYears: orch.data.length > 0 ? orch.data.length - 1 : 5,
          metric: orch.data[0]?.metric?.replace(' ', '_') || 'green_areas',
          latitude: orch.latitude || 0,
          longitude: orch.longitude || 0
        });
        setAgent1Status('done');
        setAgent2Status('done');
      }
      if (orch.summary) {
        setStory(orch.summary);
        setAgent3Status('done');
      }
      window.history.replaceState({}, '');
    }
  }, [routerLocation.state]);

  // Pre-fill from shared location
  useEffect(() => {
    if (location.name && !prompt && !parsedIntent) {
      setPrompt(`How have green areas changed in ${location.name} over 5 years?`);
    }
  }, [location.name]);

  const handleConnectGEE = async () => {
    setGeeConnecting(true);
    setGeeMessage('Connecting...');
    try {
      for (let i = 0; i < 5; i++) {
        const res = await fetch('/api/urban/status');
        const data = await res.json();
        if (data.connected) {
          setGeeConnected(true);
          setGeeMessage('Connected to Google Earth Engine.');
          setGeeConnecting(false);
          return;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      throw new Error('Timeout');
    } catch {
      setGeeConnected(false);
      setGeeMessage('Failed to connect.');
    } finally {
      setGeeConnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !geeConnected) return;

    setIsProcessing(true);
    setParsedIntent(null);
    setChartData([]);
    setStory('');

    try {
      // Agent 1: Parse
      setAgent1Status('working');
      setAgent2Status('idle');
      setAgent3Status('idle');

      const parseRes = await fetch('/api/urban/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!parseRes.ok) throw new Error('Parse failed');
      const intent = await parseRes.json();
      const parsedData: ParsedIntent = {
        city: intent.city || 'Unknown',
        timeframeYears: intent.timeframeYears || 5,
        metric: intent.metric || 'unknown',
        latitude: intent.latitude || 0,
        longitude: intent.longitude || 0
      };
      setParsedIntent(parsedData);
      setAgent1Status('done');

      // Update shared location
      if (parsedData.latitude && parsedData.longitude) {
        setLocation({
          lat: parsedData.latitude,
          lon: parsedData.longitude,
          name: parsedData.city,
          zoom: 11
        });
      }

      // Agent 2: GEE Data
      setAgent2Status('working');
      const dataRes = await fetch(
        `/api/urban/analyze?city=${encodeURIComponent(parsedData.city)}&metric=${encodeURIComponent(parsedData.metric)}&years=${parsedData.timeframeYears}`
      );
      if (!dataRes.ok) throw new Error('Analysis failed');
      const dataResult = await dataRes.json();
      setChartData(dataResult.data);
      setAgent2Status('done');

      // Agent 3: Story
      setAgent3Status('working');
      const storyRes = await fetch('/api/urban/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: parsedData.city,
          metric: parsedData.metric,
          timeframeYears: parsedData.timeframeYears,
          trend: dataResult.trend,
          dataSummary: dataResult.summary
        })
      });
      if (!storyRes.ok) throw new Error('Story failed');
      const storyResult = await storyRes.json();
      setStory(storyResult.story || '');
      setAgent3Status('done');
    } catch (error) {
      console.error("Workflow Error:", error);
      if (agent1Status === 'working') setAgent1Status('error');
      if (agent2Status === 'working') setAgent2Status('error');
      if (agent3Status === 'working') setAgent3Status('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'green_areas': return <Leaf className="w-5 h-5 text-emerald-500" />;
      case 'industrial_movement': return <Factory className="w-5 h-5 text-amber-500" />;
      case 'urban_expansion': return <Building className="w-5 h-5 text-indigo-500" />;
      default: return <Map className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-semibold tracking-tight">Urban Dynamics</h1>
          </div>
          <p className="text-xs text-slate-400">Multi-Agent Analysis System</p>
        </div>
        <div className="p-6 flex-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">System Status</h2>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Earth Engine</span>
              {geeConnected ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full">
                  Disconnected
                </span>
              )}
            </div>
            {!geeConnected && (
              <button
                onClick={handleConnectGEE}
                disabled={geeConnecting}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {geeConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {geeConnecting ? 'Connecting...' : 'Connect to GEE'}
              </button>
            )}
            {geeConnected && <p className="text-xs text-slate-400 mt-2">{geeMessage}</p>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-6 shrink-0">
          <h2 className="text-2xl font-semibold text-slate-800">Stakeholder Query</h2>
          <p className="text-sm text-slate-500 mt-1">Ask about green areas, industrial movement, or urban expansion.</p>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Input */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g., How have green areas increased or decreased in Seattle over the last 5 years?"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pr-16 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none min-h-[120px]"
                  disabled={isProcessing || !geeConnected}
                />
                <button
                  type="submit"
                  disabled={isProcessing || !prompt.trim() || !geeConnected}
                  className="absolute bottom-4 right-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white p-3 rounded-lg transition-colors"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
              {!geeConnected && (
                <p className="text-sm text-amber-600 mt-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Please wait for Earth Engine to connect.
                </p>
              )}
            </section>

            {/* Progress & Results */}
            <AnimatePresence mode="wait">
              {(isProcessing || parsedIntent) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                  {/* Agent cards */}
                  <div className="lg:col-span-1 space-y-4">
                    <AgentCard title="Agent 1: Intent Parser" description="Extracts city, timeframe, and metric." status={agent1Status} />
                    <AgentCard title="Agent 2: GEE Data Analyst" description="Gathers geospatial data from Earth Engine." status={agent2Status} />
                    <AgentCard title="Agent 3: Storyteller" description="Generates narrative explanations." status={agent3Status} />
                  </div>

                  {/* Results */}
                  <div className="lg:col-span-2 space-y-6">
                    {parsedIntent && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center gap-6 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-slate-100 rounded-xl"><Map className="w-5 h-5 text-slate-600" /></div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold">Target City</p>
                            <p className="font-medium text-slate-900">{parsedIntent.city}</p>
                          </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200" />
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-slate-100 rounded-xl">{getMetricIcon(parsedIntent.metric)}</div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold">Metric</p>
                            <p className="font-medium text-slate-900 capitalize">{parsedIntent.metric.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200" />
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-slate-100 rounded-xl"><TrendingUp className="w-5 h-5 text-slate-600" /></div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold">Timeframe</p>
                            <p className="font-medium text-slate-900">{parsedIntent.timeframeYears} Years</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Map */}
                    {parsedIntent && parsedIntent.latitude !== 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-6">Geospatial View</h3>
                        <div className="h-80 w-full rounded-xl overflow-hidden">
                          <MapBase center={[parsedIntent.latitude, parsedIntent.longitude]} zoom={11} />
                        </div>
                      </motion.div>
                    )}

                    {/* Chart */}
                    {chartData.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-6">Data Visualization</h3>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3}
                                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </motion.div>
                    )}

                    {/* Story */}
                    {story && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Stakeholder Report</h3>
                        <div className="prose prose-slate max-w-none">
                          {story.split('\n\n').map((paragraph, idx) => (
                            <p key={idx} className="text-slate-600 leading-relaxed mb-4 last:mb-0">{paragraph}</p>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Sources */}
                    {parsedIntent && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-slate-100 rounded-xl p-6 border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Data & Analysis Sources</h4>
                        <div className="space-y-2 text-sm text-slate-600">
                          <p><span className="font-medium text-slate-800">Geospatial Data:</span> Google Earth Engine (Live), MODIS NDVI, VIIRS Nighttime Lights.</p>
                          <p><span className="font-medium text-slate-800">Map:</span> OpenStreetMap, CARTO.</p>
                          <p><span className="font-medium text-slate-800">AI Analysis:</span> Google Gemini via Vertex AI.</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function AgentCard({ title, description, status }: { title: string; description: string; status: AgentStatus }) {
  return (
    <div className={`rounded-xl p-5 border transition-all duration-300 ${
      status === 'working' ? 'bg-emerald-50 border-emerald-200 shadow-sm' :
      status === 'done' ? 'bg-white border-slate-200' :
      status === 'error' ? 'bg-red-50 border-red-200' :
      'bg-slate-50 border-slate-200 opacity-60'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className={`font-semibold text-sm ${
            status === 'working' ? 'text-emerald-800' :
            status === 'error' ? 'text-red-800' : 'text-slate-700'
          }`}>{title}</h4>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
        <div>
          {status === 'working' && <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />}
          {status === 'done' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
        </div>
      </div>
    </div>
  );
}
