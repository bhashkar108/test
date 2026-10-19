"""
StudyBuddy AI — FastAPI Backend
Handles chat requests and communicates with Google Gemini API.
"""

import os
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from google import  genai
from dotenv import load_dotenv

# ── Load environment variables ──────────────────────────────────────────────
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="StudyBuddy AI",
    description="AI-powered academic assistant for students",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gemini client setup ──────────────────────────────────────────────────────
gemini_model = None

def init_gemini():
    global gemini_model
    if GEMINI_API_KEY:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            gemini_model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config={
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "max_output_tokens": 2048,
                },
            )
            print("✅ Gemini API initialized successfully.")
        except Exception as e:
            print(f"⚠️  Gemini init error: {e}")
            gemini_model = None
    else:
        print("⚠️  GEMINI_API_KEY not set. AI responses will not work.")

init_gemini()

# ── Pydantic schemas ─────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str          # "user" | "model"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    language: Optional[str] = "English"   # "English" | "Hindi"
    subject: Optional[str] = "General"

class ChatResponse(BaseModel):
    reply: str
    timestamp: float

# ── System prompt factory ────────────────────────────────────────────────────
def build_system_prompt(language: str, subject: str) -> str:
    lang_instruction = (
        "Respond in simple, easy-to-understand Hindi (Hinglish is also acceptable)."
        if language == "Hindi"
        else "Respond in clear, simple English suitable for students."
    )
    return f"""You are StudyBuddy AI, a friendly and knowledgeable academic assistant designed to help students learn better.

Your role:
- Help students understand concepts in Mathematics, Science, Programming, English, History, Geography, and other academic subjects.
- Break down complex topics into simple, easy-to-understand explanations with examples.
- For programming questions, provide clean, well-commented code examples.
- For math problems, show step-by-step solutions.
- Always be encouraging, patient, and supportive.
- Use analogies and real-world examples to make concepts relatable.
- If asked to debug code, explain what the bug is and why the fix works.
- Never give harmful, inappropriate, or off-topic responses.

Language: {lang_instruction}
Current subject focus: {subject}

Format your responses with:
- Clear headings where appropriate
- Bullet points or numbered steps for processes
- Code blocks (using markdown) for any code
- Emojis sparingly to make responses friendly ✨
- Keep responses concise but complete — not too long, not too short.

Remember: You are talking to a student. Be warm, supportive, and encouraging!"""

# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "ai_ready": gemini_model is not None,
        "model": "gemini-1.5-flash" if gemini_model else None,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not gemini_model:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured. Please set GEMINI_API_KEY in the .env file.",
        )

    try:
        system_prompt = build_system_prompt(req.language, req.subject)

        # Build Gemini conversation history
        gemini_history = []
        for msg in req.history[-10:]:   # Keep last 10 messages for context
            gemini_history.append({
                "role": msg.role,
                "parts": [msg.content],
            })

        # Start a chat session with history
        chat_session = gemini_model.start_chat(history=gemini_history)

        # Prepend system context to the first user message
        full_message = f"{system_prompt}\n\nStudent question: {req.message}"
        if req.history:
            # Only prepend system on the first message; after that keep context
            full_message = req.message

        response = chat_session.send_message(full_message)
        reply_text = response.text.strip()

        return ChatResponse(reply=reply_text, timestamp=time.time())

    except Exception as e:
        error_str = str(e)
        if "API_KEY" in error_str or "authentication" in error_str.lower():
            raise HTTPException(
                status_code=401,
                detail="Invalid API key. Please check your GEMINI_API_KEY.",
            )
        elif "quota" in error_str.lower() or "rate" in error_str.lower():
            raise HTTPException(
                status_code=429,
                detail="API rate limit reached. Please try again in a moment.",
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"AI error: {error_str}",
            )


# ── Serve frontend static files ──────────────────────────────────────────────
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
