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
    Simulate the impact of green infrastructure on a ward.
    intensity: 0.0 to 1.0 (fraction of max NDVI gain possible)
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

ward_info_tool = FunctionTool(func=get_ward_info)
simulation_tool = FunctionTool(func=run_simulation)
hotspots_tool = FunctionTool(func=get_hotspots)
materials_tool = FunctionTool(func=get_material_recommendations)
sentiment_tool = FunctionTool(func=get_ward_sentiment)
city_stats_tool = FunctionTool(func=get_city_statistics)