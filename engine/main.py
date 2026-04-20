from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from app.api.endpoints import router

app = FastAPI(title="MWU Engine & OCR Service")

@app.get("/health")
def health_check():
    return {"status": "OK", "service": "mwu-engine", "version": "v1.0.1"}

print("Starting MWU Engine & OCR Service... (Instant Bind Mode)")

from app.api.endpoints import router
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
