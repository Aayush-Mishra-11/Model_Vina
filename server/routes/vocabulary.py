"""Vocabulary routes: word-of-day, list, bookmark, and bookmarks."""

import sqlite3
import json
import random
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from ..db import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])

class BookmarkRequest(BaseModel):
    wordId: str

def _row_to_word(row: sqlite3.Row, user_id: str, conn: sqlite3.Connection) -> Dict[str, Any]:
    # Check if bookmarked by this user
    bookmarked = conn.execute(
        "SELECT 1 FROM user_vocabulary_bookmarks WHERE user_id = ? AND word_id = ?",
        (user_id, row["id"])
    ).fetchone() is not None
    
    return {
        "id": row["id"],
        "word": row["word"],
        "phonetic": row["phonetic"] or "",
        "meaning": row["meaning"] or "",
        "synonyms": json.loads(row["synonyms_json"]) if row["synonyms_json"] else [],
        "antonyms": json.loads(row["antonyms_json"]) if row["antonyms_json"] else [],
        "examples": json.loads(row["examples_json"]) if row["examples_json"] else [],
        "bookmarked": bookmarked
    }

@router.get("/word-of-day")
def get_word_of_day(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    rows = conn.execute("SELECT id, word, phonetic, meaning, synonyms_json, antonyms_json, examples_json FROM vocabulary_words").fetchall()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No words found.")
    
    # Select word of day based on date to keep it consistent throughout the day
    from datetime import datetime, timezone
    day_of_year = datetime.now(timezone.utc).timetuple().tm_yday
    word_row = rows[day_of_year % len(rows)]
    return _row_to_word(word_row, user["id"], conn)

@router.get("/words")
def list_words(
    limit: int = Query(default=20, ge=1, le=100),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> List[Dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, word, phonetic, meaning, synonyms_json, antonyms_json, examples_json FROM vocabulary_words LIMIT ?",
        (limit,)
    ).fetchall()
    return [_row_to_word(r, user["id"], conn) for r in rows]

@router.post("/bookmark")
def toggle_bookmark(
    payload: BookmarkRequest,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, bool]:
    # Check if word exists
    word = conn.execute("SELECT id FROM vocabulary_words WHERE id = ?", (payload.wordId,)).fetchone()
    if not word:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found.")
        
    existing = conn.execute(
        "SELECT 1 FROM user_vocabulary_bookmarks WHERE user_id = ? AND word_id = ?",
        (user["id"], payload.wordId)
    ).fetchone()
    
    if existing:
        conn.execute(
            "DELETE FROM user_vocabulary_bookmarks WHERE user_id = ? AND word_id = ?",
            (user["id"], payload.wordId)
        )
        return {"bookmarked": False}
    else:
        conn.execute(
            "INSERT INTO user_vocabulary_bookmarks (user_id, word_id) VALUES (?, ?)",
            (user["id"], payload.wordId)
        )
        return {"bookmarked": True}

@router.get("/bookmarks")
def get_bookmarks(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT w.id, w.word, w.phonetic, w.meaning, w.synonyms_json, w.antonyms_json, w.examples_json
        FROM vocabulary_words w
        JOIN user_vocabulary_bookmarks b ON w.id = b.word_id
        WHERE b.user_id = ?
        """,
        (user["id"],)
    ).fetchall()
    return [_row_to_word(r, user["id"], conn) for r in rows]
