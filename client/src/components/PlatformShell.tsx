import { useEffect, useState, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Globe, Layers, Building, Compass, Satellite, Leaf } from 'lucide-react';

export default function PlatformShell({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<{ earthEngine: boolean } | null>(null);

  useEffect(() => {
    const check = () => {
      fetch('/api/health')
        .then(r => r.json())
        .then(setHealth)
        .catch(() => setHealth(null));
    };
    check();
    // Re-check every 10s until connected, then stop
    const interval = setInterval(() => {
      if (!health?.earthEngine) check();
    }, 10000);
    return () => clearInterval(interval);
  }, [health?.earthEngine]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-white/10 text-white'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Top nav bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-sky-400" />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
              TerraQuery
            </span>
          </NavLink>

          <nav className="flex items-center gap-1 ml-4">
            <NavLink to="/" end className={linkClass}>
              <Compass className="w-4 h-4" />
              Command Center
            </NavLink>
            <NavLink to="/analyzer" className={linkClass}>
              <Satellite className="w-4 h-4" />
              Earth Analyzer
            </NavLink>
            <NavLink to="/landcover" className={linkClass}>
              <Layers className="w-4 h-4" />
              Land Cover
            </NavLink>
            <NavLink to="/urban" className={linkClass}>
              <Building className="w-4 h-4" />
              Urban Dynamics
            </NavLink>
            <NavLink to="/vegetation" className={linkClass}>
              <Leaf className="w-4 h-4" />
              Vegetation
            </NavLink>
          </nav>
        </div>

        {/* GEE status badge */}
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${health?.earthEngine ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-slate-400">
            Earth Engine {health?.earthEngine ? 'Connected' : 'Offline'}
          </span>
        </div>
      </header>

      {/* Module content */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
