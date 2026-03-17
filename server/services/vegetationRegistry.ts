export interface DatasetConfig {
  name: string;
  description: string;
  collection: string;
  type: 'normalized_difference' | 'band_mean' | 'band_sum';
  bands: string[];
  outputBand: string;
  cloudFilter?: { property: string; max: number };
  scaleFactor?: number;
  offset?: number;
  visParams: { min: number; max: number; palette: string[] };
  metricName: string;
  scale: number;
}

export const DATASETS: Record<string, DatasetConfig> = {
  sentinel2_ndvi: {
    name: "Sentinel-2 NDVI",
    description: "Vegetation health from Sentinel-2 (10m resolution, since 2017)",
    collection: "COPERNICUS/S2_SR_HARMONIZED",
    type: "normalized_difference",
    bands: ["B8", "B4"],
    outputBand: "NDVI",
    cloudFilter: { property: "CLOUDY_PIXEL_PERCENTAGE", max: 20 },
    visParams: { min: 0, max: 0.8, palette: ["red", "yellow", "green"] },
    metricName: "Mean NDVI",
    scale: 100,
  },
  modis_lst: {
    name: "MODIS Land Surface Temperature",
    description: "Daytime surface temperature (1km, since 2000)",
    collection: "MODIS/061/MOD11A1",
    type: "band_mean",
    bands: ["LST_Day_1km"],
    outputBand: "LST",
    scaleFactor: 0.02,
    offset: -273.15,
    visParams: { min: 10, max: 45, palette: ["blue", "lightyellow", "red"] },
    metricName: "Mean LST (\u00b0C)",
    scale: 1000,
  },
  viirs_nightlights: {
    name: "VIIRS Nighttime Lights",
    description: "Monthly nighttime radiance (500m, since 2012)",
    collection: "NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG",
    type: "band_mean",
    bands: ["avg_rad"],
    outputBand: "avg_rad",
    visParams: { min: 0, max: 60, palette: ["black", "yellow", "white"] },
    metricName: "Mean Radiance (nW/cm\u00b2/sr)",
    scale: 500,
  },
  modis_ndvi: {
    name: "MODIS NDVI",
    description: "Vegetation index (500m, global since 2000)",
    collection: "MODIS/061/MOD13A1",
    type: "band_mean",
    bands: ["NDVI"],
    outputBand: "NDVI",
    scaleFactor: 0.0001,
    visParams: { min: 0, max: 0.8, palette: ["red", "yellow", "green"] },
    metricName: "Mean NDVI",
    scale: 500,
  },
  dynamic_world: {
    name: "Dynamic World Built-up",
    description: "Near real-time built-up probability (10m, since 2015)",
    collection: "GOOGLE/DYNAMICWORLD/V1",
    type: "band_mean",
    bands: ["built"],
    outputBand: "built",
    visParams: { min: 0, max: 1, palette: ["green", "yellow", "red"] },
    metricName: "Built-up Probability",
    scale: 100,
  },
  chirps_precip: {
    name: "CHIRPS Precipitation",
    description: "Daily rainfall estimates (5km, global since 1981)",
    collection: "UCSB-CHG/CHIRPS/DAILY",
    type: "band_sum",
    bands: ["precipitation"],
    outputBand: "precipitation",
    visParams: { min: 0, max: 2000, palette: ["white", "cornflowerblue", "darkblue"] },
    metricName: "Annual Precipitation (mm)",
    scale: 5000,
  },
};

export function getDatasetNames(): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [k, v] of Object.entries(DATASETS)) names[k] = v.name;
  return names;
}
