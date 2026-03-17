import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Layers, Building, Satellite, Leaf, Loader2, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from '../../context/LocationContext';

export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setLocation } = useLocation();

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // If orchestrator says redirect, navigate directly
      if (data.redirect === '/analyzer') {
        navigate('/analyzer', { state: { initialQuery: data.analyzerQuery || query } });
        return;
      }
      if (data.redirect === '/vegetation' && data.vegetationQuery) {
        navigate('/vegetation', { state: { fromOrchestrator: data.vegetationQuery } });
        return;
      }

      setResults(data);

      // Update shared location from whichever module responded
      if (data.landcover?.data?.center) {
        const [lat, lon] = data.landcover.data.center;
        setLocation({ lat, lon, name: query, zoom: data.landcover.data.zoom || 10 });
      } else if (data.urban?.latitude) {
        setLocation({
          lat: data.urban.latitude,
          lon: data.urban.longitude,
          name: data.urban.city || query,
          zoom: 11
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToModule = (module: string) => {
    if (module === 'landcover' && results?.landcover) {
      navigate('/landcover', { state: { fromOrchestrator: results.landcover } });
    } else if (module === 'urban' && results?.urban) {
      navigate('/urban', { state: { fromOrchestrator: results.urban } });
    } else if (module === 'vegetation' && results?.vegetation) {
      navigate('/vegetation', { state: { fromOrchestrator: { location: results.vegetation.location, datasetId: results.vegetation.datasetId, timeframeYears: 3 } } });
    } else {
      navigate(`/${module}`);
    }
  };

  const submitQuery = (q: string) => {
    setQuery(q);
    // Auto-submit after setting query
    setTimeout(() => {
      const form = document.getElementById('landing-form') as HTMLFormElement;
      form?.requestSubmit();
    }, 50);
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative">
      {/* Animated Earth Globe background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Globe */}
        <div className="absolute top-1/2 left-1/2" style={{ transform: 'translate(-50%, -50%)', width: '90vmin', height: '90vmin' }}>
          <svg viewBox="0 0 600 600" className="w-full h-full opacity-20" style={{ animation: 'spin 90s linear infinite' }}>
            {/* Globe circle */}
            <circle cx="300" cy="300" r="250" fill="none" stroke="url(#globeGrad)" strokeWidth="1.5" />
            {/* Latitude lines */}
            {[-60, -30, 0, 30, 60].map(lat => {
              const r = 250 * Math.cos((lat * Math.PI) / 180);
              const cy = 300 - 250 * Math.sin((lat * Math.PI) / 180);
              return <ellipse key={lat} cx="300" cy={cy} rx={r} ry={r * 0.3} fill="none" stroke="#38bdf8" strokeWidth="0.6" opacity="0.5" />;
            })}
            {/* Longitude lines */}
            {[0, 30, 60, 90, 120, 150].map(lon => (
              <ellipse key={lon} cx="300" cy="300" rx={250 * Math.sin((lon * Math.PI) / 180)} ry={250} fill="none" stroke="#34d399" strokeWidth="0.5" opacity="0.35" />
            ))}
            {/* Continents - simplified abstract shapes */}
            <path d="M220,180 Q250,160 280,170 Q310,155 330,175 Q340,195 325,210 Q310,215 290,210 Q260,220 240,205 Q220,195 220,180Z" fill="#34d399" opacity="0.25" />
            <path d="M310,240 Q330,225 350,235 Q365,255 355,275 Q340,295 320,290 Q305,280 300,260 Q305,245 310,240Z" fill="#34d399" opacity="0.2" />
            <path d="M200,260 Q220,250 235,265 Q240,285 225,300 Q210,305 195,290 Q190,275 200,260Z" fill="#34d399" opacity="0.2" />
            <path d="M350,180 Q380,170 400,185 Q410,210 395,225 Q375,230 360,215 Q345,200 350,180Z" fill="#34d399" opacity="0.15" />
            <path d="M240,310 Q260,305 275,320 Q280,345 265,360 Q245,365 230,350 Q225,330 240,310Z" fill="#34d399" opacity="0.15" />
            <defs>
              <linearGradient id="globeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Orbiting satellite dots */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px]" style={{ animation: 'spin 60s linear infinite' }}>
          <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-sky-400/40 shadow-[0_0_8px_rgba(56,189,248,0.4)]" />
          <div className="absolute bottom-[10%] right-[5%] w-1.5 h-1.5 rounded-full bg-emerald-400/30 shadow-[0_0_6px_rgba(52,211,153,0.3)]" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]" style={{ animation: 'spin 45s linear infinite reverse' }}>
          <div className="absolute top-[5%] right-0 w-1.5 h-1.5 rounded-full bg-violet-400/35 shadow-[0_0_6px_rgba(167,139,250,0.3)]" />
        </div>

        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="bgGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38bdf8" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgGrid)" />
        </svg>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 relative z-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-sky-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Ask anything about any place on Earth
          </h1>
          <p className="text-slate-400 text-lg">
            AI-powered satellite analysis combining land cover change detection and urban dynamics
          </p>
        </div>

        {/* Query Bar */}
        <form id="landing-form" onSubmit={handleAsk} className="relative mb-8">
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-2xl shadow-2xl shadow-sky-500/5 focus-within:border-sky-500/50 focus-within:shadow-sky-500/10 transition-all">
            <Search className="w-5 h-5 text-slate-500 ml-5" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Show deforestation in Amazon... How have green areas changed in Paris?... Full analysis of Barcelona..."
              className="flex-1 bg-transparent px-4 py-5 text-slate-100 placeholder:text-slate-500 focus:outline-none text-lg"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="mr-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-semibold rounded-xl disabled:opacity-40 hover:from-sky-400 hover:to-emerald-400 transition-all flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze'}
            </button>
          </div>
        </form>

        {/* Example prompts by module */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {/* Earth Analyzer */}
          <div className="bg-slate-800/40 border border-violet-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-violet-500/10 rounded-lg"><Satellite className="w-4 h-4 text-violet-400" /></div>
              <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Earth Analyzer</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Highest peak in Nepal', q: 'Show me the highest peak in Nepal' },
                { label: 'Nile River delta', q: 'Show me the Nile River delta from above' },
                { label: 'Greenness of Central Park', q: 'What is the current NDVI of Central Park, New York?' },
                { label: 'Iceland volcanic terrain', q: 'Show me the elevation of Iceland' },
              ].map(ex => (
                <button key={ex.label} onClick={() => submitQuery(ex.q)}
                  className="px-3 py-1.5 text-[13px] rounded-lg border border-violet-500/20 text-slate-400 hover:border-violet-400/50 hover:text-violet-300 hover:bg-violet-500/5 transition-all">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Land Cover Change */}
          <div className="bg-slate-800/40 border border-sky-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-500/10 rounded-lg"><Layers className="w-4 h-4 text-sky-400" /></div>
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Land Cover Change</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Amazon deforestation timelapse', q: 'Show me deforestation in the Amazon rainforest' },
                { label: 'Borneo palm oil expansion', q: 'Show land cover transitions in Borneo over 20 years' },
                { label: 'Dubai from desert to city', q: 'Analyze land cover change in Dubai' },
                { label: 'European farmland shift', q: 'Analyze land cover change in the Netherlands' },
              ].map(ex => (
                <button key={ex.label} onClick={() => submitQuery(ex.q)}
                  className="px-3 py-1.5 text-[13px] rounded-lg border border-sky-500/20 text-slate-400 hover:border-sky-400/50 hover:text-sky-300 hover:bg-sky-500/5 transition-all">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Urban Dynamics */}
          <div className="bg-slate-800/40 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg"><Building className="w-4 h-4 text-emerald-400" /></div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Urban Dynamics</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Is Seoul getting greener?', q: 'How have green areas changed in Seoul over 5 years?' },
                { label: 'Shenzhen factory migration', q: 'Show industrial movement trends in Shenzhen over 5 years' },
                { label: 'Austin tech boom sprawl', q: 'Analyze urban expansion in Austin over 3 years' },
                { label: 'London park coverage', q: 'How have green areas changed in London over 3 years?' },
              ].map(ex => (
                <button key={ex.label} onClick={() => submitQuery(ex.q)}
                  className="px-3 py-1.5 text-[13px] rounded-lg border border-emerald-500/20 text-slate-400 hover:border-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-500/5 transition-all">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vegetation Explorer */}
          <div className="bg-slate-800/40 border border-lime-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-lime-500/10 rounded-lg"><Leaf className="w-4 h-4 text-lime-400" /></div>
              <span className="text-xs font-bold text-lime-400 uppercase tracking-wider">Vegetation Explorer</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Tokyo vegetation health', q: 'Show vegetation health in Tokyo over the last 3 years' },
                { label: 'Mumbai monsoon rainfall', q: 'What is the precipitation trend in Mumbai over 5 years?' },
                { label: 'Berlin heat island effect', q: 'Show land surface temperature in Berlin over 3 years' },
                { label: 'Amazon rainforest NDVI', q: 'Show MODIS NDVI trends in the Amazon over 5 years' },
              ].map(ex => (
                <button key={ex.label} onClick={() => submitQuery(ex.q)}
                  className="px-3 py-1.5 text-[13px] rounded-lg border border-lime-500/20 text-slate-400 hover:border-lime-400/50 hover:text-lime-300 hover:bg-lime-500/5 transition-all">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Routing explanation */}
              <div className="text-center text-sm text-slate-500">
                Routed to: {results.modules?.map((m: string) => (
                  <span key={m} className={`inline-flex items-center gap-1 mx-1 px-3 py-1 rounded-full text-xs font-medium ${
                    m === 'landcover' ? 'bg-sky-500/10 text-sky-400' :
                    m === 'analyzer' ? 'bg-violet-500/10 text-violet-400' :
                    m === 'vegetation' ? 'bg-lime-500/10 text-lime-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {m === 'landcover' ? <Layers className="w-3 h-3" /> :
                     m === 'analyzer' ? <Satellite className="w-3 h-3" /> :
                     m === 'vegetation' ? <Leaf className="w-3 h-3" /> :
                     <Building className="w-3 h-3" />}
                    {m === 'landcover' ? 'Land Cover' : m === 'analyzer' ? 'Earth Analyzer' : m === 'vegetation' ? 'Vegetation' : 'Urban Dynamics'}
                  </span>
                ))}
              </div>

              {/* Synthesis (if both modules) */}
              {results.synthesis && (
                <div className="bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border border-sky-500/20 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Combined Analysis</h3>
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                    <ReactMarkdown>{results.synthesis}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Landcover result card */}
              {results.landcover?.success && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sky-500/10 rounded-lg">
                        <Layers className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Land Cover Analysis</h3>
                        <p className="text-xs text-slate-500">
                          {results.landcover.data?.datasetConfig?.name || 'Google Earth Engine'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => goToModule('landcover')}
                      className="flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      Deep dive <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {results.landcover.message && (
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                      <ReactMarkdown>{results.landcover.message}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* Urban result card */}
              {results.urban?.data && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Building className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Urban Dynamics</h3>
                        <p className="text-xs text-slate-500">{results.urban.city} - {results.urban.trend} trend</p>
                      </div>
                    </div>
                    <button
                      onClick={() => goToModule('urban')}
                      className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Deep dive <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-400">{results.urban.summary}</p>
                </div>
              )}

              {/* Vegetation result card */}
              {results.vegetation?.success && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-lime-500/10 rounded-lg">
                        <Leaf className="w-5 h-5 text-lime-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Vegetation Analysis</h3>
                        <p className="text-xs text-slate-500">{results.vegetation.datasetName} — {results.vegetation.location}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => goToModule('vegetation')}
                      className="flex items-center gap-1 text-sm text-lime-400 hover:text-lime-300 transition-colors"
                    >
                      Deep dive <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {results.vegetation.narrative && (
                    <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                      <ReactMarkdown>{results.vegetation.narrative}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
