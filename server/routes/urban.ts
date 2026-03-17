import { Router, Request, Response } from 'express';
import { getEEInitialized, analyzeUrbanData } from '../services/earthEngine.js';
import { vertexGenerate } from '../services/vertexAI.js';
import { geocode } from '../services/geocoder.js';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({ connected: getEEInitialized() });
});

router.get('/analyze', async (req: Request, res: Response) => {
  if (!getEEInitialized()) {
    return res.status(500).json({ error: "GEE not initialized on backend" });
  }

  const city = (req.query.city as string) || "Paris";
  const metric = (req.query.metric as string) || "green_areas";
  const years = parseInt((req.query.years as string) || "3");

  try {
    // 1. Geocode the city
    const geo = await geocode(city);

    // 2. Run GEE analysis
    const result = await analyzeUrbanData(geo.lat, geo.lon, metric, years);

    res.json({
      ...result,
      city,
      latitude: geo.lat,
      longitude: geo.lon
    });
  } catch (error: any) {
    console.error("GEE Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze GEE data" });
  }
});

router.post('/parse', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const result = await vertexGenerate(
      `Analyze this urban dynamics request from a city stakeholder: "${prompt}".
Extract the target city, the timeframe (in years, default to 5 if not specified), and the primary metric they are asking about.
Also provide the approximate latitude and longitude of the target city.
The metric MUST be one of: "green_areas", "industrial_movement", or "urban_expansion". If it doesn't fit, use "unknown".
Return ONLY valid JSON with keys: city, timeframeYears, metric, latitude, longitude.`,
      { jsonMode: true }
    );
    const parsed = JSON.parse(result.replace(/```json/gi, '').replace(/```/g, '').trim());
    res.json(parsed);
  } catch (error: any) {
    console.error("Parse error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/story', async (req: Request, res: Response) => {
  const { city, metric, timeframeYears, trend, dataSummary } = req.body;

  try {
    const result = await vertexGenerate(
      `You are an expert urban planner and data storyteller.
Write a compelling, professional narrative (2-3 paragraphs) for city stakeholders explaining the changes in ${city} over the last ${timeframeYears} years regarding ${metric.replace('_', ' ')}.
The data analysis from Google Earth Engine shows a ${trend} trend.
Data summary: ${dataSummary}
1. Clearly state the findings.
2. Provide plausible, real-world urban dynamics explanations for WHY this ${trend} trend might be happening.
3. Suggest a brief recommendation or implication for the stakeholders.
Keep the tone objective, insightful, and accessible to non-technical policymakers.`
    );
    res.json({ story: result });
  } catch (error: any) {
    console.error("Story error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
