import os
import io
from datetime import date
from pydantic import BaseModel, conlist
from google import genai
from google.genai import types
from app.core.schema import OCRResponseSchema, LineItem
from fastapi import HTTPException
import base64
import json

def mock_process_image(image_base64: str) -> OCRResponseSchema:
    """
    Real AI OCR ingestion using Google Gemini Vision API.
    Decodes base64, sends to Gemini 1.5 Flash, and enforces the strict Pydantic JSON schema.
    """
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
         raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured. Cannot process OCR.")
         
    try:
        # Decode base64 
        image_data = base64.b64decode(image_base64)
        
        client = genai.Client(api_key=api_key)
        prompt = """
        You are a highly advanced multimodal vehicle OCR AI.
        Look at this image. It may be a physical paper receipt, or it may be a photo of a digital fuel pump meter (LED dashboard displaying Volume/Litres and Amount).
        
        If it's a FUEL/PETROL receipt OR a fuel pump meter: Identify the exact fuel volume (quantity in Litres or Gallons), price per unit, and total cost.
        If it's a SERVICE/MECHANIC bill: Identify all spare parts and labor entries.
        
        Output ONLY a strictly valid JSON adhering to this schema structure and nothing else. Ensure the date is formatted as YYYY-MM-DD. (If no date is visible, output today's date).
        Schema:
        {
          "merchant": "string",
          "date": "YYYY-MM-DD",
          "total_amount": float,
          "line_items": [
            {
              "description": "string",
              "quantity": float (must extract the Litre volume explicitly if fuel),
              "price_per_unit": float,
              "total": float,
              "mechanical_impact_flag": boolean (true if it's a part that impacts car operation/wear like filters, engine oil. false for labor or consumables like fuel.)
            }
          ]
        }
        """

        models_to_try = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro']
        response = None
        for m in models_to_try:
            try:
                response = client.models.generate_content(
                    model=m,
                    contents=[
                        prompt,
                        types.Part.from_bytes(data=image_data, mime_type='image/jpeg')
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                break # Success!
            except Exception as e:
                # If error is 503 High Demand, try next model. Else if we run out of models, raise.
                if "503" not in str(e) and "high demand" not in str(e).lower() and m == models_to_try[-1]:
                    raise e
                elif m == models_to_try[-1]:
                    raise e
                print(f"Model {m} failed due to demand, falling back...")
        
        raw_json = response.text
        # Handle cases where model might wrap JSON in markdown blocks
        if "```json" in raw_json:
            raw_json = raw_json.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_json:
            raw_json = raw_json.split("```")[1].strip()
            
        data_dict = json.loads(raw_json)
        
        # Enforce date fallback since Digital Meters lack physical timestamps
        if not data_dict.get('date') or str(data_dict.get('date')).strip() == "":
            data_dict['date'] = date.today().isoformat()
            
        parsed_data = OCRResponseSchema(**data_dict)
        return parsed_data

    except Exception as e:
        print(f"Error during Gemini OCR processing: {getattr(e, 'message', str(e))}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process OCR via Vision Model: {str(e)}")
