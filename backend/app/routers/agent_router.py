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
    existing = await session_service.list_sessions(
        app_name="bengaluru_climate",
        user_id=payload.session_id
    )
    
    if not existing or not existing.sessions:
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
        try:
            if hasattr(event, 'candidates') and event.candidates:
                for candidate in event.candidates:
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, 'text') and part.text:
                                final_response = part.text
        except Exception:
            pass
        try:
            text = event.content.parts[0].text
            if text:
                final_response = text
        except Exception:
            pass

    return {"response": final_response, "session_id": payload.session_id}