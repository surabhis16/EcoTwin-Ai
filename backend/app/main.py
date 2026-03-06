from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth
from app.routers import uhi_prediction, material_recommendation, sentiment, export, agent_router


app = FastAPI(title="EcoTwin AI API")

# cors for next
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#uhi router
app.include_router(uhi_prediction.router)
#material recc router
app.include_router(material_recommendation.router)
#sentiment router
app.include_router(sentiment.router) 
#export router [exporting data]
app.include_router(export.router)
#agent router
app.include_router(agent_router.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

@app.get("/")
def read_root():
    return {"message": "EcoTwin AI API"}