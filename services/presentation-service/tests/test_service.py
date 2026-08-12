from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.errors import ServiceError
from app.models import PresentationModel
from app.schemas import (
    AIGenerateDeckResponse,
    GeneratePresentationRequest,
    Slide,
    SlideUpdate,
)
from app.service import PresentationService
from tests.conftest import deck_payload, slide_payload


class FakeSession:
    def __init__(self) -> None:
        self.begin_count = 0
        self.rollback_count = 0

    @asynccontextmanager
    async def begin(self):
        self.begin_count += 1
        yield

    async def rollback(self) -> None:
        self.rollback_count += 1


class FakeRepository:
    def __init__(self, presentation: PresentationModel | None = None) -> None:
        self.session = FakeSession()
        self.presentation = presentation
        self.created_slide_count: int | None = None

    async def create_from_generated_deck(self, *, request, slide_count, deck):
        self.created_slide_count = slide_count
        now = datetime.now(UTC)
        presentation = PresentationModel(
            id=uuid4(),
            title=deck.title,
            summary=deck.summary,
            estimated_duration_minutes=deck.estimated_duration_minutes,
            source=request.source.value,
            audience=request.audience,
            tone=request.tone.value,
            slide_count=slide_count,
            status="draft",
            document_id=request.document_id,
            created_at=now,
            updated_at=now,
        )
        from app.models import SlideModel

        presentation.slides = [
            SlideModel(id=uuid4(), presentation_id=presentation.id, **slide.model_dump(mode="json"))
            for slide in deck.slides
        ]
        self.presentation = presentation
        return presentation

    async def get(self, presentation_id):
        if self.presentation is not None and self.presentation.id == presentation_id:
            return self.presentation
        return None

    @staticmethod
    def find_slide(presentation, slide_number):
        return next(
            (slide for slide in presentation.slides if slide.slide_number == slide_number),
            None,
        )

    async def update_slide(self, *, presentation, slide, update):
        for field, value in update.model_dump(exclude_unset=True, mode="json").items():
            setattr(slide, field, value)
        presentation.updated_at = datetime.now(UTC)
        return slide

    async def replace_slide(self, *, presentation, slide, replacement):
        for field, value in replacement.model_dump(
            mode="json", exclude={"slide_number"}
        ).items():
            setattr(slide, field, value)
        presentation.updated_at = datetime.now(UTC)
        return slide


class FakeUpstream:
    def __init__(self, deck: AIGenerateDeckResponse | None = None) -> None:
        self.deck = deck
        self.deck_request = None
        self.slide_request = None

    async def get_document_text(self, document_id):
        from app.schemas import DocumentTextResponse

        return DocumentTextResponse(
            document_id=document_id,
            extracted_text="Full extracted document text",
            char_count=28,
        )

    async def generate_deck(self, request):
        self.deck_request = request
        assert self.deck is not None
        return self.deck

    async def generate_slide(self, request):
        self.slide_request = request
        return Slide.model_validate(slide_payload(request.slide_number, "Regenerated title"))


@pytest.mark.asyncio
async def test_generate_clamps_slide_count_and_persists_transactionally() -> None:
    repository = FakeRepository()
    upstream = FakeUpstream(AIGenerateDeckResponse.model_validate(deck_payload(10)))
    service = PresentationService(repository, upstream)  # type: ignore[arg-type]
    request = GeneratePresentationRequest(
        source="prompt",
        topic="A sufficiently long topic",
        audience="Executives",
        tone="professional",
        slide_count=99,
    )

    result = await service.generate(request)

    assert result.slide_count == 10
    assert len(result.slides) == 10
    assert upstream.deck_request.slide_count == 10
    assert repository.created_slide_count == 10
    assert repository.session.begin_count == 1


@pytest.mark.asyncio
async def test_generate_rejects_incomplete_ai_slide_set() -> None:
    repository = FakeRepository()
    upstream = FakeUpstream(AIGenerateDeckResponse.model_validate(deck_payload(5)))
    service = PresentationService(repository, upstream)  # type: ignore[arg-type]
    request = GeneratePresentationRequest(
        source="prompt",
        topic="A sufficiently long topic",
        audience="Executives",
        tone="professional",
        slide_count=6,
    )

    with pytest.raises(ServiceError) as captured:
        await service.generate(request)

    assert captured.value.code == "AI_FAILURE"
    assert repository.session.begin_count == 0


@pytest.mark.asyncio
async def test_update_slide_changes_only_requested_fields(stored_presentation) -> None:
    repository = FakeRepository(stored_presentation)
    service = PresentationService(repository, FakeUpstream())  # type: ignore[arg-type]

    result = await service.update_slide(
        presentation_id=stored_presentation.id,
        slide_number=2,
        update=SlideUpdate(title="Updated title"),
    )

    assert result.title == "Updated title"
    assert result.key_points == ["Point 2.1", "Point 2.2"]
    assert repository.session.begin_count == 1


@pytest.mark.asyncio
async def test_regenerate_sends_full_member_3_context(stored_presentation) -> None:
    repository = FakeRepository(stored_presentation)
    upstream = FakeUpstream()
    service = PresentationService(repository, upstream)  # type: ignore[arg-type]

    from app.schemas import RegenerateSlideRequest

    result = await service.regenerate_slide(
        presentation_id=stored_presentation.id,
        slide_number=3,
        request=RegenerateSlideRequest(instructions="Make it technical"),
    )

    assert result.title == "Regenerated title"
    assert upstream.slide_request.presentation_context.all_slide_titles == [
        "Slide 1",
        "Slide 2",
        "Slide 3",
        "Slide 4",
        "Slide 5",
    ]
    assert upstream.slide_request.current_slide.title == "Slide 3"
    assert upstream.slide_request.instructions == "Make it technical"
    assert repository.session.rollback_count == 1
    assert repository.session.begin_count == 1


@pytest.mark.asyncio
async def test_get_missing_presentation_returns_not_found() -> None:
    service = PresentationService(FakeRepository(), FakeUpstream())  # type: ignore[arg-type]

    with pytest.raises(ServiceError) as captured:
        await service.get(uuid4())

    assert captured.value.status_code == 404
    assert captured.value.code == "NOT_FOUND"
