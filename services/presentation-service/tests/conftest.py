from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models import PresentationModel, SlideModel
from app.schemas import AIGenerateDeckResponse


def slide_payload(slide_number: int = 1, title: str | None = None) -> dict:
    return {
        "slide_number": slide_number,
        "title": title or f"Slide {slide_number}",
        "key_points": [f"Point {slide_number}.1", f"Point {slide_number}.2"],
        "speaker_notes": f"Speaker notes for slide {slide_number}",
        "visual_recommendation": {
            "type": "diagram",
            "description": f"Diagram for slide {slide_number}",
            "search_keywords": ["architecture", "flow"],
        },
        "audience_questions": [
            {
                "question": f"Question for slide {slide_number}?",
                "suggested_answer": "A useful answer.",
            }
        ],
    }


def deck_payload(slide_count: int = 5) -> dict:
    return {
        "title": "Generated Presentation",
        "summary": "A concise generated summary.",
        "estimated_duration_minutes": 10,
        "slides": [slide_payload(number) for number in range(1, slide_count + 1)],
    }


@pytest.fixture
def generated_deck() -> AIGenerateDeckResponse:
    return AIGenerateDeckResponse.model_validate(deck_payload())


@pytest.fixture
def stored_presentation() -> PresentationModel:
    now = datetime.now(UTC)
    presentation = PresentationModel(
        id=uuid4(),
        title="Stored Presentation",
        summary="Stored summary",
        estimated_duration_minutes=10,
        source="prompt",
        audience="Engineering leaders",
        tone="professional",
        slide_count=5,
        status="draft",
        created_at=now,
        updated_at=now,
    )
    presentation.slides = [
        SlideModel(id=uuid4(), presentation_id=presentation.id, **slide_payload(number))
        for number in range(1, 6)
    ]
    return presentation
