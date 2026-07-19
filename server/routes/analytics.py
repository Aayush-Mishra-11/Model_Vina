"""Analytics routes: GET /analytics."""

import sqlite3
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..deps import get_current_user
from ..services.progress_predictor import predict_progress

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

def _parse_iso_date(ts: str) -> datetime:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)

@router.get("")
def get_analytics(
    range: str = Query(default="month"),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    # Fetch practice sessions of user
    rows = conn.execute(
        """
        SELECT metrics_json, started_at
        FROM practice_sessions
        WHERE user_id = ?
        ORDER BY started_at ASC
        """,
        (user["id"],)
    ).fetchall()
    
    real_count = len(rows)
    if real_count == 0:
        return {
            "timeline": [],
            "radar": [
                {"skill": "Grammar", "score": 0},
                {"skill": "Confidence", "score": 0},
                {"skill": "Pronunciation", "score": 0},
                {"skill": "Vocabulary", "score": 0},
                {"skill": "Fluency", "score": 0},
                {"skill": "Pace", "score": 0},
            ],
            "byCategory": [
                {"category": "Grammar", "value": 0},
                {"category": "Pronunciation", "value": 0},
                {"category": "Fluency", "value": 0},
                {"category": "Vocabulary", "value": 0},
            ],
            "speakingSpeed": [],
            "confidenceByWeek": [],
        }

    timeline = []
    speaking_speed = []
    tot_grammar = 0
    tot_confidence = 0
    tot_pron = 0
    tot_pace = 0

    for idx, r in enumerate(rows[-7:]):
        metrics = json.loads(r["metrics_json"]) if r["metrics_json"] else {}
        conf = int(metrics.get("confidenceScore", 0) or 0)
        pron = int(metrics.get("pronunciationScore", 0) or 0)
        pace = int(metrics.get("speakingPaceWpm", 0) or 0)

        tot_confidence += conf
        tot_pron += pron
        tot_pace += pace
        tot_grammar += min(99, conf + 3)

        day_name = _parse_iso_date(r["started_at"]).strftime("%a")
        point = {
            "label": f"{day_name} #{idx+1}",
            "grammar": min(98, conf + 4),
            "confidence": conf,
            "pronunciation": pron,
            "vocabulary": max(0, conf - 10),
            "fluency": max(0, conf - 5),
            "speakingSpeed": pace,
        }
        timeline.append(point)
        speaking_speed.append({
            "label": point["label"],
            "grammar": 0,
            "confidence": 0,
            "pronunciation": 0,
            "vocabulary": 0,
            "fluency": 0,
            "speakingSpeed": pace,
        })

    avg_confidence = round(tot_confidence / min(real_count, 7))
    avg_pron = round(tot_pron / min(real_count, 7))
    avg_grammar = round(tot_grammar / min(real_count, 7))
    avg_pace = round(tot_pace / min(real_count, 7))

    radar = [
        {"skill": "Grammar", "score": avg_grammar},
        {"skill": "Confidence", "score": avg_confidence},
        {"skill": "Pronunciation", "score": avg_pron},
        {"skill": "Vocabulary", "score": max(0, avg_confidence - 12)},
        {"skill": "Fluency", "score": max(0, avg_confidence - 6)},
        {"skill": "Pace", "score": round((avg_pace / 180) * 100)},
    ]

    by_category = [
        {"category": "Grammar", "value": avg_grammar},
        {"category": "Pronunciation", "value": avg_pron},
        {"category": "Fluency", "value": max(0, avg_confidence - 6)},
        {"category": "Vocabulary", "value": max(0, avg_confidence - 12)},
    ]

    confidence_by_week = [
        {"category": "Session Avg", "value": avg_confidence}
    ]

    return {
        "timeline": timeline,
        "radar": radar,
        "byCategory": by_category,
        "speakingSpeed": speaking_speed,
        "confidenceByWeek": confidence_by_week,
    }



@router.get("/predict")
def predict(
    targetScore: int = Query(default=80, ge=10, le=100),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> Dict[str, Any]:
    """Forecast where the user's confidence score is heading.

    Pulls the user's last 30 `confidenceScore` values from
    `practice_sessions`, fits a linear-regression trend, and projects
    forward 4 weeks. Also reports a CEFR mapping and a "B2 in N weeks"
    style ETA to the optional `targetScore` (default 80 = B2/C1).
    """
    rows = conn.execute(
        """
        SELECT metrics_json, started_at
        FROM practice_sessions
        WHERE user_id = ?
        ORDER BY started_at ASC
        """,
        (user["id"],),
    ).fetchall()

    scores: List[float] = []
    for r in rows[-30:]:
        try:
            metrics = json.loads(r["metrics_json"]) if r["metrics_json"] else {}
        except (TypeError, ValueError):
            metrics = {}
        score = metrics.get("confidenceScore")
        if score is None:
            continue
        try:
            scores.append(float(score))
        except (TypeError, ValueError):
            continue

    # Estimate the user's practice cadence: sessions per week, based on
    # the span between the first and last session.
    sessions_per_week = 3.0  # default assumption
    if len(rows) >= 2 and rows[0]["started_at"] and rows[-1]["started_at"]:
        try:
            first = datetime.fromisoformat(rows[0]["started_at"].replace("Z", "+00:00"))
            last = datetime.fromisoformat(rows[-1]["started_at"].replace("Z", "+00:00"))
            span_days = max(1.0, (last - first).total_seconds() / 86400.0)
            sessions_per_week = max(0.5, min(14.0, len(rows) * 7.0 / span_days))
        except ValueError:
            pass

    forecast = predict_progress(
        scores,
        target_score=float(targetScore),
        sessions_per_week=sessions_per_week,
        weeks_ahead=4,
    )
    return forecast.to_dict()
