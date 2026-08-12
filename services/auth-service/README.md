# PitchPilot authentication service

Small FastAPI service for email/password signup and login. Passwords are salted and
hashed with scrypt, while authenticated sessions use opaque tokens stored as hashes
in SQLite and delivered through HTTP-only, SameSite cookies.

## Local setup

```powershell
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8082
```

Copy `.env.example` values into your environment when you need to override the local
defaults. Set `AUTH_COOKIE_SECURE=true` in production. If the frontend and API are
hosted on different sites, also set `AUTH_COOKIE_SAMESITE=none`; keep the default
`lax` value when they share the same site.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
