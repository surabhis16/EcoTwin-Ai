# EcoTwin AI
### Digital Twin for Urban Sustainability Planning

EcoTwin AI is a full-stack urban digital twin platform built for Bengaluru. It combines satellite-derived geospatial data, machine learning, and an agentic AI layer to help urban planners understand, simulate, and mitigate Urban Heat Island (UHI) effects across the city's 225 wards.



## Overview

Bengaluru has lost over 80% of its tree cover in the last three decades. Surface temperatures in dense urban wards regularly exceed 44°C, and planners lack tools to model the impact of interventions before committing resources. EcoTwin AI addresses this by providing a live, interactive digital twin of the city's thermal environment.



## What It Does

- Maps real-time UHI intensity, NDVI, and AQI across all 225 Bengaluru wards on an interactive 3D Cesium globe
- Simulates the temperature and carbon impact of green infrastructure interventions using a trained XGBoost model
- Recommends climate-appropriate building materials using a Random Forest classifier trained on a custom materials dataset
- Analyzes public sentiment about urban heat and infrastructure from Reddit and news sources using a fine-tuned RoBERTa model
- Provides a conversational AI agent (Google ADK + Gemini) that autonomously chains simulations, hotspot analysis, and material recommendations in response to natural language queries from planners
- Syncs agent responses bidirectionally with the 3D map - agent-triggered simulations fly the camera and render overlays; ward clicks on the map pre-fill agent context



## Architecture

```
Frontend (Next.js + TypeScript)
    Cesium 3D Globe          - ward heat map, simulation overlays, AQI/NDVI layers
    Policy Simulation Engine - step-by-step intervention wizard
    Material Recommender     - ward-aware material selection UI
    UHI Interactive Map      - 2D heatmap with UHI, NDVI, AQI toggles
    Agent Chat               - floating chat panel, markdown rendering, map sync

Backend (FastAPI)
    /api/uhi         - ward baselines, simulation, hotspots, city statistics
    /api/materials   - ML-powered material recommendation
    /api/sentiment   - ward and city-wide sentiment analysis
    /api/agent       - ADK-powered conversational agent with tool chaining
    /api/auth        - Supabase authentication

Database (Supabase + PostGIS)
    bengaluru_wards          - ward geometry, LST, NDVI, albedo, AQI
    materials                - building materials with thermal and carbon properties
    public_sentiment         - Reddit/news posts with ward-level geocoding
    ward_sentiment_summary   - materialized view, refreshed on collection

ML Models
    uhi_xgb_monotonic.pkl    - XGBoost regressor, predicts LST from NDVI/albedo/coords
    climate_material.pkl     - Random Forest classifier, predicts material heat zone suitability
    RoBERTa (cardiffnlp)     - sentiment classification, runs as singleton on CPU

Agent (Google ADK)
    Tools: get_ward_info, run_simulation, get_hotspots,
           get_material_recommendations, get_ward_sentiment, get_city_statistics
    Model: Gemini 2.0 Flash
    Sessions: InMemorySessionService, per-user session continuity
```



## Data Pipeline

All geospatial data was sourced and processed as follows:

**LST, NDVI, Albedo** - exported from Google Earth Engine as GeoTIFF, converted to CSV, spatially joined to ward boundaries via PostGIS `ST_Contains`.

**AQI** - derived from Sentinel-5P NO2/aerosol proxy, same GEE pipeline, loaded via staging table into `bengaluru_wards`.

**Ward boundaries** - OpenCity Bengaluru ward KML (225 wards), loaded into PostGIS as `MultiPolygon` geometry with spatial indexing.

**Materials dataset** - custom dataset of ~200 building materials with thermal conductivity, SRI, embodied carbon, VOC rating, recycled content, and local availability. Cooling Index derived from thermal properties; used as training label for zone suitability classification.

**Sentiment data** - collected via Reddit API (r/bangalore, r/india) and RSS news feeds. Preprocessed with spaCy, location-extracted with NER, geocoded via PostGIS, stored in `public_sentiment`. Aggregated into `ward_sentiment_summary` materialized view.



## ML Models

