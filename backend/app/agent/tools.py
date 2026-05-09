import httpx
from google.adk.tools import FunctionTool

BASE_URL = "http://localhost:8000"

async def get_ward_info(ward_id: int) -> dict:
    """Get baseline heat, NDVI, and risk data for a specific ward."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE_URL}/api/uhi/ward-baseline/{ward_id}")
        return r.json()

async def run_simulation(ward_id: int, intensity: float) -> dict:
    """
    Simulate green infrastructure impact on a ward.
    intensity: raw NDVI increase value, NOT percentage.
    For green infrastructure: intensity = (percentage/100) * 0.25
    For cooling corridors: intensity = (percentage/100) * 0.15
    For materials: intensity = (percentage/100) * 0.05
    Example: 30% green = 0.075
    """
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}/api/uhi/simulate-ward",
            json={"ward_id": ward_id, "intensity": intensity})
        return r.json()

async def get_hotspots(threshold: float = 40.0, limit: int = 10) -> dict:
    """Get wards with highest urban heat island effect above a temperature threshold."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE_URL}/api/uhi/bengaluru-hotspots",
            params={"threshold": threshold, "limit": limit})
        return r.json()

async def get_material_recommendations(
    ward_name: str,
    application: str = "Wall",
    prioritize: str = "cooling"
) -> dict:
    """Get ML-recommended building materials for a ward based on its heat zone."""
    prefs = {"cost": 0.25, "health": 0.25, "cooling": 0.25, "sustainability": 0.25}
    prefs[prioritize] = 0.5
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}/api/materials/recommend",
            json={"ward_name": ward_name, "application": application,
                  "preferences": prefs, "top_n": 3})
        return r.json()

async def get_ward_sentiment(ward_number: int) -> dict:
    """Get public sentiment and stress risk for a ward from Reddit/news data."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE_URL}/api/sentiment/ward-sentiment/{ward_number}")
        return r.json()

async def get_city_statistics() -> dict:
    """Get city-wide temperature statistics and risk distribution across all wards."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE_URL}/api/uhi/city-statistics")
        return r.json()

async def get_ward_equity(ward_id: int) -> dict:
    """
    Get equity audit for a specific ward — includes demographic vulnerability,
    SC/ST population share, gender balance, exposure score, equity priority rank,
    rank gap vs heat-only rank, and any bias flags.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE_URL}/api/equity/ward/{ward_id}")
        return r.json()

async def get_equity_hotspots() -> dict:
    """
    Get the top under-prioritized wards — wards with high demographic vulnerability
    that rank significantly lower in heat-only prioritization than in equity-adjusted
    prioritization. Use this to detect algorithmic bias in intervention planning.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE_URL}/api/equity/audit")
        data = r.json()
        return {
            "under_prioritized_wards": data.get("under_prioritized_wards", []),
            "summary": data.get("summary", {}),
            "material_fairness": data.get("material_fairness", {})
        }

async def get_xai_explanation(ward_id: int, intensity: float, albedo_increase: float = 0.0) -> dict:
    """
    Get SHAP-based XAI explanation for a UHI simulation.
    Shows which features (NDVI, albedo, location) drove the predicted temperature change
    and by how much. Use this after run_simulation to explain why a ward will cool
    by a certain amount.
    intensity: same value passed to run_simulation
    albedo_increase: 0.0 for green interventions, 0.08-0.15 for materials/cooling
    """
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}/api/xai/explain-simulation",
            json={
                "ward_id": ward_id,
                "intensity": intensity,
                "albedo_increase": albedo_increase
            })
        return r.json()

ward_equity_tool = FunctionTool(func=get_ward_equity)
equity_hotspots_tool = FunctionTool(func=get_equity_hotspots)
xai_explanation_tool = FunctionTool(func=get_xai_explanation)
ward_info_tool = FunctionTool(func=get_ward_info)
simulation_tool = FunctionTool(func=run_simulation)
hotspots_tool = FunctionTool(func=get_hotspots)
materials_tool = FunctionTool(func=get_material_recommendations)
sentiment_tool = FunctionTool(func=get_ward_sentiment)
city_stats_tool = FunctionTool(func=get_city_statistics)