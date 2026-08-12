from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas import GeneratePresentationRequest, SlideUpdate


def test_prompt_request_requires_topic() -> None:
    with pytest.raises(ValidationError, match="topic is required"):
        GeneratePresentationRequest.model_validate(
            {
                "source": "prompt",
                "audience": "Executives",
                "tone": "professional",
                "slide_count": 6,
            }
        )

def test_document_request_requires_document_id() -> None:
    with pytest.raises(ValidationError, match="document_id is required"):
        GeneratePresentationRequest.model_validate(
            {
                "source": "document",
                "audience": "Students",
                "tone": "academic",
                "slide_count": 6,
            }
        )


def test_source_specific_fields_are_mutually_exclusive() -> None:
    with pytest.raises(ValidationError, match="topic must not be supplied"):
        GeneratePresentationRequest.model_validate(
            {
                "source": "document",
                "topic": "A topic that should not be here",
                "document_id": str(uuid4()),
                "audience": "Students",
                "tone": "academic",
                "slide_count": 6,
            }
        )


def test_slide_count_must_be_an_integer_before_clamping() -> None:
    with pytest.raises(ValidationError):
        GeneratePresentationRequest.model_validate(
            {
                "source": "prompt",
                "topic": "A sufficiently long topic",
                "audience": "Executives",
                "tone": "professional",
                "slide_count": "6",
            }
        )


def test_empty_slide_update_is_rejected() -> None:
    with pytest.raises(ValidationError, match="at least one slide field"):
        SlideUpdate.model_validate({})


def test_null_slide_update_is_rejected() -> None:
    with pytest.raises(ValidationError, match="cannot be null"):
        SlideUpdate.model_validate({"title": None})


def test_unknown_tone_is_rejected() -> None:
    with pytest.raises(ValidationError):
        GeneratePresentationRequest.model_validate(
            {
                "source": "prompt",
                "topic": "A sufficiently long topic",
                "audience": "Executives",
                "tone": "simple",
                "slide_count": 6,
            }
        )
