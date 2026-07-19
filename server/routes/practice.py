"""Practice + speech + correction routes.

POST /api/practice/start   -> create a session, return {sessionId}
POST /api/practice/stop    -> finalize the most recent active session
POST /api/speech/analyze   -> upload audio, get a `PracticeResult` back
POST /api/correction       -> text in, 4-variant `CorrectionResult` out
"""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from .. import auth as auth_utils
from ..db import get_db
from ..deps import get_current_user
from ..pipeline import process_audio_session

router = APIRouter(prefix="/api", tags=["practice"])



# --------------------------- Helpers ---------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _row_to_practice_session(row: sqlite3.Row) -> Dict[str, Any]:
    metrics = json.loads(row["metrics_json"]) if row["metrics_json"] else {}
    return {
        "id": row["id"],
        "type": row["session_type"],
        "title": row["session_type"].replace("_", " ").title(),
        "durationSeconds": int(metrics.get("durationSeconds", 0) or 0),
        "score": int(metrics.get("confidenceScore", 0) or 0),
        "createdAt": row["started_at"],
    }


# --------------------------- Routes ---------------------------

@router.post("/practice/start")
def practice_start(
    payload: Dict[str, Any],
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, str]:
    session_type = (payload or {}).get("type", "free_practice")
    if session_type not in {"free_practice", "speaking_partner", "mock_interview", "group_discussion", "daily_challenge"}:
        session_type = "free_practice"
    session_id = auth_utils.new_id()
    conn.execute(
        """
        INSERT INTO practice_sessions
            (id, user_id, session_type, started_at)
        VALUES (?, ?, ?, ?)
        """,
        (session_id, user["id"], session_type, _now_iso()),
    )
    return {"sessionId": session_id}


@router.post("/practice/stop")
def practice_stop(
    payload: Dict[str, Any],
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Finalize the most recent active session for this user.

    The frontend typically calls /speech/analyze first (which writes the
    transcript + metrics) and then /practice/stop with the sessionId returned
    by /practice/start. We look up that session, attach any in-flight
    analytics, and return a `PracticeResult` for the UI.
    """
    session_id = (payload or {}).get("sessionId")
    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId is required.")
    row = conn.execute(
        """
        SELECT id, user_id, session_type, original_text, corrected_text,
               metrics_json, started_at
        FROM practice_sessions
        WHERE id = ? AND user_id = ?
        """,
        (session_id, user["id"]),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    metrics = json.loads(row["metrics_json"]) if row["metrics_json"] else {}
    return {
        "id": row["id"],
        "transcript": row["original_text"] or "",
        "corrected": row["corrected_text"] or "",
        "grammarErrors": [],
        "vocabularySuggestions": [],
        "confidenceScore": int(metrics.get("confidenceScore", 0) or 0),
        "pronunciationScore": int(metrics.get("pronunciationScore", 0) or 0),
        "speakingPaceWpm": int(metrics.get("speakingPaceWpm", 0) or 0),
        "englishOnlyViolation": False,
    }


@router.post("/speech/analyze")
async def speech_analyze(
    file: UploadFile = File(...),
    challengeId: str | None = Form(default=None),
    interviewId: str | None = Form(default=None),
    questionId: str | None = Form(default=None),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Accept an audio file, run the full STT + LLM pipeline, persist a session."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio provided.")

    from datetime import datetime, timezone
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    result = process_audio_session(
        audio_bytes,
        user_id=user["id"],
        created_at=created_at,
    )
    practice = result["result"]

    # Find the user's most recent active session and finalize it; if none exists,
    # create a fresh "free_practice" session row so the analytics aren't lost.
    active = conn.execute(
        """
        SELECT id FROM practice_sessions
        WHERE user_id = ? AND ended_at IS NULL
        ORDER BY started_at DESC LIMIT 1
        """,
        (user["id"],),
    ).fetchone()
    if active:
        session_id = active["id"]
        conn.execute(
            """
            UPDATE practice_sessions
            SET original_text = ?,
                corrected_text = ?,
                metrics_json = ?,
                language_alert = ?,
                ended_at = ?
            WHERE id = ?
            """,
            (
                result["transcript"],
                result["correctedText"],
                json.dumps({
                    "confidenceScore": practice["confidenceScore"],
                    "pronunciationScore": practice["pronunciationScore"],
                    "speakingPaceWpm": practice["speakingPaceWpm"],
                    "fillerCount": (result.get("metrics") or {}).get("fillerCount", 0),
                    "wordsSpoken": (result.get("metrics") or {}).get("wordsSpoken", 0),
                    "durationSeconds": int((result.get("metrics") or {}).get("durationSeconds", 0)),
                }),
                result["languageAlert"],
                _now_iso(),
                session_id,
            ),
        )
    else:
        session_id = auth_utils.new_id()
        conn.execute(
            """
            INSERT INTO practice_sessions
                (id, user_id, session_type, original_text, corrected_text,
                 metrics_json, language_alert, started_at, ended_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                user["id"],
                "free_practice",
                result["transcript"],
                result["correctedText"],
                json.dumps({
                    "confidenceScore": practice["confidenceScore"],
                    "pronunciationScore": practice["pronunciationScore"],
                    "speakingPaceWpm": practice["speakingPaceWpm"],
                    "fillerCount": (result.get("metrics") or {}).get("fillerCount", 0),
                    "wordsSpoken": (result.get("metrics") or {}).get("wordsSpoken", 0),
                    "durationSeconds": int((result.get("metrics") or {}).get("durationSeconds", 0)),
                }),
                result["languageAlert"],
                created_at,
                _now_iso(),
            ),
        )

    practice["id"] = session_id
    practice["sessionType"] = "free_practice"
    return practice
