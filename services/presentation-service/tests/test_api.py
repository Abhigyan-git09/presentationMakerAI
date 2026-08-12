from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import get_db_session, get_presentation_service, router
from app.errors import ServiceError, not_found
from app.main import handle_service_error, handle_validation_error


def test_validation_errors_use_standard_contract() -> None:
    app = FastAPI()
    app.include_router(router)
    app.add_exception_handler(ServiceError, handle_service_error)
    from fastapi.exceptions import RequestValidationError

    app.add_exception_handler(RequestValidationError, handle_validation_error)
    service = AsyncMock()
    app.dependency_overrides[get_presentation_service] = lambda: service

    with TestClient(app) as client:
        response = client.post(
            "/internal/presentations/generate",
            json={
                "source": "prompt",
                "topic": "short",
                "audience": "Executives",
                "tone": "professional",
                "slide_count": 6,
            },
        )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["message"] == "Request validation failed"
    assert body["error"]["details"]["errors"]


def test_not_found_errors_use_standard_contract() -> None:
    app = FastAPI()
    app.include_router(router)
    app.add_exception_handler(ServiceError, handle_service_error)
    service = AsyncMock()
    service.get.side_effect = not_found("Presentation was not found", presentation_id="id")
    app.dependency_overrides[get_presentation_service] = lambda: service

    with TestClient(app) as client:
        response = client.get(
            "/internal/presentations/02ee560b-e7a4-4ed2-a68f-2fe5ec7f62ef"
        )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "NOT_FOUND",
            "message": "Presentation was not found",
            "details": {"presentation_id": "id"},
        }
    }


def test_health_reports_database_status() -> None:
    app = FastAPI()
    app.include_router(router)
    session = AsyncMock()

    async def session_override():
        yield session

    app.dependency_overrides[get_db_session] = session_override

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "presentation-orchestrator",
        "db": "connected",
    }
