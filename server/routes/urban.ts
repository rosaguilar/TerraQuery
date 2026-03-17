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
      `You are a senior urban planner and data storyteller writing a detailed stakeholder report for city policymakers.

IMPORTANT: Start directly with the "### Executive Summary" section. Do NOT include any preamble, greeting, "To/From/Date/Subject" header, or introductory sentence before the Executive Summary. Do NOT include horizontal rules (***) before the content.

**City:** ${city}
**Metric:** ${metric.replace('_', ' ')}
**Timeframe:** Last ${timeframeYears} years
**Observed Trend:** ${trend}
**Data Summary:** ${dataSummary}

Write a comprehensive, well-structured stakeholder report using the following format in Markdown:

### Executive Summary
A concise 2-3 sentence overview of the key finding and its significance for ${city}.

### Key Findings
- Present 3-4 bullet points with specific data-driven observations
- Reference the actual numbers and trend direction
- Compare values between the start and end of the analysis period

### Analysis & Context
Explain in 2-3 paragraphs:
- What is driving this ${trend} trend? Consider climate factors, urban development policies, population growth, economic shifts, infrastructure projects, or seasonal patterns.
- How does this compare to global or regional benchmarks?
- Are there any notable inflection points or anomalies in the data?

### Implications for Stakeholders
- What does this mean for residents, businesses, and city services?
- What are the environmental or economic consequences if the trend continues?

### Recommended Actions
Provide 3-5 specific, actionable bullet points that policymakers should consider, such as:
- Policy changes
- Infrastructure investments
- Monitoring programs
- Community engagement initiatives

### Data Sources
Briefly note that data was sourced from Google Earth Engine satellite observations (MODIS NDVI / VIIRS Nighttime Lights).

Use a professional but accessible tone. Avoid overly technical jargon. Use bold text for emphasis on critical numbers and findings.`
    );
    res.json({ story: result });
  } catch (error: any) {
    console.error("Story error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
