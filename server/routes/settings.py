"""Settings routes: GET/PUT /settings."""

import sqlite3
import json
from typing import Any, Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..db import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])

class NotificationSettings(BaseModel):
    practiceReminders: bool
    weeklyReport: bool
    achievements: bool
    sound: bool

class UpdateSettingsRequest(BaseModel):
    language: str | None = None
    notifications: NotificationSettings | None = None
    englishOnlyMode: bool | None = None
    selectedVoice: str | None = None

def _get_or_create_settings(user_id: str, conn: sqlite3.Connection) -> Dict[str, Any]:
    row = conn.execute(
        "SELECT language, notifications_json, english_only_mode, selected_voice FROM user_settings WHERE user_id = ?",
        (user_id,)
    ).fetchone()
    
    if not row:
        default_notifs = {
            "practiceReminders": True,
            "weeklyReport": True,
            "achievements": True,
            "sound": True
        }
        conn.execute(
            """
            INSERT INTO user_settings (user_id, language, notifications_json, english_only_mode, selected_voice)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, "en-US", json.dumps(default_notifs), 1, "aria")
        )
        return {
            "language": "en-US",
            "notifications": default_notifs,
            "englishOnlyMode": True,
            "selectedVoice": "aria"
        }
        
    return {
        "language": row["language"],
        "notifications": json.loads(row["notifications_json"]),
        "englishOnlyMode": bool(row["english_only_mode"]),
        "selectedVoice": row["selected_voice"]
    }

@router.get("")
def get_settings(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    return _get_or_create_settings(user["id"], conn)

@router.put("")
def update_settings(
    payload: UpdateSettingsRequest,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, str]:
    # Make sure settings record exists
    _get_or_create_settings(user["id"], conn)
    
    if payload.language is not None:
        conn.execute("UPDATE user_settings SET language = ? WHERE user_id = ?", (payload.language, user["id"]))
        
    if payload.englishOnlyMode is not None:
        conn.execute("UPDATE user_settings SET english_only_mode = ? WHERE user_id = ?", (int(payload.englishOnlyMode), user["id"]))
        
    if payload.selectedVoice is not None:
        conn.execute("UPDATE user_settings SET selected_voice = ? WHERE user_id = ?", (payload.selectedVoice, user["id"]))
        
    if payload.notifications is not None:
        notifs_dict = {
            "practiceReminders": payload.notifications.practiceReminders,
            "weeklyReport": payload.notifications.weeklyReport,
            "achievements": payload.notifications.achievements,
            "sound": payload.notifications.sound
        }
        conn.execute("UPDATE user_settings SET notifications_json = ? WHERE user_id = ?", (json.dumps(notifs_dict), user["id"]))
        
    return {"message": "Settings updated successfully."}
