"""Dashboard endpoints: /dashboard and /dashboard/sessions."""

import json
import sqlite3
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

try:
    from server.db import get_db
    from server.deps import get_current_user
except (ImportError, ModuleNotFoundError):
    from db import get_db
    from deps import get_current_user

router = APIRouter(prefix="/api", tags=["dashboard"])


# --------------------------- Helpers ---------------------------

def _parse_iso(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        # SQLite gives us "2026-07-13T12:34:56.789012Z"
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _metric(value: float, label: str, unit: str = "%") -> Dict[str, Any]:
    """Build a Metric dict for the dashboard summary."""
    return {
        "label": label,
        "value": int(round(value)),
        "unit": unit,
        "change": 0.0,
        "trend": "flat",
    }


def _aggregate_score(rows: List[sqlite3.Row], key: str) -> float:
    vals = []
    for r in rows:
        metrics = json.loads(r["metrics_json"]) if r["metrics_json"] else {}
        v = metrics.get(key)
        if isinstance(v, (int, float)):
            vals.append(v)
    return sum(vals) / len(vals) if vals else 0.0


def _user_achievements(rows: List[sqlite3.Row], streak: int) -> List[Dict[str, Any]]:
    session_count = len(rows)
    grammar_scores = [json.loads(r["metrics_json"]).get("confidenceScore", 0) for r in rows if r["metrics_json"]]
    max_grammar = max(grammar_scores) if grammar_scores else 0

    return [
        {
            "id": "a1",
            "title": "First Words",
            "description": "Complete your first session",
            "icon": "spark",
            "unlocked": session_count >= 1,
            "progress": 100 if session_count >= 1 else 0,
        },
        {
            "id": "a2",
            "title": "Week Warrior",
            "description": "7-day streak",
            "icon": "flame",
            "unlocked": streak >= 7,
            "progress": min(100, int((streak / 7) * 100)),
        },
        {
            "id": "a3",
            "title": "Grammar Guru",
            "description": "90%+ grammar score",
            "icon": "wand",
            "unlocked": max_grammar >= 90,
            "progress": min(100, int((max_grammar / 90) * 100)) if max_grammar > 0 else 0,
        },
        {
            "id": "a4",
            "title": "Chatterbox",
            "description": "20 sessions",
            "icon": "mic",
            "unlocked": session_count >= 20,
            "progress": min(100, int((session_count / 20) * 100)),
        },
    ]


# --------------------------- Routes ---------------------------

@router.get("/dashboard")
def get_dashboard(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_start = now - timedelta(days=now.weekday(), hours=now.hour, minutes=now.minute, seconds=now.second, microseconds=now.microsecond)

    rows = conn.execute(
        """
        SELECT id, session_type, original_text, corrected_text,
               metrics_json, language_alert, started_at, ended_at
        FROM practice_sessions
        WHERE user_id = ?
        ORDER BY started_at DESC
        """,
        (user["id"],),
    ).fetchall()

    # Today
    today_rows = [r for r in rows if (d := _parse_iso(r["started_at"])) and d >= day_ago]
    today_minutes = 0
    for r in today_rows:
        started = _parse_iso(r["started_at"])
        ended = _parse_iso(r["ended_at"]) or now
        if started:
            today_minutes += int((ended - started).total_seconds() // 60)
    if not today_minutes and today_rows:
        words = 0
        for r in today_rows:
            metrics = json.loads(r["metrics_json"]) if r["metrics_json"] else {}
            words += int(metrics.get("wordsSpoken", 0) or 0)
        today_minutes = max(0, words // 3)

    # Streak: consecutive days back from today that have at least one session
    days_with_sessions = {_parse_iso(r["started_at"]).date() for r in rows if _parse_iso(r["started_at"])}
    streak = 0
    cursor = now.date()
    while cursor in days_with_sessions:
        streak += 1
        cursor = cursor - timedelta(days=1)

    # Weekly goal progress
    week_sessions = [r for r in rows if (d := _parse_iso(r["started_at"])) and d >= week_start]
    distinct_days = {(_parse_iso(r["started_at"]).date()) for r in week_sessions if _parse_iso(r["started_at"])}
    weekly_completed = min(7, len(distinct_days))

    # Aggregated metrics
    grammar = _aggregate_score(rows, "confidenceScore") if rows else 0.0
    confidence = _aggregate_score(rows, "confidenceScore") if rows else 0.0
    fluency = _aggregate_score(rows, "confidenceScore") if rows else 0.0
    pronunciation = _aggregate_score(rows, "pronunciationScore") if rows else 0.0
    pace_vals = [json.loads(r["metrics_json"]).get("speakingPaceWpm", 0) for r in rows if r["metrics_json"]]
    pace_avg = sum(pace_vals) / len(pace_vals) if pace_vals else 0
    vocab = 0

    recent = []
    for r in rows[:3]:
        metrics = json.loads(r["metrics_json"]) if r["metrics_json"] else {}
        recent.append({
            "id": r["id"],
            "type": r["session_type"],
            "title": r["session_type"].replace("_", " ").title(),
            "durationSeconds": int(metrics.get("durationSeconds", 0) or 0),
            "score": int(metrics.get("confidenceScore", 0) or 0),
            "createdAt": r["started_at"],
        })

    return {
        "todayPracticeMinutes": today_minutes,
        "todayPracticeGoalMinutes": 30,
        "grammarScore": _metric(grammar, "Grammar"),
        "confidence": _metric(confidence, "Confidence"),
        "fluency": _metric(fluency, "Fluency"),
        "pronunciation": _metric(pronunciation, "Pronunciation"),
        "vocabulary": {**_metric(vocab, "Vocabulary"), "unit": ""},
        "speakingPace": {**_metric(pace_avg, "Speaking pace", " wpm"), "value": int(round(pace_avg))},
        "currentStreak": streak,
        "weeklyGoal": {"completed": weekly_completed, "total": 7},
        "achievements": _user_achievements(rows, streak),
        "recentSessions": recent,
    }



@router.get("/dashboard/sessions")
def get_dashboard_sessions(
    limit: int = Query(default=10, ge=1, le=100),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, session_type, original_text, corrected_text,
               metrics_json, language_alert, started_at, ended_at
        FROM practice_sessions
        WHERE user_id = ?
        ORDER BY started_at DESC
        LIMIT ?
        """,
        (user["id"], limit),
    ).fetchall()

    out = []
    for r in rows:
        metrics = json.loads(r["metrics_json"]) if r["metrics_json"] else {}
        out.append({
            "id": r["id"],
            "type": r["session_type"],
            "title": r["session_type"].replace("_", " ").title(),
            "durationSeconds": 0,
            "score": int(metrics.get("confidenceScore", 0) or 0),
            "createdAt": r["started_at"],
        })
    return out
