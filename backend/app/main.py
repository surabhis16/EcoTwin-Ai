from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import uhi_prediction

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

@app.get("/")
def read_root():
    return {"message": "EcoTwin AI API"}