import { Router, Request, Response } from 'express';
import { vertexGenerate } from '../services/vertexAI.js';
import { getEEInitialized } from '../services/earthEngine.js';
import { DATASETS, getDatasetNames } from '../services/vegetationRegistry.js';
import { fetchGeeData, geocodeCity } from '../services/vegetationAnalyze.js';

const router = Router();

const TOPIC_TO_DATASET: Record<string, string> = {
  green_areas: 'sentinel2_ndvi',
  industrial_areas: 'dynamic_world',
  expansion: 'viirs_nightlights',
};

// GET /api/vegetation/datasets — return dataset list for the sidebar
router.get('/datasets', (_req: Request, res: Response) => {
  const datasets = Object.entries(DATASETS).map(([id, d]) => ({
    id, name: d.name, description: d.description,
  }));
  res.json(datasets);
});

// POST /api/vegetation/analyze — full pipeline: geocode → fetch data → generate narrative
router.post('/analyze', async (req: Request, res: Response) => {
  if (!getEEInitialized()) return res.status(500).json({ error: 'Earth Engine not initialized' });

  const { location, datasetId, timeframeYears, query } = req.body;
  if (!location) return res.status(400).json({ error: 'Missing location' });

  try {
    // Step 1: Resolve dataset (from explicit selection or from topic extraction)
    let resolvedDatasetId = datasetId;
    let topic = 'green_areas';

    if (!resolvedDatasetId && query) {
      // Use LLM to extract parameters from natural language query
      const paramsResult = await vertexGenerate(
        `Extract the location, topic, and timeframe from this query. Topics: "green_areas" (vegetation/parks/NDVI), "industrial_areas" (factories/built-up), "expansion" (urban growth/nightlights). Timeframes: 1, 3, or 5 years.
Query: "${query}"
Return JSON: { "location": "...", "topic": "green_areas|industrial_areas|expansion", "timeframe_years": 1|3|5, "dataset_id": null }`,
        { jsonMode: true }
      );
      const parsed = JSON.parse(paramsResult.replace(/```json/gi, '').replace(/```/g, '').trim());
      resolvedDatasetId = parsed.dataset_id || TOPIC_TO_DATASET[parsed.topic] || 'sentinel2_ndvi';
      topic = parsed.topic || 'green_areas';
    }

    resolvedDatasetId = resolvedDatasetId || TOPIC_TO_DATASET[topic] || 'sentinel2_ndvi';
    const years = timeframeYears || 3;

    if (!DATASETS[resolvedDatasetId]) {
      return res.status(400).json({ error: `Unknown dataset: ${resolvedDatasetId}` });
    }

    // Step 2: Geocode
    const { geojson: geometryGeojson, center: mapCenter } = await geocodeCity(location);

    // Step 3: Fetch GEE data
    const spatialData = await fetchGeeData(geometryGeojson, resolvedDatasetId, years);

    // Step 4: Generate narrative
    const datasetName = DATASETS[resolvedDatasetId].name;
    const narrative = await vertexGenerate(
      `You are a data storyteller for city stakeholders.
Explain the following ${datasetName} data for ${location} over the last ${years} years.
Make it clear, executive-friendly, and avoid overly technical jargon. Provide a 2-3 sentence summary.

Data points: ${JSON.stringify(spatialData.dataPoints)}`
    );

    res.json({
      success: true,
      narrative,
      dataPoints: spatialData.dataPoints,
      tileUrl: spatialData.tileUrl,
      visParams: spatialData.visParams,
      mapCenter,
      geometryGeojson,
      datasetId: resolvedDatasetId,
      datasetName,
      location,
    });
  } catch (error: any) {
    console.error("Vegetation analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
