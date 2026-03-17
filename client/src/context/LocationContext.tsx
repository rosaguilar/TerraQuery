import { createContext, useContext, useState, ReactNode } from 'react';

interface LocationState {
  lat: number;
  lon: number;
  name: string;
  zoom: number;
}

interface LocationContextType {
  location: LocationState;
  setLocation: (loc: LocationState) => void;
}

const defaultLocation: LocationState = { lat: 0, lon: 0, name: '', zoom: 2 };

const LocationContext = createContext<LocationContextType>({
  location: defaultLocation,
  setLocation: () => {}
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationState>(defaultLocation);
  return (
    <LocationContext.Provider value={{ location, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
