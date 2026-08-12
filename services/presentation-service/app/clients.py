from __future__ import annotations

import httpx
from pydantic import ValidationError

from app.config import Settings
from app.errors import ai_failure, internal_error, not_found
from app.schemas import (
    AIGenerateDeckRequest,
    AIGenerateDeckResponse,
    AIGenerateSlideRequest,
    DocumentTextResponse,
    Slide,
)


class UpstreamClient:
    def __init__(self, http_client: httpx.AsyncClient, settings: Settings) -> None:
        self.http_client = http_client
        self.settings = settings

    async def get_document_text(self, document_id: str) -> DocumentTextResponse:
        url = (
            f"{self.settings.document_service_base_url}"
            f"/internal/documents/{document_id}/text"
        )
        try:
            response = await self.http_client.get(url)
        except httpx.RequestError as exc:
            raise internal_error(
                "Document Service is unavailable",
                status_code=503,
                upstream_service="document-service",
            ) from exc

        if response.status_code == 404:
            raise not_found(
                "Document expired or was not found",
                document_id=document_id,
            )
        if response.is_error:
            raise internal_error(
                "Document Service request failed",
                status_code=502,
                upstream_service="document-service",
                upstream_status=response.status_code,
            )

        try:
            return DocumentTextResponse.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise internal_error(
                "Document Service returned an invalid response",
                status_code=502,
                upstream_service="document-service",
            ) from exc

    async def generate_deck(
        self,
        request: AIGenerateDeckRequest,
    ) -> AIGenerateDeckResponse:
        url = f"{self.settings.ai_service_base_url}/internal/ai/generate-deck"
        try:
            response = await self.http_client.post(url, json=request.model_dump(mode="json"))
        except httpx.RequestError as exc:
            raise ai_failure(
                "AI Service is unavailable",
                upstream_service="ai-service",
            ) from exc

        self._raise_for_ai_error(response)
        try:
            return AIGenerateDeckResponse.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise ai_failure(
                "AI Service returned an invalid deck",
                status_code=502,
                upstream_service="ai-service",
            ) from exc

    async def generate_slide(self, request: AIGenerateSlideRequest) -> Slide:
        url = f"{self.settings.ai_service_base_url}/internal/ai/generate-slide"
        try:
            response = await self.http_client.post(url, json=request.model_dump(mode="json"))
        except httpx.RequestError as exc:
            raise ai_failure(
                "AI Service is unavailable",
                upstream_service="ai-service",
            ) from exc

        self._raise_for_ai_error(response)
        try:
            return Slide.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise ai_failure(
                "AI Service returned an invalid slide",
                status_code=502,
                upstream_service="ai-service",
            ) from exc

    @staticmethod
    def _raise_for_ai_error(response: httpx.Response) -> None:
        if not response.is_error:
            return
        status_code = 503 if response.status_code >= 500 else 502
        raise ai_failure(
            "AI Service request failed",
            status_code=status_code,
            upstream_service="ai-service",
            upstream_status=response.status_code,
        )
