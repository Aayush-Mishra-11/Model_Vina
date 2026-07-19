"""SQLite database helper for the ConviAI backend.

A single connection per request is created via `get_db()` (a FastAPI dependency).
The connection uses the stdlib `sqlite3` module, which is part of the Python
standard library — no extra dependencies. The DB file lives next to this module.
"""

import os
import sqlite3
from typing import Iterator

DB_PATH = os.path.join(os.path.dirname(__file__), "conviai.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency that yields a SQLite connection and closes it after use."""
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()
