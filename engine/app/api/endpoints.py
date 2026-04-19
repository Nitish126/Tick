from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.schema import OCRResponseSchema, MWURequestSchema, MWUResponseSchema
from app.services.ocr import mock_process_image
from app.services.mwu import calculate_mwu

router = APIRouter()

class OCRProcessRequest(BaseModel):
    image_base64: str

@router.post("/ocr/process", response_model=OCRResponseSchema)
def process_ocr(request: OCRProcessRequest):
    try:
        # In a real scenario, this delegates to Google/AWS OCR wrappers
        data = mock_process_image(request.image_base64)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mwu/calculate", response_model=MWUResponseSchema)
def calculate_vehicle_mwu(request: MWURequestSchema):
    score = calculate_mwu(
        distance_km=request.distance_km,
        thermal_factor=request.thermal_factor,
        idle_ratio=request.idle_ratio
    )
    return MWUResponseSchema(mwu_score=score)
