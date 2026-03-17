# TerraQuery

A unified AI-powered geospatial analysis platform that combines four specialized modules into a single application. Ask any question about any place on Earth — an LLM orchestrator routes your query to the right tool automatically.

## Modules

### Earth Analyzer
Conversational AI assistant with direct Google Earth Engine access. Visualize NDVI, elevation, and land cover layers, query pixel values, compute region statistics, and run time series analysis for any location.

### Land Cover Change
Analyze land cover transitions over decades using MODIS (global, 2001-2024) and CORINE (Europe, 1990-2018) satellite datasets. Produces animated GIF time-lapses, Sankey transition diagrams, and AI-generated environmental reports.

### Urban Dynamics
Multi-agent system for city stakeholders. Tracks green areas (NDVI trends), industrial movement (nighttime lights), and urban expansion over 1-5 years. Three AI agents work in sequence: intent parsing, Earth Engine data gathering, and narrative generation.

### Vegetation Explorer
Multi-dataset environmental analysis with six GEE datasets: Sentinel-2 NDVI, MODIS NDVI, MODIS Land Surface Temperature, VIIRS Nighttime Lights, Dynamic World Built-up, and CHIRPS Precipitation. Sidebar-driven or natural language queries with trend charts and map overlays.

## Architecture

```
├── server/                    Express + TypeScript backend (port 3001)
│   ├── index.ts               Entry point, EE init, route registration
│   ├── routes/
│   │   ├── landcover.ts       POST /api/landcover/chat
│   │   ├── urban.ts           GET/POST /api/urban/*
│   │   ├── analyzer.ts        POST /api/analyzer/chat, /api/analyzer/pixel
│   │   ├── vegetation.ts      GET /api/vegetation/datasets, POST /api/vegetation/analyze
│   │   └── orchestrator.ts    POST /api/ask (LLM router)
│   └── services/
│       ├── earthEngine.ts     Shared EE init + landcover/urban computations
│       ├── vertexAI.ts        Vertex AI with model fallback chain
│       ├── analyzerTools.ts   NDVI/elevation/landcover tools for Earth Analyzer
│       ├── vegetationRegistry.ts  6 GEE dataset configs
│       ├── vegetationAnalyze.ts   Generic GEE pipeline + GAUL geocoding
│       ├── datasetConfig.ts   CORINE/MODIS/DynamicWorld metadata
│       └── geocoder.ts        Shared Nominatim geocoding
│
├── client/                    React + Vite + Tailwind v4 frontend (port 5173)
│   └── src/
│       ├── App.tsx            React Router with persistent module mounting
│       ├── components/
│       │   ├── PlatformShell.tsx   Top nav, module tabs, EE status badge
│       │   ├── MapBase.tsx         Shared Leaflet map component
│       │   └── ErrorBoundary.tsx   Per-module error isolation
│       ├── context/
│       │   └── LocationContext.tsx  Shared location state across modules
│       └── modules/
│           ├── landing/       Command center with AI query bar + examples
│           ├── analyzer/      Earth Analyzer (chat + interactive map)
│           ├── landcover/     Land Cover Change (sidebar + GIF map + Sankey)
│           ├── urban/         Urban Dynamics (3-agent workflow + chart)
│           └── vegetation/    Vegetation Explorer (sidebar + chart + map)
│
└── package.json               Root: runs server + client via concurrently
```

## Prerequisites

- **Node.js** 18+ and npm
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

# Optional: Vertex AI region (default: us-central1, recommended for Earth Engine)
VERTEX_REGION=us-central1

# Optional: Server port (default: 3001)
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

### 4. Run

```bash
npm start
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

Open **http://localhost:5173** in your browser.

## How It Works

### Orchestrator (Command Center)

The landing page has a unified query bar. When you submit a query:

1. **Vertex AI** analyzes the query and decides which module(s) to invoke
2. Simple location queries ("show me where X is") route to **Earth Analyzer**
3. Land cover change/deforestation queries route to **Land Cover Change**
4. City stakeholder questions (green areas, industrial movement, expansion) route to **Urban Dynamics**
5. Specific environmental metrics (NDVI, temperature, precipitation) route to **Vegetation Explorer**
6. Complex queries can invoke multiple modules with a synthesized report

### Shared Infrastructure

- **Single Earth Engine init** — authenticated once at server startup, shared across all modules
- **Vertex AI with fallback chain** — gemini-2.5-pro, falls back to gemini-2.5-flash, then gemini-2.0-flash on quota errors
- **LocationContext** — when you query a location in one module, switching tabs preserves the location
- **Persistent modules** — switching between tabs doesn't lose your work; all modules stay mounted

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
| `/api/urban/story` | POST | Generate narrative report |
| `/api/vegetation/datasets` | GET | List available GEE datasets |
| `/api/vegetation/analyze` | POST | Run vegetation/environmental analysis |

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router, Recharts, React-Leaflet, Lucide icons
- **Backend:** Express, TypeScript, tsx
- **AI:** Google Vertex AI (Gemini 2.5 Pro/Flash), AI SDK
- **Geospatial:** Google Earth Engine (MODIS, CORINE, Sentinel-2, VIIRS, Dynamic World, CHIRPS, SRTM)
- **Maps:** Leaflet with OpenStreetMap, CARTO, and Google Satellite basemaps

## Authors

- Senyang Li (sneyang.li@utwente.nl)
- Tong Jiang (tong.jiang@utwente.nl)
- Rosa Aguilar (r.aguilar@utwente.nl)
- Alex-Andrei Cuvuliuc (alex-andrei.cuvuliuc@utwente.nl)

## License

MIT
