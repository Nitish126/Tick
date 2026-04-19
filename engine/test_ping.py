from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

models_to_try = [
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite-001"
]

for m in models_to_try:
    try:
        response = client.models.generate_content(
            model=m,
            contents="Say hi",
        )
        print(f"SUCCESS: {m} -> {response.text}")
    except Exception as e:
        print(f"ERROR: {m} -> {e}")
