import { useEffect, useState } from 'react';
import { useLocation as useRouterLocation } from 'react-router-dom';
import { LocationProvider } from './context/LocationContext';
import PlatformShell from './components/PlatformShell';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './modules/landing/LandingPage';
import LandcoverApp from './modules/landcover/LandcoverApp';
import UrbanApp from './modules/urban/UrbanApp';
import AnalyzerApp from './modules/analyzer/AnalyzerApp';
import VegetationApp from './modules/vegetation/VegetationApp';

const MODULES = ['/', '/analyzer', '/landcover', '/urban', '/vegetation'] as const;

export default function App() {
  const { pathname } = useRouterLocation();
  const [visited, setVisited] = useState<Set<string>>(new Set(['/']));

  useEffect(() => {
    setVisited(prev => {
      if (prev.has(pathname)) return prev;
      return new Set([...prev, pathname]);
    });
  }, [pathname]);

  return (
    <LocationProvider>
      <PlatformShell>
        {MODULES.map(path => {
          const isActive = pathname === path;
          const isMounted = visited.has(path);
          if (!isMounted) return null;

          return (
            <div
              key={path}
              style={{
                height: '100%',
                width: '100%',
                ...(isActive
                  ? {}
                  : { position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' }
                )
              }}
            >
              <ErrorBoundary>
                {path === '/' && <LandingPage />}
                {path === '/analyzer' && <AnalyzerApp />}
                {path === '/landcover' && <LandcoverApp />}
                {path === '/urban' && <UrbanApp />}
                {path === '/vegetation' && <VegetationApp />}
              </ErrorBoundary>
            </div>
          );
        })}
      </PlatformShell>
    </LocationProvider>
  );
}
