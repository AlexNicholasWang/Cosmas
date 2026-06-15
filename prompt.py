import sys
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

def prompt(promptText):
    client = genai.Client(api_key = os.getenv("GEMINI_KEY").strip())
    response = client.models.generate_content(model = "gemini-3.5-flash", contents = promptText).text
    return response
load_dotenv()
print(os.getenv("GEMINI_KEY"))
print(prompt("Hello Gemini!"))
