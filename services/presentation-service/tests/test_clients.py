from __future__ import annotations

from uuid import uuid4

import httpx
import pytest

from app.clients import UpstreamClient
from app.config import Settings
from app.errors import ServiceError
from app.schemas import AIGenerateDeckRequest
from tests.conftest import deck_payload


def settings() -> Settings:
    return Settings(
        ai_service_url="http://ai-service:8082",
        document_service_url="http://document-service:8083",
        database_url="postgresql://user:pass@postgres:5432/presentations",
    )


@pytest.mark.asyncio
async def test_get_document_text_maps_missing_document_to_not_found() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(404, json={"error": "missing"}))
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = UpstreamClient(http_client, settings())
        with pytest.raises(ServiceError) as captured:
            await client.get_document_text(str(uuid4()))

    assert captured.value.status_code == 404
    assert captured.value.code == "NOT_FOUND"


@pytest.mark.asyncio
async def test_generate_deck_validates_ai_response() -> None:
    transport = httpx.MockTransport(
        lambda _: httpx.Response(200, json={"title": "Incomplete response"})
    )
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = UpstreamClient(http_client, settings())
        with pytest.raises(ServiceError) as captured:
            await client.generate_deck(
                AIGenerateDeckRequest(
                    topic="A sufficiently long topic",
                    audience="Executives",
                    tone="professional",
                    slide_count=5,
                    source="prompt",
                )
            )

    assert captured.value.status_code == 502
    assert captured.value.code == "AI_FAILURE"


@pytest.mark.asyncio
async def test_generate_deck_uses_member_3_contract() -> None:
    captured_payload: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_payload
        captured_payload = __import__("json").loads(request.content)
        assert request.url.path == "/internal/ai/generate-deck"
        return httpx.Response(200, json=deck_payload())

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
        client = UpstreamClient(http_client, settings())
        result = await client.generate_deck(
            AIGenerateDeckRequest(
                topic="A sufficiently long topic",
                audience="Executives",
                tone="professional",
                slide_count=5,
                source="prompt",
            )
        )

    assert result.title == "Generated Presentation"
    assert captured_payload == {
        "topic": "A sufficiently long topic",
        "audience": "Executives",
        "tone": "professional",
        "slide_count": 5,
        "source": "prompt",
    }
