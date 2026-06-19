import sys
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from typing import List

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

class ChatTurn(BaseModel):
    role: str
    text: str

class StatelessChatRequest(BaseModel):
    history: List[ChatTurn]
    vertical: str
    new_message: str

@app.post("/api/chat")
async def chat(request: StatelessChatRequest):
    contents = []
    with open((BASE_DIR / f"{request.vertical}Constitution.txt"), "r", encoding="utf-8") as file:
        constitution = file.read()
    contents.append(
        types.Content(
            role = "user",
            parts=[types.Part.from_text(text=constitution)]
        )
    )
    try:
        
        for turn in request.history:
            contents.append(
                types.Content(
                    role=turn.role,
                    parts=[types.Part.from_text(text=turn.text)]
                )
            )
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=request.new_message)]
            )
        )
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=constitution)
        )

        return {"response": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
