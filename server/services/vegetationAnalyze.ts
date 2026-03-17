import ee from '@google/earthengine';
import { DATASETS, DatasetConfig } from './vegetationRegistry.js';

export interface DataPoint {
  year: number;
  value: number;
  metric: string;
}

export interface SpatialData {
  dataPoints: DataPoint[];
  tileUrl: string | null;
  visParams: any;
}

export async function fetchGeeData(
  geometryGeojson: any,
  datasetId: string,
  timeframeYears: number
): Promise<SpatialData> {
  if (!DATASETS[datasetId]) throw new Error(`Unknown dataset: ${datasetId}`);

  const config = DATASETS[datasetId];
  const geometry = ee.Geometry(geometryGeojson);
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - timeframeYears;

  const dataPoints: DataPoint[] = [];
  let latestImage: any = null;

  for (let year = startYear; year <= currentYear; year++) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    let collection = ee.ImageCollection(config.collection)
      .filterBounds(geometry)
      .filterDate(startDate, endDate);

    if (config.cloudFilter) {
      collection = collection.filter(
        ee.Filter.lt(config.cloudFilter.property, config.cloudFilter.max)
      );
    }

    let result: any;

    if (config.type === 'normalized_difference') {
      const images = collection.map((img: any) =>
        img.normalizedDifference(config.bands)
          .rename(config.outputBand)
          .copyProperties(img, ['system:time_start'])
      );
      result = images.mean().clip(geometry);
    } else if (config.type === 'band_mean') {
      const images = collection.select(config.bands[0]);
      result = images.mean().clip(geometry);
      if (config.scaleFactor) {
        result = result.multiply(config.scaleFactor).add(config.offset || 0);
      }
      result = result.rename(config.outputBand);
    } else if (config.type === 'band_sum') {
      const images = collection.select(config.bands[0]);
      result = images.sum().clip(geometry);
      result = result.rename(config.outputBand);
    } else {
      throw new Error(`Unknown computation type: ${config.type}`);
    }

    const stats = result.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry,
      scale: config.scale,
      maxPixels: 1e9,
    });

    const value = await new Promise<number | null>((resolve) => {
      stats.get(config.outputBand).evaluate((val: any, err: any) => {
        if (err) { resolve(null); return; }
        resolve(val);
      });
    });

    if (value !== null) {
      dataPoints.push({ year, value: Math.round(value * 10000) / 10000, metric: config.metricName });
    }

    latestImage = result;
  }

  // Generate tile URL for the latest year
  let tileUrl: string | null = null;
  if (latestImage) {
    tileUrl = await new Promise<string | null>((resolve) => {
      latestImage.getMapId(config.visParams, (map: any, err: any) => {
        if (err) { resolve(null); return; }
        resolve(map.urlFormat);
      });
    });
  }

  return { dataPoints, tileUrl, visParams: config.visParams };
}

/**
 * Geocode a city using FAO/GAUL boundaries, fallback to Nominatim.
 */
export async function geocodeCity(cityName: string): Promise<{ geojson: any; center: [number, number] }> {
  const name = cityName.trim();

  // Try GAUL level 2
  const gaul2 = ee.FeatureCollection('FAO/GAUL_SIMPLIFIED_500m/2015/level2');
  const matches2 = gaul2.filter(ee.Filter.eq('ADM2_NAME', name));

  const size2 = await new Promise<number>((resolve) => {
    matches2.size().evaluate((val: any, err: any) => resolve(err ? 0 : val));
  });

  if (size2 > 0) {
    return await extractGeometry(matches2.first());
  }

  // Try GAUL level 1
  const gaul1 = ee.FeatureCollection('FAO/GAUL_SIMPLIFIED_500m/2015/level1');
  const matches1 = gaul1.filter(ee.Filter.eq('ADM1_NAME', name));

  const size1 = await new Promise<number>((resolve) => {
    matches1.size().evaluate((val: any, err: any) => resolve(err ? 0 : val));
  });

  if (size1 > 0) {
    return await extractGeometry(matches1.first());
  }

  // Fallback: use Nominatim to get a bounding box
  const { geocode } = await import('./geocoder.js');
  const geo = await geocode(name);
  const bbox = ee.Geometry.Point([geo.lon, geo.lat]).buffer(10000);
  const bboxGeojson = await new Promise<any>((resolve) => {
    bbox.getInfo((val: any) => resolve(val));
  });
  return { geojson: bboxGeojson, center: [geo.lat, geo.lon] };
}

async function extractGeometry(feature: any): Promise<{ geojson: any; center: [number, number] }> {
  const geometry = ee.Feature(feature).geometry();
  const hull = geometry.convexHull();
  const centroid = geometry.centroid().coordinates();

  const [geojson, coords] = await Promise.all([
    new Promise<any>((resolve) => hull.getInfo((val: any) => resolve(val))),
    new Promise<number[]>((resolve) => centroid.evaluate((val: any) => resolve(val))),
  ]);

  return { geojson, center: [coords[1], coords[0]] };
}
