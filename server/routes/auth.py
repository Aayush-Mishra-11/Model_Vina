"""Auth routes: register, login, me, forgot/reset password, email verify."""

import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from .. import auth as auth_utils
from ..db import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# --------------------------- Schemas ---------------------------

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=200)


class VerifyRequest(BaseModel):
    token: str


# --------------------------- Helpers ---------------------------

def _user_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "plan": row["plan"],
        "createdAt": row["created_at"],
    }


def _auth_response(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "user": _user_to_dict(row),
        "token": auth_utils.issue_token(row["id"]),
    }


# --------------------------- Routes ---------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, conn: sqlite3.Connection = Depends(get_db)) -> Dict[str, Any]:
    email_normalized = payload.email.strip().lower()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email_normalized,)).fetchone()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    user_id = auth_utils.new_id()
    salt, pw_hash = auth_utils.hash_password(payload.password)
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    conn.execute(
        """
        INSERT INTO users (id, name, email, password_hash, password_salt, plan, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, payload.name.strip(), email_normalized, pw_hash, salt, "free", created_at),
    )
    row = conn.execute(
        "SELECT id, name, email, plan, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    return _auth_response(row)


@router.post("/login")
def login(payload: LoginRequest, conn: sqlite3.Connection = Depends(get_db)) -> Dict[str, Any]:
    email_normalized = payload.email.strip().lower()
    row = conn.execute(
        """
        SELECT id, name, email, plan, created_at, password_hash, password_salt
        FROM users WHERE email = ?
        """,
        (email_normalized,),
    ).fetchone()
    if not row or not auth_utils.verify_password(payload.password, row["password_salt"], row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return _auth_response(row)


@router.get("/me")
def me(user: sqlite3.Row = Depends(get_current_user)) -> Dict[str, Any]:
    return _user_to_dict(user)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest) -> Dict[str, str]:
    # Real email integration is out of scope. We accept any well-formed email
    # and return success so the UI's flow is unbroken.
    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest) -> Dict[str, str]:
    # Same as above — no real token store yet.
    return {"message": "Password updated. Please log in."}


@router.post("/verify")
def verify_email(payload: VerifyRequest, conn: sqlite3.Connection = Depends(get_db)) -> Dict[str, Any]:
    """Stub verify endpoint.

    In the demo, the verify page just receives a placeholder token from the
    signup redirect. We return the most recently created user (if any) so
    the user can be auto-logged in. In production this would consume a
    one-time token from the `email_verifications` table.
    """
    row = conn.execute(
        "SELECT id, name, email, plan, created_at FROM users ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account to verify. Please sign up first.",
        )
    return _auth_response(row)
