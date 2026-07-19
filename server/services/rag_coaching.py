"""Coaching stub (RAG disabled for performance optimization)."""

from typing import Any, Dict, List, Optional

def is_available() -> bool:
    return False

def last_init_error() -> Optional[str]:
    return None

def store_session(
    user_id: str,
    session_id: str,
    session_type: str,
    transcript: str,
    corrected: str,
    metrics: Dict[str, Any],
    created_at: str,
) -> bool:
    return True

def similar_sessions(
    user_id: str,
    transcript: str,
    k: int = 3,
) -> List[Dict[str, Any]]:
    return []

def coaching_context(
    user_id: str,
    transcript: str,
    k: int = 3,
    max_chars: int = 2000,
) -> str:
    return ""
