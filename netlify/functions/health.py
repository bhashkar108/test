"""
StudyBuddy AI — Netlify Serverless Function: /health
Returns API status so the frontend can show the connection indicator.
"""

import json
import os

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Content-Type": "application/json",
    }


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    ai_ready = bool(GEMINI_API_KEY)

    return {
        "statusCode": 200,
        "headers": cors_headers(),
        "body": json.dumps({
            "status": "ok",
            "ai_ready": ai_ready,
            "model": "gemini-1.5-flash" if ai_ready else None,
        }),
    }
