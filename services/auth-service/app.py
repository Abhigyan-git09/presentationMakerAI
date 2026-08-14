from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
COMMON_PASSWORDS = {
    "123456789012345",
    "letmeinletmein",
    "passwordpassword",
    "qwertyqwertyqwerty",
    "welcome123456789",
}
PASSWORD_SCHEME = "scrypt-v1"
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_FAILURE_LIMIT = 5
LOGIN_BLOCK_SECONDS = 15 * 60
MAX_PRESENTATION_BYTES = 1_500_000
MAX_PRESENTATIONS_PER_USER = 50


def _normalise_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("Enter a valid email address")
    return email


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=15, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if len(name) < 2:
            raise ValueError("Name must contain at least 2 characters")
        return name

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalise_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if value.casefold() in COMMON_PASSWORDS:
            raise ValueError("Choose a less common password")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalise_email(value)


class PresentationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    presentation: dict[str, Any]

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if not name:
            raise ValueError("Presentation name is required")
        return name

    @field_validator("presentation")
    @classmethod
    def validate_presentation(cls, value: dict[str, Any]) -> dict[str, Any]:
        slides = value.get("slides")
        if not isinstance(slides, list) or not slides:
            raise ValueError("A saved presentation must contain at least one slide")
        if len(slides) > 50:
            raise ValueError("A saved presentation cannot contain more than 50 slides")
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(encoded) > MAX_PRESENTATION_BYTES:
            raise ValueError("Presentation is too large to save")
        return value


class RenamePresentationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if not name:
            raise ValueError("Presentation name is required")
        return name


class AuthDatabase:
    def __init__(self, database_path: str):
        self.database_path = database_path

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialise(self) -> None:
        database_file = Path(self.database_path)
        if self.database_path != ":memory:":
            database_file.parent.mkdir(parents=True, exist_ok=True)

        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    password_scheme TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS sessions_user_id_index
                    ON sessions(user_id);
                CREATE INDEX IF NOT EXISTS sessions_expires_at_index
                    ON sessions(expires_at);

                CREATE TABLE IF NOT EXISTS login_attempts (
                    email TEXT PRIMARY KEY,
                    window_started_at INTEGER NOT NULL,
                    failure_count INTEGER NOT NULL,
                    blocked_until INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS saved_presentations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    presentation_json TEXT NOT NULL,
                    slide_count INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS saved_presentations_user_updated_index
                    ON saved_presentations(user_id, updated_at DESC);
                """
            )


def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    password_salt = salt or secrets.token_bytes(16)
    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=password_salt,
        n=2**14,
        r=8,
        p=1,
        dklen=64,
    )
    return (
        base64.b64encode(password_hash).decode("ascii"),
        base64.b64encode(password_salt).decode("ascii"),
    )


def _verify_password(password: str, stored_hash: str, stored_salt: str) -> bool:
    candidate_hash, _ = _hash_password(
        password,
        base64.b64decode(stored_salt.encode("ascii")),
    )
    return hmac.compare_digest(candidate_hash, stored_hash)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _public_user(row: sqlite3.Row) -> dict[str, str]:
    return {"id": row["id"], "email": row["email"], "name": row["name"]}


def _presentation_summary(row: sqlite3.Row) -> dict[str, Any]:
    presentation = json.loads(row["presentation_json"])
    slides = presentation.get("slides") or []
    first_slide = slides[0] if slides else {}
    return {
        "id": row["id"],
        "name": row["name"],
        "title": presentation.get("title") or row["name"],
        "topic": presentation.get("topic") or presentation.get("title") or row["name"],
        "slideCount": row["slide_count"],
        "firstSlideTitle": first_slide.get("title") or "Untitled slide",
        "preferences": presentation.get("preferences") or {},
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _saved_presentation(row: sqlite3.Row) -> dict[str, Any]:
    return {
        **_presentation_summary(row),
        "presentation": json.loads(row["presentation_json"]),
    }


def _create_session(
    connection: sqlite3.Connection,
    user_id: str,
    session_ttl_seconds: int,
) -> str:
    now = int(time.time())
    token = secrets.token_urlsafe(48)
    connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    connection.execute(
        """
        INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (_token_hash(token), user_id, now, now + session_ttl_seconds),
    )
    return token


def _login_is_blocked(connection: sqlite3.Connection, email: str, now: int) -> bool:
    attempt = connection.execute(
        "SELECT blocked_until FROM login_attempts WHERE email = ?", (email,)
    ).fetchone()
    return bool(attempt and attempt["blocked_until"] > now)


