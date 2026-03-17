import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { initEarthEngine, getEEInitialized } from './services/earthEngine.js';
import landcoverRoutes from './routes/landcover.js';
import urbanRoutes from './routes/urban.js';
import orchestratorRoutes from './routes/orchestrator.js';
import analyzerRoutes from './routes/analyzer.js';
import vegetationRoutes from './routes/vegetation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Write the JSON string to a file so Google Cloud SDKs can use it
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const tmpKeyPath = path.join(__dirname, 'temp-sa-key.json');
  fs.writeFileSync(tmpKeyPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpKeyPath;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/landcover', landcoverRoutes);
app.use('/api/urban', urbanRoutes);
app.use('/api/ask', orchestratorRoutes);
app.use('/api/analyzer', analyzerRoutes);
app.use('/api/vegetation', vegetationRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    earthEngine: getEEInitialized(),
    modules: ['landcover', 'urban', 'analyzer', 'vegetation']
  });
});

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// Initialize Earth Engine and start server
async function startServer() {
  try {
    await initEarthEngine();
    console.log('Earth Engine initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Earth Engine:', error);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Geospatial Platform server listening on 0.0.0.0:${PORT}`);
  });
}

startServer();
