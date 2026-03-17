import { VertexAI } from '@google-cloud/vertexai';

let vertexAIInstance: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (vertexAIInstance) return vertexAIInstance;

  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.VERTEX_REGION || 'europe-west4';
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID is missing from the environment variables.');
  }
  vertexAIInstance = new VertexAI({
    project: projectId,
    location: location,
    apiEndpoint: `${location}-aiplatform.googleapis.com`
  });
  return vertexAIInstance;
}

export interface GenerateOptions {
  jsonMode?: boolean;
  temperature?: number;
  generationConfig?: Record<string, any>;
}

/**
 * Model fallback chain — includes Gemma 3 on Vertex AI.
 *
 * Order:
 *   1. gemma-3-27b-it (open-weight, hosted on Vertex AI via Model Garden)
 *   2. gemini-2.5-pro (most capable)
 *   3. gemini-2.5-flash (fast, on 429)
 *   4. gemini-2.0-flash (fallback, on 429)
 *
 * Gemma 3 is free-tier on Vertex AI Model Garden and good for
 * narrative generation, summaries, and simpler tasks.
 * Falls back to Gemini for complex tasks or if Gemma fails.
 */
const MODEL_CHAIN = [
  'gemma-3-27b-it',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

export async function vertexGenerate(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const vertexAI = getVertexAI();
  const { jsonMode = false, temperature = 0.1, generationConfig = {} } = options;

  for (const modelName of MODEL_CHAIN) {
    try {
      const isGemma = modelName.startsWith('gemma');

      const model = vertexAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature,
          // Gemma 3 on Vertex AI doesn't support responseMimeType for JSON mode
          ...(!isGemma && jsonMode ? { responseMimeType: 'application/json' } : {}),
          ...generationConfig
        }
      });

      // For Gemma with JSON mode, append JSON instruction to the prompt
      const finalPrompt = isGemma && jsonMode
        ? prompt + '\n\nIMPORTANT: Return ONLY valid JSON, no markdown fencing, no extra text.'
        : prompt;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }]
      });

      const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) {
        console.warn(`[${modelName}] Empty response, trying next...`);
        continue;
      }

      console.log(`[AI] ${modelName} responded (${text.length} chars)`);
      return text;
    } catch (e: any) {
      if (e.message?.includes('429')) {
        console.warn(`[429] ${modelName} quota hit, trying next...`);
        continue;
      }
      // If Gemma fails for any reason, fall through to Gemini
      if (modelName.startsWith('gemma')) {
        console.warn(`[${modelName}] Failed: ${e.message?.slice(0, 100)}, falling back to Gemini...`);
        continue;
      }
      throw e;
    }
  }
  throw new Error('All models failed (Gemma 3 + Vertex AI Gemini).');
}

/**
 * Extract map parameters from a user query (landcover module).
 */
export async function extractMapParamsFromQuery(query: string) {
  const prompt = `You are an expert geospatial assistant connected to Google Earth Engine.
The backend system fully supports computing and displaying landcover change data.
Analyze the user's request and extract the following parameters as JSON:
- lat (number): The approximate latitude of the location.
- lon (number): The approximate longitude of the location.
- type (string): Exactly one of ['rgb', 'ndvi', 'elevation', 'water', 'landcover_change']. IMPORTANT: If the user asks about "change", "deforestation", "growth", or "development", you MUST set type to 'landcover_change'. Do not say you cannot show it. The backend will handle the computation. Otherwise, use 'ndvi' for vegetation/health/plants, 'elevation' for terrain/mountains/height, 'water' for rivers/lakes/floods, and default to 'rgb' if unsure.
- zoom (number): An appropriate map zoom level (integer from 4 to 15). City level is 12, country level is 5, specific landmark is 14.
- dataset (string): Only for 'landcover_change'. Choose either 'modis' (NASA MODIS, Global, 500m, 2001-2024, default) or 'corine' (Copernicus CORINE, Europe ONLY, 100m, 2000-2018). If the location is in Europe and the user wants high resolution, choose 'corine'.
- message (string): A short, friendly, and informative message explaining what you are showing them. If type is 'landcover_change', say "I am fetching the land cover change data for you."
- bbox (array of 4 numbers, STRONGLY RECOMMENDED): Provide the bounding box as [min_lon, min_lat, max_lon, max_lat] for the region of interest. This is critical for large natural features (rainforests, deserts, mountain ranges, river basins, seas) and any region that spans multiple administrative boundaries. Without bbox, the system falls back to a single administrative district which will be too small. Always provide bbox for regions like "Amazon rainforest", "Sahara desert", "Great Barrier Reef", etc.

User request: "${query}"

Return ONLY valid JSON with these exact keys.`;

  try {
    const resultText = await vertexGenerate(prompt, { jsonMode: true });
    const cleaned = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: any) {
    console.error("Agent parsing error:", error);
    return {
      lat: 47.60,
      lon: -122.33,
      type: "landcover_change",
      zoom: 12,
      message: "Parsing failed. " + error.message
    };
  }
}

/**
 * Generate an environmental report from land cover stats.
 */
export async function generateEnvironmentalReport(
  stats: any,
  query: string,
  datasetConfigInfo: { startYear: string; endYear: string }
) {
  const startYear = datasetConfigInfo?.startYear || '2001';
  const endYear = datasetConfigInfo?.endYear || '2024';

  const prompt = `You are a Senior Environmental Data Analyst. I have used Google Earth Engine to compute the land cover changes for a user's query.
User's query: "${query}"

Here is the land cover area (in Hectares) for each category that occurred between roughly ${startYear} and ${endYear} for the requested location:
${JSON.stringify(stats, null, 2)}

(Note: 1 Hectare = 10,000 square meters. When writing your report, translate Hectares into highly creative, fun, or locally-relevant real-world metrics to make the scale understandable. For example, instead of just "pixels" or "hectares", use things like "Central Parks", "tennis courts", "Double-decker buses", "pyramids of Giza", or "blue whales". Be creative!).

Write an extremely simple, easy-to-read summary of the environmental changes.
The simpler the better. Do NOT write long paragraphs or extensive context.
Format your response using Markdown with the following structure:
1. **Status Badge:** A single bold severity level (e.g., 🔴 CRITICAL, 🟡 WARNING, 🟢 STABLE), followed immediately by the analysis time interval (e.g., "Analysis Period: 2001 - 2022").
2. **Highlights:** ONLY show the 2 or 3 most important highlights using short bullet points. Highlight the creative area translations.

Keep it very brief, clean, and punchy. Use emojis to make it scannable.`;

  try {
    return await vertexGenerate(prompt);
  } catch (error: any) {
    console.error("Agent report error:", error);
    return "Error generating the environmental report: " + error.message;
  }
}
