export interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
}

/**
 * Geocode a location name using Nominatim (OpenStreetMap).
 */
export async function geocode(query: string): Promise<GeocodingResult> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    { headers: { 'User-Agent': 'GeospatialPlatform/1.0' } }
  );
  const data = await res.json() as any[];
  if (!data || data.length === 0) {
    throw new Error(`Location '${query}' not found`);
  }
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}
