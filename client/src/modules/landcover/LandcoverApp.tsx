import { useState, useEffect } from 'react';
import { useLocation as useRouterLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import LandcoverMap from './components/LandcoverMap';
import { useLocation } from '../../context/LocationContext';

export default function LandcoverApp() {
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { location, setLocation } = useLocation();
  const routerLocation = useRouterLocation();

  // Hydrate from orchestrator results passed via navigation state
  useEffect(() => {
    const state = routerLocation.state as any;
    if (state?.fromOrchestrator) {
      const orch = state.fromOrchestrator;
      if (orch.data) setMapData(orch.data);
      if (orch.message) setAgentMessage(orch.message);
      // Clear the state so refreshing doesn't re-hydrate stale data
      window.history.replaceState({}, '');
    }
  }, [routerLocation.state]);

  // If location was set from another module and no data yet, pre-fill query
  useEffect(() => {
    if (location.name && !query && !mapData) {
      setQuery(`Show me land cover change in ${location.name}`);
    }
  }, [location.name]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setAgentMessage("Thinking...");

    try {
      const response = await fetch('/api/landcover/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("The server is temporarily unavailable. Please try again.");
      }

      if (!response.ok) throw new Error(result?.error || `Status: ${response.status}`);
      if (!result.success) throw new Error(result.error);

      setMapData(result.data);
      setAgentMessage(result.message);

      // Update shared location context
      if (result.data?.center) {
        setLocation({
          lat: result.data.center[0],
          lon: result.data.center[1],
          name: query,
          zoom: result.data.zoom || 10
        });
      }

      setQuery('');
    } catch (err: any) {
      setError(err.message || "Failed to fetch map data");
      setAgentMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-[420px] bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 p-8 flex flex-col gap-5 overflow-y-auto shrink-0">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
          Land Cover Change Analyzer
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Ask the Vertex AI agent to analyze deforestation, urban growth, or land cover changes in any location!
        </p>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-2">
          {[
            { emoji: '\uD83C\uDDEB\uD83C\uDDF7', label: 'Paris', q: 'Show me land cover change in Paris' },
            { emoji: '\uD83C\uDDEA\uD83C\uDDF8', label: 'Barcelona', q: 'Analyze land cover change in Barcelona' },
            { emoji: '\uD83C\uDDE7\uD83C\uDDF7', label: 'Amazon', q: 'Show me deforestation in the Amazon rainforest' },
            { emoji: '\uD83C\uDDF3\uD83C\uDDEC', label: 'Lagos', q: 'Analyze land cover change in Lagos, Nigeria' }
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setQuery(s.q)}
              className="px-3 py-1.5 text-xs rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors"
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleChat} className="flex flex-col gap-4 bg-white/[0.03] p-5 rounded-xl border border-white/[0.05]">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g., Show me deforestation in the Amazon rainforest"
            disabled={loading}
            className="w-full h-24 p-3.5 bg-black/20 border border-white/10 rounded-lg text-slate-200 text-sm resize-none placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-gradient-to-r from-sky-400 to-blue-600 text-white py-3.5 rounded-lg font-semibold tracking-wide shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:bg-slate-700 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none disabled:translate-y-0 transition-all"
          >
            {loading ? 'Asking Agent...' : 'Send to Agent'}
          </button>
        </form>

        {/* Response */}
        {agentMessage && !error && (
          agentMessage === "Thinking..." ? (
            <div className="flex items-center gap-3 text-sky-400 font-medium p-5 bg-sky-500/5 rounded-xl border border-dashed border-sky-500/30">
              <div className="w-4 h-4 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-sm">Vertex AI Agent is analyzing Earth Engine data...</span>
            </div>
          ) : (
            <div className="bg-slate-900/60 p-6 rounded-xl border border-sky-500/20 shadow-inner">
              <h2 className="text-sky-400 text-sm font-bold uppercase tracking-wider mb-4 pb-3 border-b border-sky-500/20">
                Gemini Analytics Report
              </h2>
              <div className="prose prose-invert prose-sm max-w-none text-slate-200 [&_strong]:text-white [&_h3]:text-white [&_h3]:text-base [&_h3]:border-b [&_h3]:border-white/10 [&_h3]:pb-1 [&_li]:mb-1.5 [&_ul]:pl-5 [&_p]:mb-3.5">
                <ReactMarkdown>{agentMessage}</ReactMarkdown>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 text-xs text-slate-500">
                <strong>Data Sources:</strong> {mapData?.datasetConfig?.name || 'Google Earth Engine'}
                {mapData?.datasetConfig?.scale ? ` (${mapData.datasetConfig.scale}m)` : ''}, geoBoundaries.
              </div>
            </div>
          )
        )}

        {error && (
          <div className="bg-red-500/10 border-l-4 border-red-500 p-4 text-red-300 text-sm rounded-lg break-words">
            <strong>Error:</strong> {error}
          </div>
        )}
      </aside>

      {/* Map */}
      <div className="flex-1 bg-slate-950">
        <LandcoverMap mapData={mapData} />
      </div>
    </div>
  );
}
