import { Router, Request, Response } from 'express';
import { vertexGenerate } from '../services/vertexAI.js';
import { geocodePlace, getGEEMapLayer, getPixelValue, getRegionStats, getTimeSeries } from '../services/analyzerTools.js';

const router = Router();

const SYSTEM_PROMPT = `You are an advanced Earth Engine Dashboard assistant and geospatial scientist.
The map is constant on the screen. You have access to Google Earth Engine tools.

When the user asks about a location, you MUST respond with a JSON tool call in this format:
{"tool": "analyzeLocation", "args": {"locationName": "...", "layerType": "NDVI"}}

Available tools:
- analyzeLocation: Show a location on the map with a layer. Args: locationName (string), layerType (NDVI|ELEVATION|LANDCOVER)
- queryPixelValue: Get exact value at a point. Args: locationName (string), layerType (NDVI|ELEVATION|LANDCOVER)
- analyzeTimeSeries: Get yearly trends. Args: locationName (string), layerType (NDVI|ELEVATION|LANDCOVER), startYear (number), endYear (number)
- analyzeRegionStats: Area statistics. Args: locationName (string), layerType (NDVI|ELEVATION|LANDCOVER), radiusKm (number)

For simple location queries like "show me X" or "where is X", use analyzeLocation with ELEVATION as the default layer.
After executing the tool, provide a brief scientific interpretation of the results.

IMPORTANT: First output a single JSON line with the tool call, then provide your text analysis after.
Always respond in the same language as the user's query.`;

const TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  analyzeLocation: async ({ locationName, layerType }) => {
    const coords = await geocodePlace(locationName);
    if (!coords) return { error: 'Location not found' };
    const [lat, lon] = coords;
    const tileUrl = await getGEEMapLayer(lat, lon, (layerType || 'ELEVATION') as any);
    return { location: locationName, coordinates: { lat, lon }, tileUrl, layerType: layerType || 'ELEVATION', aoi: { lat, lon, radiusKm: 50, label: locationName } };
  },
  queryPixelValue: async ({ locationName, layerType }) => {
    const coords = await geocodePlace(locationName);
    if (!coords) return { error: 'Location not found' };
    const [lat, lon] = coords;
    const value = await getPixelValue(lat, lon, (layerType || 'ELEVATION') as any);
    return { toolType: 'pixelValue', location: locationName, coordinates: { lat, lon }, layerType, value, aoi: { lat, lon, radiusKm: 0.5, label: 'Point Query' } };
  },
  analyzeTimeSeries: async ({ locationName, layerType, startYear, endYear }) => {
    const coords = await geocodePlace(locationName);
    if (!coords) return { error: 'Location not found' };
    const [lat, lon] = coords;
    const result = await getTimeSeries(lat, lon, (layerType || 'NDVI') as any, startYear || 2018, endYear || new Date().getFullYear(), 5);
    return { toolType: 'timeSeries', location: locationName, coordinates: { lat, lon }, ...result, aoi: { lat, lon, radiusKm: 5, label: `Time Series (${result.type})` } };
  },
  analyzeRegionStats: async ({ locationName, layerType, radiusKm }) => {
    const coords = await geocodePlace(locationName);
    if (!coords) return { error: 'Location not found' };
    const [lat, lon] = coords;
    const stats = await getRegionStats(lat, lon, (layerType || 'NDVI') as any, radiusKm || 5);
    return { toolType: 'regionStats', location: locationName, coordinates: { lat, lon }, ...stats, aoi: { lat, lon, radiusKm: radiusKm || 5, label: `Region Stats (${layerType})` } };
  },
};

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages: rawMessages } = req.body;

    // Build conversation history as text
    const history = (rawMessages || []).map((m: any) => {
      const text = m.content || (m.parts || []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
      return `${m.role}: ${text}`;
    }).join('\n');

    // Step 1: Get LLM response (may include tool call)
    const llmResponse = await vertexGenerate(
      `${SYSTEM_PROMPT}\n\nConversation:\n${history}`,
      { temperature: 0.2 }
    );

    // Step 2: Try to extract and execute tool call
    let toolResult: any = null;
    let textResponse = llmResponse;

    const toolMatch = llmResponse.match(/\{[\s]*"tool"[\s]*:[\s]*"(\w+)"[\s]*,[\s]*"args"[\s]*:[\s]*(\{[^}]+\})\s*\}/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const toolArgs = JSON.parse(toolMatch[2]);
      const handler = TOOL_HANDLERS[toolName];
      if (handler) {
        toolResult = await handler(toolArgs);
        toolResult.toolName = toolName;
      }
      // Remove tool call and any surrounding markdown fencing from text response
      textResponse = llmResponse
        .replace(toolMatch[0], '')
        .replace(/```json\s*```/g, '')
        .replace(/```json\s*\n?\s*```/g, '')
        .replace(/```\s*```/g, '')
        .trim();

      // If text is empty after tool removal, ask LLM to interpret the result
      if (!textResponse && toolResult && !toolResult.error) {
        textResponse = await vertexGenerate(
          `You are a geospatial scientist. The user asked: "${history.split('\n').pop()}"\n\nThe tool "${toolName}" returned: ${JSON.stringify(toolResult)}\n\nProvide a brief, informative response about this location/data. Be concise (2-3 sentences max).`,
          { temperature: 0.3 }
        );
      }
    }

    // Step 3: Stream back as UIMessage format for useChat
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Vercel-AI-Data-Stream', 'v1');

    // Send start
    res.write('data: {"type":"start"}\n\n');

    // Send tool result if any
    if (toolResult) {
      const toolPart = {
        type: 'tool-invocation',
        toolCallId: `call_${Date.now()}`,
        toolName: toolResult.toolName,
        state: 'result',
        result: toolResult,
      };
      res.write(`data: ${JSON.stringify({ type: 'tool-invocation', ...toolPart })}\n\n`);
    }

    // Send text response
    if (textResponse) {
      res.write(`data: ${JSON.stringify({ type: 'text', text: textResponse })}\n\n`);
    }

    // Send finish
    res.write(`data: ${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error("Analyzer chat error:", error);
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'error', errorText: error.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

router.post('/pixel', async (req: Request, res: Response) => {
  try {
    const { lat, lon, layerType } = req.body;
    if (typeof lat !== 'number' || typeof lon !== 'number') return res.status(400).json({ error: 'Invalid coordinates' });
    if (!['NDVI', 'ELEVATION', 'LANDCOVER'].includes(layerType)) return res.status(400).json({ error: 'Invalid layer type' });
    const value = await getPixelValue(lat, lon, layerType);
    res.json({ value });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
