from __future__ import annotations

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Path, Request, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients import UpstreamClient
from app.config import Settings, get_settings
from app.database import get_db_session
from app.repository import PresentationRepository
from app.schemas import (
    ErrorResponse,
    GeneratePresentationRequest,
    HealthResponse,
    Presentation,
    RegenerateSlideRequest,
    Slide,
    SlideUpdate,
)
from app.service import PresentationService

router = APIRouter()

SettingsDependency = Annotated[Settings, Depends(get_settings)]
SessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
SlideNumberPath = Annotated[int, Path(ge=1)]

ERROR_RESPONSES = {
    404: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    500: {"model": ErrorResponse},
    502: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}


def get_upstream_client(
    request: Request,
    settings: SettingsDependency,
) -> UpstreamClient:
    http_client: httpx.AsyncClient = request.app.state.http_client
    return UpstreamClient(http_client, settings)


UpstreamDependency = Annotated[UpstreamClient, Depends(get_upstream_client)]


def get_presentation_service(
    session: SessionDependency,
    upstream: UpstreamDependency,
) -> PresentationService:
    return PresentationService(PresentationRepository(session), upstream)


ServiceDependency = Annotated[PresentationService, Depends(get_presentation_service)]


@router.get("/health", response_model=HealthResponse)
async def health(
    response: Response,
    session: SessionDependency,
) -> HealthResponse:
    try:
        await session.execute(text("SELECT 1"))
        database_status = "connected"
    except SQLAlchemyError:
        database_status = "disconnected"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(db=database_status)


@router.post(
    "/internal/presentations/generate",
    response_model=Presentation,
    status_code=status.HTTP_201_CREATED,
    responses=ERROR_RESPONSES,
)
async def generate_presentation(
    payload: GeneratePresentationRequest,
    service: ServiceDependency,
) -> Presentation:
    return await service.generate(payload)


@router.get(
    "/internal/presentations/{presentation_id}",
    response_model=Presentation,
    responses=ERROR_RESPONSES,
)
async def get_presentation(
    presentation_id: UUID,
    service: ServiceDependency,
) -> Presentation:
    return await service.get(presentation_id)


@router.patch(
    "/internal/presentations/{presentation_id}/slides/{slide_number}",
    response_model=Slide,
    responses=ERROR_RESPONSES,
)
async def update_slide(
    presentation_id: UUID,
    payload: SlideUpdate,
    slide_number: SlideNumberPath,
    service: ServiceDependency,
) -> Slide:
    return await service.update_slide(
        presentation_id=presentation_id,
        slide_number=slide_number,
        update=payload,
    )


@router.post(
    "/internal/presentations/{presentation_id}/slides/{slide_number}/regenerate",
    response_model=Slide,
    responses=ERROR_RESPONSES,
)
async def regenerate_slide(
    presentation_id: UUID,
    payload: RegenerateSlideRequest,
    slide_number: SlideNumberPath,
    service: ServiceDependency,
) -> Slide:
    return await service.regenerate_slide(
        presentation_id=presentation_id,
        slide_number=slide_number,
        request=payload,
    )
