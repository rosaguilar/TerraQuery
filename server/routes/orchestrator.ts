import { Router, Request, Response } from 'express';
import { vertexGenerate } from '../services/vertexAI.js';

const router = Router();

interface RouteDecision {
  modules: ('landcover' | 'urban' | 'analyzer' | 'vegetation')[];
  landcoverQuery?: string;
  urbanQuery?: { city: string; metric: string; years: number };
  analyzerQuery?: string;
  vegetationQuery?: { location: string; datasetId: string; timeframeYears: number };
  explanation: string;
}

router.post('/', async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const routingResult = await vertexGenerate(
      `You are an intelligent router for a geospatial analysis platform with four modules:

1. **Earth Analyzer** (analyzer): A conversational AI assistant with direct Google Earth Engine access. It can show any location on a map, visualize NDVI/elevation/land cover layers, query pixel values, compute region statistics, and run time series analysis. Best for: simple location queries ("show me X", "where is Y"), point-level analysis, elevation lookups, current NDVI at a location, exploring a specific place, any general geospatial question. This is the DEFAULT — use it when the query doesn't clearly need one of the specialized modules below.

2. **Land Cover Change** (landcover): Specialized for analyzing land cover CHANGE over time using MODIS (global, 2001-2024) or CORINE (Europe, 1990-2018) datasets. Produces animated GIF time-lapses, Sankey transition diagrams, and environmental reports. Best for: deforestation analysis, urban sprawl over decades, land use transitions, before/after comparisons. Use ONLY when the user explicitly asks about change, transitions, or temporal comparison of land cover.

3. **Urban Dynamics** (urban): Multi-agent system for city stakeholders analyzing urban trends — green areas (NDVI trends), industrial movement (nighttime lights), urban expansion. Best for: city-level policy questions about how metrics changed over N years. Use ONLY when the query is specifically about urban stakeholder metrics (green areas trends, industrial movement, urban expansion) for a city.

4. **Vegetation / Environmental Explorer** (vegetation): Multi-dataset analysis with 6 GEE datasets. Best for: when the user asks about a SPECIFIC environmental metric for a city/region — vegetation health (NDVI), land surface temperature, nighttime lights intensity, built-up areas, or precipitation. Also use when the user mentions a specific dataset or wants to compare environmental indicators. Available datasets:
   - "sentinel2_ndvi": Sentinel-2 NDVI (vegetation health, 10m, since 2017)
   - "modis_lst": MODIS Land Surface Temperature (1km, since 2000)
   - "viirs_nightlights": VIIRS Nighttime Lights (radiance, 500m, since 2012)
   - "modis_ndvi": MODIS NDVI (vegetation, 500m, since 2000)
   - "dynamic_world": Dynamic World Built-up probability (10m, since 2015)
   - "chirps_precip": CHIRPS Precipitation (rainfall, 5km, since 1981)

ROUTING RULES:
- Default to "analyzer" for general queries, simple location lookups, elevation, "show me X" requests.
- Use "vegetation" when the user asks about specific environmental metrics (temperature, precipitation, nighttime lights, vegetation health/NDVI, built-up areas) for a city or region over time. Pick the best dataset from the list.
- Use "landcover" ONLY for land cover change/transition/deforestation analysis.
- Use "urban" ONLY for city stakeholder questions about green areas, industrial movement, or urban expansion trends.
- You can invoke multiple modules if the query spans their domains.

User query: "${query}"

Return ONLY valid JSON with:
- modules: array of "analyzer" and/or "landcover" and/or "urban" and/or "vegetation"
- analyzerQuery: (if analyzer) the query to pass to the analyzer chat (string)
- landcoverQuery: (if landcover) the query to pass to the landcover module (string)
- urbanQuery: (if urban) object with { city: string, metric: "green_areas"|"industrial_movement"|"urban_expansion", years: number }
- vegetationQuery: (if vegetation) object with { location: string, datasetId: string, timeframeYears: number } where datasetId is one of: sentinel2_ndvi, modis_lst, viirs_nightlights, modis_ndvi, dynamic_world, chirps_precip
- explanation: brief one-sentence explanation of routing decision`,
      { jsonMode: true }
    );

    const decision: RouteDecision = JSON.parse(
      routingResult.replace(/```json/gi, '').replace(/```/g, '').trim()
    );

    const results: any = { modules: decision.modules, explanation: decision.explanation };
    const baseUrl = `http://localhost:${process.env.PORT || 3001}`;

    // If only analyzer, redirect frontend there
    const hasAnalyzer = decision.modules.includes('analyzer');
    const hasOthers = decision.modules.some(m => m !== 'analyzer');

    if (hasAnalyzer && !hasOthers) {
      results.redirect = '/analyzer';
      results.analyzerQuery = decision.analyzerQuery || query;
      return res.json(results);
    }

    // If only vegetation, redirect frontend there with pre-filled params
    const hasVegetation = decision.modules.includes('vegetation');
    const onlyVegetation = hasVegetation && decision.modules.length === 1;

    if (onlyVegetation && decision.vegetationQuery) {
      results.redirect = '/vegetation';
      results.vegetationQuery = decision.vegetationQuery;
      return res.json(results);
    }

    if (hasAnalyzer) {
      results.analyzerQuery = decision.analyzerQuery || query;
    }

    const promises: Promise<void>[] = [];

    if (decision.modules.includes('landcover') && decision.landcoverQuery) {
      promises.push(
        fetch(`${baseUrl}/api/landcover/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: decision.landcoverQuery })
        })
          .then(r => r.json())
          .then(data => { results.landcover = data; })
          .catch(err => { results.landcover = { success: false, error: err.message }; })
      );
    }

    if (decision.modules.includes('urban') && decision.urbanQuery) {
      const uq = decision.urbanQuery;
      promises.push(
        fetch(`${baseUrl}/api/urban/analyze?city=${encodeURIComponent(uq.city)}&metric=${encodeURIComponent(uq.metric)}&years=${uq.years}`)
          .then(r => r.json())
          .then(async (data: any) => {
            results.urban = data;
            // Also generate the detailed stakeholder story
            if (data.data && data.trend) {
              try {
                const storyRes = await fetch(`${baseUrl}/api/urban/story`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    city: uq.city,
                    metric: uq.metric,
                    timeframeYears: uq.years,
                    trend: data.trend,
                    dataSummary: data.summary,
                  }),
                });
                const storyData = await storyRes.json() as any;
                if (storyData.story) results.urban.story = storyData.story;
              } catch {}
            }
          })
          .catch(err => { results.urban = { error: err.message }; })
      );
    }

    if (decision.modules.includes('vegetation') && decision.vegetationQuery) {
      const vq = decision.vegetationQuery;
      promises.push(
        fetch(`${baseUrl}/api/vegetation/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: vq.location, datasetId: vq.datasetId, timeframeYears: vq.timeframeYears })
        })
          .then(r => r.json())
          .then(data => { results.vegetation = data; })
          .catch(err => { results.vegetation = { error: err.message }; })
      );
    }

    await Promise.all(promises);

    // Synthesis if multiple modules returned data
    const dataSources: string[] = [];
    if (results.landcover?.success) dataSources.push(`Land Cover: ${JSON.stringify(results.landcover.message || 'Analysis complete')}`);
    if (results.urban?.data) dataSources.push(`Urban Dynamics (${results.urban.city}): ${results.urban.summary}`);
    if (results.vegetation?.success) dataSources.push(`Vegetation (${results.vegetation.datasetName}): ${results.vegetation.narrative}`);

    if (dataSources.length > 1) {
      results.synthesis = await vertexGenerate(
        `You are a senior environmental analyst. Synthesize these analysis results into a brief unified report (3-4 bullet points max). Use markdown.\n\n${dataSources.join('\n\n')}`
      );
    }

    res.json(results);
  } catch (error: any) {
    console.error("Orchestrator error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
