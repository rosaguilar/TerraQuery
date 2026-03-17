export const LAYER_CONFIGS = {
  NDVI: {
    type: 'gradient' as const,
    palette: ['#FFFFFF', '#CE7E45', '#FCD163', '#99B718', '#66A000', '#207401', '#011301'],
    min: 0, max: 0.8,
    source: 'Copernicus Sentinel-2 SR Harmonized',
    sourceId: 'COPERNICUS/S2_SR_HARMONIZED',
  },
  ELEVATION: {
    type: 'gradient' as const,
    palette: ['#0000ff', '#00ffff', '#ffff00', '#ff0000', '#ffffff'],
    min: 0, max: 4000, unit: 'm',
    source: 'NASA SRTM 30m',
    sourceId: 'USGS/SRTMGL1_003',
  },
  LANDCOVER: {
    type: 'categorical' as const,
    categories: [
      { color: '#419bdf', key: 'water' },
      { color: '#397d49', key: 'trees' },
      { color: '#88b053', key: 'grass' },
      { color: '#e49635', key: 'shrub' },
      { color: '#dfc351', key: 'crops' },
      { color: '#c4281b', key: 'built' },
      { color: '#a59b8f', key: 'bare' },
    ],
    source: 'Google Dynamic World V1',
    sourceId: 'GOOGLE/DYNAMICWORLD/V1',
  },
};

export const TIME_OPTIONS = [
  { value: 'recent_30d', type: 'recent' },
  { value: 'recent_90d', type: 'recent' },
  { value: 'recent_6m', type: 'recent' },
  { value: '2025', type: 'year' },
  { value: '2024', type: 'year' },
  { value: '2023', type: 'year' },
  { value: '2022', type: 'year' },
  { value: '2021', type: 'year' },
  { value: '2020', type: 'year' },
] as const;

export const TRANSLATIONS = {
  en: {
    title: "GEE Analytics Terminal",
    statusReady: "ONLINE_READY",
    statusBusy: "ANALYZING_CLUSTER",
    placeholder: "Command location or analysis...",
    waitingInput: "Initiate geospatial query to begin",
    layerSync: "DATA_SYNC_COMPLETE",
    analyzePrompt: "Interrogating satellite cluster...",
    toolProgress: {
      analyzeLocation: "Rendering map layer...",
      queryPixelValue: "Querying pixel value...",
      analyzeRegionStats: "Computing region statistics...",
      analyzeTimeSeries: "Fetching time series data...",
      default: "Processing analysis...",
    } as Record<string, string>,
    layers: { NDVI: "NDVI", ELEVATION: "Elevation", LANDCOVER: "Land Cover" } as Record<string, string>,
    timePeriods: { recent_30d: "30 Days", recent_90d: "90 Days", recent_6m: "6 Months", full_year: "Full Year" } as Record<string, string>,
    timePeriodLabel: "PERIOD",
    dataSource: "Data Source",
    legend: {
      NDVI: { name: "Vegetation Index (NDVI)", minLabel: "No Vegetation (0)", maxLabel: "Dense Vegetation (0.8)" },
      ELEVATION: { name: "Elevation", minLabel: "Low (0m)", maxLabel: "High (4000m)" },
      LANDCOVER: { name: "Land Cover", water: "Water", trees: "Trees", grass: "Grass", shrub: "Shrub", crops: "Crops", built: "Built-up", bare: "Bare Ground" }
    } as Record<string, any>,
  }
};
