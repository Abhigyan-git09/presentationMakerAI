from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api import router
from app.config import get_settings
from app.errors import ServiceError
from app.schemas import ErrorBody, ErrorResponse

logger = logging.getLogger("presentation-orchestrator")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=settings.upstream_timeout_seconds) as client:
        app.state.http_client = client
        yield


app = FastAPI(
    title="Presentation Orchestrator",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(router)


@app.exception_handler(ServiceError)
async def handle_service_error(_: Request, exc: ServiceError) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorBody(
            code=exc.code,
            message=exc.message,
            details=exc.details,
        )
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    _: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        normalized = {key: value for key, value in error.items() if key != "ctx"}
        errors.append(normalized)
    payload = ErrorResponse(
        error=ErrorBody(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"errors": errors},
        )
    )
    return JSONResponse(status_code=422, content=jsonable_encoder(payload))


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error", exc_info=exc)
    payload = ErrorResponse(
        error=ErrorBody(
            code="INTERNAL_ERROR",
            message="An unexpected internal error occurred",
        )
    )
    return JSONResponse(status_code=500, content=payload.model_dump(mode="json"))
