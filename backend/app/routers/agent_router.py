from fastapi import APIRouter
from pydantic import BaseModel
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent.agent import urban_climate_agent

router = APIRouter(prefix="/api/agent", tags=["Agent"])

session_service = InMemorySessionService()
runner = Runner(
    agent=urban_climate_agent,
    app_name="bengaluru_climate",
    session_service=session_service
)

class ChatMessage(BaseModel):
    session_id: str
    message: str

@router.post("/chat")
async def chat(payload: ChatMessage):
    await session_service.create_session(
        app_name="bengaluru_climate",
        user_id=payload.session_id,
        session_id=payload.session_id
    )

    user_msg = types.Content(
        role="user",
        parts=[types.Part(text=payload.message)]
    )

    final_response = ""
    async for event in runner.run_async(
        user_id=payload.session_id,
        session_id=payload.session_id,
        new_message=user_msg
    ):
        if event.is_final_response() and event.content:
            final_response = event.content.parts[0].text

    return {"response": final_response, "session_id": payload.session_id}