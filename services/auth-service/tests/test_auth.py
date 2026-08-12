import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app

EMAIL = "person@example.com"
PASSWORD = "A-secure-test-passphrase"


def make_client(tmp_path: Path) -> TestClient:
    app = create_app(
        database_path=str(tmp_path / "auth.db"),
        allowed_origins=["http://testserver"],
        cookie_secure=False,
    )
    return TestClient(app)


def test_signup_me_logout_and_login(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        signup = client.post(
            "/auth/signup",
            json={"name": "Test Person", "email": EMAIL.upper(), "password": PASSWORD},
        )
        assert signup.status_code == 201
        assert signup.json()["user"]["email"] == EMAIL
        assert signup.headers["cache-control"] == "no-store"
        assert "HttpOnly" in signup.headers["set-cookie"]
        assert "SameSite=lax" in signup.headers["set-cookie"]

        current_user = client.get("/auth/me")
        assert current_user.status_code == 200
        assert current_user.json()["user"]["name"] == "Test Person"

        logout = client.post("/auth/logout")
        assert logout.status_code == 204
        assert client.get("/auth/me").status_code == 401

        login = client.post(
            "/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        assert login.status_code == 200
        assert login.json()["user"]["email"] == EMAIL
        assert client.get("/auth/me").status_code == 200


def test_duplicate_email_and_weak_password_are_rejected(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        payload = {"name": "Test Person", "email": EMAIL, "password": PASSWORD}
        assert client.post("/auth/signup", json=payload).status_code == 201
        duplicate = client.post("/auth/signup", json=payload)
        assert duplicate.status_code == 409

        weak = client.post(
            "/auth/signup",
            json={
                "name": "Another Person",
                "email": "another@example.com",
                "password": "short",
            },
        )
        assert weak.status_code == 422


def test_invalid_login_is_generic_and_rate_limited(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        for _ in range(5):
            response = client.post(
                "/auth/login",
                json={"email": "missing@example.com", "password": PASSWORD},
            )
            assert response.status_code == 401
            assert response.json()["detail"] == "Invalid email or password"

        blocked = client.post(
            "/auth/login",
            json={"email": "missing@example.com", "password": PASSWORD},
        )
        assert blocked.status_code == 429


def test_health_check(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        assert client.get("/health").json() == {"status": "ok"}


def test_cross_site_cookie_requires_https(tmp_path: Path) -> None:
    try:
        create_app(
            database_path=str(tmp_path / "auth.db"),
            cookie_secure=False,
            cookie_samesite="none",
        )
    except ValueError as error:
        assert "requires AUTH_COOKIE_SECURE=true" in str(error)
    else:
        raise AssertionError("An insecure cross-site cookie configuration was accepted")
