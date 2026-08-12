from __future__ import annotations

from typing import Any, Literal

ErrorCode = Literal["VALIDATION_ERROR", "NOT_FOUND", "AI_FAILURE", "INTERNAL_ERROR"]


class ServiceError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: ErrorCode,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def not_found(message: str, **details: Any) -> ServiceError:
    return ServiceError(
        status_code=404,
        code="NOT_FOUND",
        message=message,
        details=details,
    )

def ai_failure(message: str, *, status_code: int = 503, **details: Any) -> ServiceError:
    return ServiceError(
        status_code=status_code,
        code="AI_FAILURE",
        message=message,
        details=details,
    )


def internal_error(message: str, *, status_code: int = 500, **details: Any) -> ServiceError:
    return ServiceError(
        status_code=status_code,
        code="INTERNAL_ERROR",
        message=message,
        details=details,
    )
