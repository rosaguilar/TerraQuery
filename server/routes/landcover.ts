import { Router, Request, Response } from 'express';
import { getDynamicMapLayer } from '../services/earthEngine.js';
import { extractMapParamsFromQuery, generateEnvironmentalReport } from '../services/vertexAI.js';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const userQuery = req.body.query;
    if (!userQuery) {
      return res.status(400).json({ success: false, error: "Missing query" });
    }

    // 1. Vertex AI Agent understands the query and extracts parameters
    const params = await extractMapParamsFromQuery(userQuery);

    // 2. Earth Engine generates the map layer based on agent's instructions
    const mapData = await getDynamicMapLayer(
      params.lat, params.lon, params.type, params.zoom, params.dataset, params.bbox
    ) as any;

    // 3. Generate Environmental Report if stats are available
    let finalMessage = params.message;
    if (mapData.stats) {
      console.log("Stats found, generating environmental report...");
      finalMessage = await generateEnvironmentalReport(mapData.stats, userQuery, mapData.datasetConfig);
    }

    // 4. Return the response
    res.json({
      success: true,
      data: mapData,
      message: finalMessage
    });
  } catch (error: any) {
    console.error("Chat Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process request'
    });
  }
});

export default router;
