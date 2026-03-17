import ee from '@google/earthengine';
import { geocode } from './geocoder.js';

export type TimePeriod = 'recent_30d' | 'recent_90d' | 'recent_6m' | 'full_year';

export async function geocodePlace(query: string): Promise<[number, number] | null> {
  try {
    const result = await geocode(query);
    return [result.lat, result.lon];
  } catch { return null; }
}

function maskS2clouds(image: any) {
  const qa = image.select('QA60');
  const cloudBitMask = 1 << 10;
  const cirrusBitMask = 1 << 11;
  const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

function getDateRange(timePeriod: TimePeriod, year: string): { start: string; end: string } {
  const now = new Date();
  const currentYear = now.getFullYear().toString();

  if (year === currentYear && timePeriod !== 'full_year') {
    const end = now;
    const endStr = end.toISOString().split('T')[0];
    let start: Date;
    switch (timePeriod) {
      case 'recent_30d':
        start = new Date(end); start.setDate(start.getDate() - 30); break;
      case 'recent_90d':
        start = new Date(end); start.setDate(start.getDate() - 90); break;
      case 'recent_6m':
        start = new Date(end); start.setMonth(start.getMonth() - 6); break;
      default:
        return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    return { start: start.toISOString().split('T')[0], end: endStr };
  }
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export async function getGEEMapLayer(lat: number, lon: number, type: 'NDVI' | 'ELEVATION' | 'LANDCOVER', year?: string, timePeriod?: TimePeriod): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const point = ee.Geometry.Point([lon, lat]);
      const region = point.buffer(50000).bounds();
      let image: any;
      let visParams: any;

      const targetYear = year || new Date().getFullYear().toString();
      const period = timePeriod || 'recent_90d';
      const { start, end } = getDateRange(period, targetYear);

      if (type === 'NDVI') {
        const s2Col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(region).filterDate(start, end)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).map(maskS2clouds);
        image = s2Col.median().normalizedDifference(['B8', 'B4']);
        visParams = { min: 0, max: 0.8, palette: ['#FFFFFF', '#CE7E45', '#DF923D', '#F1B555', '#FCD163', '#99B718', '#74A901', '#66A000', '#529400', '#3E8601', '#207401', '#056201', '#004C00', '#023B01', '#012E01', '#011D01', '#011301'] };
      } else if (type === 'ELEVATION') {
        image = ee.Image('USGS/SRTMGL1_003');
        visParams = { min: 0, max: 4000, palette: ['0000ff', '00ffff', 'ffff00', 'ff0000', 'ffffff'] };
      } else {
        const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
          .filterBounds(region).filterDate(start, end);
        image = dw.select('label').mode();
        visParams = { min: 0, max: 8, palette: ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 'dfc351', 'c4281b', 'a59b8f', 'b39fe1'] };
      }

      const clippedImage = image.clip(region);
      clippedImage.getMapId(visParams, (map: any, err: any) => {
        if (err) { console.error("GEE Error:", err); return resolve(null); }
        resolve(map.urlFormat);
      });
    } catch (e) {
      console.error("GEE Catch:", e);
      resolve(null);
    }
  });
}

const LANDCOVER_NAMES: Record<number, string> = {
  0: 'Water', 1: 'Trees', 2: 'Grass', 3: 'Flooded Vegetation',
  4: 'Crops', 5: 'Shrub & Scrub', 6: 'Built-up', 7: 'Bare Ground', 8: 'Snow & Ice',
};

export async function getPixelValue(lat: number, lon: number, type: 'NDVI' | 'ELEVATION' | 'LANDCOVER', year?: string, timePeriod?: TimePeriod): Promise<string> {
  return new Promise((resolve) => {
    try {
      const point = ee.Geometry.Point([lon, lat]);
      const region = point.buffer(50000).bounds();
      let image: any;
      const targetYear = year || new Date().getFullYear().toString();
      const period = timePeriod || 'recent_90d';
      const { start, end } = getDateRange(period, targetYear);

      if (type === 'NDVI') {
        const s2Col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(region).filterDate(start, end)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).map(maskS2clouds);
        image = s2Col.median().normalizedDifference(['B8', 'B4']);
      } else if (type === 'ELEVATION') {
        image = ee.Image('USGS/SRTMGL1_003');
      } else {
        const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
          .filterBounds(region).filterDate(start, end);
        image = dw.select('label').mode();
      }

      const value = image.reduceRegion({ reducer: ee.Reducer.first(), geometry: point, scale: 10, bestEffort: true });
      value.evaluate((result: any, err: any) => {
        if (err) return resolve('Error: ' + err);
        if (!result || Object.keys(result).length === 0) return resolve('No data');
        if (type === 'NDVI') { const nd = result['nd']; return resolve(nd != null ? `NDVI: ${Number(nd).toFixed(4)}` : 'No data'); }
        else if (type === 'ELEVATION') { const elev = result['elevation']; return resolve(elev != null ? `${Number(elev).toFixed(0)} m` : 'No data'); }
        else { const label = result['label']; return resolve(label != null ? (LANDCOVER_NAMES[Math.round(label)] || `class ${label}`) : 'No data'); }
      });
    } catch (e) { resolve('Error: ' + (e as Error).message); }
  });
}

