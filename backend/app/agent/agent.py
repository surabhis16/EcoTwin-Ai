from google.adk.agents import Agent
from .tools import (
    ward_info_tool, simulation_tool, hotspots_tool,
    materials_tool, sentiment_tool, city_stats_tool
)
from .prompts import SYSTEM_PROMPT

urban_climate_agent = Agent(
    name="BengaluruClimateAgent",
    model="gemini-2.5-flash",
    instruction=SYSTEM_PROMPT,
    tools=[
        ward_info_tool,
        simulation_tool,
        hotspots_tool,
        materials_tool,
        sentiment_tool,
        city_stats_tool,
    ]
)