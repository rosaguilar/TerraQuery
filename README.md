# TerraQuery

**Live Application:** [https://terraquery-383351027149.europe-west4.run.app](https://terraquery-383351027149.europe-west4.run.app)

An integrated AI-powered geospatial analysis platform that combines four specialized modules into a single application. Ask any question about any place on Earth — an LLM orchestrator routes your query to the right tool automatically.

## Modules

### Earth Analyzer
Conversational AI assistant with direct Google Earth Engine access. Visualize NDVI, elevation, and land cover layers, query pixel values, compute region statistics, and run time series analysis for any location.

### Land Cover Change
Analyze land cover transitions over decades using MODIS (global, 2001-2024) and CORINE (Europe, 1990-2018) satellite datasets. Produces animated GIF time-lapses, Sankey transition diagrams, and AI-generated environmental reports.

### Urban Dynamics
Multi-agent system for city stakeholders. Tracks green areas (NDVI trends), industrial movement (nighttime lights), and urban expansion over 1-5 years. Three AI agents work in sequence: intent parsing, Earth Engine data gathering, and detailed stakeholder report generation with executive summary, key findings, analysis, implications, and recommended actions.

### Vegetation Explorer
Multi-dataset environmental analysis with six GEE datasets: Sentinel-2 NDVI, MODIS NDVI, MODIS Land Surface Temperature, VIIRS Nighttime Lights, Dynamic World Built-up, and CHIRPS Precipitation dataset. Sidebar-driven or natural language queries with trend charts and map overlays.

## Architecture

```
├── Dockerfile                 Multi-stage Docker build (Node 22)
├── .dockerignore              Docker build exclusions
├── package.json               Root: runs server + client via concurrently
│
├── server/                    Express + TypeScript backend (port 8080 in Docker)
│   ├── index.ts               Entry point, EE init, route registration, static file serving
│   ├── tsconfig.json          TypeScript configuration
│   ├── routes/
│   │   ├── orchestrator.ts    POST /api/ask (LLM router to all 4 modules)
│   │   ├── analyzer.ts        POST /api/analyzer/chat, /api/analyzer/pixel
│   │   ├── landcover.ts       POST /api/landcover/chat
│   │   ├── urban.ts           GET/POST /api/urban/* (status, analyze, parse, story)
│   │   └── vegetation.ts      GET /api/vegetation/datasets, POST /api/vegetation/analyze
│   └── services/
│       ├── vertexAI.ts        Gemma 3 + Gemini fallback chain (Vertex AI)
│       ├── earthEngine.ts     Shared EE init + landcover/urban computations
│       ├── analyzerTools.ts   NDVI/elevation/landcover tools for Earth Analyzer
│       ├── vegetationRegistry.ts  6 GEE dataset configs
│       ├── vegetationAnalyze.ts   Generic GEE pipeline + GAUL geocoding
│       ├── datasetConfig.ts   CORINE/MODIS/DynamicWorld metadata
│       └── geocoder.ts        Shared Nominatim geocoding
│
├── client/                    React + Vite + Tailwind v4 frontend
│   ├── index.html             Entry HTML
│   ├── vite.config.ts         Vite config with API proxy
│   ├── tsconfig.json          TypeScript configuration
│   └── src/
│       ├── App.tsx            React Router with persistent module mounting
│       ├── index.css          Tailwind imports + global styles
│       ├── main.tsx           React entry point
│       ├── components/
│       │   ├── PlatformShell.tsx   Top nav, module tabs, EE status badge
│       │   ├── MapBase.tsx         Shared Leaflet map component
│       │   └── ErrorBoundary.tsx   Per-module error isolation
│       ├── context/
│       │   └── LocationContext.tsx  Shared location state across modules
│       └── modules/
│           ├── landing/       Command center with AI query bar + example prompts
│           ├── analyzer/      Earth Analyzer (chat + interactive map + GEE tools)
│           ├── landcover/     Land Cover Change (sidebar + GIF map + Sankey chart)
│           ├── urban/         Urban Dynamics (3-agent workflow + chart + report)
│           └── vegetation/    Vegetation Explorer (sidebar + chart + map)
```

## Prerequisites

- **Node.js** 18+ and npm
- **Docker** (for production deployment)
- A **Google Cloud Platform** project with:
  - Google Earth Engine API enabled
  - Vertex AI API enabled
  - A service account with Earth Engine and Vertex AI permissions

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd TerraQuery
npm run install:all
```

This installs dependencies for the root, `server/`, and `client/` directories.

### 2. Configure environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: GCP service account JSON (the entire JSON key file as a single-line string)
# This account needs Earth Engine and Vertex AI permissions
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@...iam.gserviceaccount.com",...}

# Required: Your GCP project ID
GCP_PROJECT_ID=your-project-id

# Optional: Vertex AI region (default: europe-west4)
VERTEX_REGION=europe-west4

# Optional: Server port (default: 8080 in Docker, 3001 in dev)
PORT=3001
```

### 3. GCP Service Account Setup

1. Go to [GCP Console > IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/service-accounts)
2. Create a service account (or use an existing one)
3. Grant roles:
   - **Earth Engine Resource Viewer** (`roles/earthengine.viewer`)
   - **Vertex AI User** (`roles/aiplatform.user`)
4. Create a JSON key and paste its contents into `GOOGLE_APPLICATION_CREDENTIALS_JSON`
5. Register the service account for Earth Engine at [signup.earthengine.google.com](https://signup.earthengine.google.com)

### 4. Run (Development)

```bash
npm start
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

Open **http://localhost:5173** in your browser.

### 5. Run with Docker (Production)

Build and run with Docker:

```bash
docker build -t terraquery .
docker run -d --name terraquery -p 8080:8080 --env-file .env terraquery
```

> **Note:** Docker's `--env-file` does not support quoted values. If your `GOOGLE_APPLICATION_CREDENTIALS_JSON` contains single quotes, pass it directly instead:
>
> ```bash
> docker run -d --name terraquery -p 8080:8080 \
>   -e "GOOGLE_APPLICATION_CREDENTIALS_JSON=$(cat your-service-account.json | tr -d '\n')" \
>   -e "GCP_PROJECT_ID=your-project-id" \
>   -e "VERTEX_REGION=europe-west4" \
>   terraquery
> ```

Open **http://localhost:8080** in your browser.

The Docker image uses a multi-stage build: the client is compiled with Vite, the server is compiled with TypeScript, and the production image runs the compiled JavaScript with Node.js behind a non-root user.

### 6. Deploy to Google Cloud Run

```bash
gcloud run deploy terraquery \
  --source . \
  --region europe-west4 \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=your-project-id,VERTEX_REGION=europe-west4" \
  --set-secrets "GOOGLE_APPLICATION_CREDENTIALS_JSON=your-secret:latest"
```

## How It Works

### Orchestrator (Command Center)

The landing page has a unified query bar. When you submit a query:

1. **Vertex AI** analyzes the query and decides which module(s) to invoke
2. Simple location queries ("show me where X is") route to **Earth Analyzer**
3. Land cover change/deforestation queries route to **Land Cover Change**
4. City stakeholder questions (green areas, industrial movement, expansion) route to **Urban Dynamics**
5. Specific environmental metrics (NDVI, temperature, precipitation) route to **Vegetation Explorer**
6. Complex queries can invoke multiple modules with a synthesized report

### AI Model Fallback Chain

All LLM calls use a multi-model fallback strategy on Vertex AI:

1. **Gemma 3 27B** (`gemma-3-27b-it`) — open-weight model, tried first
2. **Gemini 2.5 Pro** — most capable, used if Gemma fails
3. **Gemini 2.5 Flash** — fast fallback on 429 quota errors
4. **Gemini 2.0 Flash** — last resort

### Shared Infrastructure

- **Single Earth Engine init** — authenticated once at server startup, shared across all modules
- **LocationContext** — when you query a location in one module, switching tabs preserves the location
- **Persistent modules** — switching between tabs doesn't lose your work; all modules stay mounted
- **Error boundaries** — each module is isolated; a crash in one doesn't affect others

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/ask` | POST | Orchestrator — LLM routes query to module(s) |
| `/api/health` | GET | Health check + EE status |
| `/api/analyzer/chat` | POST | Earth Analyzer streaming chat |
| `/api/analyzer/pixel` | POST | Pixel value query |
| `/api/landcover/chat` | POST | Land cover change analysis |
| `/api/urban/status` | GET | Earth Engine connection status |
| `/api/urban/analyze` | GET | Urban dynamics GEE analysis |
| `/api/urban/parse` | POST | Parse stakeholder query |
| `/api/urban/story` | POST | Generate detailed stakeholder report |
| `/api/vegetation/datasets` | GET | List available GEE datasets |
| `/api/vegetation/analyze` | POST | Run vegetation/environmental analysis |

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router, Recharts, React-Leaflet, Lucide icons
- **Backend:** Express, TypeScript
- **AI:** Google Vertex AI (Gemma 3 27B, Gemini 2.5 Pro/Flash)
- **Geospatial:** Google Earth Engine (MODIS, CORINE, Sentinel-2, VIIRS, Dynamic World, CHIRPS, SRTM)
- **Maps:** Leaflet with OpenStreetMap, CARTO, and Google Satellite basemaps
- **Deployment:** Docker, Google Cloud Run

## Authors

- Senyang Li (senyang.li@utwente.nl)
- Tong Jiang (tong.jiang@utwente.nl)
- Rosa Aguilar (r.aguilar@utwente.nl)
- Alex-Andrei Cuvuliuc (alex-andrei.cuvuliuc@utwente.nl)

## License

MIT
