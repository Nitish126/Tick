from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from app.api.endpoints import router

app = FastAPI(title="MWU Engine & OCR Service")

app.include_router(router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "OK", "service": "mwu-engine"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