export async function getRegionStats(lat: number, lon: number, type: 'NDVI' | 'ELEVATION' | 'LANDCOVER', radiusKm: number = 5, year?: string, timePeriod?: TimePeriod): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    try {
      const point = ee.Geometry.Point([lon, lat]);
      const aoi = point.buffer(radiusKm * 1000);
      const bigRegion = point.buffer(50000).bounds();
      let image: any;
      const targetYear = year || new Date().getFullYear().toString();
      const period = timePeriod || 'recent_90d';
      const { start, end } = getDateRange(period, targetYear);

      if (type === 'NDVI') {
        const s2Col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(bigRegion).filterDate(start, end)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).map(maskS2clouds);
        image = s2Col.median().normalizedDifference(['B8', 'B4']);
      } else if (type === 'ELEVATION') {
        image = ee.Image('USGS/SRTMGL1_003');
      } else {
        const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
          .filterBounds(bigRegion).filterDate(start, end);
        image = dw.select('label').mode();
      }

      if (type === 'LANDCOVER') {
        const hist = image.reduceRegion({ reducer: ee.Reducer.frequencyHistogram(), geometry: aoi, scale: 10, bestEffort: true, maxPixels: 1e7 });
        hist.evaluate((result: any, err: any) => {
          if (err) return resolve({ error: err });
          const labelHist = result?.label || {};
          const total = Object.values(labelHist).reduce((s: number, v: any) => s + Number(v), 0) as number;
          const distribution: Record<string, string> = {};
          for (const [k, v] of Object.entries(labelHist)) {
            distribution[LANDCOVER_NAMES[Math.round(Number(k))] || `class ${k}`] = ((Number(v) / total) * 100).toFixed(1) + '%';
          }
          resolve({ type: 'LANDCOVER', radiusKm, distribution });
        });
      } else {
        const stats = image.reduceRegion({
          reducer: ee.Reducer.mean().combine(ee.Reducer.minMax(), '', true).combine(ee.Reducer.stdDev(), '', true),
          geometry: aoi, scale: type === 'NDVI' ? 10 : 30, bestEffort: true, maxPixels: 1e7,
        });
        stats.evaluate((result: any, err: any) => {
          if (err) return resolve({ error: err });
          if (!result) return resolve({ error: 'No data' });
          const band = type === 'NDVI' ? 'nd' : 'elevation';
          const fmt = (v: any, d: number) => v != null ? Number(v).toFixed(d) : 'N/A';
          const dec = type === 'NDVI' ? 4 : 0;
          const unit = type === 'ELEVATION' ? ' m' : '';
          resolve({ type, radiusKm, mean: fmt(result[`${band}_mean`], dec) + unit, min: fmt(result[`${band}_min`], dec) + unit, max: fmt(result[`${band}_max`], dec) + unit, stdDev: fmt(result[`${band}_stdDev`], dec) + unit });
        });
      }
    } catch (e) { resolve({ error: (e as Error).message }); }
  });
}

export interface TimeSeriesPoint { year: string; value: number | string | null; }

export async function getTimeSeries(lat: number, lon: number, type: 'NDVI' | 'ELEVATION' | 'LANDCOVER', startYear: number = 2018, endYear: number = new Date().getFullYear(), radiusKm: number = 5): Promise<{ type: string; series: TimeSeriesPoint[]; error?: string }> {
  const point = ee.Geometry.Point([lon, lat]);
  const aoi = radiusKm > 0 ? point.buffer(radiusKm * 1000) : point;
  const bigRegion = point.buffer(50000).bounds();

  if (type === 'ELEVATION') {
    return new Promise((resolve) => {
      const image = ee.Image('USGS/SRTMGL1_003');
      const val = image.reduceRegion({ reducer: ee.Reducer.mean(), geometry: aoi, scale: 30, bestEffort: true });
      val.evaluate((r: any, err: any) => {
        if (err) return resolve({ type, series: [], error: String(err) });
        const elev = r?.elevation;
        resolve({ type, series: [{ year: 'static', value: elev != null ? Number(Number(elev).toFixed(0)) : null }] });
      });
    });
  }

  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const promises = years.map(y => new Promise<TimeSeriesPoint>((resolve) => {
    try {
      const start = `${y}-01-01`; const end = `${y}-12-31`;
      if (type === 'NDVI') {
        const col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(bigRegion).filterDate(start, end)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).map(maskS2clouds);
        const ndvi = col.median().normalizedDifference(['B8', 'B4']);
        const val = ndvi.reduceRegion({ reducer: ee.Reducer.mean(), geometry: aoi, scale: 10, bestEffort: true, maxPixels: 1e7 });
        val.evaluate((r: any, err: any) => {
          if (err || !r) return resolve({ year: String(y), value: null });
          const v = r['nd'];
          resolve({ year: String(y), value: v != null ? Number(Number(v).toFixed(4)) : null });
        });
      } else {
        const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
          .filterBounds(bigRegion).filterDate(start, end);
        const mode = dw.select('label').mode();
        const hist = mode.reduceRegion({ reducer: ee.Reducer.frequencyHistogram(), geometry: aoi, scale: 10, bestEffort: true, maxPixels: 1e7 });
        hist.evaluate((r: any, err: any) => {
          if (err || !r?.label) return resolve({ year: String(y), value: null });
          const labelHist = r.label as Record<string, number>;
          let maxKey = '', maxVal = 0;
          for (const [k, v] of Object.entries(labelHist)) { if (Number(v) > maxVal) { maxVal = Number(v); maxKey = k; } }
          resolve({ year: String(y), value: LANDCOVER_NAMES[Math.round(Number(maxKey))] || `class ${maxKey}` });
        });
      }
    } catch { resolve({ year: String(y), value: null }); }
  }));

  const series = await Promise.all(promises);
  return { type, series };
}
