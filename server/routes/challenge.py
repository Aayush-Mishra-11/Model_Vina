"""Daily Challenge routes: GET today, GET history, and POST complete."""

import sqlite3
import json
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from ..db import get_db
from ..deps import get_current_user
from ..converters.stt import transcribe_audio_bytes
from ..analytics import calculate_metrics
from ..llm import call_local_mistral
from ..auth import new_id

router = APIRouter(prefix="/api/challenge", tags=["challenge"])

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

@router.get("/today")
def get_today_challenge(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = conn.execute(
        "SELECT id, challenge_type, title, prompt, reward FROM daily_challenges WHERE challenge_date = ?",
        (today_date,)
    ).fetchone()
    
    if not row:
        # Fallback challenge if seeding didn't catch today
        row = {
            "id": "c_default",
            "challenge_type": "storytelling",
            "title": "Daily Practice",
            "prompt": "Talk about a recent book you read or a movie you watched and why you liked it.",
            "reward": "+20 XP"
        }
        
    completed = conn.execute(
        "SELECT 1 FROM user_challenge_completions WHERE user_id = ? AND challenge_id = ?",
        (user["id"], row["id"])
    ).fetchone() is not None
    
    return {
        "id": row["id"],
        "type": row["challenge_type"],
        "title": row["title"],
        "prompt": row["prompt"],
        "reward": row["reward"],
        "completed": completed
    }

@router.get("/history")
def get_challenge_history(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT c.id, c.challenge_date, c.title, c.reward, h.score, h.completed_at
        FROM daily_challenges c
        JOIN user_challenge_completions h ON c.id = h.challenge_id
        WHERE h.user_id = ?
        ORDER BY h.completed_at DESC
        """,
        (user["id"],)
    ).fetchall()
    
    return [{
        "id": r["id"],
        "date": r["challenge_date"],
        "title": r["title"],
        "reward": r["reward"],
        "score": r["score"],
        "completedAt": r["completed_at"]
    } for r in rows]

import re

def _clean_llm_response(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"<thought>.*?</thought>", "", cleaned, flags=re.DOTALL)
    patterns = [
        r"^empathy/encouragement/friendly reply\s*:\s*",
        r"^refining friendly reply\s*:\s*",
        r"^friendly reply\s*:\s*",
        r"^response\s*:\s*",
        r"^coach\s*:\s*",
        r"^feedback\s*:\s*",
    ]
    for p in patterns:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"^[*\?\"\s:]+", "", cleaned).strip()
    if cleaned.startswith('"') and cleaned.endswith('"'):
        cleaned = cleaned[1:-1].strip()
    return cleaned


@router.post("/complete")
async def complete_challenge(
    challengeId: str = Query(...),
    file: UploadFile = File(...),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    challenge = conn.execute(
        "SELECT id, title, prompt, reward FROM daily_challenges WHERE id = ?",
        (challengeId,)
    ).fetchone()
    
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")
        
    already = conn.execute(
        "SELECT 1 FROM user_challenge_completions WHERE user_id = ? AND challenge_id = ?",
        (user["id"], challengeId)
    ).fetchone()
    if already:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge already completed today.")
         
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio file.")
        
    transcript, duration = transcribe_audio_bytes(audio_bytes)
    
    metrics = calculate_metrics(transcript, duration)
    score = int(metrics.get("confidenceScore", 0) or 75)

    feedback = "Great effort! Practice speaking longer sentences daily to get more detailed feedback."
    if transcript.strip():
        llm_prompt = (
            "You are an English speaking coach reviewing a student's daily practice challenge response.\n"
            f"Challenge Title: {challenge['title']}\n"
            f"Challenge Prompt: {challenge['prompt']}\n"
            f"Student's transcript: \"{transcript}\"\n\n"
            "Provide a friendly, direct 2-3 sentence coaching feedback on how they answered the prompt, "
            "one specific grammar/vocabulary correction if needed, and a positive word of encouragement.\n"
            "Keep the feedback concise, under 60 words total, and address the student directly."
        )
        try:
            feedback = call_local_mistral(llm_prompt)
            feedback = _clean_llm_response(feedback)
        except Exception:
            pass
    
    # Save completion
    conn.execute(
        "INSERT INTO user_challenge_completions (user_id, challenge_id, score, completed_at, feedback, transcript) VALUES (?, ?, ?, ?, ?, ?)",
        (user["id"], challengeId, score, _now_iso(), feedback, transcript)
    )
    
    # Save as practice session
    conn.execute(
        """
        INSERT OR IGNORE INTO practice_sessions
            (id, user_id, session_type, original_text, corrected_text,
             metrics_json, language_alert, started_at, ended_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            challengeId,
            user["id"],
            "daily_challenge",
            transcript,
            feedback,
            json.dumps({
                "confidenceScore": score,
                "pronunciationScore": score,
                "speakingPaceWpm": 130,
                "durationSeconds": int(duration),
            }),
            None,
            _now_iso(),
            _now_iso()
        )
    )
    
    return {
        "score": score,
        "reward": challenge["reward"],
        "transcript": transcript,
        "feedback": feedback
    }

