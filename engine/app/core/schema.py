from pydantic import BaseModel, conlist
from typing import List, Optional
from datetime import date

class LineItem(BaseModel):
    description: str
    quantity: float
    price_per_unit: float
    total: float
    # Identifies if this is a part that impacts mechanical wear (e.g. "Fuel Filter")
    mechanical_impact_flag: Optional[bool] = False 

class OCRResponseSchema(BaseModel):
    merchant: str
    date: date
    total_amount: float
    line_items: List[LineItem] = []
    
    # Simple validation rule
    # In a real app we would ensure sum(line_items.total) == total_amount

class MWURequestSchema(BaseModel):
    distance_km: float
    thermal_factor: float
    idle_ratio: float
    
class MWUResponseSchema(BaseModel):
    mwu_score: float
