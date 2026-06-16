import sys
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI()
origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:8000", "http://127.0.0.1:5173", "https://cosmas.cfd/", "https://cosmas.cfd"]
app.add_middleware(CORSMiddleware, allow_origins = origins, allow_credentials = True, allow_methods = ["*"], allow_headers = ["*"])
load_dotenv()
client = genai.Client(api_key = os.getenv("GEMINI_KEY").strip())
print("Gemini is setup")

class PromptRequest(BaseModel):
    userData: str
    vertical: str
@app.post("/api/prompt")
def prompt(data: PromptRequest):
    with open((BASE_DIR / f"{data.vertical}Constitution.txt"), "r", encoding="utf-8") as file:
        constitution = file.read()
    promptText = constitution + "Here's the user's information: " + data.userData
    response = client.models.generate_content(model = "gemini-3.1-flash-lite", contents = promptText).text
    return response