def _record_login_failure(connection: sqlite3.Connection, email: str, now: int) -> None:
    attempt = connection.execute(
        """
        SELECT window_started_at, failure_count
        FROM login_attempts
        WHERE email = ?
        """,
        (email,),
    ).fetchone()

    if not attempt or now - attempt["window_started_at"] >= LOGIN_WINDOW_SECONDS:
        window_started_at = now
        failure_count = 1
    else:
        window_started_at = attempt["window_started_at"]
        failure_count = attempt["failure_count"] + 1

    blocked_until = now + LOGIN_BLOCK_SECONDS if failure_count >= LOGIN_FAILURE_LIMIT else 0
    connection.execute(
        """
        INSERT INTO login_attempts (email, window_started_at, failure_count, blocked_until)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
            window_started_at = excluded.window_started_at,
            failure_count = excluded.failure_count,
            blocked_until = excluded.blocked_until
        """,
        (email, window_started_at, failure_count, blocked_until),
    )


def _set_session_cookie(
    response: Response,
    cookie_name: str,
    token: str,
    cookie_secure: bool,
    cookie_samesite: str,
) -> None:
    response.set_cookie(
        key=cookie_name,
        value=token,
        httponly=True,
        secure=cookie_secure,
        samesite=cookie_samesite,
        path="/",
    )


