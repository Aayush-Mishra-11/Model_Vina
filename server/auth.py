"""Password hashing and JWT helpers (stdlib + pyjwt).

Passwords are hashed with PBKDF2-HMAC-SHA256 (200,000 iterations) using a
per-user 16-byte salt. No external crypto deps are required beyond pyjwt,
which is already in `requirements.txt`.
"""

import hashlib
import hmac
import os
import secrets
import time
import uuid
from typing import Any, Dict, Optional

import jwt
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-insecure-secret-change-me")
JWT_ALG = "HS256"
JWT_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days

PBKDF2_ITERATIONS = 200_000
PBKDF2_ALGO = "sha256"
SALT_BYTES = 16


# --------------------------- Passwords ---------------------------

def hash_password(password: str) -> tuple[str, str]:
    """Return (salt_hex, hash_hex) for the given plaintext password."""
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(PBKDF2_ALGO, password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return salt.hex(), digest.hex()


def verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    """Constant-time comparison of a password against a stored salt+hash."""
    try:
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hash_hex)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac(PBKDF2_ALGO, password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(digest, expected)


# --------------------------- JWT ---------------------------

def issue_token(user_id: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None


# --------------------------- Misc ---------------------------

def new_id() -> str:
    return uuid.uuid4().hex