### UHI Temperature Predictor
- Algorithm: XGBoost Regressor with monotonicity constraints
- Features: NDVI, albedo, longitude, latitude
- Constraint: NDVI and albedo are monotonically decreasing with LST (physically enforced)
- Output: Predicted Land Surface Temperature (°C)
- Used in: simulation endpoint - predicts LST delta from NDVI increase, scaled by 0.33 to convert surface temp change to air temp change

### Material Zone Classifier
- Algorithm: Random Forest Classifier (100 estimators)
- Features: thermal conductivity, specific heat, SRI, embodied carbon, price, VOC, recycled content, source distance, local availability
- Labels: Low / Medium / High cooling suitability zone (derived from Cooling Index tertiles)
- Used in: material recommendation endpoint - filters materials matching ward heat zone, ranks by user-weighted scoring (cost, health, cooling, sustainability)

### Sentiment Classifier
- Model: `cardiffnlp/twitter-roberta-base-sentiment-latest`
- Loaded as a CPU singleton with batch inference
- Output: positive / negative / neutral + confidence score [-1, 1]
- Stress risk derived from sentiment score and policy category



## Tech Stack

| Layer | Technology |
|------|-------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| 3D Visualization | CesiumJS (OSM Buildings, KML ward boundaries) |
| Backend | FastAPI, SQLAlchemy, Uvicorn |
| Database | Supabase (PostgreSQL + PostGIS) |
| ML | XGBoost, scikit-learn, PyTorch, HuggingFace Transformers |
| AI Agent | Google ADK 1.26, Gemini 2.5 Flash |
| Auth | Supabase Auth |
| Data Collection | PRAW (Reddit), feedparser, BeautifulSoup, spaCy NER |
| Geospatial | Google Earth Engine, Sentinel-5P, PostGIS, GDAL |



## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Supabase project with PostGIS extension enabled
- Google AI Studio API key (Gemini)
- Cesium Ion token

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Create `backend/.env`:
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
GOOGLE_API_KEY=your-gemini-api-key
```

Run database migrations from `db/` in order:
1. `blr_wards.sql`
2. `materials.sql`
3. `sentiment.sql`
4. `aqi.sql`

Start the server:
```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_CESIUM_ION_TOKEN=your-token
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

### Agent (dev UI, optional)

```bash
cd backend
adk web --port 8001
# select bengaluru_agent from dropdown
```



## API Overview

| Endpoint | Method | Description |
|------|-------------|-------------|
| `/api/uhi/ward-baseline/{ward_id}` | GET | Ward LST, NDVI, risk level |
| `/api/uhi/simulate-ward` | POST | Simulate green infra intervention |
| `/api/uhi/bengaluru-hotspots` | GET | Top UHI wards above threshold |
| `/api/uhi/city-statistics` | GET | City-wide temperature and risk distribution |
| `/api/materials/recommend` | POST | ML material recommendations for a ward |
| `/api/sentiment/ward-sentiment/{ward_number}` | GET | Ward sentiment and stress risk |
| `/api/agent/chat` | POST | Conversational agent with tool chaining |



## Key Design Decisions

**Monotonic XGBoost** - physical monotonicity constraints ensure the model never predicts that increasing vegetation raises temperature, preventing physically impossible outputs in simulation.

**0.33 surface-to-air scaling** - LST delta from the model is scaled by 0.33 when reporting air temperature reduction, reflecting the empirical relationship between surface and ambient temperature change in urban environments.

**Tool-based agent over RAG** - the agent has no vector store. It calls live FastAPI endpoints as tools, ensuring all numbers in agent responses are grounded in real database values, not retrieved text.

**Event bus for map sync** - frontend uses a lightweight pub/sub event bus (`mapEventBus.ts`) to decouple the agent chat component from the Cesium viewer. Agent responses are parsed for ward IDs and simulation keywords; matched data triggers camera flights and overlay rendering without prop drilling.

**Materialized view for sentiment** - `ward_sentiment_summary` aggregates 30-day sentiment per ward as a materialized view, refreshed after each Reddit collection run, keeping the 3D map overlay performant.