def create_app(
    *,
    database_path: str | None = None,
    allowed_origins: list[str] | None = None,
    cookie_secure: bool | None = None,
    cookie_samesite: str | None = None,
) -> FastAPI:
    resolved_database_path = database_path or os.getenv("AUTH_DATABASE_PATH", "auth.db")
    resolved_origins = allowed_origins or [
        origin.strip()
        for origin in os.getenv(
            "AUTH_ALLOWED_ORIGINS",
            "http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ]
    resolved_cookie_secure = (
        cookie_secure
        if cookie_secure is not None
        else os.getenv("AUTH_COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
    )
    resolved_cookie_samesite = (
        cookie_samesite or os.getenv("AUTH_COOKIE_SAMESITE", "lax")
    ).lower()
    if resolved_cookie_samesite not in {"lax", "strict", "none"}:
        raise ValueError("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
    if resolved_cookie_samesite == "none" and not resolved_cookie_secure:
        raise ValueError("AUTH_COOKIE_SAMESITE=none requires AUTH_COOKIE_SECURE=true")
    cookie_name = os.getenv("AUTH_COOKIE_NAME", "pitchpilot_session")
    session_ttl_seconds = int(os.getenv("AUTH_SESSION_TTL_HOURS", "24")) * 60 * 60
    database = AuthDatabase(resolved_database_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        database.initialise()
        yield

    auth_app = FastAPI(title="PitchPilot authentication service", lifespan=lifespan)
    auth_app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @auth_app.middleware("http")
    async def prevent_auth_caching(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(("/auth", "/library")):
            response.headers["Cache-Control"] = "no-store"
        return response

    def require_user(request: Request) -> dict[str, str]:
        token = request.cookies.get(cookie_name)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        token_digest = _token_hash(token)
        now = int(time.time())
        with database.connect() as connection:
            user = connection.execute(
                """
                SELECT users.id, users.email, users.name
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
                """,
                (token_digest, now),
            ).fetchone()
            if not user:
                connection.execute(
                    "DELETE FROM sessions WHERE token_hash = ?", (token_digest,)
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

        return _public_user(user)

    @auth_app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @auth_app.post("/auth/signup", status_code=status.HTTP_201_CREATED)
    def signup(payload: SignupRequest, response: Response) -> dict[str, object]:
        password_hash, password_salt = _hash_password(payload.password)
        user_id = str(uuid.uuid4())
        now = int(time.time())

        with database.connect() as connection:
            try:
                connection.execute(
                    """
                    INSERT INTO users (
                        id, email, name, password_hash, password_salt,
                        password_scheme, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        payload.email,
                        payload.name,
                        password_hash,
                        password_salt,
                        PASSWORD_SCHEME,
                        now,
                    ),
                )
                token = _create_session(connection, user_id, session_ttl_seconds)
            except sqlite3.IntegrityError as error:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists",
                ) from error

        _set_session_cookie(
            response,
            cookie_name,
            token,
            resolved_cookie_secure,
            resolved_cookie_samesite,
        )
        return {"user": {"id": user_id, "email": payload.email, "name": payload.name}}

    @auth_app.post("/auth/login")
    def login(payload: LoginRequest, response: Response) -> dict[str, object]:
        now = int(time.time())
        with database.connect() as connection:
            if _login_is_blocked(connection, payload.email, now):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Try again later.",
                )

            user = connection.execute(
                "SELECT * FROM users WHERE email = ?", (payload.email,)
            ).fetchone()
            if user:
                password_matches = _verify_password(
                    payload.password,
                    user["password_hash"],
                    user["password_salt"],
                )
            else:
                # Keep unknown-account requests close to the normal password-check timing.
                _hash_password(payload.password, b"pitchpilot-dummy")
                password_matches = False

            if not user or not password_matches:
                _record_login_failure(connection, payload.email, now)
                # Persist throttling state before returning the authentication error.
                connection.commit()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                )

            connection.execute("DELETE FROM login_attempts WHERE email = ?", (payload.email,))
            token = _create_session(connection, user["id"], session_ttl_seconds)

        _set_session_cookie(
            response,
            cookie_name,
            token,
            resolved_cookie_secure,
            resolved_cookie_samesite,
        )
        return {"user": _public_user(user)}

    @auth_app.get("/auth/me")
    def me(request: Request) -> dict[str, object]:
        return {"user": require_user(request)}

    @auth_app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
    def logout(request: Request, response: Response) -> Response:
        token = request.cookies.get(cookie_name)
        if token:
            with database.connect() as connection:
                connection.execute(
                    "DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),)
                )
        response.delete_cookie(
            key=cookie_name,
            httponly=True,
            secure=resolved_cookie_secure,
            samesite=resolved_cookie_samesite,
            path="/",
        )
        response.status_code = status.HTTP_204_NO_CONTENT
        return response

    @auth_app.get("/library")
    def list_saved_presentations(request: Request) -> dict[str, object]:
        user = require_user(request)
        with database.connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM saved_presentations
                WHERE user_id = ?
                ORDER BY updated_at DESC, created_at DESC
                """,
                (user["id"],),
            ).fetchall()
        return {"presentations": [_presentation_summary(row) for row in rows]}

    @auth_app.get("/library/{presentation_id}")
    def get_saved_presentation(
        presentation_id: str,
        request: Request,
    ) -> dict[str, object]:
        user = require_user(request)
        with database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM saved_presentations WHERE id = ? AND user_id = ?",
                (presentation_id, user["id"]),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")
        return {"presentation": _saved_presentation(row)}

    @auth_app.post("/library", status_code=status.HTTP_201_CREATED)
    def create_saved_presentation(
        payload: PresentationRequest,
        request: Request,
    ) -> dict[str, object]:
        user = require_user(request)
        presentation_id = str(uuid.uuid4())
        now = int(time.time())
        presentation_json = json.dumps(
            payload.presentation,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        with database.connect() as connection:
            saved_count = connection.execute(
                "SELECT COUNT(*) FROM saved_presentations WHERE user_id = ?",
                (user["id"],),
            ).fetchone()[0]
            if saved_count >= MAX_PRESENTATIONS_PER_USER:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Library limit reached ({MAX_PRESENTATIONS_PER_USER} presentations)",
                )
            connection.execute(
                """
                INSERT INTO saved_presentations (
                    id, user_id, name, presentation_json, slide_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    presentation_id,
                    user["id"],
                    payload.name,
                    presentation_json,
                    len(payload.presentation["slides"]),
                    now,
                    now,
                ),
            )
            row = connection.execute(
                "SELECT * FROM saved_presentations WHERE id = ?",
                (presentation_id,),
            ).fetchone()
        return {"presentation": _saved_presentation(row)}

    @auth_app.put("/library/{presentation_id}")
    def update_saved_presentation(
        presentation_id: str,
        payload: PresentationRequest,
        request: Request,
    ) -> dict[str, object]:
        user = require_user(request)
        now = int(time.time())
        presentation_json = json.dumps(
            payload.presentation,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        with database.connect() as connection:
            result = connection.execute(
                """
                UPDATE saved_presentations
                SET name = ?, presentation_json = ?, slide_count = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (
                    payload.name,
                    presentation_json,
                    len(payload.presentation["slides"]),
                    now,
                    presentation_id,
                    user["id"],
                ),
            )
            if not result.rowcount:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Presentation not found",
                )
            row = connection.execute(
                "SELECT * FROM saved_presentations WHERE id = ?",
                (presentation_id,),
            ).fetchone()
        return {"presentation": _saved_presentation(row)}

    @auth_app.patch("/library/{presentation_id}")
    def rename_saved_presentation(
        presentation_id: str,
        payload: RenamePresentationRequest,
        request: Request,
    ) -> dict[str, object]:
        user = require_user(request)
        now = int(time.time())
        with database.connect() as connection:
            result = connection.execute(
                """
                UPDATE saved_presentations
                SET name = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
                """,
                (payload.name, now, presentation_id, user["id"]),
            )
            if not result.rowcount:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Presentation not found",
                )
            row = connection.execute(
                "SELECT * FROM saved_presentations WHERE id = ?",
                (presentation_id,),
            ).fetchone()
        return {"presentation": _presentation_summary(row)}

    @auth_app.delete("/library/{presentation_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_saved_presentation(
        presentation_id: str,
        request: Request,
        response: Response,
    ) -> Response:
        user = require_user(request)
        with database.connect() as connection:
            result = connection.execute(
                "DELETE FROM saved_presentations WHERE id = ? AND user_id = ?",
                (presentation_id, user["id"]),
            )
            if not result.rowcount:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Presentation not found",
                )
        response.status_code = status.HTTP_204_NO_CONTENT
        return response

    return auth_app


app = create_app()
