from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import uhi_prediction, material_recommendation, sentiment, export

app = FastAPI(title="EcoTwin AI API")

# cors for next
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include uhi router
app.include_router(uhi_prediction.router)
# include material recc router
app.include_router(material_recommendation.router)
#include sentiment router
app.include_router(sentiment.router) 
#include export router [exporting data]
app.include_router(export.router)

@app.get("/")
def read_root():
    return {"message": "EcoTwin AI API"}