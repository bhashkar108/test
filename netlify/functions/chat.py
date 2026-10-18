"""
StudyBuddy AI — Netlify Serverless Function: /chat
Handles student questions via Google Gemini API.
"""

import json
import os
import time

import google.generativeai as genai

# ── Env ──────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


# ── Helpers ───────────────────────────────────────────────────────────────────
def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
    }


def json_response(status: int, body: dict):
    return {
        "statusCode": status,
        "headers": cors_headers(),
        "body": json.dumps(body),
    }


def build_system_prompt(language: str, subject: str) -> str:
    lang_instruction = (
        "Respond in simple, easy-to-understand Hindi (Hinglish is also fine)."
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


# ── Main handler ──────────────────────────────────────────────────────────────
def handler(event, context):
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    if event.get("httpMethod") != "POST":
        return json_response(405, {"detail": "Method not allowed. Use POST."})

    # API key check
    if not GEMINI_API_KEY:
        return json_response(
            503,
            {
                "detail": (
                    "AI service is not configured. "
                    "Please set GEMINI_API_KEY in Netlify → Site Settings → Environment Variables."
                )
            },
        )

    # Parse request body
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return json_response(400, {"detail": "Invalid JSON body."})

    message  = (body.get("message") or "").strip()
    history  = body.get("history", [])
    language = body.get("language", "English")
    subject  = body.get("subject", "General")

    if not message:
        return json_response(400, {"detail": "Message cannot be empty."})

    # Call Gemini
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={
                "temperature": 0.7,
                "top_p": 0.9,
                "max_output_tokens": 2048,
            },
        )

        # Build conversation history for Gemini (last 10 turns)
        gemini_history = [
            {"role": m["role"], "parts": [m["content"]]}
            for m in history[-10:]
            if m.get("role") and m.get("content")
        ]

        chat_session = model.start_chat(history=gemini_history)

        # Prepend system prompt only on the very first message
        full_message = (
            f"{build_system_prompt(language, subject)}\n\nStudent question: {message}"
            if not history
            else message
        )

        response = chat_session.send_message(full_message)
        return json_response(200, {"reply": response.text.strip(), "timestamp": time.time()})

    except Exception as exc:
        err_str = str(exc)

        if "API_KEY" in err_str or "authentication" in err_str.lower():
            return json_response(401, {"detail": "Invalid Gemini API key. Check your Netlify environment variable."})
        if "quota" in err_str.lower() or "rate" in err_str.lower() or "429" in err_str:
            return json_response(429, {"detail": "API rate limit reached. Please wait a moment and try again."})

        return json_response(500, {"detail": f"AI error: {err_str}"})
