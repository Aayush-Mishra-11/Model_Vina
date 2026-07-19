"""FastAPI dependencies, most notably `get_current_user`."""

import sqlite3
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from . import auth as auth_utils
from .db import get_db


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    conn: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    """Resolve the bearer token to a user row. 401 if missing/invalid."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    payload = auth_utils.decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = conn.execute(
        "SELECT id, name, email, plan, created_at FROM users WHERE id = ?",
        (payload["sub"],),
    ).fetchone()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    conn: sqlite3.Connection = Depends(get_db),
) -> Optional[sqlite3.Row]:
    """Like `get_current_user` but returns None instead of raising for unauthenticated calls."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = auth_utils.decode_token(token)
    if not payload or "sub" not in payload:
        return None
    return conn.execute(
        "SELECT id, name, email, plan, created_at FROM users WHERE id = ?",
        (payload["sub"],),
    ).fetchone()
