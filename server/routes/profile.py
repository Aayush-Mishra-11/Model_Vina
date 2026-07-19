"""Profile routes: GET/PUT /profile, /profile/certificates, and /profile/stats."""

import sqlite3
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

try:
    from server.db import get_db
    from server.deps import get_current_user
    from server.routes.auth import _user_to_dict
except (ImportError, ModuleNotFoundError):
    from db import get_db
    from deps import get_current_user
    from routes.auth import _user_to_dict

router = APIRouter(prefix="/api/profile", tags=["profile"])

class UpdateProfileRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    avatarUrl: str | None = None

@router.get("")
def get_profile(user: sqlite3.Row = Depends(get_current_user)) -> Dict[str, Any]:
    return _user_to_dict(user)

@router.put("")
def update_profile(
    payload: UpdateProfileRequest,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    name = payload.name.strip() if payload.name else user["name"]
    email = payload.email.strip().lower() if payload.email else user["email"]
    
    if payload.email and email != user["email"]:
        # Check uniqueness
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")
            
    conn.execute(
        "UPDATE users SET name = ?, email = ? WHERE id = ?",
        (name, email, user["id"])
    )
    
    updated_user = conn.execute(
        "SELECT id, name, email, plan, created_at FROM users WHERE id = ?",
        (user["id"],)
    ).fetchone()
    return _user_to_dict(updated_user)

@router.get("/certificates")
def get_certificates(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> List[Dict[str, Any]]:
    # Generate certificates based on sessions with high scores
    sessions = conn.execute(
        """
        SELECT id, session_type, metrics_json, started_at
        FROM practice_sessions
        WHERE user_id = ?
        ORDER BY started_at DESC
        """,
        (user["id"],)
    ).fetchall()
    
    certs = []
    has_foundations = False
    has_interview = False
    
    for s in sessions:
        metrics = json.loads(s["metrics_json"]) if s["metrics_json"] else {}
        score = int(metrics.get("confidenceScore" if "confidenceScore" in metrics else "score", 0) or 0)
        
        if score >= 80 and not has_foundations:
            certs.append({
                "id": "c_foundations_" + s["id"][:6],
                "title": "Communication Foundations",
                "issuedAt": s["started_at"],
                "score": score
            })
            has_foundations = True
            
        if s["session_type"] == "mock_interview" and score >= 80 and not has_interview:
            certs.append({
                "id": "c_interview_" + s["id"][:6],
                "title": "Interview Ready",
                "issuedAt": s["started_at"],
                "score": score
            })
            has_interview = True
            
    # Default cert if they have at least one session
    if not certs and len(sessions) > 0:
        certs.append({
            "id": "c_welcome",
            "title": "Practice Starter",
            "issuedAt": sessions[-1]["started_at"],
            "score": 50
        })
        
    return certs

@router.get("/stats")
def get_profile_stats(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    sessions = conn.execute(
        "SELECT metrics_json, started_at FROM practice_sessions WHERE user_id = ?",
        (user["id"],)
    ).fetchall()
    
    total_sessions = len(sessions)
    total_minutes = 0
    total_score = 0
    
    for s in sessions:
        metrics = json.loads(s["metrics_json"]) if s["metrics_json"] else {}
        # compute actual duration or fallback to word-based estimate
        dur = int(metrics.get("durationSeconds", 0) or 0)
        if dur == 0:
            words = int(metrics.get("wordsSpoken", 0) or 0)
            dur = words // 3
        total_minutes += max(0, dur // 60)
        total_score += int(metrics.get("confidenceScore", 0) or 0)
        
    average_score = round(total_score / total_sessions) if total_sessions > 0 else 0
    
    # Calculate streak
    days = set()
    for s in sessions:
        try:
            dt = datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))
            days.add(dt.date())
        except ValueError:
            pass
            
    longest_streak = 0
    current_streak = 0
    sorted_days = sorted(list(days), reverse=True)
    
    if sorted_days:
        # check consecutive days starting from today/yesterday
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        
        # calculate current streak
        streak_day = today
        if sorted_days[0] == today or sorted_days[0] == yesterday:
            streak_day = sorted_days[0]
            current_streak = 1
            idx = 1
            while idx < len(sorted_days):
                if sorted_days[idx] == streak_day - timedelta(days=1):
                    current_streak += 1
                    streak_day = sorted_days[idx]
                    idx += 1
                else:
                    break
        
        # calculate longest streak
        # let's do a simple scan
        all_sorted = sorted(list(days))
        temp_streak = 0
        prev_day = None
        for d in all_sorted:
            if prev_day is None:
                temp_streak = 1
            elif d == prev_day + timedelta(days=1):
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
            prev_day = d
        longest_streak = max(longest_streak, temp_streak)
        
    # Bookmarks count
    bookmarks_count = conn.execute(
        "SELECT COUNT(*) FROM user_vocabulary_bookmarks WHERE user_id = ?",
        (user["id"],)
    ).fetchone()[0]
    
    return {
        "totalSessions": total_sessions,
        "totalMinutes": total_minutes if total_sessions > 0 else 0,
        "averageScore": average_score if total_sessions > 0 else 0,
        "longestStreak": max(longest_streak, current_streak) if total_sessions > 0 else 0,
        "wordsLearned": bookmarks_count * 5 if bookmarks_count > 0 else 0,
    }

